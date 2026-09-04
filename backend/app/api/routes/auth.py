"""Authentication routes: signup, login, token refresh.

Login and signup are rate limited on BOTH the client IP and the account (email)
with an escalating backoff — thresholds live in Settings (see ratelimit.py).
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_auth_attempt, enforce, reset_auth_attempts
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import User
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """Store and compare emails case-insensitively."""
    return email.strip().lower()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Register a new user and return an access token."""
    if get_settings().rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    if get_settings().rate_limit_enabled:
        reset_auth_attempts(email)
    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return an access token."""
    if get_settings().rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    if get_settings().rate_limit_enabled:
        reset_auth_attempts(email)
    access_token = create_access_token(user.id)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: User = Depends(get_current_user),
):
    """Return the current authenticated user."""
    return current_user
