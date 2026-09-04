"""Repository schemas."""

import re
import uuid
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, field_validator, model_validator

from app.db.models import SourceType
from app.schemas.common import TimestampedORMModel

_URL_SOURCE_TYPES = (SourceType.github, SourceType.gitlab, SourceType.git, SourceType.archive)

# owner/name (GitHub) or namespaced path (GitLab): alphanumeric segments with
# . _ - allowed, at least one nesting level, no empty or ".." segments.
_REPO_PATH = re.compile(r"^[A-Za-z0-9_.-]+(/[A-Za-z0-9_.-]+)+$")

# Branch names must not contain whitespace, control chars or git's forbidden
# characters (space, ~ ^ : ? * [ \ and control characters).
_BRANCH_OK = re.compile(r"^[^\s~^:?*\\\x00-\x1f]+$")


def _clean_name(value: str) -> str:
    """Reject names that are empty after stripping; store the stripped form."""
    stripped = value.strip()
    if not stripped:
        raise ValueError("must not be empty or whitespace-only")
    if len(stripped) > 200:
        raise ValueError("must be at most 200 characters")
    return stripped


def _clean_branch(value: str) -> str:
    stripped = value.strip()
    if not _BRANCH_OK.match(stripped):
        raise ValueError("contains characters not allowed in a git branch name")
    return stripped


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_type: SourceType
    source_url: HttpUrl | None = None
    default_branch: str = Field(default="main", max_length=200)

    @field_validator("name")
    @classmethod
    def _name_strip(cls, v: str) -> str:
        return _clean_name(v)

    @field_validator("default_branch")
    @classmethod
    def _branch_strip(cls, v: str) -> str:
        return _clean_branch(v)

    @model_validator(mode="after")
    def _url_source_requires_url(self) -> "RepositoryCreate":
        if self.source_type in _URL_SOURCE_TYPES and self.source_url is None:
            raise ValueError(f"source_url is required for {self.source_type.value} repositories")
        if self.source_type is SourceType.zip and self.source_url is not None:
            raise ValueError("source_url must be empty for ZIP uploads")
        return self


class ArchiveImportRequest(BaseModel):
    """Import a repository from a hosted archive URL (S3 object / presigned URL /
    GitHub release asset / any other downloadable .zip)."""

    url: HttpUrl
    name: str | None = Field(default=None, min_length=1, max_length=200)
    default_branch: str = Field(default="main", max_length=200)

    @field_validator("name")
    @classmethod
    def _name_strip(cls, v: str | None) -> str | None:
        return _clean_name(v) if v is not None else None

    @field_validator("default_branch")
    @classmethod
    def _branch_strip(cls, v: str) -> str:
        return _clean_branch(v)


class OAuthImportRequest(BaseModel):
    """Import a repository through a connected GitHub/GitLab account.

    ``repo_path`` is the owner/name (GitHub) or full namespaced path (GitLab),
    e.g. ``octocat/hello-world`` or ``group/subgroup/project``.
    """

    provider: Literal["github", "gitlab"]
    repo_path: str = Field(min_length=3, max_length=500)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    default_branch: str = Field(default="main", max_length=200)

    @field_validator("repo_path")
    @classmethod
    def _repo_path_strict(cls, v: str) -> str:
        stripped = v.strip().strip("/")
        if stripped.endswith(".git"):
            stripped = stripped[:-4]
        if not _REPO_PATH.match(stripped):
            raise ValueError("must look like 'owner/repository' with alphanumeric segments")
        # A segment of ".." (or an empty segment) would make the path mean
        # something other than owner/repository — reject it outright.
        if ".." in stripped.split("/"):
            raise ValueError("repo_path must not contain '..' segments")
        return stripped

    @field_validator("name")
    @classmethod
    def _name_strip(cls, v: str | None) -> str | None:
        return _clean_name(v) if v is not None else None

    @field_validator("default_branch")
    @classmethod
    def _branch_strip(cls, v: str) -> str:
        return _clean_branch(v)


class RepositoryRead(TimestampedORMModel):
    owner_id: uuid.UUID
    name: str
    source_type: SourceType
    source_url: str | None
    default_branch: str
    storage_path: str | None
    primary_languages: list[str]
    status: str
