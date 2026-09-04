"""Scan management routes."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db, get_scan_scheduler
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import Finding, Repository, Scan, ScanStatus
from app.schemas.finding import FindingRead
from app.schemas.scan import ScanCreate, ScanDetail, ScanRead

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanRead, status_code=status.HTTP_201_CREATED)
async def create_scan(
    payload: ScanCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    scheduler=Depends(get_scan_scheduler),
):
    """Start a new scan for a repository and schedule it in the background."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "create_scan"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_scan

        await assert_can_scan(db, current_user)
    # Verify repository ownership
    repo_result = await db.execute(
        select(Repository).where(
            Repository.id == payload.repository_id,
            Repository.owner_id == current_user.id,
        )
    )
    repository = repo_result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    if repository.status in ("ingesting",):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository is currently being ingested by another scan",
        )

    scan = Scan(
        repository_id=payload.repository_id,
        configuration=payload.configuration,
        status=ScanStatus.pending,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    scheduler(scan.id)
    return scan


@router.get("", response_model=list[ScanRead])
async def list_scans(
    repository_id: uuid.UUID | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List scans, optionally filtered by repository."""
    query = select(Scan).join(Repository).where(Repository.owner_id == current_user.id)
    if repository_id:
        query = query.where(Scan.repository_id == repository_id)
    query = query.order_by(Scan.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{scan_id}/findings", response_model=list[FindingRead])
async def get_scan_findings(
    scan_id: uuid.UUID,
    severity: str | None = None,
    status: str | None = None,
    limit: int = Query(default=200, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the findings produced by one scan (ownership-scoped)."""
    scan_result = await db.execute(
        select(Scan).join(Repository).where(Scan.id == scan_id, Repository.owner_id == current_user.id)
    )
    if scan_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    query = select(Finding).where(Finding.scan_id == scan_id)
    if severity:
        query = query.where(Finding.severity == severity)
    if status:
        query = query.where(Finding.status == status)
    query = query.order_by(Finding.created_at.asc()).limit(min(limit, 500)).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{scan_id}", response_model=ScanDetail)
async def get_scan(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single scan with its analysis runs."""
    result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.analysis_runs))
        .join(Repository)
        .where(
            Scan.id == scan_id,
            Repository.owner_id == current_user.id,
        )
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")
    return scan


@router.get("/{scan_id}/report")
async def get_scan_report(
    scan_id: uuid.UUID,
    format: str = "json",
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Full audit report for a scan in JSON or Markdown (``?format=json|markdown``)."""
    from app.services.reporting import build_scan_report, render_markdown

    report = await build_scan_report(db, scan_id, current_user.id)
    if report is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if format == "markdown":
        md = render_markdown(report)
        filename = f"repoverix-report-{scan_id}.md"
        return Response(
            content=md,
            media_type="text/markdown; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    if format != "json":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="format must be 'json' or 'markdown'",
        )
    return Response(
        content=json.dumps(report, indent=2, default=str),
        media_type="application/json",
    )


@router.post("/{scan_id}/cancel", response_model=ScanRead)
async def cancel_scan(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cancel a running or pending scan."""
    result = await db.execute(
        select(Scan)
        .join(Repository)
        .where(
            Scan.id == scan_id,
            Repository.owner_id == current_user.id,
        )
    )
    scan = result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    if scan.status not in (ScanStatus.pending, ScanStatus.running):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel scan with status {scan.status.value}",
        )

    scan.status = ScanStatus.failed
    from datetime import UTC, datetime

    scan.finished_at = datetime.now(UTC)
    scan.error = "Cancelled by user"
    await db.commit()
    await db.refresh(scan)

    # signal the background orchestrator to stop at the next stage boundary
    from app.analysis import runtime

    runtime.request_cancel(scan.id)
    return scan
