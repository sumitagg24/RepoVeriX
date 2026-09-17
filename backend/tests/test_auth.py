"""Tests for authentication endpoints and the account-security policy.

Covers signup policy (disposable email, weak password, duplicate), login
policy (bad credentials, lockout, suspended, unverified), enumeration safety,
verification resend, password reset (including session revocation), and the
verification gate on expensive operations.
"""

import pytest
from httpx import AsyncClient

from app.core.security import hash_password
from app.db.models import User
from app.services import account_security as acct

STRONG = "correct horse battery staple 9"
STRONG2 = "another entirely different passphrase 7"


class TestAuth:
    """Test authentication endpoints."""

    @pytest.mark.asyncio
    async def test_signup(self, client: AsyncClient):
        """Test user signup with a policy-compliant password."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "newuser@example.com",
                "password": STRONG,
                "full_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["email_verified"] is False

    @pytest.mark.asyncio
    async def test_signup_weak_password_rejected(self, client: AsyncClient):
        """Common/breached passwords are rejected server-side."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "weakpw@example.com",
                "password": "password123",
                "full_name": "Weak",
            },
        )
        assert response.status_code == 422
        assert response.headers.get("x-error-code") == "WEAK_PASSWORD"

    @pytest.mark.asyncio
    async def test_signup_disposable_email_rejected(self, client: AsyncClient):
        """Disposable domains are blocked before account creation."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "attacker@mailinator.com",
                "password": STRONG,
                "full_name": "Burner",
            },
        )
        assert response.status_code == 422
        assert response.headers.get("x-error-code") == "DISPOSABLE_EMAIL"
        # Case-insensitivity of the domain match.
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "Attacker@Mailinator.COM",
                "password": STRONG,
                "full_name": "Burner",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_signup_free_providers_allowed(self, client: AsyncClient):
        """Legitimate free providers are not blocked (domain policy)."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "realuser@proton.me",
                "password": STRONG,
                "full_name": "Real",
            },
        )
        assert response.status_code == 201

    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, client: AsyncClient, test_user):
        """Test signup with duplicate email fails."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": test_user.email,
                "password": STRONG,
                "full_name": "Another User",
            },
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_login(self, client: AsyncClient, test_user):
        """Test user login."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "password123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["email_verified"] is True

    @pytest.mark.asyncio
    async def test_login_invalid_password(self, client: AsyncClient, test_user):
        """Test login with invalid password fails with the safe message."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401
        assert response.json()["detail"] == "We couldn't sign you in with that email and password."

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent user fails."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_enumeration_safe(self, client: AsyncClient, test_user):
        """Nonexistent email and wrong password produce identical responses."""
        missing = await client.post(
            "/api/v1/auth/login",
            json={"email": "ghost@example.com", "password": "whatever-nope-1"},
        )
        wrong = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "wrongpassword"},
        )
        assert missing.status_code == wrong.status_code == 401
        assert missing.json()["detail"] == wrong.json()["detail"]

    @pytest.mark.asyncio
    async def test_login_temporary_lockout(self, client: AsyncClient, test_user, db_session):
        """After the configured failure threshold the account cools down (423)."""
        settings_lock_at = 5
        # Record failures directly through the service (fast, no HTTP loop).
        for _ in range(settings_lock_at):
            await acct.record_failed_login(db_session, test_user)
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        assert response.status_code == 423
        assert response.headers.get("x-error-code") == "TEMPORARILY_LOCKED"

    @pytest.mark.asyncio
    async def test_login_suspended(self, client: AsyncClient, test_user, db_session):
        """Suspended accounts cannot authenticate."""
        test_user.is_active = False
        db_session.add(test_user)
        await db_session.commit()
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "password123"},
        )
        assert response.status_code == 403
        assert response.headers.get("x-error-code") == "SUSPENDED"

    @pytest.mark.asyncio
    async def test_login_unverified_rejected(self, client: AsyncClient, db_session):
        """Password accounts must verify their email before logging in."""
        user = User(
            email="unverified@example.com",
            hashed_password=hash_password(STRONG),
            full_name="Unverified",
            is_active=True,
            # email_verified_at intentionally None
        )
        db_session.add(user)
        await db_session.commit()
        response = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": STRONG},
        )
        assert response.status_code == 403
        assert response.headers.get("x-error-code") == "EMAIL_NOT_VERIFIED"

    @pytest.mark.asyncio
    async def test_password_reset_flow_and_session_revocation(
        self, client: AsyncClient, test_user, db_session, auth_headers
    ):
        """Full reset flow: request → token → new password; old sessions die."""
        response = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": test_user.email},
        )
        assert response.status_code == 200
        # Enumeration-safe response for a nonexistent account.
        missing = await client.post(
            "/api/v1/auth/forgot-password",
            json={"email": "no-such@example.com"},
        )
        assert missing.status_code == 200
        assert missing.json()["detail"] == response.json()["detail"]

        # Old token still valid before reset.
        me = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert me.status_code == 200

        # Perform the reset with a valid token.
        await db_session.refresh(test_user)
        assert test_user.password_reset_token_hash is not None
        from app.services.account_security import new_token  # noqa: F401

        # Re-issue to learn the plaintext (the emailed token cannot be recovered).
        token = await acct.issue_password_reset_token(db_session, test_user)
        response = await client.post(
            "/api/v1/auth/reset-password",
            json={
                "uid": str(test_user.id),
                "token": token,
                "new_password": "brand new strong passphrase 42",
            },
        )
        assert response.status_code == 200

        # The pre-reset token is now dead (token_version bumped).
        me = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert me.status_code == 401

        # Login with the new password works.
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": test_user.email, "password": "brand new strong passphrase 42"},
        )
        assert login.status_code == 200

    @pytest.mark.asyncio
    async def test_reset_token_single_use(self, client: AsyncClient, test_user, db_session):
        """A consumed reset token cannot be reused."""
        token = await acct.issue_password_reset_token(db_session, test_user)
        first = await client.post(
            "/api/v1/auth/reset-password",
            json={"uid": str(test_user.id), "token": token, "new_password": "one-time passphrase 11"},
        )
        assert first.status_code == 200
        replay = await client.post(
            "/api/v1/auth/reset-password",
            json={"uid": str(test_user.id), "token": token, "new_password": "one-time passphrase 12"},
        )
        assert replay.status_code == 400
        assert replay.headers.get("x-error-code") == "INVALID_TOKEN"

    @pytest.mark.asyncio
    async def test_verify_email_flow(self, client: AsyncClient, db_session):
        """Verification token unlocks the account."""
        user = User(
            email="verifyme@example.com",
            hashed_password=hash_password(STRONG),
            full_name="Verify Me",
            is_active=True,
        )
        db_session.add(user)
        await db_session.commit()

        token = await acct.issue_verification_token(db_session, user)
        response = await client.post(
            "/api/v1/auth/verify-email",
            json={"uid": str(user.id), "token": token},
        )
        assert response.status_code == 200
        await db_session.refresh(user)
        assert user.email_verified_at is not None

        # Login now succeeds.
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": user.email, "password": STRONG},
        )
        assert login.status_code == 200

    @pytest.mark.asyncio
    async def test_resend_verification_enumeration_safe(self, client: AsyncClient):
        """Resend responds identically whether or not the account exists."""
        known = await client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "unverified@example.com"},
        )
        unknown = await client.post(
            "/api/v1/auth/resend-verification",
            json={"email": "nobody-here@example.com"},
        )
        assert known.status_code == unknown.status_code == 200
        assert known.json() == unknown.json()

    @pytest.mark.asyncio
    async def test_verification_gate_blocks_scan(
        self, client: AsyncClient, test_user, db_session, test_repository
    ):
        """Unverified accounts cannot start scans (server-side gate)."""
        test_user.email_verified_at = None
        db_session.add(test_user)
        await db_session.commit()

        from app.core.security import create_access_token

        token = create_access_token(test_user.id, token_version=test_user.token_version or 0)
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id)},
            headers=headers,
        )
        assert response.status_code == 403
        assert response.headers.get("x-error-code") == "EMAIL_NOT_VERIFIED"

    @pytest.mark.asyncio
    async def test_verification_gate_blocks_repository(self, client: AsyncClient, test_user, db_session):
        """Unverified accounts cannot register repositories."""
        test_user.email_verified_at = None
        db_session.add(test_user)
        await db_session.commit()

        from app.core.security import create_access_token

        token = create_access_token(test_user.id, token_version=test_user.token_version or 0)
        headers = {"Authorization": f"Bearer {token}"}
        response = await client.post(
            "/api/v1/repositories",
            json={"name": "new-repo", "source_type": "git", "source_url": "https://git.example.com/x/y.git"},
            headers=headers,
        )
        assert response.status_code == 403
        assert response.headers.get("x-error-code") == "EMAIL_NOT_VERIFIED"

    @pytest.mark.asyncio
    async def test_change_password_revokes_other_sessions(self, client: AsyncClient, test_user, auth_headers):
        """Password change bumps token_version: old tokens stop working."""
        response = await client.post(
            "/api/v1/auth/change-password",
            json={"current_password": "password123", "new_password": "fresh passphrase 55"},
            headers=auth_headers,
        )
        assert response.status_code == 200
        new_token = response.json()["access_token"]

        old = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert old.status_code == 401
        new = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert new.status_code == 200

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers):
        """Test getting current user."""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["full_name"] == "Test User"
        assert data["email_verified"] is True

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without auth fails."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_security_overview(self, client: AsyncClient, test_user, auth_headers, db_session):
        """Security page payload: verification state + audit events."""
        from app.services import authaudit

        await authaudit.record(
            db_session,
            user_id=test_user.id,
            email=test_user.email,
            event=authaudit.AUTH_LOGIN_SUCCESS,
            ip="203.0.113.7",
        )
        response = await client.get("/api/v1/auth/security-overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email_verified"] is True
        assert data["account_status"] == "active"
        assert isinstance(data["recent_events"], list)
