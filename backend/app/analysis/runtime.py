"""In-process background scan scheduling.

MVP keeps scans in the same process as the API (a modular monolith). Tasks are
tracked so a scan can be cancelled; a cancelled scan exits at the next stage
boundary. Multi-worker deployment would move this to a job queue — documented in
docs/architecture.md.
"""

from __future__ import annotations

import asyncio
import logging
import uuid
from typing import Any

logger = logging.getLogger("repoverix.scans")

_tasks: dict[uuid.UUID, asyncio.Task] = {}
_cancel_events: dict[uuid.UUID, asyncio.Event] = {}


def request_cancel(scan_id: uuid.UUID) -> bool:
    """Request cancellation of a running scan; returns False if not tracked."""
    event = _cancel_events.get(scan_id)
    if event is None:
        return False
    event.set()
    return True


def is_cancelled(scan_id: uuid.UUID) -> bool:
    return _cancel_events.get(scan_id) is not None and _cancel_events[scan_id].is_set()


def schedule_scan(scan_id: uuid.UUID, runner: Any) -> None:
    """Schedule ``runner(scan_id)`` in the background event loop."""
    loop = asyncio.get_running_loop()
    _cancel_events[scan_id] = asyncio.Event()

    async def _run() -> None:
        try:
            await runner(scan_id)
        except asyncio.CancelledError:
            logger.warning("scan task cancelled scan_id=%s", scan_id)
        except Exception as exc:  # pragma: no cover - last-resort guard
            logger.exception("unhandled scan task error scan_id=%s: %s", scan_id, exc)
        finally:
            _tasks.pop(scan_id, None)
            _cancel_events.pop(scan_id, None)

    task = loop.create_task(_run())
    _tasks[scan_id] = task


def cancel_scan_task(scan_id: uuid.UUID) -> bool:
    """Force-cancel a background task (used on shutdown or hard cancel)."""
    task = _tasks.get(scan_id)
    if task is None:
        return False
    task.cancel()
    return True


def active_scan_ids() -> list[str]:
    return [str(sid) for sid in _tasks]
