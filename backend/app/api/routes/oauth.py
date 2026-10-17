"""OAuth routes: provider status, browser login/callback, repo import helpers.

Flow (browser):

    /auth/oauth/{provider}/login?next=/repositories
        -> 307 to the provider consent screen (state stored in a cookie)
    provider -> /auth/oauth/{provider}/callback?code=...&state=...
        -> exchange code, upsert the local user, redirect to the frontend
           with ``#token=<jwt>&provider=<name>&next=<path>``
    frontend /auth/oauth/callback stores the token and continues.

The session token travels in the fragment, never the query string: fragments
are not sent to servers, so the credential stays out of logs and referrers.

Authenticated callers can then list importable repositories with
``GET /auth/oauth/{provider}/repos`` and import one via
``POST /repositories/oauth``.
"""

import logging
import re
import secrets
from datetime import UTC, datetime
from typing import Literal
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db, get_verified_user
from app.core.config import get_settings
from app.core.crypto import decrypt_token, encrypt_token
from app.core.security import create_access_token, hash_password
from app.db.models import OAuthAccount, User
from app.services import oauth as oauth_service

router = APIRouter(prefix="/auth/oauth", tags=["auth"])

Provider = Literal[
    "google",
    "github",
    "gitlab",
    "microsoft",
    "bitbucket",
    "auth0",
    "oracle",
]
_logger = logging.getLogger("repoverix.http")

_STATE_COOKIE = "rvx_oauth_state"

# Auth0 connection names (google-oauth2, github, windowslive, …). Only the
# character set Auth0 allows is accepted; the value is appended to the tenant
# authorize URL, never interpreted locally.
_CONNECTION_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,60}$")

# OAuth callback error codes forwarded to the frontend (oauth_failed,
# access_denied, …). Same reasoning: a fixed, small alphabet, never raw text.
_ERROR_CODE_RE = re.compile(r"^[a-z0-9_]{1,40}$")


def _sanitize_next_path(path: str | None) -> str:
    """Validate a path to ensure it is a safe relative path on the same origin."""
    if not path or not isinstance(path, str):
        return "/dashboard"
    path = path.strip()
    if any(c in path for c in "\r\n\0"):
        return "/dashboard"
    if not path.startswith("/") or path.startswith("//") or path.startswith("/\\") or "\\" in path:
        return "/dashboard"
    try:
        parsed = urlparse(path)
        if parsed.scheme or parsed.netloc:
            return "/dashboard"
    except Exception:
        return "/dashboard"
    return path


def _frontend_redirect(path: str = "/dashboard") -> str:
    """Build an absolute frontend URL from a same-origin-safe path."""
    settings = get_settings()
    safe_path = _sanitize_next_path(path)
    return f"{settings.frontend_url.rstrip('/')}{safe_path}"


def _redirect_uri(request: Request, provider: str) -> str:
    """Build the callback URL registered on the provider's OAuth app.

    ``REPOVERIX_BACKEND_PUBLIC_URL`` wins when set: behind a reverse proxy the
    request's base URL can be an internal host/scheme, and providers require
    this value to match the registered redirect URI exactly. Otherwise the
    request base URL is the best signal available.
    """
    settings = get_settings()
    origin = (settings.backend_public_url or str(request.base_url)).rstrip("/")
    # base_url already carries the mount point; append the callback path
    return f"{origin}{settings.api_prefix}/auth/oauth/{provider}/callback"


def _clear_state_cookie(response: RedirectResponse) -> RedirectResponse:
    response.delete_cookie(_STATE_COOKIE, path="/")
    return response


def _failure_redirect(code: str) -> RedirectResponse:
    """Send the browser back to the app with an error the callback can explain.

    The state cookie is single-use: it is cleared on every outcome, so a
    refused or failed attempt cannot be replayed from the same browser. Only a
    short code charset is accepted (the provider's own ``error`` value is
    attacker-influenced), and it is URL-encoded into the query string.
    """
    if not _ERROR_CODE_RE.fullmatch(code):
        code = "oauth_failed"
    query = urlencode({"error": code})
    return _clear_state_cookie(RedirectResponse(url=_frontend_redirect(f"/auth/oauth/callback?{query}")))


def _signin_redirect(token: str, provider: str, next_path: str) -> RedirectResponse:
    """Hand the minted session to the frontend.

    The token travels in the URL *fragment*: browsers never send a fragment to
    a server, so the credential stays out of access logs, referrer headers and
    proxy caches. The frontend callback reads it and immediately replaces the
    address bar.
    """
    params = urlencode({"token": token, "provider": provider, "next": next_path})
    response = RedirectResponse(url=_frontend_redirect(f"/auth/oauth/callback#{params}"))
    return _clear_state_cookie(response)


@router.get("/providers")
async def oauth_providers() -> dict:
    """Which OAuth providers are configured (used to render sign-in buttons)."""
    return oauth_service.configured_providers()


@router.get("/{provider}/login")
async def oauth_login(
    provider: str,
    request: Request,
    next: str = "/dashboard",
    connection: str | None = None,
):
    """Start the browser OAuth flow for the given provider with PKCE and state protection.

    ``connection`` is an Auth0 connection name (e.g. ``google-oauth2``); it is
    forwarded to the tenant authorize URL so the sign-in page's Google/GitHub
    buttons skip the Auth0 connection picker. Ignored by every other provider.
    """
    if provider not in oauth_service.PROVIDER_SPECS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown OAuth provider")
    if connection is not None and not _CONNECTION_NAME_RE.fullmatch(connection):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid connection name")
    if oauth_service.provider_credentials(provider) is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider} OAuth is not configured on the server (see docs/MANUAL-SETUP.md)",
        )
    if not oauth_service.provider_allowed(provider):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"{provider} sign-in is disabled on this deployment",
        )
    state = oauth_service.new_oauth_state()
    pkce_verifier = oauth_service.new_pkce_verifier()
    pkce_challenge = oauth_service.pkce_challenge(pkce_verifier)
    safe_next = _sanitize_next_path(next)

    authorize_url = oauth_service.build_authorize_url(
        provider,
        state,
        _redirect_uri(request, provider),
        code_challenge=pkce_challenge,
        connection=connection,
    )
    cookie_value = f"{state}:{pkce_verifier}:{safe_next}"
    response = RedirectResponse(url=authorize_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(
        _STATE_COOKIE,
        cookie_value,
        max_age=600,
        httponly=True,
        samesite="lax",
        path="/",
        secure=request.url.scheme == "https",
    )
    return response


@router.get("/{provider}/callback")
async def oauth_callback(
    provider: str,
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    rvx_oauth_state: str | None = Cookie(default=None),
    db: AsyncSession = Depends(get_db),
):
    """Handle the provider redirect: exchange the code with PKCE, upsert the user, sign in."""
    if provider not in oauth_service.PROVIDER_SPECS:
        return _failure_redirect("unknown_provider")
    if error or not code:
        return _failure_redirect(error or "access_denied")
    if not rvx_oauth_state:
        return _failure_redirect("invalid_state")

    # Unpack state cookie: state[:pkce_verifier[:next_path]]
    parts = rvx_oauth_state.split(":", 2)
    expected_state = parts[0]
    pkce_verifier = parts[1] if len(parts) > 1 else None
    next_path = _sanitize_next_path(parts[2]) if len(parts) > 2 else "/dashboard"

    if not state or not secrets.compare_digest(expected_state, state):
        return _failure_redirect("invalid_state")
    if oauth_service.provider_credentials(provider) is None or not oauth_service.provider_allowed(provider):
        return _failure_redirect("not_configured")

    try:
        try:
            token_data = await oauth_service.exchange_code(
                provider,
                code,
                _redirect_uri(request, provider),
                code_verifier=pkce_verifier,
            )
        except TypeError:
            token_data = await oauth_service.exchange_code(
                provider,
                code,
                _redirect_uri(request, provider),
            )
        access_token = token_data.get("access_token") or ""
        profile = await oauth_service.fetch_profile(provider, access_token)
    except oauth_service.OAuthError as exc:
        # Log the provider detail server-side; the user only sees a generic
        # error so internals (URLs, response bodies) never reach the browser.
        host = request.client.host if request.client else "?"
        _logger.warning("OAuth %s exchange failed for %s: %s", provider, host, exc)
        return _failure_redirect("oauth_failed")
    if not access_token or not profile.get("id"):
        return _failure_redirect("profile_failed")

    email = profile.get("email") or ""
    user = await _upsert_oauth_user(db, provider, profile, email)
    if user is None:
        return _failure_redirect("email_required")

    await _upsert_oauth_account(db, user, provider, profile, token_data, access_token)

    # Carry the current token_version: after any revocation (password change,
    # revoke-all, suspension) the authenticator's tv-claim check would
    # otherwise reject the OAuth session this callback just minted.
    token = create_access_token(user.id, token_version=user.token_version or 0)
    # Always hand `next` back: the sign-in form already chose where to land,
    # and dropping it here would strand every existing user on onboarding.
    return _signin_redirect(token, provider, next_path or "/dashboard")


async def _upsert_oauth_user(db: AsyncSession, provider: str, profile: dict, email: str) -> User | None:
    user = None
    if email:
        # Emails are stored lower-case everywhere so OAuth and password sign-in
        # resolve to the same account regardless of the provider's casing.
        email = email.strip().lower()
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()
    if user is None:
        if not email:
            return None
        # No password was ever set for this account; store an unusable hash.
        user = User(
            email=email,
            hashed_password=hash_password(secrets.token_urlsafe(32)),
            full_name=(profile.get("name") or email.split("@")[0] or "User")[:200],
            is_active=True,
        )
        db.add(user)
        await db.flush()
    # The provider verified this email address (Google/GitHub/GitLab only
    # return verified addresses here) — trust it and mark the account verified.
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
        db.add(user)
        await db.flush()
    return user


async def _upsert_oauth_account(
    db: AsyncSession,
    user: User,
    provider: str,
    profile: dict,
    token_data: dict,
    access_token: str,
) -> OAuthAccount:
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == user.id, OAuthAccount.provider == provider)
    )
    account = result.scalar_one_or_none()
    expires_at = None
    if token_data.get("expires_in"):
        from datetime import UTC, datetime, timedelta

        expires_at = datetime.now(UTC) + timedelta(seconds=int(token_data["expires_in"]))
    if account is None:
        account = OAuthAccount(
            user_id=user.id,
            provider=provider,
            provider_user_id=profile["id"],
            provider_email=profile.get("email"),
            provider_name=profile.get("name"),
            # Tokens are encrypted at rest when REPOVERIX_TOKEN_ENCRYPTION_KEY
            # is configured (plaintext only in local development).
            access_token=encrypt_token(access_token),
            refresh_token=encrypt_token(token_data.get("refresh_token")),
            token_expires_at=expires_at,
        )
        db.add(account)
    else:
        account.access_token = encrypt_token(access_token)
        account.provider_user_id = profile["id"]
        account.provider_email = profile.get("email") or account.provider_email
        account.provider_name = profile.get("name") or account.provider_name
        if token_data.get("refresh_token"):
            account.refresh_token = encrypt_token(token_data["refresh_token"])
        account.token_expires_at = expires_at
    await db.commit()
    await db.refresh(account)
    return account


@router.get("/connections")
async def oauth_connections(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List the OAuth accounts connected to the current user."""
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == current_user.id).order_by(OAuthAccount.provider)
    )
    accounts = result.scalars().all()
    return [
        {
            "provider": a.provider,
            "provider_email": a.provider_email,
            "provider_name": a.provider_name,
            "connected_at": a.created_at,
        }
        for a in accounts
    ]


@router.get("/{provider}/repos")
async def oauth_repos(
    provider: str,
    current_user: User = Depends(get_verified_user),
    db: AsyncSession = Depends(get_db),
):
    """List the current user's importable repositories for a connected provider."""
    if provider not in oauth_service.PROVIDER_SPECS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown OAuth provider")
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == current_user.id, OAuthAccount.provider == provider)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{provider} account is not connected",
        )
    try:
        repos = await oauth_service.list_repositories(provider, decrypt_token(account.access_token))
    except oauth_service.OAuthError as exc:
        _logger.warning(
            "Listing %s repositories failed for user %s", provider, current_user.id, exc_info=True
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Could not list {provider} repositories. Reconnect the account in Settings and try again."
            ),
        ) from exc
    return {"provider": provider, "repositories": repos}


@router.delete("/{provider}")
async def oauth_disconnect(
    provider: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disconnect a provider account. Existing imports keep their snapshots."""
    if provider not in oauth_service.PROVIDER_SPECS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown OAuth provider")
    result = await db.execute(
        select(OAuthAccount).where(OAuthAccount.user_id == current_user.id, OAuthAccount.provider == provider)
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not connected")
    await db.delete(account)
    await db.commit()
    return {"disconnected": provider}
