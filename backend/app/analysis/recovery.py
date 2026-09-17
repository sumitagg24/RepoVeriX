"""Startup job recovery.

The MVP schedules scans and verification runs as in-process background tasks
(see ``runtime.py``). If the process dies mid-run, those rows would otherwise
stay ``running``/``pending`` forever — making the UI show jobs that will never
finish and blocking future cancels/duplicate checks.

At startup we reconcile every such row to a terminal, honest state:

- Scans:        ``pending``/``running``  -> ``failed`` ("interrupted by restart")
- Verifications: ``pending``/``running`` -> ``repair_not_verified``

Rows already terminal (completed/failed/verified…) are left untouched, and a
failure here must never prevent the API from starting.
"""

from __future__ import annotations

import logging
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.db.models import Scan, ScanStatus, VerificationRun, VerificationStatus

logger = logging.getLogger("repoverix.recovery")

_RECOVER_SCAN_ERROR = "Scan interrupted by a server restart before it finished — run a new scan to retry."
_RECOVER_VERIFY_LOG = (
    "Verification interrupted by a server restart before it finished — verify again to retry."
)


async def recover_stale_jobs(session_factory: async_sessionmaker[AsyncSession]) -> dict[str, int]:
    """Mark interrupted jobs as failed so no row is permanently stuck running.

    Returns ``{"scans_recovered": int, "verifications_recovered": int}``.
    """
    now = datetime.now(UTC)
    scans_recovered = 0
    verifications_recovered = 0

    async with session_factory() as db:
        scan_result = await db.execute(
            select(Scan).where(Scan.status.in_([ScanStatus.pending, ScanStatus.running]))
        )
        for scan in scan_result.scalars().all():
            scan.status = ScanStatus.failed
            scan.finished_at = now
            scan.error = _RECOVER_SCAN_ERROR
            scans_recovered += 1
            logger.warning("recovered interrupted scan scan_id=%s", scan.id)

        verify_result = await db.execute(
            select(VerificationRun).where(
                VerificationRun.status.in_([VerificationStatus.pending, VerificationStatus.running])
            )
        )
        for run in verify_result.scalars().all():
            run.status = VerificationStatus.repair_not_verified
            run.finished_at = now
            run.logs = (run.logs or "") + _RECOVER_VERIFY_LOG
            verifications_recovered += 1
            logger.warning(
                "recovered interrupted verification verification_id=%s",
                run.id,
            )

        if scans_recovered or verifications_recovered:
            await db.commit()
        else:
            await db.rollback()

    logger.info(
        "startup recovery complete scans_recovered=%s verifications_recovered=%s",
        scans_recovered,
        verifications_recovered,
    )
    return {"scans_recovered": scans_recovered, "verifications_recovered": verifications_recovered}
