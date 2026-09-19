"""OAuth2 plumbing for sign-in and repository import providers.

Supports Google (sign-in), GitHub and GitLab (sign-in + private repository
import). Credentials come from ``REPOVERIX_*_OAUTH_CLIENT_ID`` /
``..._CLIENT_SECRET`` environment variables. Every network call accepts an
optional ``httpx.AsyncClient`` so tests can inject a ``MockTransport``.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlencode

import httpx

from app.core.config import Settings, get_settings


@dataclass(frozen=True)
class ProviderSpec:
    """Static endpoint + scope configuration for one OAuth provider."""

    name: str
    authorize_url: str
    token_url: str
    userinfo_url: str
    scope: str
    # Endpoint used to list the user's repositories for import.
    repos_url: str | None = None


PROVIDER_SPECS: dict[str, ProviderSpec] = {
    "google": ProviderSpec(
        name="google",
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        userinfo_url="https://www.googleapis.com/oauth2/v3/userinfo",
        scope="openid email profile",
    ),
    "github": ProviderSpec(
        name="github",
        authorize_url="https://github.com/login/oauth/authorize",
        token_url="https://github.com/login/oauth/access_token",
        userinfo_url="https://api.github.com/user",
        scope="read:user user:email repo",
        repos_url="https://api.github.com/user/repos",
    ),
    "gitlab": ProviderSpec(
        name="gitlab",
        authorize_url="https://gitlab.com/oauth/authorize",
        token_url="https://gitlab.com/oauth/token",
        userinfo_url="https://gitlab.com/api/v4/user",
        scope="read_user read_api read_repository",
        repos_url="https://gitlab.com/api/v4/projects",
    ),
    "microsoft": ProviderSpec(
        name="microsoft",
        authorize_url="https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        token_url="https://login.microsoftonline.com/common/oauth2/v2.0/token",
        userinfo_url="https://graph.microsoft.com/v1.0/me",
        scope="openid email profile User.Read",
    ),
    "bitbucket": ProviderSpec(
        name="bitbucket",
        authorize_url="https://bitbucket.org/site/oauth2/authorize",
        token_url="https://bitbucket.org/site/oauth2/access_token",
        userinfo_url="https://api.bitbucket.org/2.0/user",
        scope="account email repository",
        repos_url="https://api.bitbucket.org/2.0/repositories",
    ),
}

_DISPLAY_NAMES: dict[str, str] = {
    "google": "Google",
    "github": "GitHub",
    "gitlab": "GitLab",
    "microsoft": "Microsoft",
    "bitbucket": "Bitbucket",
}


def provider_credentials(provider: str, settings: Settings | None = None) -> tuple[str, str] | None:
    """Return (client_id, client_secret) for a provider, or None if unconfigured."""
    settings = settings or get_settings()
    mapping = {
        "google": (settings.google_oauth_client_id, settings.google_oauth_client_secret),
        "github": (settings.github_oauth_client_id, settings.github_oauth_client_secret),
        "gitlab": (settings.gitlab_oauth_client_id, settings.gitlab_oauth_client_secret),
        "microsoft": (settings.microsoft_oauth_client_id, settings.microsoft_oauth_client_secret),
        "bitbucket": (settings.bitbucket_oauth_client_id, settings.bitbucket_oauth_client_secret),
    }
    client_id, client_secret = mapping.get(provider, (None, None))
    if not client_id or not client_secret:
        return None
    return client_id, client_secret


def configured_providers(settings: Settings | None = None) -> dict[str, dict[str, Any]]:
    """Public capability map: which providers have credentials configured."""
    settings = settings or get_settings()
    out: dict[str, dict[str, Any]] = {}
    for name in PROVIDER_SPECS:
        creds = provider_credentials(name, settings)
        out[name] = {
            "configured": creds is not None,
            "display_name": _DISPLAY_NAMES.get(name, name.capitalize()),
            "supports_repo_import": name in ("github", "gitlab", "bitbucket"),
            "supports_signin": True,
        }
    return out


def new_oauth_state() -> str:
    return secrets.token_urlsafe(32)


def build_authorize_url(
    provider: str, state: str, redirect_uri: str, settings: Settings | None = None
) -> str:
    """Build the provider authorization URL for the browser redirect."""
    spec = PROVIDER_SPECS[provider]
    client_id, _ = provider_credentials(provider, settings) or ("", "")
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": spec.scope,
        "state": state,
        "access_type": "offline" if provider == "google" else "none",
        "prompt": "select_account" if provider == "google" else "consent",
    }
    return f"{spec.authorize_url}?{urlencode(params)}"


def make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=httpx.Timeout(30.0), follow_redirects=True)


async def exchange_code(
    provider: str,
    code: str,
    redirect_uri: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict[str, Any]:
    """Exchange an authorization code for tokens. Returns the raw JSON body."""
    spec = PROVIDER_SPECS[provider]
    client_id, client_secret = provider_credentials(provider) or ("", "")
    headers = {"Accept": "application/json"}
    payload = {
        "grant_type": "authorization_code",
        "code": code,
        "redirect_uri": redirect_uri,
        "client_id": client_id,
        "client_secret": client_secret,
    }
    close = client is None
    client = client or make_client()
    try:
        resp = await client.post(spec.token_url, data=payload, headers=headers)
    finally:
        if close:
            await client.aclose()
    if resp.status_code >= 400:
        raise OAuthError(f"Token exchange failed ({resp.status_code}): {resp.text[:300]}")
    return resp.json()


async def fetch_profile(
    provider: str,
    access_token: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> dict[str, str]:
    """Fetch the provider profile and normalize to {id, email, name}."""
    spec = PROVIDER_SPECS[provider]
    headers = {"Authorization": f"Bearer {access_token}"}
    if provider == "github":
        headers["Accept"] = "application/vnd.github+json"
    close = client is None
    client = client or make_client()
    try:
        resp = await client.get(spec.userinfo_url, headers=headers)
        if resp.status_code >= 400:
            raise OAuthError(f"Profile fetch failed ({resp.status_code})")
        data = resp.json()
        if provider == "github":
            return {
                "id": str(data.get("id", "")),
                "email": data.get("email") or (await _github_primary_email(client, access_token)),
                "name": data.get("name") or data.get("login") or "",
            }
        if provider == "google":
            return {
                "id": str(data.get("sub", "")),
                "email": data.get("email", ""),
                "name": data.get("name", ""),
            }
        if provider == "microsoft":
            # Microsoft Graph: id = AAD object ID, email comes from userPrincipalName
            return {
                "id": str(data.get("id", "")),
                "email": data.get("mail") or data.get("userPrincipalName", ""),
                "name": data.get("displayName", ""),
            }
        if provider == "bitbucket":
            # Bitbucket /2.0/user: uuid is the stable identifier
            return {
                "id": str(data.get("uuid") or data.get("account_id", "")),
                "email": data.get("email", ""),  # may be empty; enriched from /2.0/user/emails
                "name": data.get("display_name") or data.get("nickname", ""),
            }
        # gitlab (and any future provider)
        return {
            "id": str(data.get("id", "")),
            "email": data.get("email", ""),
            "name": data.get("name") or data.get("username") or "",
        }
    finally:
        if close:
            await client.aclose()


async def _github_primary_email(client: httpx.AsyncClient, access_token: str) -> str:
    resp = await client.get(
        "https://api.github.com/user/emails",
        headers={"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"},
    )
    if resp.status_code >= 400:
        return ""
    emails = resp.json()
    if not isinstance(emails, list):
        return ""
    primary = next((e for e in emails if e.get("primary") and e.get("verified")), None) or (
        next((e for e in emails if e.get("verified")), None) or {}
    )
    return str(primary.get("email") or "")


async def list_repositories(
    provider: str,
    access_token: str,
    *,
    client: httpx.AsyncClient | None = None,
) -> list[dict[str, Any]]:
    """List the user's accessible repositories for the import picker."""
    spec = PROVIDER_SPECS[provider]
    headers = {"Authorization": f"Bearer {access_token}"}
    if provider == "github":
        headers["Accept"] = "application/vnd.github+json"
    close = client is None
    client = client or make_client()
    try:
        if provider == "github":
            resp = await client.get(
                spec.repos_url, params={"sort": "updated", "per_page": 100}, headers=headers
            )
            data = resp.json() if resp.status_code < 400 else []
            if not isinstance(data, list):
                return []
            return [
                {
                    "id": str(r.get("id", "")),
                    "name": r.get("name", ""),
                    "full_name": r.get("full_name", ""),
                    "description": r.get("description"),
                    "html_url": r.get("html_url", ""),
                    "default_branch": r.get("default_branch") or "main",
                    "private": bool(r.get("private", False)),
                }
                for r in data
            ]
        # gitlab
        resp = await client.get(
            spec.repos_url,
            params={"membership": "true", "per_page": 100, "order_by": "updated_at", "simple": "true"},
            headers=headers,
        )
        data = resp.json() if resp.status_code < 400 else []
        if not isinstance(data, list):
            return []
        return [
            {
                "id": str(p.get("id", "")),
                "name": p.get("name", ""),
                "full_name": p.get("path_with_namespace", ""),
                "description": p.get("description"),
                "html_url": p.get("web_url", ""),
                "default_branch": p.get("default_branch") or "main",
                "private": p.get("visibility") in ("private", "internal"),
            }
            for p in data
        ]
    finally:
        if close:
            await client.aclose()


class OAuthError(RuntimeError):
    """Raised when a provider exchange or profile fetch fails."""
