"""Personal API tokens for CI / headless access.

Tokens look like ``rvx_<32 urlsafe chars>``; only the SHA-256 hash is stored,
the plaintext is returned exactly once at creation. Authentication with a
token is equivalent to the owning user (same quotas, plans and RBAC), and
revocation is immediate. Rotation = create new + revoke old.
"""

from __future__ import annotations

import hashlib
import secrets
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import ApiToken, User
from app.schemas.common import TimestampedORMModel

router = APIRouter(prefix="/tokens", tags=["tokens"])

_PREFIX = "rvx_"


class TokenCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    expires_in_days: int | None = Field(default=None, ge=1, le=3650)


class TokenRead(TimestampedORMModel):
    name: str
    token_prefix: str
    last_used_at: datetime | None
    revoked_at: datetime | None
    expires_at: datetime | None


class TokenCreated(TokenRead):
    """Includes the plaintext token — shown exactly once."""

    token: str


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _new_secret() -> tuple[str, str, str]:
    """Return (plaintext, hash, display-prefix)."""
    secret = secrets.token_urlsafe(24)
    plaintext = _PREFIX + secret
    return plaintext, _hash(plaintext), plaintext[:10]


@router.post("", response_model=TokenCreated, status_code=status.HTTP_201_CREATED)
async def create_token(
    payload: TokenCreate,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "create_token"))

    plaintext, digest, prefix = _new_secret()
    expires_at = None
    if payload.expires_in_days is not None:
        from datetime import timedelta

        expires_at = datetime.now(UTC) + timedelta(days=payload.expires_in_days)
    row = ApiToken(
        user_id=current_user.id,
        name=payload.name.strip(),
        token_hash=digest,
        token_prefix=prefix,
        expires_at=expires_at,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return TokenCreated(
        id=row.id,
        created_at=row.created_at,
        updated_at=row.updated_at,
        name=row.name,
        token_prefix=row.token_prefix,
        last_used_at=row.last_used_at,
        revoked_at=row.revoked_at,
        expires_at=row.expires_at,
        token=plaintext,
    )


@router.get("", response_model=list[TokenRead])
async def list_tokens(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's tokens (metadata only — secrets are unrecoverable)."""
    rows = (
        (
            await db.execute(
                select(ApiToken)
                .where(ApiToken.user_id == current_user.id)
                .order_by(ApiToken.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        TokenRead(
            id=r.id,
            created_at=r.created_at,
            updated_at=r.updated_at,
            name=r.name,
            token_prefix=r.token_prefix,
            last_used_at=r.last_used_at,
            revoked_at=r.revoked_at,
            expires_at=r.expires_at,
        )
        for r in rows
    ]


@router.delete("/{token_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_token(
    token_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Revoke a token immediately (CI jobs using it start failing with 401)."""
    result = await db.execute(
        update(ApiToken)
        .where(
            ApiToken.id == token_id,
            ApiToken.user_id == current_user.id,
            ApiToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Token not found")
    await db.commit()
