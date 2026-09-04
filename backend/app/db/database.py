"""Async engine, session factory and FastAPI dependency."""

from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.base import Base

settings = get_settings()

engine = create_async_engine(settings.database_url, echo=settings.debug)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a database session for the duration of a request."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables. Used for local development and tests; Alembic is used for deployments."""
    from app.db import models  # noqa: F401  (ensure models are registered on the metadata)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
