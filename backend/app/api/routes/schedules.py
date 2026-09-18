"""Scheduled (recurring) scan management routes.

- ``GET    /repositories/{id}/schedule``  get the current schedule (or 404)
- ``PUT    /repositories/{id}/schedule``  upsert a schedule
- ``PATCH  /repositories/{id}/schedule``  toggle enabled / change interval
- ``DELETE /repositories/{id}/schedule``  delete the schedule

One schedule per repository.  The scheduler tick fires a new scan when
``next_run_at`` passes and then advances the window by ``interval_hours``.
``enabled=false`` pauses the schedule without deleting it.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db, get_verified_user
from app.db.models import Repository, ScanConfiguration, ScheduledScan, User
from app.services import access

router = APIRouter(prefix="/repositories", tags=["schedules"])

_MIN_HOURS = 1
_MAX_HOURS = 720  # 30 days


class ScheduleUpsertRequest(BaseModel):
    interval_hours: int = Field(default=24, ge=_MIN_HOURS, le=_MAX_HOURS)
    configuration: ScanConfiguration = ScanConfiguration.repoverix
    enabled: bool = True
    # Optional: override the first run time (ISO-8601 UTC).  Defaults to
    # now + interval_hours so the first run is one full period away.
    first_run_at: datetime | None = None


class SchedulePatchRequest(BaseModel):
    enabled: bool | None = None
    interval_hours: int | None = Field(default=None, ge=_MIN_HOURS, le=_MAX_HOURS)
    configuration: ScanConfiguration | None = None


def _serialize(s: ScheduledScan) -> dict:
    return {
        "id": str(s.id),
        "repository_id": str(s.repository_id),
        "enabled": s.enabled,
        "interval_hours": s.interval_hours,
        "configuration": s.configuration.value,
        "next_run_at": s.next_run_at.isoformat(),
        "last_run_at": s.last_run_at.isoformat() if s.last_run_at else None,
        "last_scan_id": str(s.last_scan_id) if s.last_scan_id else None,
        "created_at": s.created_at.isoformat(),
        "updated_at": s.updated_at.isoformat(),
    }


async def _load_repo(
    repository_id: uuid.UUID, db: AsyncSession, user: User
) -> Repository:
    try:
        return await access.load_repository(db, repository_id, user.id)
    except access.AccessDenied:
        raise HTTPException(status_code=404, detail="Repository not found") from None


@router.get("/{repository_id}/schedule")
async def get_schedule(
    repository_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the recurring scan schedule for this repository."""
    await _load_repo(repository_id, db, current_user)
    sched = (
        await db.execute(select(ScheduledScan).where(ScheduledScan.repository_id == repository_id))
    ).scalar_one_or_none()
    if sched is None:
        raise HTTPException(status_code=404, detail="No schedule configured for this repository")
    return _serialize(sched)


@router.put("/{repository_id}/schedule", status_code=status.HTTP_200_OK)
async def upsert_schedule(
    repository_id: uuid.UUID,
    payload: ScheduleUpsertRequest,
    current_user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Create or replace the recurring scan schedule.

    Replaces the existing schedule if one exists; the interval and configuration
    can change.  ``next_run_at`` is reset to ``first_run_at`` (if given) or
    ``now + interval_hours``.
    """
    await _load_repo(repository_id, db, current_user)
    if not await access.can_manage(db, await _load_repo(repository_id, db, current_user), current_user.id):
        raise HTTPException(status_code=403, detail="Manager role required to configure schedules")

    now = datetime.now(UTC)
    first_run = payload.first_run_at or (now + timedelta(hours=payload.interval_hours))
    # Clamp first_run to the future.
    if first_run <= now:
        first_run = now + timedelta(hours=payload.interval_hours)

    existing = (
        await db.execute(select(ScheduledScan).where(ScheduledScan.repository_id == repository_id))
    ).scalar_one_or_none()

    if existing is not None:
        existing.interval_hours = payload.interval_hours
        existing.configuration = payload.configuration
        existing.enabled = payload.enabled
        existing.next_run_at = first_run
        await db.commit()
        await db.refresh(existing)
        return _serialize(existing)

    sched = ScheduledScan(
        repository_id=repository_id,
        interval_hours=payload.interval_hours,
        configuration=payload.configuration,
        enabled=payload.enabled,
        next_run_at=first_run,
    )
    db.add(sched)
    await db.commit()
    await db.refresh(sched)
    return _serialize(sched)


@router.patch("/{repository_id}/schedule")
async def patch_schedule(
    repository_id: uuid.UUID,
    payload: SchedulePatchRequest,
    current_user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Partially update a schedule (toggle enabled, change interval, etc.)."""
    repo = await _load_repo(repository_id, db, current_user)
    if not await access.can_manage(db, repo, current_user.id):
        raise HTTPException(status_code=403, detail="Manager role required to configure schedules")

    sched = (
        await db.execute(select(ScheduledScan).where(ScheduledScan.repository_id == repository_id))
    ).scalar_one_or_none()
    if sched is None:
        raise HTTPException(status_code=404, detail="No schedule configured for this repository")

    if payload.enabled is not None:
        sched.enabled = payload.enabled
    if payload.interval_hours is not None:
        sched.interval_hours = payload.interval_hours
        # Recalculate next run based on the new interval from last run (or now).
        base = sched.last_run_at or datetime.now(UTC)
        sched.next_run_at = base + timedelta(hours=payload.interval_hours)
    if payload.configuration is not None:
        sched.configuration = payload.configuration

    await db.commit()
    await db.refresh(sched)
    return _serialize(sched)


@router.delete("/{repository_id}/schedule", status_code=status.HTTP_204_NO_CONTENT)
async def delete_schedule(
    repository_id: uuid.UUID,
    current_user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete the recurring scan schedule for this repository."""
    repo = await _load_repo(repository_id, db, current_user)
    if not await access.can_manage(db, repo, current_user.id):
        raise HTTPException(status_code=403, detail="Manager role required to configure schedules")

    sched = (
        await db.execute(select(ScheduledScan).where(ScheduledScan.repository_id == repository_id))
    ).scalar_one_or_none()
    if sched is None:
        raise HTTPException(status_code=404, detail="No schedule configured for this repository")
    await db.delete(sched)
    await db.commit()
