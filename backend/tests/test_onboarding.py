"""Tests for the first-run onboarding endpoints.

Step completion must be derived from real repository data — the tests plant
OAuth connections, repositories and scans directly and assert the status
endpoint reflects them, and that completion is idempotent.
"""

from datetime import datetime

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import create_access_token
from app.db.models import OAuthAccount, Repository, SourceType


@pytest.mark.asyncio
async def test_status_requires_auth(client: AsyncClient):
    response = await client.get("/api/v1/onboarding/status")
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_fresh_user_status_all_steps_incomplete(client: AsyncClient, auth_headers: dict):
    response = await client.get("/api/v1/onboarding/status", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["completed"] is False
    assert body["completed_at"] is None
    assert body["latest_repository"] is None
    assert body["steps"]["connect_provider"]["done"] is False
    assert body["steps"]["add_repository"]["done"] is False
    assert body["steps"]["run_first_scan"]["done"] is False


@pytest.mark.asyncio
async def test_steps_reflect_real_evidence(
    client: AsyncClient, db_session: AsyncSession, test_user, auth_headers: dict
):
    # 1) Connect a provider -> connect_provider flips on.
    db_session.add(
        OAuthAccount(
            user_id=test_user.id,
            provider="github",
            provider_user_id="12345",
            access_token="tok",
        )
    )
    await db_session.commit()
    body = (await client.get("/api/v1/onboarding/status", headers=auth_headers)).json()
    assert body["steps"]["connect_provider"]["done"] is True
    assert body["steps"]["connect_provider"]["detail"] == "github"
    assert body["steps"]["add_repository"]["done"] is False

    # 2) Add a repository -> add_repository flips on with a deep-link hint.
    repo = Repository(
        owner_id=test_user.id,
        name="acme/api",
        source_type=SourceType.github,
        source_url="https://github.com/acme/api",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)
    body = (await client.get("/api/v1/onboarding/status", headers=auth_headers)).json()
    assert body["steps"]["add_repository"]["done"] is True
    assert body["latest_repository"] == {"id": str(repo.id), "name": "acme/api"}
    assert body["steps"]["run_first_scan"]["done"] is False


@pytest.mark.asyncio
async def test_complete_is_idempotent_and_reported_in_status(
    client: AsyncClient, db_session: AsyncSession, test_user, auth_headers: dict
):
    first = await client.post("/api/v1/onboarding/complete", headers=auth_headers)
    assert first.status_code == 200
    body = first.json()
    assert body["completed"] is True
    first_ts = body["completed_at"]

    second = await client.post("/api/v1/onboarding/complete", headers=auth_headers)
    assert second.status_code == 200
    # The first timestamp wins — completion never regresses.
    assert second.json()["completed_at"] == first_ts

    status = (await client.get("/api/v1/onboarding/status", headers=auth_headers)).json()
    assert status["completed"] is True
    assert status["completed_at"] == first_ts

    # The timestamp is persisted for the user.
    await db_session.refresh(test_user)
    assert test_user.onboarding_completed_at is not None


@pytest.mark.asyncio
async def test_complete_persists_across_new_token(
    client: AsyncClient, db_session: AsyncSession, test_user, auth_headers: dict
):
    await client.post("/api/v1/onboarding/complete", headers=auth_headers)
    await db_session.refresh(test_user)

    # A freshly minted token (new login) must still see completion.
    fresh_headers = {"Authorization": f"Bearer {create_access_token(test_user.id)}"}
    status = (await client.get("/api/v1/onboarding/status", headers=fresh_headers)).json()
    assert status["completed"] is True
    assert datetime.fromisoformat(status["completed_at"]) is not None
