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

_tasks: dict[str, asyncio.Task] = {}
_cancel_events: dict[str, asyncio.Event] = {}


def request_cancel(scan_id: uuid.UUID | str) -> bool:
    """Request cancellation of a running task; returns False if not tracked."""
    event = _cancel_events.get(str(scan_id))
    if event is None:
        return False
    event.set()
    return True


def is_cancelled(scan_id: uuid.UUID | str) -> bool:
    return _cancel_events.get(str(scan_id)) is not None and _cancel_events[str(scan_id)].is_set()


def schedule(name: str, coro_factory: Any) -> asyncio.Task:
    """Schedule ``coro_factory()`` (an awaitable factory) in the background loop."""
    loop = asyncio.get_running_loop()
    _cancel_events[name] = asyncio.Event()

    async def _run() -> None:
        try:
            await coro_factory()
        except asyncio.CancelledError:
            logger.warning("background task cancelled name=%s", name)
        except Exception as exc:  # pragma: no cover - last-resort guard
            logger.exception("unhandled background task error name=%s: %s", name, exc)
        finally:
            _tasks.pop(name, None)
            _cancel_events.pop(name, None)

    task = loop.create_task(_run())
    _tasks[name] = task
    return task


def schedule_scan(scan_id: uuid.UUID, runner: Any) -> None:
    """Schedule ``runner(scan_id)`` in the background event loop."""
    schedule(str(scan_id), lambda: _scan_runner(scan_id, runner))


async def _scan_runner(scan_id: uuid.UUID, runner: Any) -> None:
    await runner(scan_id)


def cancel_scan_task(scan_id: uuid.UUID | str) -> bool:
    """Force-cancel a background task (used on shutdown or hard cancel)."""
    task = _tasks.get(str(scan_id))
    if task is None:
        return False
    task.cancel()
    return True


def active_task_names() -> list[str]:
    return list(_tasks)
