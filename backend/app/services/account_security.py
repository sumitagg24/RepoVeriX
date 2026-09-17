"""Account-security primitives: one-time email tokens, persistent progressive
lockout, and the email-verification gate.

Token design
------------
Verification and reset tokens are random 32-byte values delivered by email;
only their SHA-256 hash is stored, so a database leak cannot produce a usable
link. Comparison is constant-time. Every token is single-use: consumption
clears the stored hash.

Lockout design
--------------
On top of the per-IP/per-account window limiter (``app/core/ratelimit.py``),
failed password logins accumulate on the account row. After
``auth_max_failed_attempts`` consecutive failures the account cools down for
``auth_lockout_minutes``, doubling per further failure and capped at
``auth_max_lockout_minutes``. It is always temporary — there is no permanent
lock — and any successful login resets the counter.

Verification gate
-----------------
``ensure_email_verified`` refuses provider connections, repository
registration and scans for unverified password accounts. OAuth-created
accounts are verified at creation (the provider returned the address), and
pre-existing accounts were grandfathered by migration 005.
"""

from __future__ import annotations

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.core.errors import auth_error
from app.db.models import User

# ---------------------------------------------------------------------------
# One-time tokens
# ---------------------------------------------------------------------------


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def new_token() -> str:
    """A fresh URL-safe one-time token (delivered by email, stored hashed)."""
    return secrets.token_urlsafe(32)


def _as_aware(dt: datetime) -> datetime:
    """Treat SQLite's naive datetimes as UTC (Postgres returns aware ones)."""
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _token_valid(stored_hash: str | None, expires_at, token: str) -> bool:
    if not stored_hash or expires_at is None:
        return False
    if datetime.now(UTC) > _as_aware(expires_at):
        return False
    return hmac.compare_digest(stored_hash, hash_token(token))


async def issue_verification_token(db: AsyncSession, user: User) -> str:
    """Create (or replace) the email-verification token and persist its hash."""
    settings = get_settings()
    token = new_token()
    user.verification_token_hash = hash_token(token)
    user.verification_expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.email_verification_token_minutes
    )
    db.add(user)
    await db.commit()
    return token


async def issue_password_reset_token(db: AsyncSession, user: User) -> str:
    settings = get_settings()
    token = new_token()
    user.password_reset_token_hash = hash_token(token)
    user.password_reset_expires_at = datetime.now(UTC) + timedelta(
        minutes=settings.password_reset_token_minutes
    )
    db.add(user)
    await db.commit()
    return token


async def consume_token(db: AsyncSession, user: User, *, kind: str, token: str) -> bool:
    """Validate and burn a one-time token (``kind`` = verification|password_reset)."""
    if kind == "verification":
        ok = _token_valid(user.verification_token_hash, user.verification_expires_at, token)
        if ok:
            user.verification_token_hash = None
            user.verification_expires_at = None
    elif kind == "password_reset":
        ok = _token_valid(user.password_reset_token_hash, user.password_reset_expires_at, token)
        if ok:
            user.password_reset_token_hash = None
            user.password_reset_expires_at = None
    else:  # pragma: no cover — closed set
        ok = False
    if ok:
        db.add(user)
        await db.commit()
    return ok


# ---------------------------------------------------------------------------
# Persistent progressive lockout
# ---------------------------------------------------------------------------


def lockout_seconds_remaining(user: User) -> int:
    """Seconds the account is still cooling down (0 = not locked)."""
    if user.locked_until is None:
        return 0
    remaining = (_as_aware(user.locked_until) - datetime.now(UTC)).total_seconds()
    return max(0, int(remaining))


def _apply_lock(user: User) -> int:
    """Escalate the cooldown; returns the applied lock duration in seconds."""
    settings = get_settings()
    excess = max(0, user.failed_login_count - settings.auth_max_failed_attempts)
    minutes = settings.auth_lockout_minutes * (settings.auth_lockout_backoff_multiplier**excess)
    seconds = int(min(minutes, settings.auth_max_lockout_minutes) * 60)
    user.locked_until = datetime.now(UTC) + timedelta(seconds=seconds)
    return seconds


async def record_failed_login(db: AsyncSession, user: User) -> int:
    """Count a failure, lock the account if the threshold is crossed.

    Returns the number of seconds the account is locked for (0 if not locked).
    """
    settings = get_settings()
    user.failed_login_count = (user.failed_login_count or 0) + 1
    locked_for = 0
    if user.failed_login_count >= settings.auth_max_failed_attempts:
        locked_for = _apply_lock(user)
    db.add(user)
    await db.commit()
    return locked_for


async def record_successful_login(db: AsyncSession, user: User) -> None:
    """Reset failure accounting after a successful authentication."""
    if user.failed_login_count or user.locked_until is not None:
        user.failed_login_count = 0
        user.locked_until = None
        db.add(user)
        await db.commit()


# ---------------------------------------------------------------------------
# Email-verification gate
# ---------------------------------------------------------------------------


def is_verified(user: User) -> bool:
    return user.email_verified_at is not None


def ensure_email_verified(user: User) -> None:
    """Raise 403 EMAIL_NOT_VERIFIED unless the account may use expensive features.

    Only applies while ``REPOVERIX_AUTH_REQUIRE_EMAIL_VERIFICATION`` is true
    and the account is actually unverified. Deployments that run without an
    email backend can disable the policy in configuration.
    """
    settings = get_settings()
    if not settings.auth_require_email_verification or is_verified(user):
        return
    raise auth_error(
        status_code=status.HTTP_403_FORBIDDEN,
        message="Please verify your email before continuing.",
        code="EMAIL_NOT_VERIFIED",
    )
