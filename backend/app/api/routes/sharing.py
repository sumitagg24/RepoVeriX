"""Report sharing routes.

Authenticated (owner-only) share management under ``/scans/{id}/share`` and a
deliberately separate, unauthenticated public surface at
``/public/reports/{token}`` that only ever serves the sanitised report from
``app.services.sharing.build_public_report``.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_public_rate, enforce
from app.db.models import ReportShare, Repository, Scan
from app.services import sharing

router = APIRouter(tags=["sharing"])
public_router = APIRouter(prefix="/public", tags=["public"])


class ShareCreateRequest(BaseModel):
    """Optional expiry in days (1–365); omit for a never-expiring link."""

    expiry_days: int | None = Field(default=None, ge=1, le=365)


class ShareResponse(BaseModel):
    share_id: str
    url: str
    token: str
    expires_at: datetime | None
    revoked_at: datetime | None
    view_count: int
    created_at: datetime | None


def _frontend_url() -> str:
    return get_settings().frontend_url.rstrip("/")


def _to_response(share: ReportShare) -> ShareResponse:
    return ShareResponse(
        share_id=str(share.id),
        # The UI route renders the shared report; the API route stays public.
        url=f"{_frontend_url()}/share/{share.token}",
        token=share.token,
        expires_at=share.expires_at,
        revoked_at=share.revoked_at,
        view_count=share.view_count,
        created_at=share.created_at,
    )


async def _owned_scan_id(db: AsyncSession, scan_id: uuid.UUID, user_id) -> bool:
    result = await db.execute(
        select(Scan.id)
        .join(Repository, Repository.id == Scan.repository_id)
        .where(Scan.id == scan_id, Repository.owner_id == user_id)
    )
    return result.scalar_one_or_none() is not None


@router.post("/scans/{scan_id}/share", response_model=ShareResponse, status_code=status.HTTP_201_CREATED)
async def create_report_share(
    scan_id: uuid.UUID,
    payload: ShareCreateRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ShareResponse:
    """Create a new secret-URL share for a scan report (revokes prior links)."""
    days = payload.expiry_days if payload else None
    try:
        share = await sharing.create_share(db, scan_id, current_user.id, days)
    except LookupError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found") from None
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="expiry_days must be between 1 and 365",
        ) from None
    return _to_response(share)


@router.get("/scans/{scan_id}/share", response_model=list[ShareResponse])
async def list_report_shares(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ShareResponse]:
    """List the shares created for a scan the caller owns."""
    if not await _owned_scan_id(db, scan_id, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    shares = (
        (
            await db.execute(
                select(ReportShare)
                .where(ReportShare.scan_id == scan_id)
                .order_by(ReportShare.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [_to_response(s) for s in shares]


@router.delete("/shares/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_report_share(
    share_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Revoke a share — the secret URL stops resolving immediately."""
    result = await db.execute(
        select(ReportShare)
        .join(Scan, Scan.id == ReportShare.scan_id)
        .join(Repository, Repository.id == Scan.repository_id)
        .where(ReportShare.id == share_id, Repository.owner_id == current_user.id)
    )
    share = result.scalar_one_or_none()
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Share not found")
    if share.revoked_at is None:
        share.revoked_at = datetime.now(UTC)
        await db.commit()


@public_router.get("/reports/{token}")
async def get_public_report(
    token: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict[str, Any]:
    """Serve the sanitised report for a valid share token.

    Public (no auth) but rate-limited per IP; tokens are 256-bit secrets so
    enumeration is infeasible, and the payload strips code, snippets, source
    URLs and usage data.
    """
    current = get_settings()
    if current.rate_limit_enabled:
        enforce(check_public_rate(request))

    if not token or len(token) > 128:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    share = await sharing.resolve_share(db, token)
    if share is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    report = await sharing.build_public_report(db, share)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")

    await sharing.record_view(db, share)
    report["share"] = {
        "view_count": share.view_count + 1,
        "expires_at": share.expires_at.isoformat() if share.expires_at else None,
    }
    return report
