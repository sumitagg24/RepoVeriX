"""GitHub REST service for pull-request auditing.

Thin, typed access to the GitHub API used by the PR auditor:

- ``fetch_pr``        PR metadata (title, base/head ref+sha, author, url)
- ``post_pr_review``  post an inline review with line comments (explicit opt-in)

Token resolution: a user's connected GitHub ``OAuthAccount`` token wins, then
``REPOVERIX_GITHUB_TOKEN``. Tokens are only ever sent in the ``Authorization``
header and are never included in responses or logs. Tests inject a mock
``httpx.AsyncClient`` instead of hitting api.github.com.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

import httpx

from app.core.config import Settings, get_settings

_GITHUB_URL_RE = re.compile(
    r"(?:https?://)?(?:www\.)?github\.com[:/](?P<owner>[A-Za-z0-9_.-]+)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)


@dataclass
class PullRequest:
    number: int
    title: str
    body: str | None
    state: str
    author: str | None
    html_url: str
    base_ref: str
    base_sha: str
    head_ref: str
    head_sha: str
    mergeable: bool | None = None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> PullRequest:
        base = data.get("base") or {}
        head = data.get("head") or {}
        return cls(
            number=int(data.get("number") or 0),
            title=str(data.get("title") or ""),
            body=data.get("body"),
            state=str(data.get("state") or ""),
            author=(data.get("user") or {}).get("login"),
            html_url=str(data.get("html_url") or ""),
            base_ref=str(base.get("ref") or "main"),
            base_sha=str(base.get("sha") or ""),
            head_ref=str(head.get("ref") or ""),
            head_sha=str(head.get("sha") or ""),
            mergeable=data.get("mergeable"),
        )


def repo_ident(source_url: str | None) -> tuple[str, str] | None:
    """Parse ``owner/repo`` from a repository source URL (github.com)."""
    if not source_url:
        return None
    match = _GITHUB_URL_RE.match(source_url.strip())
    if not match:
        return None
    return match.group("owner"), match.group("repo")


def resolve_token(settings: Settings | None = None, oauth_access_token: str | None = None) -> str | None:
    """Connected-account token wins; the server-level token is the fallback."""
    settings = settings or get_settings()
    return oauth_access_token or settings.github_token


def _auth_headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "RepoVeriX-PRAuditor",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


async def fetch_pr(
    owner: str,
    repo: str,
    number: int,
    *,
    token: str | None = None,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> PullRequest:
    """Fetch PR metadata from the GitHub API."""
    settings = settings or get_settings()
    url = f"{settings.github_api_base_url}/repos/{owner}/{repo}/pulls/{number}"
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=settings.github_api_timeout_seconds,
    )
    try:
        response = await client.get(url)
    finally:
        if owns_client:
            await client.aclose()
    if response.status_code == 404:
        raise GithubApiError(f"Pull request #{number} not found or repository is private/not accessible", 404)
    if response.status_code in (401, 403):
        raise GithubApiError("GitHub authentication required for this repository", response.status_code)
    if response.status_code != 200:
        raise GithubApiError(f"GitHub API error {response.status_code}", response.status_code)
    return PullRequest.from_api(response.json())


async def post_pr_review(
    owner: str,
    repo: str,
    number: int,
    *,
    body: str,
    comments: list[dict[str, Any]],
    token: str,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Post a PR review (event COMMENT) with inline comments.

    ``comments`` entries: ``{"path": str, "line": int, "body": str}`` where
    ``line`` is a 1-based line number in the *head* file that must sit inside
    an added hunk of the diff (GitHub rejects out-of-diff lines).
    """
    settings = settings or get_settings()
    url = f"{settings.github_api_base_url}/repos/{owner}/{repo}/pulls/{number}/reviews"
    payload: dict[str, Any] = {"body": body[:65000], "event": "COMMENT"}
    if comments:
        payload["comments"] = [c for c in comments if c.get("path") and c.get("line")][:50]
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=settings.github_api_timeout_seconds,
    )
    try:
        response = await client.post(url, json=payload)
    finally:
        if owns_client:
            await client.aclose()
    if response.status_code not in (200, 201):
        content_type = response.headers.get("content-type", "")
        if content_type.startswith("application/json"):
            payload = response.json()
            detail = str((payload.get("message") if isinstance(payload, dict) else "") or response.text)
        else:
            detail = response.text
        message = f"GitHub rejected the review ({response.status_code}): {detail[:400]}"
        raise GithubApiError(message, response.status_code)
    return response.json()


class GithubApiError(Exception):
    """Raised when the GitHub API call fails; carries an HTTP-ish status."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status
