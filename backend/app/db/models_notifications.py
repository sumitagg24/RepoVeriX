"""Notification ORM model.

Kept in a separate file so it can be imported from both services and routes
without pulling in the entire domain model graph.  The ``Notification`` table
is appended to the shared ``Base`` metadata automatically on import.
"""

from __future__ import annotations

import enum
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import GUID, Base, TimestampMixin, UUIDPrimaryKeyMixin


class NotificationKind(str, enum.Enum):
    scan_completed = "scan_completed"
    scan_failed = "scan_failed"
    verification_completed = "verification_completed"
    verification_failed = "verification_failed"
    new_critical_finding = "new_critical_finding"
    digest = "digest"


def _nk() -> Enum:
    return Enum(
        NotificationKind,
        name="notification_kind",
        values_callable=lambda e: [m.value for m in e],
    )


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    """One in-app notification for a user.

    Notifications are created by backend services (scan complete, critical
    finding found, verification result) and surfaced via ``GET /notifications``.
    They are never shown anonymously.

    ``payload`` holds kind-specific structured data (scan_id, finding counts,
    severity breakdown) served verbatim to the frontend.
    """

    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "read_at"),)

    user_id: Mapped[uuid.UUID] = mapped_column(
        GUID, ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False
    )
    kind: Mapped[str] = mapped_column(String(50), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    # Relative path the UI navigates to when the user clicks the notification.
    action_url: Mapped[str | None] = mapped_column(String(2048))
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    # Kind-specific structured data (counts, IDs, etc.) returned verbatim.
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
