"""Pytest configuration and fixtures."""

import asyncio
from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.core.config import Settings
from app.core.security import hash_password
from app.db.base import Base
from app.db.models import (
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    SourceType,
    User,
)
from app.main import app

# Override settings for testing
test_settings = Settings(
    database_url="sqlite+aiosqlite:///:memory:",
    auto_create_tables=True,
    jwt_secret="test-secret",
    debug=True,
)


@pytest.fixture(scope="session")
def event_loop():
    """Create event loop for async tests."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="function")
async def db_engine():
    """Create test database engine."""
    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield test_engine
    await test_engine.dispose()


@pytest_asyncio.fixture(scope="function")
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    """Create test database session."""
    async_session = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


@pytest_asyncio.fixture(scope="function")
async def client(db_session) -> AsyncGenerator[AsyncClient, None]:
    """Create test client with database override."""
    async def override_get_db():
        yield db_session

    from app.api.dependencies import get_db as get_db_dep
    app.dependency_overrides[get_db_dep] = override_get_db

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture(scope="function")
async def test_user(db_session) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        hashed_password=hash_password("password123"),
        full_name="Test User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture(scope="function")
async def auth_headers(test_user) -> dict:
    """Create auth headers for test user."""
    from app.core.security import create_access_token
    token = create_access_token(test_user.id)
    return {"Authorization": f"Bearer {token}"}


@pytest_asyncio.fixture(scope="function")
async def test_repository(db_session, test_user) -> Repository:
    """Create a test repository."""
    repo = Repository(
        owner_id=test_user.id,
        name="test-repo",
        source_type=SourceType.github,
        source_url="https://github.com/test/test-repo",
        default_branch="main",
        status="registered",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)
    return repo


@pytest_asyncio.fixture(scope="function")
async def test_scan(db_session, test_repository) -> Scan:
    """Create a test scan."""
    scan = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.completed,
    )
    db_session.add(scan)
    await db_session.commit()
    await db_session.refresh(scan)
    return scan