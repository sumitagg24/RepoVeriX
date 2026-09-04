"""Async engine, session factory and FastAPI dependency."""

from collections.abc import AsyncIterator

from sqlalchemy import text
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
        await _ensure_column(
            conn,
            "repositories",
            "oauth_account_id",
            "CHAR(32)" if "sqlite" in str(engine.url) else "UUID",
        )
        # Subscription/usage columns added for pre-billing databases.
        _user_columns = {
            "plan": "VARCHAR(20)",
            "subscription_status": "VARCHAR(20)",
            "current_period_end": "DATETIME",
            "stripe_customer_id": "VARCHAR(200)",
            "stripe_subscription_id": "VARCHAR(200)",
            "scans_used": "INTEGER",
            "fixes_used": "INTEGER",
            "verifications_used": "INTEGER",
        }
        for column, ddl in _user_columns.items():
            await _ensure_column(conn, "users", column, ddl)
        # Backfill defaults for rows created before the billing columns existed.
        await conn.execute(text("UPDATE users SET plan = 'free' WHERE plan IS NULL"))
        await conn.execute(text("UPDATE users SET scans_used = 0 WHERE scans_used IS NULL"))
        await conn.execute(text("UPDATE users SET fixes_used = 0 WHERE fixes_used IS NULL"))
        await conn.execute(text("UPDATE users SET verifications_used = 0 WHERE verifications_used IS NULL"))


async def _ensure_column(conn, table: str, column: str, column_ddl: str) -> None:
    """Add a nullable column to a pre-existing table without a full migration.

    ``create_all`` only creates missing tables; databases created before the
    OAuth feature need ``oauth_account_id`` added in place. The statement is a
    no-op when the column already exists.
    """
    try:
        await conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {column_ddl}"))
    except Exception:
        # duplicate-column (SQLite) / already-exists (PostgreSQL) — column present
        pass
