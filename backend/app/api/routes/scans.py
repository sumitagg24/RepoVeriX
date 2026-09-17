"""Scan management routes."""

import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db, get_scan_scheduler, get_verified_user
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import Finding, Repository, Scan, ScanConfiguration, ScanStatus
from app.schemas.finding import FindingRead
from app.schemas.scan import ScanCreate, ScanDetail, ScanRead

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanRead, status_code=status.HTTP_201_CREATED)
async def create_scan(
    payload: ScanCreate,
    request: Request,
    current_user=Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
    scheduler=Depends(get_scan_scheduler),
):
    """Start a new scan for a repository and schedule it in the background.

    Idempotency: a client may send an ``Idempotency-Key`` header so a retried
    request (network timeout, double-click, retry button) never queues two
    scans for the same action — the original scan is returned instead of a
    duplicate being created. Keys are scoped per user and never expire, so a
    retried request weeks later still resolves to its original scan.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "create_scan"))
    configuration = payload.configuration or ScanConfiguration.repoverix
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_scan, require_llm_scan_config

        await assert_can_scan(db, current_user)
        await require_llm_scan_config(db, current_user, configuration)
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

    idempotency_key = request.headers.get("idempotency-key", "").strip()
    if len(idempotency_key) > 128:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Idempotency-Key must be at most 128 characters",
        )
    if idempotency_key:
        existing = (
            await db.execute(
                select(Scan)
                .join(Repository, Repository.id == Scan.repository_id)
                .where(
                    Repository.owner_id == current_user.id,
                    Scan.idempotency_key == idempotency_key,
                )
            )
        ).scalar_one_or_none()
        if existing is not None:
            return existing

    scan = Scan(
        repository_id=payload.repository_id,
        configuration=configuration,
        status=ScanStatus.pending,
        idempotency_key=idempotency_key or None,
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
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "reports")
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
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
                # Scan artifacts are immutable once produced; allow short private
                # caching so repeat downloads (CDN / browser back) stay cheap.
                "Cache-Control": "private, max-age=300",
            },
        )
    if format != "json":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="format must be 'json' or 'markdown'",
        )
    return Response(
        content=json.dumps(report, indent=2, default=str),
        media_type="application/json",
        headers={"Cache-Control": "private, max-age=300"},
    )


@router.get("/{scan_id}/sarif")
async def get_scan_sarif(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Export the scan's findings as SARIF 2.1.0 (GitHub Code Scanning, VS Code…)."""
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "sarif-export")
    from app.analysis import ingest
    from app.services.sarif import build_sarif

    scan_result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.repository))
        .join(Repository)
        .where(Scan.id == scan_id, Repository.owner_id == current_user.id)
    )
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    result = await db.execute(
        select(Finding).options(selectinload(Finding.evidence)).where(Finding.scan_id == scan.id)
    )
    findings = list(result.scalars().all())

    src = ingest.source_dir(str(scan.repository.id))
    source_root = src if src.exists() else None
    document = build_sarif(findings, scan, source_root)
    filename = f"repoverix-{scan_id}.sarif"
    return Response(
        content=json.dumps(document, indent=2, default=str),
        media_type="application/sarif+json",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "private, max-age=300",
        },
    )


@router.get("/{scan_id}/dedup")
async def get_scan_dedup(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Duplicate-finding clusters within one scan (same location, multiple tools)."""
    from app.analysis import regression

    scan_result = await db.execute(
        select(Scan).join(Repository).where(Scan.id == scan_id, Repository.owner_id == current_user.id)
    )
    if scan_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    result = await db.execute(
        select(Finding).options(selectinload(Finding.evidence)).where(Finding.scan_id == scan_id)
    )
    findings = list(result.scalars().all())
    clusters = regression.dedup_clusters(findings)
    return {
        "scan_id": str(scan_id),
        "total_findings": len(findings),
        "cluster_count": len(clusters),
        "duplicated_findings": sum(c["size"] for c in clusters),
        "clusters": clusters,
    }


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
