"""Async engine, session factory and FastAPI dependency."""

from collections.abc import AsyncIterator

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import get_settings
from app.db.base import Base

settings = get_settings()

# Production hardening: managed providers (Neon, RDS, ...) close idle TCP
# connections, so pooled connections must be validated before reuse
# (``pool_pre_ping``) and recycled well before server-side idle timeouts.
# Without this, the first request after an idle period fails with
# "connection is closed".
engine = create_async_engine(
    settings.database_url,
    echo=settings.debug,
    pool_pre_ping=True,
    pool_recycle=280,
    pool_size=5,
    max_overflow=10,
    pool_timeout=30,
)
SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Yield a database session for the duration of a request."""
    async with SessionLocal() as session:
        yield session


async def init_db() -> None:
    """Create all tables. Used for local development and tests; Alembic is used for deployments."""
    from app.db import models  # noqa: F401  (ensure models are registered on the metadata)
    from app.db import models_notifications  # noqa: F401  (notifications table)

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _ensure_column(
            conn,
            "repositories",
            "oauth_account_id",
            "CHAR(32)" if "sqlite" in str(engine.url) else "UUID",
        )
        # Subscription/usage columns added for pre-billing databases.
        await _ensure_column(conn, "scans", "idempotency_key", "VARCHAR(128)")
        # Organizations / RBAC (003): repositories optionally belong to an org.
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS organizations ("
                "id VARCHAR(36) PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, name VARCHAR(200) NOT NULL, "
                "slug VARCHAR(200) NOT NULL UNIQUE, created_by VARCHAR(36))"
            )
        )
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS organization_members ("
                "id VARCHAR(36) PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, organization_id VARCHAR(36) NOT NULL, "
                "user_id VARCHAR(36) NOT NULL, role VARCHAR(30) NOT NULL DEFAULT 'member', "
                "invited_by VARCHAR(36), UNIQUE (organization_id, user_id))"
            )
        )
        await conn.execute(
            text(
                "CREATE TABLE IF NOT EXISTS api_tokens ("
                "id VARCHAR(36) PRIMARY KEY, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, "
                "updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, user_id VARCHAR(36) NOT NULL, "
                "name VARCHAR(100) NOT NULL, token_hash VARCHAR(64) NOT NULL UNIQUE, "
                "token_prefix VARCHAR(12) NOT NULL, last_used_at DATETIME, revoked_at DATETIME, "
                "expires_at DATETIME)"
            )
        )
        await _ensure_column(
            conn, "repositories", "org_id", "CHAR(32)" if "sqlite" in str(engine.url) else "UUID"
        )
        await _ensure_column(conn, "repositories", "webhook_secret", "VARCHAR(64)")
        await conn.execute(text("CREATE INDEX IF NOT EXISTS ix_repositories_org_id ON repositories (org_id)"))
        _user_columns = {
            "plan": "VARCHAR(20)",
            "subscription_status": "VARCHAR(20)",
            "current_period_end": "DATETIME",
            "stripe_customer_id": "VARCHAR(200)",
            "stripe_subscription_id": "VARCHAR(200)",
            "scans_used": "INTEGER",
            "fixes_used": "INTEGER",
            "verifications_used": "INTEGER",
            "website_audits_used": "INTEGER",
        }
        for column, ddl in _user_columns.items():
            await _ensure_column(conn, "users", column, ddl)
        # Backfill defaults for rows created before the billing columns existed.
        await conn.execute(text("UPDATE users SET plan = 'free' WHERE plan IS NULL"))
        await conn.execute(text("UPDATE users SET scans_used = 0 WHERE scans_used IS NULL"))
        await conn.execute(text("UPDATE users SET fixes_used = 0 WHERE fixes_used IS NULL"))
        await conn.execute(text("UPDATE users SET verifications_used = 0 WHERE verifications_used IS NULL"))
        await conn.execute(text("UPDATE users SET website_audits_used = 0 WHERE website_audits_used IS NULL"))
        # Composite indexes defined on the ORM models only apply to tables
        # *created* after this change; existing deployments get them here so a
        # hot-path query never falls back to per-row index hops. Statements are
        # built from the constant list below only (no user input), and are
        # no-ops when the index already exists on both SQLite and PostgreSQL.
        for _index_name, _table, _columns in _COMPOSITE_INDEXES:
            await conn.execute(text(f"CREATE INDEX IF NOT EXISTS {_index_name} ON {_table} ({_columns})"))


# Hot-path composite indexes. Kept in sync with the ORM ``__table_args__``
# declarations in ``app/db/models.py`` — this list exists only so pre-existing
# databases (whose tables ``create_all`` skips) receive the same indexes.
_COMPOSITE_INDEXES: list[tuple[str, str, str]] = [
    ("ix_scans_idempotency_key", "scans", "idempotency_key"),
    ("ix_scans_repository_created", "scans", "repository_id, created_at"),
    ("ix_findings_scan_severity_status", "findings", "scan_id, severity, status"),
    ("ix_findings_scan_file", "findings", "scan_id, file_path"),
    ("ix_analysis_runs_scan_stage", "analysis_runs", "scan_id, stage"),
    ("ix_evidence_finding_order", "evidence", "finding_id, order_index"),
]


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
