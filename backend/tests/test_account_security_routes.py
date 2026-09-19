"""Tests for session-management endpoints, profile update, and the dev-mode
verification link contract.

The dev link must exist only when the mail backend is the console logger
(no real delivery to intercept) and must never appear when SMTP is configured.
"""

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.core.config import get_settings
from app.core.security import create_access_token
from app.db.models import User
from app.services import account_security as acct
from app.services import authaudit


@pytest.fixture()
def auth_headers(test_user) -> dict:
    token = create_access_token(test_user.id, token_version=test_user.token_version or 0)
    return {"Authorization": f"Bearer {token}"}


class TestSessionManagement:
    @pytest.mark.asyncio
    async def test_logout_records_audit_event(self, client: AsyncClient, test_user, db_session, auth_headers):
        response = await client.post("/api/v1/auth/logout", headers=auth_headers)
        assert response.status_code == 200

        events = (
            (
                await db_session.execute(
                    select(authaudit.AuthEvent).where(
                        authaudit.AuthEvent.user_id == test_user.id,
                        authaudit.AuthEvent.event == authaudit.AUTH_LOGOUT,
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(events) == 1

    @pytest.mark.asyncio
    async def test_logout_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/logout")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_revoke_all_invalidates_old_token_and_issues_new(
        self, client: AsyncClient, test_user, db_session, auth_headers
    ):
        old_version = test_user.token_version or 0
        response = await client.post("/api/v1/auth/revoke-all-sessions", headers=auth_headers)
        assert response.status_code == 200
        new_token = response.json()["access_token"]
        assert new_token

        # The old token is dead (tv claim no longer matches).
        old_me = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert old_me.status_code == 401

        # The fresh token returned for this session works.
        new_me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert new_me.status_code == 200

        await db_session.refresh(test_user)
        assert test_user.token_version == old_version + 1

        # Audit trail recorded the revocation.
        events = (
            (
                await db_session.execute(
                    select(authaudit.AuthEvent).where(
                        authaudit.AuthEvent.user_id == test_user.id,
                        authaudit.AuthEvent.event == authaudit.AUTH_SESSION_REVOKED,
                    )
                )
            )
            .scalars()
            .all()
        )
        assert len(events) == 1

    @pytest.mark.asyncio
    async def test_revoke_all_requires_auth(self, client: AsyncClient):
        response = await client.post("/api/v1/auth/revoke-all-sessions")
        assert response.status_code == 401


class TestProfileUpdate:
    @pytest.mark.asyncio
    async def test_update_display_name(self, client: AsyncClient, test_user, auth_headers):
        response = await client.put(
            "/api/v1/auth/me",
            json={"full_name": "Renamed User"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        assert response.json()["full_name"] == "Renamed User"

        me = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert me.json()["full_name"] == "Renamed User"

    @pytest.mark.asyncio
    async def test_update_requires_auth(self, client: AsyncClient):
        response = await client.put("/api/v1/auth/me", json={"full_name": "Nope"})
        assert response.status_code == 401


class TestDevVerificationLink:
    @pytest.mark.asyncio
    async def test_signup_includes_dev_link_in_console_mode(self, client: AsyncClient):
        """console backend → response carries the link so the loop completes."""
        assert get_settings().email_backend == "console"  # test env default
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "devlink@example.com",
                "password": "D3v-link-passphrase-1",
                "full_name": "Dev Link",
            },
        )
        assert response.status_code == 201
        url = response.json().get("dev_verification_url")
        assert url and "/auth/verify-email?uid=" in url and "&token=" in url

        # The link must actually work end-to-end.
        uid = url.split("uid=")[1].split("&")[0]
        token = url.split("token=")[1]
        verify = await client.post("/api/v1/auth/verify-email", json={"uid": uid, "token": token})
        assert verify.status_code == 200

    @pytest.mark.asyncio
    async def test_signup_omits_dev_link_in_smtp_mode(self, client: AsyncClient, monkeypatch):
        """SMTP backend → the link travels by email only, never in the body."""
        monkeypatch.setattr(get_settings(), "email_backend", "smtp")
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "smtplink@example.com",
                "password": "S0mtp-passphrase-99",
                "full_name": "SMTP Link",
            },
        )
        assert response.status_code == 201
        assert response.json().get("dev_verification_url") is None

    @pytest.mark.asyncio
    async def test_resend_includes_dev_link_in_console_mode(self, client: AsyncClient, db_session):
        user = User(
            email="resenddev@example.com",
            hashed_password=acct.hash_password_safe("R3send-passphrase-7")
            if hasattr(acct, "hash_password_safe")
            else __import__("app.core.security", fromlist=["hash_password"]).hash_password(
                "R3send-passphrase-7"
            ),
            full_name="Resend Dev",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        response = await client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "resenddev@example.com"},
        )
        assert response.status_code == 200
        assert response.json().get("dev_verification_url")

    @pytest.mark.asyncio
    async def test_resend_unknown_email_has_no_dev_link(self, client: AsyncClient):
        """Enumeration safety survives the dev-link feature."""
        response = await client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "nobody@nowhere.example"},
        )
        assert response.status_code == 200
        assert response.json().get("dev_verification_url") is None
