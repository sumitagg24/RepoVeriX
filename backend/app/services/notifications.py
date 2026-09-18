"""Notification service.

Creates in-app notifications and optionally sends email digests.

Public API
----------
``notify_scan_completed``      — called by the scan orchestrator on finish
``notify_verification_result`` — called by the verification runner on finish
``notify_critical_findings``   — called per-finding for critical/high severity
``send_digest``                — send a daily email summary of unread notifications
``list_notifications``         — paginated list for the REST API
``mark_read``                  — bulk mark-as-read
``mark_all_read``              — mark every unread notification for a user

All functions accept the SQLAlchemy ``AsyncSession`` as first argument and
never raise on email-delivery failures (email is best-effort; the in-app
record is always written first).
"""

from __future__ import annotations

import logging
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import desc, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models_notifications import Notification, NotificationKind

logger = logging.getLogger("repoverix.notifications")

# Maximum notifications to return in one page.
_PAGE_SIZE = 50
# Maximum unread notifications kept per user (oldest are pruned).
_MAX_UNREAD = 200


# --------------------------------------------------------------------------- creation


async def _create(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    kind: NotificationKind,
    title: str,
    body: str | None = None,
    action_url: str | None = None,
    payload: dict[str, Any] | None = None,
) -> Notification:
    n = Notification(
        user_id=user_id,
        kind=kind.value,
        title=title,
        body=body,
        action_url=action_url,
        payload=payload or {},
    )
    db.add(n)
    await db.flush()  # assign ID without committing — caller commits
    return n


async def notify_scan_completed(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    scan_id: uuid.UUID,
    repository_name: str,
    status: str,  # "completed" | "failed"
    finding_counts: dict[str, int] | None = None,
    error: str | None = None,
) -> Notification:
    """Record a scan-done notification and (optionally) fire an email."""
    if status == "failed":
        kind = NotificationKind.scan_failed
        title = f"Scan failed — {repository_name}"
        body = error[:300] if error else "The scan encountered an unexpected error."
    else:
        kind = NotificationKind.scan_completed
        counts = finding_counts or {}
        total = sum(counts.values())
        critical = counts.get("critical", 0)
        high = counts.get("high", 0)
        title = f"Scan complete — {repository_name}"
        if total == 0:
            body = "No findings detected."
        else:
            body = f"{total} finding(s) detected"
            if critical or high:
                body += f" ({critical} critical, {high} high)"
            body += "."

    n = await _create(
        db,
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        action_url=f"/scans/{scan_id}",
        payload={
            "scan_id": str(scan_id),
            "repository_name": repository_name,
            "status": status,
            "finding_counts": finding_counts or {},
            "error": error,
        },
    )
    # Best-effort email notification (non-blocking, never raises)
    await _try_email_scan(db, user_id=user_id, title=title, body=body, scan_id=scan_id)
    return n


async def notify_verification_result(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    verification_id: uuid.UUID,
    patch_id: uuid.UUID,
    finding_title: str,
    status: str,  # "verified_repair" | "repair_failed" | "repair_not_verified"
) -> Notification:
    """Record a verification-run-done notification."""
    if status == "verified_repair":
        kind = NotificationKind.verification_completed
        title = f"Fix verified — {finding_title[:80]}"
        body = "The patch passed all checks. The finding is resolved."
        action_url = f"/findings/{patch_id}"  # frontend resolves to patch detail
    else:
        kind = NotificationKind.verification_failed
        label = "failed" if status == "repair_failed" else "not verified"
        title = f"Fix {label} — {finding_title[:80]}"
        body = f"The verification run finished with status: {status.replace('_', ' ')}."
        action_url = f"/findings/{patch_id}"

    return await _create(
        db,
        user_id=user_id,
        kind=kind,
        title=title,
        body=body,
        action_url=action_url,
        payload={
            "verification_id": str(verification_id),
            "patch_id": str(patch_id),
            "finding_title": finding_title,
            "status": status,
        },
    )


async def notify_critical_finding(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    scan_id: uuid.UUID,
    finding_id: uuid.UUID,
    finding_title: str,
    severity: str,
    file_path: str,
) -> Notification:
    """Record a per-finding notification for critical or high severity findings."""
    title = f"{severity.upper()} finding — {finding_title[:80]}"
    body = f"Detected in {file_path}."
    return await _create(
        db,
        user_id=user_id,
        kind=NotificationKind.new_critical_finding,
        title=title,
        body=body,
        action_url=f"/findings/{finding_id}",
        payload={
            "scan_id": str(scan_id),
            "finding_id": str(finding_id),
            "finding_title": finding_title,
            "severity": severity,
            "file_path": file_path,
        },
    )


# --------------------------------------------------------------------------- read / list


async def list_notifications(
    db: AsyncSession,
    user_id: uuid.UUID,
    *,
    unread_only: bool = False,
    page: int = 1,
    page_size: int = _PAGE_SIZE,
) -> tuple[list[Notification], int]:
    """Return (notifications, total_unread_count) for the user.

    Notifications are newest-first.  ``page`` is 1-indexed.
    """
    page_size = min(page_size, _PAGE_SIZE)
    offset = (max(1, page) - 1) * page_size

    q = select(Notification).where(Notification.user_id == user_id)
    if unread_only:
        q = q.where(Notification.read_at.is_(None))
    q = q.order_by(desc(Notification.created_at)).offset(offset).limit(page_size)

    rows = list((await db.execute(q)).scalars().all())

    unread_count = int(
        (
            await db.execute(
                select(func.count(Notification.id)).where(
                    Notification.user_id == user_id,
                    Notification.read_at.is_(None),
                )
            )
        ).scalar()
        or 0
    )
    return rows, unread_count


async def mark_read(db: AsyncSession, user_id: uuid.UUID, notification_ids: list[uuid.UUID]) -> int:
    """Mark specific notifications as read; returns the count updated."""
    now = datetime.now(UTC)
    result = await db.execute(
        update(Notification)
        .where(
            Notification.user_id == user_id,
            Notification.id.in_(notification_ids),
            Notification.read_at.is_(None),
        )
        .values(read_at=now)
    )
    await db.commit()
    return result.rowcount  # type: ignore[return-value]


async def mark_all_read(db: AsyncSession, user_id: uuid.UUID) -> int:
    """Mark every unread notification as read; returns the count updated."""
    now = datetime.now(UTC)
    result = await db.execute(
        update(Notification)
        .where(Notification.user_id == user_id, Notification.read_at.is_(None))
        .values(read_at=now)
    )
    await db.commit()
    return result.rowcount  # type: ignore[return-value]


# --------------------------------------------------------------------------- email digest


async def send_digest(db: AsyncSession, user_id: uuid.UUID) -> bool:
    """Send an email digest of unread notifications to the user.

    Returns True when the email was dispatched, False when there is nothing
    to report or the user has no email address.  Never raises on delivery
    failure — errors are logged and the function returns False.
    """
    from sqlalchemy import select

    from app.db.models import User

    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user is None or not user.email:
        return False

    rows, unread_count = await list_notifications(db, user_id, unread_only=True, page_size=10)
    if not rows:
        return False

    try:
        from app.services.mailer import send_notification_digest

        await send_notification_digest(user.email, user.full_name, rows, unread_count)
        return True
    except Exception as exc:  # pragma: no cover — email is best-effort
        logger.warning("digest email failed for user %s: %s", user_id, exc)
        return False


# --------------------------------------------------------------------------- internal helpers


async def _try_email_scan(
    db: AsyncSession,
    *,
    user_id: uuid.UUID,
    title: str,
    body: str | None,
    scan_id: uuid.UUID,
) -> None:
    """Best-effort single-event email for scan completion. Never raises."""
    try:
        from sqlalchemy import select

        from app.db.models import User
        from app.services.mailer import send_scan_notification

        user_result = await db.execute(select(User).where(User.id == user_id))
        user = user_result.scalar_one_or_none()
        if user and user.email:
            await send_scan_notification(
                user.email,
                user.full_name,
                title=title,
                body=body or "",
                scan_id=str(scan_id),
            )
    except Exception as exc:  # pragma: no cover
        logger.debug("scan notification email failed: %s", exc)
