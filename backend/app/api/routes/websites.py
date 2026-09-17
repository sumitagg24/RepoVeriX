"""Passive website-audit routes.

Authorization model: websites are personal resources — owner-only. A user
who does not own the website gets the same 404 as an anonymous request
(IDOR guard). Audit creation is rate-limited and SSRF-validated; the audit
itself runs in the background via the same scheduler seam as repository
scans.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis.webcrawler import UnsafeURLError, normalize_url
from app.api.dependencies import (
    get_current_user,
    get_db,
    get_verified_user,
    get_website_audit_scheduler,
)
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.core.ssrf import validate_url
from app.db.models import Website, WebsiteAudit
from app.schemas.website import (
    WebsiteAuditCreate,
    WebsiteAuditDetail,
    WebsiteAuditRead,
    WebsiteCreate,
    WebsiteRead,
)

router = APIRouter(prefix="/websites", tags=["websites"])


async def _load_website(db: AsyncSession, website_id: uuid.UUID, user_id) -> Website:
    website = (await db.execute(select(Website).where(Website.id == website_id))).scalar_one_or_none()
    if website is None or website.owner_id != user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Website not found")
    return website


@router.post("", response_model=WebsiteRead, status_code=status.HTTP_201_CREATED)
async def register_website(
    payload: WebsiteCreate,
    current_user=Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a public website for passive auditing."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "register_website"))
    try:
        normalized = normalize_url(payload.url)
    except UnsafeURLError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)) from exc
    # SSRF gate on the *resolved* host — rejects private/loopback/metadata.
    decision = validate_url(normalized)
    if not decision.allowed:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=decision.reason)
    hostname = normalized.split("://", 1)[1].split(":", 1)[0].rstrip("/")
    existing = (
        await db.execute(
            select(Website).where(Website.owner_id == current_user.id, Website.url == normalized)
        )
    ).scalar_one_or_none()
    if existing is not None:
        return existing  # idempotent registration
    website = Website(owner_id=current_user.id, url=normalized, hostname=hostname)
    db.add(website)
    await db.commit()
    await db.refresh(website)
    return website


@router.get("", response_model=list[WebsiteRead])
async def list_websites(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the caller's registered websites."""
    rows = (
        (
            await db.execute(
                select(Website).where(Website.owner_id == current_user.id).order_by(Website.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


@router.delete("/{website_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_website(
    website_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a website and its audits (owner-only)."""
    website = await _load_website(db, website_id, current_user.id)
    await db.delete(website)
    await db.commit()


@router.post("/{website_id}/audits", response_model=WebsiteAuditRead, status_code=status.HTTP_202_ACCEPTED)
async def create_audit(
    website_id: uuid.UUID,
    payload: WebsiteAuditCreate,
    scheduler=Depends(get_website_audit_scheduler),
    current_user=Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a passive audit of a registered website (runs in background)."""
    website = await _load_website(db, website_id, current_user.id)
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "create_webaudit"))
    # Only one live audit per website: prevents duplicate crawls hammering a target.
    running = (
        await db.execute(
            select(WebsiteAudit).where(
                WebsiteAudit.website_id == website_id,
                WebsiteAudit.status.in_(("pending", "running")),
            )
        )
    ).scalar_one_or_none()
    if running is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An audit is already running for this website",
        )
    audit = WebsiteAudit(
        website_id=website.id,
        status="pending",
        max_pages=payload.max_pages,
        max_depth=payload.max_depth,
    )
    db.add(audit)
    await db.commit()
    await db.refresh(audit)
    scheduler(audit.id)
    return audit


@router.get("/{website_id}/audits", response_model=list[WebsiteAuditRead])
async def list_audits(
    website_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Audit history for one website (newest first)."""
    await _load_website(db, website_id, current_user.id)
    rows = (
        (
            await db.execute(
                select(WebsiteAudit)
                .where(WebsiteAudit.website_id == website_id)
                .order_by(WebsiteAudit.created_at.desc())
                .limit(limit)
            )
        )
        .scalars()
        .all()
    )
    return list(rows)


@router.get("/{website_id}/audits/{audit_id}", response_model=WebsiteAuditDetail)
async def get_audit(
    website_id: uuid.UUID,
    audit_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full audit detail: scores, findings, evidence, crawled pages."""
    await _load_website(db, website_id, current_user.id)
    audit = (
        await db.execute(
            select(WebsiteAudit).where(WebsiteAudit.id == audit_id, WebsiteAudit.website_id == website_id)
        )
    ).scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Audit not found")
    return audit
