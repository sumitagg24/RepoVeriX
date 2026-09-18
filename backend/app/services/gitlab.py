"""GitLab REST service for merge-request auditing.

Mirrors the GitHub service interface so the PR audit route can dispatch to
either provider transparently:

- ``repo_ident``        parse ``owner/repo`` from a GitLab source URL
- ``fetch_mr``          MR metadata → ``MergeRequest`` dataclass
- ``list_mrs``          open/merged MRs for a repository
- ``post_mr_note``      post a root-level MR comment (general note)
- ``post_commit_status``create a pipeline status on a commit SHA

Token resolution: a user's connected GitLab ``OAuthAccount`` token is tried
first; ``REPOVERIX_GITLAB_TOKEN`` (server-level fallback) is used when no
connected account is available.

All tokens are sent only in the ``Authorization`` header; they are never
included in responses, logs, or error messages.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import quote

import httpx

from app.core.config import Settings, get_settings

# Matches self-hosted GitLab instances too (gitlab.example.com)
_GITLAB_URL_RE = re.compile(
    r"(?:https?://)?(?P<host>[A-Za-z0-9._-]+)"
    r"[:/](?P<namespace>[A-Za-z0-9_./-]+?)/(?P<repo>[A-Za-z0-9_.-]+?)(?:\.git)?/?$",
    re.IGNORECASE,
)
_GITLAB_COM = "https://gitlab.com"


def repo_ident(source_url: str | None) -> tuple[str, str, str] | None:
    """Parse ``(host, namespace/group, repo)`` from a GitLab source URL.

    Returns ``None`` when the URL does not look like a GitLab URL.  The caller
    must verify the returned host is actually a GitLab instance; we check that
    the URL contains ``gitlab`` in the host as a lightweight heuristic.
    """
    if not source_url:
        return None
    m = _GITLAB_URL_RE.match(source_url.strip())
    if m is None:
        return None
    host = m.group("host")
    if "gitlab" not in host.lower():
        return None
    namespace = m.group("namespace")
    repo = m.group("repo")
    return host, namespace, repo


def _project_id_encoded(namespace: str, repo: str) -> str:
    """URL-encode ``namespace/repo`` for GitLab's ``:id`` path parameter."""
    return quote(f"{namespace}/{repo}", safe="")


def _api_base(host: str) -> str:
    scheme = "https"
    if host in ("localhost", "127.0.0.1") or host.startswith("localhost:"):
        scheme = "http"
    return f"{scheme}://{host}/api/v4"


def _auth_headers(token: str | None) -> dict[str, str]:
    headers = {
        "Accept": "application/json",
        "User-Agent": "RepoVeriX-MRAuditor",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    return headers


def resolve_token(
    settings: Settings | None = None,
    oauth_access_token: str | None = None,
) -> str | None:
    """Connected-account OAuth token wins; server-level token is the fallback."""
    settings = settings or get_settings()
    server_token = getattr(settings, "gitlab_token", None)
    return oauth_access_token or server_token


# --------------------------------------------------------------------------- data classes


@dataclass
class MergeRequest:
    iid: int  # project-scoped MR number (the one users see)
    title: str
    description: str | None
    state: str  # "opened" | "merged" | "closed"
    author: str | None
    web_url: str
    source_branch: str
    target_branch: str
    sha: str  # HEAD sha of the source branch
    merge_commit_sha: str | None
    diff_refs_base_sha: str | None
    diff_refs_head_sha: str | None
    diff_refs_start_sha: str | None

    @classmethod
    def from_api(cls, data: dict[str, Any]) -> "MergeRequest":
        diff_refs = data.get("diff_refs") or {}
        return cls(
            iid=int(data.get("iid") or 0),
            title=str(data.get("title") or ""),
            description=data.get("description"),
            state=str(data.get("state") or ""),
            author=(data.get("author") or {}).get("username"),
            web_url=str(data.get("web_url") or ""),
            source_branch=str(data.get("source_branch") or ""),
            target_branch=str(data.get("target_branch") or ""),
            sha=str(data.get("sha") or ""),
            merge_commit_sha=data.get("merge_commit_sha"),
            diff_refs_base_sha=diff_refs.get("base_sha"),
            diff_refs_head_sha=diff_refs.get("head_sha"),
            diff_refs_start_sha=diff_refs.get("start_sha"),
        )

    @property
    def base_sha(self) -> str:
        return self.diff_refs_base_sha or ""

    @property
    def head_sha(self) -> str:
        return self.diff_refs_head_sha or self.sha


# --------------------------------------------------------------------------- API calls


class GitlabApiError(Exception):
    """Raised when the GitLab API call fails; carries an HTTP-ish status."""

    def __init__(self, message: str, status: int = 400):
        super().__init__(message)
        self.status = status


async def fetch_mr(
    host: str,
    namespace: str,
    repo: str,
    iid: int,
    *,
    token: str | None = None,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> MergeRequest:
    """Fetch MR metadata from the GitLab API."""
    settings = settings or get_settings()
    pid = _project_id_encoded(namespace, repo)
    url = f"{_api_base(host)}/projects/{pid}/merge_requests/{iid}"
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=float(settings.github_api_timeout_seconds),  # reuse same timeout setting
    )
    try:
        response = await client.get(url, params={"include_diverged_commits_count": "true"})
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code == 404:
        raise GitlabApiError(f"Merge request !{iid} not found or project is not accessible", 404)
    if response.status_code in (401, 403):
        raise GitlabApiError("GitLab authentication required for this project", response.status_code)
    if response.status_code != 200:
        raise GitlabApiError(f"GitLab API error {response.status_code}", response.status_code)
    return MergeRequest.from_api(response.json())


async def list_mrs(
    host: str,
    namespace: str,
    repo: str,
    *,
    state: str = "opened",
    page: int = 1,
    per_page: int = 25,
    token: str | None = None,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> list[dict[str, Any]]:
    """List merge requests for a project; returns raw GitLab API dicts.

    ``state`` can be ``"opened"``, ``"merged"``, ``"closed"``, or ``"all"``.
    """
    settings = settings or get_settings()
    pid = _project_id_encoded(namespace, repo)
    url = f"{_api_base(host)}/projects/{pid}/merge_requests"
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=float(settings.github_api_timeout_seconds),
    )
    try:
        response = await client.get(
            url,
            params={"state": state, "page": page, "per_page": per_page, "order_by": "updated_at"},
        )
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code in (401, 403):
        raise GitlabApiError("GitLab authentication required", response.status_code)
    if response.status_code == 404:
        raise GitlabApiError("Project not found or not accessible", 404)
    if response.status_code != 200:
        raise GitlabApiError(f"GitLab API error {response.status_code}", response.status_code)
    return response.json()  # type: ignore[return-value]


async def post_mr_note(
    host: str,
    namespace: str,
    repo: str,
    iid: int,
    *,
    body: str,
    token: str,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Post a general note (top-level comment) on a GitLab MR.

    GitLab's discussion API supports position-based inline comments too, but
    they require the diff_refs blobs to be resolved to exact lines — that is
    fragile across rebases.  A general note is always accepted and is the
    safer, more reliable choice for automated review tools.
    """
    settings = settings or get_settings()
    pid = _project_id_encoded(namespace, repo)
    url = f"{_api_base(host)}/projects/{pid}/merge_requests/{iid}/notes"
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=float(settings.github_api_timeout_seconds),
    )
    try:
        response = await client.post(url, json={"body": body[:1_000_000]})
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code not in (200, 201):
        detail = ""
        if response.headers.get("content-type", "").startswith("application/json"):
            try:
                detail = str(response.json().get("message", ""))
            except Exception:
                detail = response.text
        raise GitlabApiError(
            f"GitLab rejected the note ({response.status_code}): {detail[:400]}",
            response.status_code,
        )
    return response.json()


async def post_commit_status(
    host: str,
    namespace: str,
    repo: str,
    sha: str,
    *,
    state: str,
    name: str,
    description: str,
    target_url: str | None = None,
    token: str,
    client: httpx.AsyncClient | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """Post a commit status (pipeline status) for ``sha``.

    ``state``: ``"pending"`` | ``"running"`` | ``"success"`` | ``"failed"`` |
    ``"canceled"``.  Idempotent per ``(sha, name)`` — GitLab replaces the
    previous entry.
    """
    settings = settings or get_settings()
    pid = _project_id_encoded(namespace, repo)
    url = f"{_api_base(host)}/projects/{pid}/statuses/{sha}"
    payload: dict[str, Any] = {
        "state": state,
        "name": name[:255],
        "description": description[:1024],
    }
    if target_url:
        payload["target_url"] = target_url
    owns_client = client is None
    client = client or httpx.AsyncClient(
        headers=_auth_headers(token),
        timeout=float(settings.github_api_timeout_seconds),
    )
    try:
        response = await client.post(url, json=payload)
    finally:
        if owns_client:
            await client.aclose()

    if response.status_code not in (200, 201):
        raise GitlabApiError(
            f"GitLab rejected the commit status ({response.status_code}): {response.text[:300]}",
            response.status_code,
        )
    return response.json()
