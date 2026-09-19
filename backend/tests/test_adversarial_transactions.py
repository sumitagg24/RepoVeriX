"""Adversarial tests for transaction and lifecycle edges.

Each test targets a defect class found in the adversarial pass:

- Silent-loss: mailer template functions created a coroutine for the async
  ``send_email`` and never awaited it — no email was ever actually sent.
- Lifecycle: the OAuth callback minted its session token with the default
  ``token_version=0``, so after any revocation (password change, revoke-all)
  the next OAuth sign-in produced a token the authenticator immediately
  rejects — a permanent OAuth login dead-end.
- Atomicity: a rejected password change must not partially commit.
"""

import logging

from app.core.config import get_settings
from app.services import oauth as oauth_service

# ---------------------------------------------------------------------------
# 1. Mailer must actually emit (silent coroutine no-op regression guard)
# ---------------------------------------------------------------------------


async def test_mailer_actually_sends_verification_email(caplog):
    from app.services import mailer

    with caplog.at_level(logging.INFO, logger="repoverix.mailer"):
        await mailer.send_verification_email("victim@example.com", "uid-1", "tok-1")
    bodies = [r.getMessage() for r in caplog.records]
    assert any("Verify your RepoVeriX email" in b and "tok-1" in b for b in bodies), (
        "verification email body was never emitted — the mailer created an unawaited coroutine (silent no-op)"
    )


async def test_mailer_actually_sends_password_reset_email(caplog):
    from app.services import mailer

    with caplog.at_level(logging.INFO, logger="repoverix.mailer"):
        await mailer.send_password_reset_email("victim@example.com", "uid-1", "tok-2")
    bodies = [r.getMessage() for r in caplog.records]
    assert any("Reset your RepoVeriX password" in b and "tok-2" in b for b in bodies), (
        "password reset email body was never emitted — the mailer created an "
        "unawaited coroutine (silent no-op)"
    )


# ---------------------------------------------------------------------------
# 2. OAuth callback token must carry the current token_version
# ---------------------------------------------------------------------------


async def test_oauth_callback_token_survives_token_version_bump(client, db_session, monkeypatch):
    """Full callback flow, then simulate a revocation, then sign in again via
    OAuth: the freshly minted token must be accepted by /auth/me."""
    settings = get_settings()
    monkeypatch.setattr(settings, "github_oauth_client_id", "test-client-id", raising=False)
    monkeypatch.setattr(settings, "github_oauth_client_secret", "test-client-secret", raising=False)

    async def fake_exchange(provider, code, redirect_uri, client=None, **kwargs):
        return {"access_token": "provider-access-token"}

    async def fake_profile(provider, access_token, client=None):
        return {"id": "prov-9001", "email": "oauth-tv@example.com", "name": "OAuth TV"}

    monkeypatch.setattr(oauth_service, "exchange_code", fake_exchange)
    monkeypatch.setattr(oauth_service, "fetch_profile", fake_profile)

    from sqlalchemy import select

    from app.db.models import User

    async def sign_in_via_oauth() -> str:
        client.cookies.set("rvx_oauth_state", "s")
        try:
            resp = await client.get("/api/v1/auth/oauth/github/callback?code=c&state=s")
        finally:
            client.cookies.delete("rvx_oauth_state")  # type: ignore[misc]
        assert resp.status_code in (301, 302, 307), resp.text
        location = resp.headers["location"]
        fragment = location.split("?", 1)[1]
        params = dict(p.split("=", 1) for p in fragment.split("&"))
        assert params.get("provider") == "github", location
        return params["token"]

    token1 = await sign_in_via_oauth()

    # Sanity: the first token works.
    me = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert me.status_code == 200, me.text

    # Revoke every session out from under the user (as a password change would).
    result = await db_session.execute(select(User).where(User.email == "oauth-tv@example.com"))
    user = result.scalar_one()
    user.token_version = (user.token_version or 0) + 5
    db_session.add(user)
    await db_session.commit()

    old_token_rejected = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token1}"})
    assert old_token_rejected.status_code == 401

    # Sign in again via OAuth — the new token must carry the bumped version.
    token2 = await sign_in_via_oauth()
    me2 = await client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token2}"})
    assert me2.status_code == 200, (
        "OAuth sign-in issued a token with a stale/default token_version; "
        "after any revocation OAuth re-login can never authenticate"
    )


# ---------------------------------------------------------------------------
# 3. Failed password change must not half-commit
# ---------------------------------------------------------------------------


async def test_change_password_wrong_current_leaves_credentials_intact(
    client, test_user, auth_headers, db_session
):
    from app.core.security import verify_password

    resp = await client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "definitely-wrong", "new_password": "brand-new-password-99"},
        headers=auth_headers,
    )
    assert resp.status_code == 400

    await db_session.refresh(test_user)
    assert verify_password("password123", test_user.hashed_password), (
        "a rejected password change altered the stored credential"
    )
