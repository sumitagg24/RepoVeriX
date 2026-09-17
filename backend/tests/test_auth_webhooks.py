"""Security tests for the authentication webhook receiver.

Covers the webhook acceptance criteria: signature verification (forgery,
replay, malformed payloads) and idempotent user synchronization.
"""

import hashlib
import hmac
import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import get_settings
from app.db.models import User

WEBHOOK_URL = "/api/v1/auth/webhooks/user-sync"


def _sign(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


@pytest.fixture()
def webhook_secret(monkeypatch):
    """Enable the receiver with a known secret for the test session."""
    secret = "test-webhook-secret-0123456789abcdef"
    monkeypatch.setattr(get_settings(), "auth_webhook_secret", secret)
    return secret


@pytest.fixture()
def auth_headers(test_user) -> dict:
    from app.core.security import create_access_token

    token = create_access_token(test_user.id, token_version=test_user.token_version or 0)
    return {"Authorization": f"Bearer {token}"}


def _event_body(event_type: str, email: str, **record_extra) -> bytes:
    import json

    record = {"email": email, "email_verified": True, **record_extra}
    return json.dumps({"id": str(uuid.uuid4()), "type": event_type, "record": record}).encode()


class TestAuthWebhookSecurity:
    @pytest.mark.asyncio
    async def test_rejects_missing_signature(self, client: AsyncClient, webhook_secret):
        response = await client.post(WEBHOOK_URL, content=_event_body("user.created", "w@example.com"))
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_forged_signature(self, client: AsyncClient, webhook_secret):
        body = _event_body("user.created", "w@example.com")
        forged = _sign("attacker-secret-not-the-real-one", body)
        response = await client.post(WEBHOOK_URL, content=body, headers={"X-RVX-Signature": forged})
        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_rejects_when_unconfigured(self, client: AsyncClient, monkeypatch):
        monkeypatch.setattr(get_settings(), "auth_webhook_secret", None)
        body = _event_body("user.created", "w@example.com")
        response = await client.post(
            WEBHOOK_URL,
            content=body,
            headers={"X-RVX-Signature": _sign("anything", body)},
        )
        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_valid_event_creates_verified_user(self, client: AsyncClient, webhook_secret, db_session):
        body = _event_body("user.created", "synced@example.com", full_name="Synced User")
        response = await client.post(
            WEBHOOK_URL, content=body, headers={"X-RVX-Signature": _sign(webhook_secret, body)}
        )
        assert response.status_code == 200
        assert response.json()["detail"] == "ok"

        row = (await db_session.execute(select(User).where(User.email == "synced@example.com"))).scalar_one()
        assert row.full_name == "Synced User"
        assert row.email_verified_at is not None

    @pytest.mark.asyncio
    async def test_replay_is_absorbed(self, client: AsyncClient, webhook_secret, db_session):
        body = _event_body("user.created", "replay@example.com")
        headers = {"X-RVX-Signature": _sign(webhook_secret, body)}
        first = await client.post(WEBHOOK_URL, content=body, headers=headers)
        assert first.status_code == 200
        second = await client.post(WEBHOOK_URL, content=body, headers=headers)
        assert second.status_code == 200
        assert second.json()["detail"] == "duplicate"

        rows = (
            (await db_session.execute(select(User).where(User.email == "replay@example.com"))).scalars().all()
        )
        assert len(rows) == 1

    @pytest.mark.asyncio
    async def test_malformed_payload_rejected(self, client: AsyncClient, webhook_secret):
        body = b"{not json at all"
        response = await client.post(
            WEBHOOK_URL, content=body, headers={"X-RVX-Signature": _sign(webhook_secret, body)}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_missing_fields_rejected(self, client: AsyncClient, webhook_secret):
        import json

        body = json.dumps({"type": "user.created"}).encode()  # no id, no record
        response = await client.post(
            WEBHOOK_URL, content=body, headers={"X-RVX-Signature": _sign(webhook_secret, body)}
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_user_deleted_deactivates_and_revokes_sessions(
        self, client: AsyncClient, webhook_secret, db_session, test_user, auth_headers
    ):
        body = _event_body("user.deleted", test_user.email)
        response = await client.post(
            WEBHOOK_URL, content=body, headers={"X-RVX-Signature": _sign(webhook_secret, body)}
        )
        assert response.status_code == 200

        await db_session.refresh(test_user)
        assert test_user.is_active is False

        # The old session no longer authenticates (token_version bumped).
        me = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert me.status_code == 401
