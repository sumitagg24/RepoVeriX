"""Authentication audit trail (AUTH_* events).

Every security-relevant authentication event is appended to ``auth_events``:
signup, login success/failure, lockouts, password reset, email verification,
provider connect/disconnect, session revocation and webhook-driven sync.

Recording must never break the request it observes: failures are logged (with
request context) and swallowed. Nothing sensitive is ever stored — no
passwords, tokens, authorization codes or raw provider responses.
"""

from __future__ import annotations

import logging
import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import AuthEvent

logger = logging.getLogger("repoverix.authaudit")

# Event catalogue — the closed vocabulary written to auth_events.event.
AUTH_SIGNUP = "AUTH_SIGNUP"
AUTH_LOGIN_SUCCESS = "AUTH_LOGIN_SUCCESS"
AUTH_LOGIN_FAILURE = "AUTH_LOGIN_FAILURE"
AUTH_LOGOUT = "AUTH_LOGOUT"
AUTH_PASSWORD_RESET_REQUEST = "AUTH_PASSWORD_RESET_REQUEST"
AUTH_PASSWORD_RESET = "AUTH_PASSWORD_RESET"
AUTH_EMAIL_VERIFIED = "AUTH_EMAIL_VERIFIED"
AUTH_EMAIL_VERIFICATION_SENT = "AUTH_EMAIL_VERIFICATION_SENT"
AUTH_ACCOUNT_LOCKED = "AUTH_ACCOUNT_LOCKED"
AUTH_PROVIDER_LOGIN = "AUTH_PROVIDER_LOGIN"
AUTH_PROVIDER_CONNECTED = "AUTH_PROVIDER_CONNECTED"
AUTH_PROVIDER_DISCONNECTED = "AUTH_PROVIDER_DISCONNECTED"
AUTH_SESSION_REVOKED = "AUTH_SESSION_REVOKED"
AUTH_PASSWORD_CHANGED = "AUTH_PASSWORD_CHANGED"
AUTH_WEBHOOK_SYNC = "AUTH_WEBHOOK_SYNC"

_VALID_EVENTS = {v for k, v in vars().items() if k.startswith("AUTH_")}


async def record(
    db: AsyncSession,
    event: str,
    *,
    user_id: uuid.UUID | str | None = None,
    email: str | None = None,
    ip: str | None = None,
    detail: dict[str, Any] | None = None,
) -> None:
    """Append one audit event; failures are logged, never raised."""
    if event not in _VALID_EVENTS:  # defensive: keep the catalogue closed
        logger.warning("authaudit.unknown_event", extra={"event": event})
        event = "AUTH_UNKNOWN"
    row = AuthEvent(
        user_id=user_id if user_id is None else uuid.UUID(str(user_id)),
        email=(email or None) and str(email).strip().lower()[:320] or None,
        event=event,
        ip=(ip or None) and str(ip)[:64] or None,
        # Only small scalar context is accepted by callers; cap for safety.
        detail={k: str(v)[:200] for k, v in (detail or {}).items()} or None,
    )
    db.add(row)
    try:
        # Commit here, not at request teardown: several callers have already
        # committed their primary write before auditing, so the audit row would
        # otherwise be discarded when the request session closes. Recording is
        # an observer — it owns its transaction.
        await db.commit()
    except Exception:  # noqa: BLE001 — audit must not break the request
        logger.exception("authaudit.record_failed", extra={"event": event})
        await db.rollback()


async def recent_for_user(db: AsyncSession, user_id, limit: int = 20) -> list[AuthEvent]:
    """Most recent events for a user (security page)."""
    from sqlalchemy import select

    stmt = (
        select(AuthEvent)
        .where(AuthEvent.user_id == uuid.UUID(str(user_id)))
        .order_by(AuthEvent.created_at.desc())
        .limit(limit)
    )
    return list((await db.execute(stmt)).scalars().all())
