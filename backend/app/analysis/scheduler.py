"""Recurring-scan scheduler.

Runs a lightweight in-process tick loop that fires scheduled scans when their
``next_run_at`` has passed.  The tick runs every ``TICK_INTERVAL_SECONDS``
(default 60 s) inside the same asyncio event loop as the API.

Design constraints
------------------
- One pending/running scan per repository is allowed at a time.  If a scan
  is already in-flight the tick skips that schedule and does *not* advance
  ``next_run_at`` so the attempt is retried on the next tick.
- Schedules are row-level locked (``SELECT … FOR UPDATE SKIP LOCKED``) so a
  future multi-worker deployment can run multiple scheduler replicas without
  double-firing.  SQLite falls back to ordinary SELECT (SKIP LOCKED is a
  no-op there).
- The loop exits cleanly on asyncio cancellation (SIGINT / shutdown).
- All exceptions inside the tick are caught and logged so a single bad
  schedule never kills the loop.

Startup
-------
``start_scheduler(session_factory)`` is called from the FastAPI lifespan
handler.  It returns immediately after registering the background task; the
loop runs until the process exits.

``stop_scheduler()`` requests a clean shutdown and awaits the task.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

logger = logging.getLogger("repoverix.scheduler")

TICK_INTERVAL_SECONDS = 60

_task: asyncio.Task | None = None
_stop_event: asyncio.Event | None = None


# --------------------------------------------------------------------------- public API


def start_scheduler(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """Register the tick loop as a background task.  Safe to call once only."""
    global _task, _stop_event
    if _task is not None and not _task.done():
        return  # already running
    _stop_event = asyncio.Event()
    loop = asyncio.get_event_loop()
    _task = loop.create_task(_loop(session_factory, _stop_event), name="scheduled-scan-loop")
    logger.info("Scheduled-scan tick loop started (interval=%ds)", TICK_INTERVAL_SECONDS)


async def stop_scheduler() -> None:
    """Signal the tick loop to stop and wait for it to finish."""
    global _task, _stop_event
    if _stop_event is not None:
        _stop_event.set()
    if _task is not None and not _task.done():
        try:
            await asyncio.wait_for(_task, timeout=10)
        except (asyncio.TimeoutError, asyncio.CancelledError):
            _task.cancel()
    logger.info("Scheduled-scan tick loop stopped")


# --------------------------------------------------------------------------- internal


async def _loop(
    session_factory: async_sessionmaker[AsyncSession],
    stop: asyncio.Event,
) -> None:
    """Main tick loop: check for due schedules every ``TICK_INTERVAL_SECONDS``."""
    while not stop.is_set():
        try:
            await _tick(session_factory)
        except asyncio.CancelledError:
            break
        except Exception:  # pragma: no cover
            logger.exception("scheduler tick error (continuing)")
        # Wait for the interval or until stop is signalled.
        try:
            await asyncio.wait_for(stop.wait(), timeout=TICK_INTERVAL_SECONDS)
        except asyncio.TimeoutError:
            pass  # normal — interval elapsed


async def _tick(session_factory: async_sessionmaker[AsyncSession]) -> None:
    """One scheduler tick: fire all overdue, enabled schedules."""
    from app.db.models import Scan, ScanStatus, ScheduledScan

    now = datetime.now(UTC)
    async with session_factory() as db:
        # Fetch schedules that are due and enabled.
        # SKIP LOCKED ensures only one scheduler replica acts on each row.
        try:
            stmt = (
                select(ScheduledScan)
                .where(
                    ScheduledScan.enabled.is_(True),
                    ScheduledScan.next_run_at <= now,
                )
                .with_for_update(skip_locked=True)
            )
            result = await db.execute(stmt)
        except Exception:
            # SQLite doesn't support FOR UPDATE; fall back without locking.
            stmt = select(ScheduledScan).where(
                ScheduledScan.enabled.is_(True),
                ScheduledScan.next_run_at <= now,
            )
            result = await db.execute(stmt)

        schedules = list(result.scalars().all())
        if not schedules:
            return

        for schedule in schedules:
            await _fire_schedule(db, schedule, now)


async def _fire_schedule(db: AsyncSession, schedule, now: datetime) -> None:
    """Attempt to start a scan for one due schedule."""
    from app.db.models import Scan, ScanStatus

    repository_id: uuid.UUID = schedule.repository_id
    interval_hours: int = max(1, min(720, schedule.interval_hours))

    # Skip if a scan is already pending or running for this repository.
    in_flight = (
        await db.execute(
            select(Scan.id).where(
                Scan.repository_id == repository_id,
                Scan.status.in_([ScanStatus.pending, ScanStatus.running]),
            )
        )
    ).first()

    if in_flight is not None:
        logger.debug(
            "scheduler: skip repository=%s — scan %s already in-flight",
            repository_id,
            in_flight[0],
        )
        return

    # Create the scan row.
    scan = Scan(
        repository_id=repository_id,
        configuration=schedule.configuration,
        status=ScanStatus.pending,
        idempotency_key=f"scheduled:{schedule.id}:{now.date().isoformat()}",
    )
    db.add(scan)

    # Advance the schedule.
    schedule.last_run_at = now
    schedule.next_run_at = now + timedelta(hours=interval_hours)
    schedule.last_scan_id = None  # will be set below once we have the ID

    await db.flush()  # assign scan.id
    schedule.last_scan_id = scan.id
    await db.commit()

    logger.info(
        "scheduler: triggered scan=%s for repository=%s (interval=%dh, next=%s)",
        scan.id,
        repository_id,
        interval_hours,
        schedule.next_run_at.isoformat(),
    )

    # Schedule the background pipeline (same as the API route does).
    from app.analysis import runtime as scan_runtime
    from app.analysis.orchestrate import run_scan
    from app.db.database import SessionLocal

    scan_runtime.schedule_scan(scan.id, lambda sid: run_scan(SessionLocal, sid))
