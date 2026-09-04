"""Repository schemas."""

import uuid
from typing import Literal

from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.db.models import SourceType
from app.schemas.common import TimestampedORMModel

_URL_SOURCE_TYPES = (SourceType.github, SourceType.gitlab, SourceType.git, SourceType.archive)


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_type: SourceType
    source_url: HttpUrl | None = None
    default_branch: str = Field(default="main", min_length=1, max_length=200)

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
    default_branch: str = Field(default="main", min_length=1, max_length=200)


class OAuthImportRequest(BaseModel):
    """Import a repository through a connected GitHub/GitLab account.

    ``repo_path`` is the owner/name (GitHub) or full namespaced path (GitLab),
    e.g. ``octocat/hello-world`` or ``group/subgroup/project``.
    """

    provider: Literal["github", "gitlab"]
    repo_path: str = Field(min_length=1, max_length=500)
    name: str | None = Field(default=None, min_length=1, max_length=200)
    default_branch: str = Field(default="main", min_length=1, max_length=200)


class RepositoryRead(TimestampedORMModel):
    owner_id: uuid.UUID
    name: str
    source_type: SourceType
    source_url: str | None
    default_branch: str
    storage_path: str | None
    primary_languages: list[str]
    status: str
