"""Provider dispatcher for pull-request / merge-request auditing.

Determines whether a repository's source URL belongs to GitHub or GitLab and
returns the appropriate token + identity tuple so the route handler does not
need to branch on the provider.
"""

from __future__ import annotations

from app.core.config import Settings, get_settings
from app.db.models import Repository
from app.services import github as gh
from app.services import gitlab as gl


def detect_provider(repository: Repository) -> str | None:
    """Return ``"github"``, ``"gitlab"``, or ``None`` based on ``source_url``."""
    url = repository.source_url or ""
    if gh.repo_ident(url) is not None:
        return "github"
    if gl.repo_ident(url) is not None:
        return "gitlab"
    return None


def github_token(repository: Repository, settings: Settings | None = None) -> str | None:
    settings = settings or get_settings()
    from app.core.crypto import decrypt_token

    oauth = repository.oauth_account
    stored = oauth.access_token if oauth is not None and oauth.provider == "github" else None
    return gh.resolve_token(settings, oauth_access_token=decrypt_token(stored))


def gitlab_token(repository: Repository, settings: Settings | None = None) -> str | None:
    settings = settings or get_settings()
    from app.core.crypto import decrypt_token

    oauth = repository.oauth_account
    stored = oauth.access_token if oauth is not None and oauth.provider == "gitlab" else None
    return gl.resolve_token(settings, oauth_access_token=decrypt_token(stored))
