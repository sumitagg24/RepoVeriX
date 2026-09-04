"""FastAPI dependencies for authentication and database access."""

import uuid
from collections.abc import AsyncGenerator, Callable

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import decode_access_token
from app.db.database import SessionLocal
from app.db.models import User

bearer_scheme = HTTPBearer(auto_error=False)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Yield a database session."""
    async with SessionLocal() as session:
        yield session


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> str:
    """Extract and validate the current user ID from the JWT."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = decode_access_token(credentials.credentials)
    if user_id is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user_id


async def get_current_user(
    user_id: str = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> User:
    """Fetch the current user from the database."""
    from sqlalchemy import select

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )
    return user


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
