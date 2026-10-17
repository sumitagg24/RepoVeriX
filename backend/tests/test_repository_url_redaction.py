"""Regression tests: credentials embedded in a repository URL must not leak."""

import uuid
from datetime import UTC, datetime

from app.db.models import SourceType
from app.schemas.repository import RepositoryRead


def _repository(source_url: str | None) -> RepositoryRead:
    now = datetime.now(UTC)
    return RepositoryRead.model_validate(
        {
            "id": uuid.uuid4(),
            "created_at": now,
            "updated_at": now,
            "owner_id": uuid.uuid4(),
            "name": "private-repo",
            "source_type": SourceType.git,
            "source_url": source_url,
            "default_branch": "main",
            "storage_path": None,
            "primary_languages": [],
            "status": "registered",
        }
    )


def test_read_model_redacts_embedded_git_token():
    read = _repository("https://x-access-token:ghp_SUPERSECRETVALUE1234@github.com/owner/repo.git")
    assert read.source_url is not None
    assert "ghp_SUPERSECRETVALUE1234" not in read.source_url
    assert "[REDACTED]" in read.source_url
    # the host and path stay visible so the row is still identifiable
    assert "github.com" in read.source_url
    assert "owner/repo.git" in read.source_url


def test_read_model_redacts_embedded_password():
    read = _repository("https://alice:hunter2@git.internal.example/team/app.git")
    assert read.source_url is not None
    assert "hunter2" not in read.source_url
    assert "alice" in read.source_url


def test_read_model_leaves_clean_urls_untouched():
    clean = "https://github.com/owner/repo.git"
    assert _repository(clean).source_url == clean


def test_read_model_handles_missing_url():
    assert _repository(None).source_url is None
