"""Adversarial sweep closure: flush-without-commit / lost-write defect class.

Production ``get_db`` closes the request session without committing; the test
override shares one session that conftest commits — that asymmetry hid the
authaudit and mailer bugs. These tests prove the remaining named defect
(billing rollover writes lost on GET /billing) and guard against regressions:

1. A rollover triggered by GET /billing must be visible to a *fresh request*
   against the same database — proven with a prod-shaped override (one new
   session per request over a temp-file SQLite where only committed data is
   readable) instead of the shared-session test client.
2. The same proof at the service layer: the rollover must be
   caller-independent.
3. The rollover must stay a no-op for an active period.
4. A static guard: every billing symbol any route imports must exist — the
   sweep found ``assert_can_fix`` imported by automation.py without existing
   (ImportError at request time on a live route).
"""

import tempfile
from pathlib import Path

import httpx
import pytest_asyncio
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.models import User
from app.services import billing as billing_service


@pytest_asyncio.fixture
async def prod_client():
    """ASGI client wired exactly like production get_db: a fresh session per
    request over a temp-file SQLite engine (committed-data-only visibility)."""
    tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    tmp.close()
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp.name}")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    from app.api.dependencies import get_db as get_db_dep
    from app.main import app

    async def override_get_db():
        async with factory() as session:
            yield session

    app.dependency_overrides[get_db_dep] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac, factory
    app.dependency_overrides.pop(get_db_dep, None)
    await engine.dispose()
    Path(tmp.name).unlink(missing_ok=True)


async def _seed_user(
    session: AsyncSession,
    *,
    period_end,
    scans: int = 7,
    fixes: int = 5,
    verifications: int = 3,
):
    """Seed a verified user with usage; return the id for later re-reads."""
    import uuid
    from datetime import UTC, datetime

    from app.core.security import hash_password

    user = User(
        email=f"rollover-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=hash_password("password123"),
        full_name="Rollover Probe",
        is_active=True,
        email_verified_at=datetime.now(UTC),
        plan="free",
        current_period_end=period_end,
        scans_used=scans,
        fixes_used=fixes,
        verifications_used=verifications,
    )
    session.add(user)
    await session.commit()
    return user.id


def _auth_headers(user_id) -> dict:
    from app.core.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user_id)}"}


async def test_get_billing_persists_rollover_across_requests(prod_client):
    """End-to-end: after GET /billing rolls the period over, the *database*
    (fresh session, committed data only) must hold the reset counters.

    Note the response body always shows rolled-over values — the handler
    reads the dirty in-session attributes — which is precisely why this
    defect is invisible from the API surface and only visible in the DB.
    """
    client, factory = prod_client
    from datetime import UTC, datetime, timedelta

    async with factory() as session:
        user_id = await _seed_user(session, period_end=datetime.now(UTC) - timedelta(days=1))

    first = await client.get("/api/v1/billing", headers=_auth_headers(user_id))
    assert first.status_code == 200, first.text
    assert first.json()["usage"]["scans_used"] == 0  # in-memory view, masks the bug

    async with factory() as probe:
        persisted = (await probe.execute(select(User).where(User.id == user_id))).scalar_one()
        assert persisted.scans_used == 0 and persisted.fixes_used == 0, (
            "GET /billing mutated rollover state but never committed it — the "
            "DB still holds the stale counters and the reset is recomputed "
            "(and re-lost) on every request"
        )
        assert persisted.current_period_end is not None


async def test_rollover_if_needed_persists_through_fresh_session(db_session, session_factory):
    """Service-level caller-independence: the rollover must commit its own
    write so every caller (including exception-raisers) inherits safety."""
    from datetime import UTC, datetime, timedelta

    user_id = await _seed_user(db_session, period_end=datetime.now(UTC) - timedelta(days=1))

    await billing_service.rollover_if_needed(db_session, await db_session.get(User, user_id))

    async with session_factory() as probe:
        persisted = (await probe.execute(select(User).where(User.id == user_id))).scalar_one()
        assert persisted.scans_used == 0, (
            "rollover_if_needed only flushed; a caller without a later commit loses the reset entirely"
        )


async def test_rollover_noop_when_period_active(db_session, session_factory):
    """An active period must not be touched (idempotency of the fix)."""
    from datetime import UTC, datetime, timedelta

    user_id = await _seed_user(
        db_session,
        period_end=datetime.now(UTC) + timedelta(days=10),
        scans=4,
        fixes=2,
        verifications=1,
    )
    user = await db_session.get(User, user_id)

    await billing_service.rollover_if_needed(db_session, user)
    assert user.scans_used == 4  # untouched in-session

    async with session_factory() as probe:
        persisted = (await probe.execute(select(User).where(User.id == user.id))).scalar_one()
        assert persisted.scans_used == 4


def test_billing_symbols_imported_by_routes_exist():
    """The sweep found automation.py importing ``assert_can_fix``, which does
    not exist — an ImportError raised at request time on a live route. This
    guard fails while any billing import in app/api/routes is a phantom."""
    import ast

    routes_dir = Path("app/api/routes")
    offenders: list[str] = []
    for path in routes_dir.glob("*.py"):
        tree = ast.parse(path.read_text(encoding="utf-8"))
        for node in ast.walk(tree):
            if not isinstance(node, (ast.ImportFrom, ast.Import)):
                continue
            module = node.module if isinstance(node, ast.ImportFrom) else ""
            if module != "app.services.billing":
                continue
            for alias in node.names:
                if not hasattr(billing_service, alias.name):
                    offenders.append(f"{path.name}: {alias.name}")
    assert not offenders, (
        f"routes import billing symbols that do not exist (ImportError at request time): {offenders}"
    )
