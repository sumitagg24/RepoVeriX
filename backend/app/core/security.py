"""Password hashing and JWT helpers."""

import uuid
from datetime import UTC, datetime, timedelta

import bcrypt
import jwt

from app.core.config import get_settings


def hash_password(password: str) -> str:
    """Hash a plaintext password with bcrypt."""
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    """Check a plaintext password against a bcrypt hash."""
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except ValueError:
        return False


def create_access_token(
    subject: uuid.UUID | str,
    expires_delta: timedelta | None = None,
    *,
    token_version: int = 0,
) -> str:
    """Create a signed JWT whose ``sub`` claim is the user id.

    The ``tv`` claim carries the user's ``token_version`` so stateless sessions
    become revocable: bumping the version invalidates every outstanding token
    (logout-all, password change/reset, suspension).
    """
    settings = get_settings()
    now = datetime.now(UTC)
    expire = now + (expires_delta or timedelta(minutes=settings.access_token_expire_minutes))
    payload = {
        "sub": str(subject),
        "iat": int(now.timestamp()),
        "exp": int(expire.timestamp()),
        "tv": int(token_version),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token_claims(token: str) -> dict | None:
    """Return the full validated claim set, or ``None`` if invalid/expired."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except jwt.PyJWTError:
        return None
    return payload if isinstance(payload, dict) else None


def decode_access_token(token: str) -> str | None:
    """Return the ``sub`` claim of a valid token, or ``None`` if invalid/expired."""
    payload = decode_token_claims(token)
    if payload is None:
        return None
    subject = payload.get("sub")
    return subject if isinstance(subject, str) else None
