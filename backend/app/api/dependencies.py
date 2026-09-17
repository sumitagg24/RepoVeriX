"""FastAPI dependencies for authentication and database access."""

import uuid
from collections.abc import AsyncGenerator, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_token_claims
from app.db.database import SessionLocal
from app.db.models import User, UserStatus
from app.services.account_security import ensure_email_verified

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session."""
    async with SessionLocal() as session:
        yield session


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Fetch the current user from a JWT *or* an API token (``rvx_…``).

    API tokens authenticate CI systems with the same identity and privileges
    as their owner. Only the SHA-256 hash is stored; revoked/expired tokens
    are rejected. Token use updates ``last_used_at`` (best-effort).
    """
    import hashlib
    from datetime import UTC, datetime

    from sqlalchemy import select

    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    presented = credentials.credentials

    user: User | None = None
    if presented.startswith("rvx_"):
        from app.db.models import ApiToken

        digest = hashlib.sha256(presented.encode()).hexdigest()
        row = (await db.execute(select(ApiToken).where(ApiToken.token_hash == digest))).scalar_one_or_none()
        if row is not None:
            now = datetime.now(UTC)
            # SQLite returns naive UTC datetimes; normalize before comparing.
            expires = row.expires_at
            if expires is not None and expires.tzinfo is None:
                expires = expires.replace(tzinfo=UTC)
            expired = expires is not None and expires <= now
            if row.revoked_at is not None or expired:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token revoked or expired",
                    headers={"WWW-Authenticate": "Bearer"},
                )
            user_result = await db.execute(select(User).where(User.id == row.user_id))
            user = user_result.scalar_one_or_none()
            if user is not None:
                row.last_used_at = now
                try:
                    await db.commit()
                except Exception:  # noqa: BLE001 - usage tracking must not fail auth
                    await db.rollback()
    else:
        claims = decode_token_claims(presented)
        if claims is not None:
            result = await db.execute(select(User).where(User.id == claims["sub"]))
            user = result.scalar_one_or_none()
            if user is not None:
                # Revocable stateless sessions: a token minted before a
                # token_version bump (password change/reset, logout-all,
                # suspension) no longer authenticates.
                if int(claims.get("tv", 0)) != int(user.token_version or 0):
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="Session revoked — please sign in again",
                        headers={"WWW-Authenticate": "Bearer"},
                    )

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active or user.status in (UserStatus.suspended, UserStatus.deleted):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is suspended. Contact support if you believe this is a mistake.",
        )
    return user


async def get_verified_user(current_user: User = Depends(get_current_user)) -> User:
    """Authenticated user who has also verified their email address.

    Composes ``get_current_user`` with the email-verification gate (identical
    403 ``EMAIL_NOT_VERIFIED`` error, same configuration switch). Apply it to
    the routes that unlock expensive features — repository registration,
    scans, provider-driven repository listing — so the gate lives in exactly
    one place instead of a copy-pasted check inside each handler.
    """
    ensure_email_verified(current_user)
    return current_user


async def get_scan_scheduler() -> Callable[[uuid.UUID], None]:
    """Return the function that starts a scan in the background.

    Kept as a dependency so tests can substitute a stub and so a future job
    queue can replace the in-process scheduler without touching routes.
    """
    from app.analysis import runtime as scan_runtime
    from app.analysis.orchestrate import run_scan
    from app.db.database import SessionLocal

    def _schedule(scan_id: uuid.UUID) -> None:
        scan_runtime.schedule_scan(scan_id, lambda sid: run_scan(SessionLocal, sid))

    return _schedule


async def get_website_audit_scheduler() -> Callable[[uuid.UUID], None]:
    """Return the function that starts a passive website audit in the background.

    Same seam pattern as ``get_scan_scheduler`` so tests can substitute an
    inline runner and a future job queue can replace the in-process scheduler
    without touching routes.
    """
    from app.analysis import runtime as scan_runtime
    from app.analysis.webrun import run_website_audit
    from app.db.database import SessionLocal

    def _schedule(audit_id: uuid.UUID) -> None:
        scan_runtime.schedule(str(audit_id), lambda: run_website_audit(SessionLocal, audit_id))

    return _schedule


async def get_verification_scheduler() -> Callable[[uuid.UUID], None]:
    """Return the function that starts a verification run in the background.

    Same pattern as ``get_scan_scheduler`` so tests can substitute a stub and a
    future job queue can replace the in-process scheduler without touching
    routes. Verification runs inside a Docker sandbox by default.
    """
    from app.analysis import runtime as scan_runtime
    from app.analysis.verify import run_verification
    from app.db.database import SessionLocal

    def _schedule(verification_id: uuid.UUID) -> None:
        scan_runtime.schedule(
            str(verification_id),
            lambda: run_verification(SessionLocal, verification_id),
        )

    return _schedule
