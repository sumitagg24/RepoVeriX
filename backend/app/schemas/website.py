"""Pydantic schemas for the passive website-audit subsystem."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class WebsiteCreate(BaseModel):
    """Register a website for passive audits."""

    url: str = Field(min_length=1, max_length=2048)


class WebsiteRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    url: str
    hostname: str
    label: str | None
    status: str
    created_at: datetime
    last_audit_at: datetime | None


class WebsiteAuditCreate(BaseModel):
    """Start a passive audit of a registered website."""

    max_pages: int = Field(default=10, ge=1, le=25)
    max_depth: int = Field(default=2, ge=1, le=3)


class WebsiteAuditRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    website_id: uuid.UUID
    status: str
    pages_crawled: int
    error: str | None
    created_at: datetime
    finished_at: datetime | None


class WebsiteAuditDetail(WebsiteAuditRead):
    scores: dict[str, Any] | None = None
    summary: dict[str, Any] | None = None
    pages: list[dict[str, Any]] | None = None
    findings: list[dict[str, Any]] | None = None
    evidence: list[dict[str, Any]] | None = None
