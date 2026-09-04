"""Patch and verification routes."""

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db, get_verification_scheduler
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import Finding, Patch, Repository, Scan, VerificationRun, VerificationStatus
from app.schemas.verification import PatchRead, VerificationRunDetail, VerificationRunRead

router = APIRouter(prefix="/patches", tags=["patches"])


@router.get("", response_model=list[PatchRead])
async def list_patches(
    finding_id: uuid.UUID | None = None,
    scan_id: uuid.UUID | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List patches with optional filters."""
    query = (
        select(Patch).join(Finding).join(Scan).join(Repository).where(Repository.owner_id == current_user.id)
    )

    if finding_id:
        query = query.where(Patch.finding_id == finding_id)
    if scan_id:
        query = query.where(Finding.scan_id == scan_id)
    if status:
        query = query.where(Patch.status == status)

    query = query.order_by(Patch.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{patch_id}", response_model=PatchRead)
async def get_patch(
    patch_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single patch by ID."""
    result = await db.execute(
        select(Patch)
        .join(Finding)
        .join(Scan)
        .join(Repository)
        .where(
            Patch.id == patch_id,
            Repository.owner_id == current_user.id,
        )
    )
    patch = result.scalar_one_or_none()
    if patch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patch not found")
    return patch


@router.get("/{patch_id}/verifications", response_model=list[VerificationRunRead])
async def list_verification_runs(
    patch_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List verification runs for a patch."""
    # Verify patch ownership
    patch_result = await db.execute(
        select(Patch)
        .join(Finding)
        .join(Scan)
        .join(Repository)
        .where(
            Patch.id == patch_id,
            Repository.owner_id == current_user.id,
        )
    )
    patch = patch_result.scalar_one_or_none()
    if patch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patch not found")

    result = await db.execute(
        select(VerificationRun)
        .where(VerificationRun.patch_id == patch_id)
        .order_by(VerificationRun.created_at.desc())
    )
    return list(result.scalars().all())


@router.post("/{patch_id}/verify", response_model=VerificationRunRead, status_code=status.HTTP_201_CREATED)
async def verify_patch(
    patch_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    scheduler=Depends(get_verification_scheduler),
):
    """Create a verification run for a candidate patch and schedule it.

    Execution happens inside an isolated sandbox (Docker in production); the
    original repository is never modified. Sandbox runs are rate limited per
    user because they consume host resources.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "verify_patch"))
    result = await db.execute(
        select(Patch)
        .options(selectinload(Patch.finding))
        .join(Finding)
        .join(Scan)
        .join(Repository)
        .where(
            Patch.id == patch_id,
            Repository.owner_id == current_user.id,
        )
    )
    patch = result.scalar_one_or_none()
    if patch is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patch not found")

    active = await db.execute(
        select(VerificationRun).where(
            VerificationRun.patch_id == patch_id,
            VerificationRun.status.in_([VerificationStatus.pending, VerificationStatus.running]),
        )
    )
    if active.scalar_one_or_none() is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A verification run for this patch is already pending or running",
        )

    run = VerificationRun(
        patch_id=patch_id,
        status=VerificationStatus.pending,
        started_at=datetime.now(UTC),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    scheduler(run.id)
    return run


@router.get("/verification/{verification_id}", response_model=VerificationRunDetail)
async def get_verification_run(
    verification_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single verification run with test results."""
    result = await db.execute(
        select(VerificationRun)
        .options(selectinload(VerificationRun.test_results))
        .join(Patch)
        .join(Finding)
        .join(Scan)
        .join(Repository)
        .where(
            VerificationRun.id == verification_id,
            Repository.owner_id == current_user.id,
        )
    )
    verification = result.scalar_one_or_none()
    if verification is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Verification run not found")
    return verification
