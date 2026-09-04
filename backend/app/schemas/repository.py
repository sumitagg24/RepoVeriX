"""Repository schemas."""

import uuid

from pydantic import BaseModel, Field, HttpUrl, model_validator

from app.db.models import SourceType
from app.schemas.common import TimestampedORMModel


class RepositoryCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    source_type: SourceType
    source_url: HttpUrl | None = None
    default_branch: str = Field(default="main", min_length=1, max_length=200)

    @model_validator(mode="after")
    def _github_requires_url(self) -> "RepositoryCreate":
        if self.source_type is SourceType.github and self.source_url is None:
            raise ValueError("source_url is required for GitHub repositories")
        return self


class RepositoryRead(TimestampedORMModel):
    owner_id: uuid.UUID
    name: str
    source_type: SourceType
    source_url: str | None
    default_branch: str
    storage_path: str | None
    primary_languages: list[str]
    status: str
