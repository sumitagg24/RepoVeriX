"""OAuth routes: provider status, browser login/callback, repo import helpers.

Flow (browser):

    /auth/oauth/{provider}/login?next=/repositories
        -> 307 to the provider consent screen (state stored in a cookie)
    provider -> /auth/oauth/{provider}/callback?code=...&state=...
        -> exchange code, upsert the local user, redirect to the frontend
           with ``?token=<jwt>&provider=<name>``
    frontend /auth/oauth/callback stores the token and continues.

Authenticated callers can then list importable repositories with
``GET /auth/oauth/{provider}/repos`` and import one via
``POST /repositories/oauth``.
"""

import secrets
from typing import Literal
from urllib.parse import urlencode

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.security import create_access_token, hash_password
from app.db.models import OAuthAccount, User
from app.services import oauth as oauth_service

router = APIRouter(prefix="/auth/oauth", tags=["auth"])

Provider = Literal["google", "github", "gitlab"]

_STATE_COOKIE = "rvx_oauth_state"


def _frontend_redirect(path: str = "/dashboard") -> str:
    """Build an absolute frontend URL from a same-origin-safe path."""
    settings = get_settings()
    if not path.startswith("/") or path.startswith("//"):
        path = "/dashboard"
    return f"{settings.frontend_url.rstrip('/')}{path}"


def _redirect_uri(request: Request, provider: str) -> str:
    settings = get_settings()
    origin = str(request.base_url).rstrip("/")
    # base_url already carries the mount point; append the callback path
    return f"{origin}{settings.api_prefix}/auth/oauth/{provider}/callback"


@router.get("/providers")
async def oauth_providers() -> dict:
    """Which OAuth providers are configured (used to render sign-in buttons)."""
    return oauth_service.configured_providers()


@router.get("/{provider}/login")
async def oauth_login(provider: str, request: Request, next: str = "/dashboard"):
    """Start the browser OAuth flow for the given provider."""
    if provider not in oauth_service.PROVIDER_SPECS:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Unknown OAuth provider")
    if oauth_service.provider_credentials(provider) is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=f"{provider} OAuth is not configured on the server (see MANUAL-SETUP.md)",
        )
    state = oauth_service.new_oauth_state()
    authorize_url = oauth_service.build_authorize_url(provider, state, _redirect_uri(request, provider))
    response = RedirectResponse(url=authorize_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)
    response.set_cookie(
        _STATE_COOKIE,
        state,
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
    """Handle the provider redirect: exchange the code, upsert the user, sign in."""
    if provider not in oauth_service.PROVIDER_SPECS:
        return RedirectResponse(url=_frontend_redirect("/auth/oauth/callback?error=unknown_provider"))
    if error or not code:
        return RedirectResponse(
            url=_frontend_redirect(f"/auth/oauth/callback?error={error or 'access_denied'}")
        )
    if not rvx_oauth_state or rvx_oauth_state != state:
        return RedirectResponse(url=_frontend_redirect("/auth/oauth/callback?error=invalid_state"))
    if oauth_service.provider_credentials(provider) is None:
        return RedirectResponse(url=_frontend_redirect("/auth/oauth/callback?error=not_configured"))

    try:
        token_data = await oauth_service.exchange_code(provider, code, _redirect_uri(request, provider))
        access_token = token_data.get("access_token") or ""
        profile = await oauth_service.fetch_profile(provider, access_token)
    except oauth_service.OAuthError as exc:
        params = urlencode({"error": f"oauth:{str(exc)[:120]}"})
        return RedirectResponse(url=_frontend_redirect(f"/auth/oauth/callback?{params}"))
    if not access_token or not profile.get("id"):
        return RedirectResponse(url=_frontend_redirect("/auth/oauth/callback?error=profile_failed"))

    email = profile.get("email") or ""
    user = await _upsert_oauth_user(db, provider, profile, email)
    if user is None:
        return RedirectResponse(url=_frontend_redirect("/auth/oauth/callback?error=email_required"))

    await _upsert_oauth_account(db, user, provider, profile, token_data, access_token)

    token = create_access_token(user.id)
    params = urlencode({"token": token, "provider": provider})
    response = RedirectResponse(url=_frontend_redirect(f"/auth/oauth/callback?{params}"))
    response.delete_cookie(_STATE_COOKIE, path="/")
    return response


async def _upsert_oauth_user(db: AsyncSession, provider: str, profile: dict, email: str) -> User | None:
    user = None
    if email:
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
            access_token=access_token,
            refresh_token=token_data.get("refresh_token"),
            token_expires_at=expires_at,
        )
        db.add(account)
    else:
        account.access_token = access_token
        account.provider_user_id = profile["id"]
        account.provider_email = profile.get("email") or account.provider_email
        account.provider_name = profile.get("name") or account.provider_name
        if token_data.get("refresh_token"):
            account.refresh_token = token_data["refresh_token"]
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
    current_user: User = Depends(get_current_user),
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
        repos = await oauth_service.list_repositories(provider, account.access_token)
    except oauth_service.OAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Could not list {provider} repositories: {exc}",
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
