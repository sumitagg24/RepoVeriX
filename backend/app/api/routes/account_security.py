"""Account-security API routes: email verification, password recovery and
authentication webhook synchronization.

Everything user-facing here speaks the safe copy from ``app.core.auth_errors``;
internal diagnostics go to the structured log only. Token links carry
``uid`` + ``token`` because only the SHA-256 hash is stored — the token alone
cannot identify the account, and that is deliberate (a database leak yields
no usable links).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core import auth_errors
from app.core.config import get_settings
from app.core.errors import auth_error
from app.core.ratelimit import check_auth_attempt, enforce
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import AuthEvent, ProcessedAuthWebhook, User
from app.schemas.auth import (
    ChangePasswordRequest,
    ForgotPasswordRequest,
    ProfileUpdateRequest,
    ResendVerificationRequest,
    ResetPasswordRequest,
    VerifyEmailRequest,
)
from app.services import account_security as acct
from app.services import authaudit, mailer
from app.services import passwords as pw

router = APIRouter(tags=["account-security"])
logger = logging.getLogger("repoverix.account_security")

_WEBHOOK_PROVIDER = "repoverix-local"


def _client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


def dev_verification_url(user: User, token: str) -> str | None:
    """The verification link itself, but ONLY when the mail backend is the
    console logger — i.e. there is no real email delivery to intercept, and
    without this the signup loop cannot be completed by a human. Never
    populated when SMTP is configured (production)."""
    if get_settings().email_backend != "console":
        return None
    return f"{get_settings().frontend_url.rstrip('/')}/auth/verify-email?uid={user.id}&token={token}"


# ---------------------------------------------------------------------------
# Email verification
# ---------------------------------------------------------------------------


@router.post("/auth/verify-email", status_code=status.HTTP_200_OK)
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    """Burn a one-time verification token and mark the account verified."""
    try:
        uid = uuid.UUID(payload.uid)
    except ValueError:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN") from None

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN")

    ok = await acct.consume_token(db, user, kind="verification", token=payload.token)
    if not ok:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN")

    user.email_verified_at = datetime.now(UTC)
    # A verified human is present at the mailbox: clear any cooldown.
    user.failed_login_count = 0
    user.locked_until = None
    db.add(user)
    await db.commit()
    await authaudit.record(
        db,
        user_id=user.id,
        email=user.email,
        event=authaudit.AUTH_EMAIL_VERIFIED,
        detail={"method": "token"},
    )
    return {"detail": "Your email is verified. Repository connections and scans are unlocked."}


@router.post("/auth/resend-verification", status_code=status.HTTP_200_OK)
async def resend_verification(
    payload: ResendVerificationRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Re-send the verification email.

    Enumeration-safe: the response is identical whether or not the account
    exists (and whether or not it is already verified).
    """
    if get_settings().rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is not None and not acct.is_verified(user):
        token = await issue_verification_token_checked(db, user)
        if token is not None:
            try:
                await mailer.send_verification_email(user.email, str(user.id), token)
            except Exception:  # noqa: BLE001 — never leak mail internals
                logger.exception("verification_resend.delivery_failed")
            await authaudit.record(
                db,
                user_id=user.id,
                email=user.email,
                event=authaudit.AUTH_EMAIL_VERIFICATION_SENT,
                ip=_client_ip(request),
                detail={"flow": "resend"},
            )
            if get_settings().email_backend == "console":
                return {
                    "detail": auth_errors.MAYBE_SENT,
                    "dev_verification_url": dev_verification_url(user, token),
                }

    return {"detail": auth_errors.MAYBE_SENT}


async def issue_verification_token_checked(db: AsyncSession, user: User) -> str | None:
    """Issue a verification token unless one was issued too recently.

    Anti-flood: at most ``email_resend_per_hour`` tokens per hour per account.
    Returns ``None`` when the resend budget is exhausted (the caller still
    returns the generic "maybe sent" response so attackers learn nothing).
    """
    settings = get_settings()
    window_start = datetime.now(UTC) - timedelta(hours=1)
    result = await db.execute(
        select(AuthEvent).where(
            AuthEvent.user_id == user.id,
            AuthEvent.event == authaudit.AUTH_EMAIL_VERIFICATION_SENT,
            AuthEvent.created_at >= window_start,
        )
    )
    sent = len(result.scalars().all())
    if sent >= settings.email_resend_per_hour:
        return None
    return await acct.issue_verification_token(db, user)


# ---------------------------------------------------------------------------
# Password recovery
# ---------------------------------------------------------------------------


@router.post("/auth/forgot-password", status_code=status.HTTP_200_OK)
async def forgot_password(
    payload: ForgotPasswordRequest, request: Request, db: AsyncSession = Depends(get_db)
):
    """Request a password reset. Enumeration-safe by design.

    The response is byte-identical whether the account exists or not; the
    email is only sent when it does. Requests are rate limited per IP+email
    by the same limiter as login.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is not None:
        token = await acct.issue_password_reset_token(db, user)
        try:
            await mailer.send_password_reset_email(user.email, str(user.id), token)
        except Exception:  # noqa: BLE001 — never leak mail internals
            logger.exception("password_reset.delivery_failed")
        await authaudit.record(
            db,
            user_id=user.id,
            email=user.email,
            event=authaudit.AUTH_PASSWORD_RESET_REQUEST,
            ip=_client_ip(request),
        )

    return {"detail": auth_errors.MAYBE_SENT}


@router.post("/auth/reset-password", status_code=status.HTTP_200_OK)
async def reset_password(payload: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    """Consume a one-time reset token and set the new password.

    A successful reset bumps ``token_version`` so every existing session is
    invalidated — recovery must never leave attacker-held sessions alive.
    The new password must pass the strength screen.
    """
    try:
        uid = uuid.UUID(payload.uid)
    except ValueError:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN") from None

    result = await db.execute(select(User).where(User.id == uid))
    user = result.scalar_one_or_none()
    if user is None:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN")

    ok = await acct.consume_token(db, user, kind="password_reset", token=payload.token)
    if not ok:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_TOKEN, "INVALID_TOKEN")

    verdict = pw.check_password(payload.new_password)
    if not verdict.ok:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.WEAK_PASSWORD, "WEAK_PASSWORD")

    user.hashed_password = hash_password(payload.new_password)
    user.token_version = (user.token_version or 0) + 1
    user.failed_login_count = 0
    user.locked_until = None
    db.add(user)
    await db.commit()
    await authaudit.record(
        db,
        user_id=user.id,
        email=user.email,
        event=authaudit.AUTH_PASSWORD_RESET,
        detail={"sessions_revoked": True},
    )
    return {"detail": "Password updated. Please sign in with your new password."}


# ---------------------------------------------------------------------------
# Authenticated password change (Settings → Security)
# ---------------------------------------------------------------------------


@router.post("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(payload.current_password, current_user.hashed_password):
        await authaudit.record(
            db,
            user_id=current_user.id,
            email=current_user.email,
            event=authaudit.AUTH_LOGIN_FAILURE,
            ip=_client_ip(request),
            detail={"reason": "password_change_wrong_current"},
        )
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.INVALID_CREDENTIALS, "INVALID_CREDENTIALS")

    verdict = pw.check_password(payload.new_password)
    if not verdict.ok:
        raise auth_error(status.HTTP_400_BAD_REQUEST, auth_errors.WEAK_PASSWORD, "WEAK_PASSWORD")

    current_user.hashed_password = hash_password(payload.new_password)
    current_user.token_version += 1  # revoke every other session
    db.add(current_user)
    await db.commit()
    await authaudit.record(
        db,
        user_id=current_user.id,
        email=current_user.email,
        event=authaudit.AUTH_PASSWORD_CHANGED,
        ip=_client_ip(request),
    )
    new_token = create_access_token(current_user.id, token_version=current_user.token_version or 0)
    return {"detail": "Password updated. Other sessions were signed out.", "access_token": new_token}


# ---------------------------------------------------------------------------
# Security page data (Settings → Security)
# ---------------------------------------------------------------------------


@router.get("/auth/security-overview")
async def security_overview(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Everything the Settings → Security page renders."""
    events = await authaudit.recent_for_user(db, current_user.id, limit=15)
    visible = {
        authaudit.AUTH_LOGIN_SUCCESS,
        authaudit.AUTH_LOGIN_FAILURE,
        authaudit.AUTH_PASSWORD_CHANGED,
        authaudit.AUTH_PASSWORD_RESET,
        authaudit.AUTH_EMAIL_VERIFIED,
        authaudit.AUTH_ACCOUNT_LOCKED,
        authaudit.AUTH_SESSION_REVOKED,
        authaudit.AUTH_PROVIDER_CONNECTED,
        authaudit.AUTH_PROVIDER_DISCONNECTED,
    }
    return {
        "email_verified": acct.is_verified(current_user),
        "account_status": current_user.status.value if current_user.status else "active",
        "mfa_status": "not_available_yet",
        "recent_events": [
            {
                "event": e.event,
                "ip": e.ip,
                "at": e.created_at.isoformat() if e.created_at else None,
                "detail": e.detail or {},
            }
            for e in events
            if e.event in visible
        ],
    }


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------


@router.post("/auth/logout")
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record an explicit logout. Bearer tokens are stateless and simply
    discarded by the client; short expiry plus token_version revocation (see
    revoke-all) is what actually limits a stolen token's life."""
    await authaudit.record(
        db,
        user_id=current_user.id,
        email=current_user.email,
        event=authaudit.AUTH_LOGOUT,
        ip=_client_ip(request),
    )
    return {"detail": "Signed out."}


@router.post("/auth/revoke-all-sessions")
async def revoke_all_sessions(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Invalidate every bearer token issued so far, including the caller's.

    Bumps ``token_version`` — the same plumbing a password reset uses — so the
    ``tv`` claim check in ``get_current_user`` rejects all outstanding tokens.
    The response carries a fresh token for *this* session so the user is not
    logged out of the device they performed the revocation from.
    """
    current_user.token_version = (current_user.token_version or 0) + 1
    db.add(current_user)
    await db.commit()
    await authaudit.record(
        db,
        user_id=current_user.id,
        email=current_user.email,
        event=authaudit.AUTH_SESSION_REVOKED,
        ip=_client_ip(request),
        detail={"scope": "all_sessions"},
    )
    return {
        "detail": "All other sessions were signed out.",
        "access_token": create_access_token(current_user.id, token_version=current_user.token_version or 0),
    }


# ---------------------------------------------------------------------------
# Profile
# ---------------------------------------------------------------------------


@router.put("/auth/me")
async def update_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update the display name. Email is intentionally immutable here: it is
    the verified identity anchor and changes must go through a verified flow."""
    current_user.full_name = payload.full_name.strip()
    db.add(current_user)
    await db.commit()
    return {"detail": "Profile updated.", "full_name": current_user.full_name}


# ---------------------------------------------------------------------------
# Authentication webhooks (user synchronization)
# ---------------------------------------------------------------------------


def _verify_webhook_signature(secret: str, body: bytes, signature_header: str | None) -> bool:
    """HMAC-SHA256 over the raw body, constant-time compare."""
    if not signature_header:
        return False
    expected = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature_header)


@router.post("/auth/webhooks/user-sync")
async def auth_user_sync_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_rvx_signature: str | None = Header(default=None),
):
    """Receive user lifecycle events from the identity provider.

    Contract (docs/security.md): the sender signs the *raw* request body with
    HMAC-SHA256 using ``REPOVERIX_AUTH_WEBHOOK_SECRET`` and sends it as
    ``X-RVX-Signature``. Delivery is at-least-once; the idempotency ledger
    (``processed_auth_webhooks``) absorbs replays. Out-of-order events are
    tolerated: updates for unknown users are recorded and ignored.
    """
    settings = get_settings()
    secret = settings.auth_webhook_secret
    if not secret:
        # Fail closed with 503 so the sender retries after configuration.
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Webhook receiver is not configured",
        )

    body = await request.body()
    if not _verify_webhook_signature(secret, body, x_rvx_signature):
        await authaudit.record(
            db,
            user_id=None,
            email=None,
            event="AUTH_WEBHOOK_REJECTED",
            ip=_client_ip(request),
            detail={"reason": "invalid_signature"},
        )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")

    try:
        payload = json.loads(body)
    except Exception:  # noqa: BLE001
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload")

    event_type = payload.get("type")
    event_id = payload.get("id")
    record = payload.get("record") or {}
    if not event_type or not event_id or not isinstance(record, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload")

    existing = await db.execute(
        select(ProcessedAuthWebhook).where(
            ProcessedAuthWebhook.provider == _WEBHOOK_PROVIDER,
            ProcessedAuthWebhook.event_id == str(event_id),
        )
    )
    if existing.scalar_one_or_none() is not None:
        return {"detail": "duplicate"}

    email = (record.get("email") or "").strip().lower()

    if event_type in ("user.created", "user.updated"):
        if not email:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Malformed payload")
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
        if user is None:
            # Synced account: no usable password hash until the user completes
            # a reset (the random hash below is not a credential anyone knows).
            user = User(
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(32)),
                full_name=(str(record.get("full_name") or email.split("@")[0] or "User"))[:200],
                is_active=True,
            )
            db.add(user)
            await db.flush()
        new_name = record.get("full_name")
        if new_name:
            user.full_name = str(new_name)[:200]
        if record.get("email_verified") and not acct.is_verified(user):
            user.email_verified_at = user.email_verified_at or datetime.now(UTC)
        db.add(user)
        await db.commit()
        await authaudit.record(
            db,
            user_id=user.id,
            email=user.email,
            event=authaudit.AUTH_WEBHOOK_SYNC,
            detail={"event_type": event_type, "event_id": str(event_id)},
        )

    elif event_type == "user.deleted":
        if email:
            result = await db.execute(select(User).where(User.email == email))
            user = result.scalar_one_or_none()
            if user is not None:
                user.is_active = False
                user.token_version = (user.token_version or 0) + 1  # kill sessions
                db.add(user)
                await db.commit()
                await authaudit.record(
                    db,
                    user_id=user.id,
                    email=user.email,
                    event=authaudit.AUTH_WEBHOOK_SYNC,
                    detail={"event_type": event_type, "event_id": str(event_id)},
                )

    # Record the event id in every path (duplicate/out-of-order tolerance).
    db.add(
        ProcessedAuthWebhook(
            provider=_WEBHOOK_PROVIDER,
            event_id=str(event_id),
            event_type=str(event_type),
        )
    )
    await db.commit()
    return {"detail": "ok"}
