"""Scan management routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.db.models import Repository, Scan, ScanStatus
from app.schemas.scan import ScanCreate, ScanDetail, ScanRead

router = APIRouter(prefix="/scans", tags=["scans"])


@router.post("", response_model=ScanRead, status_code=status.HTTP_201_CREATED)
async def create_scan(
    payload: ScanCreate,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Start a new scan for a repository."""
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

    scan = Scan(
        repository_id=payload.repository_id,
        configuration=payload.configuration,
        status=ScanStatus.pending,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)
    return scan


@router.get("", response_model=list[ScanRead])
async def list_scans(
    repository_id: uuid.UUID | None = None,
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List scans, optionally filtered by repository."""
    query = select(Scan).join(Repository).where(Repository.owner_id == current_user.id)
    if repository_id:
        query = query.where(Scan.repository_id == repository_id)
    query = query.order_by(Scan.created_at.desc())

    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{scan_id}", response_model=ScanDetail)
async def get_scan(
    scan_id: uuid.UUID,
    current_user = Depends(get_current_user),
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


@router.post("/{scan_id}/cancel", response_model=ScanRead)
async def cancel_scan(
    scan_id: uuid.UUID,
    current_user = Depends(get_current_user),
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
    return scan