"""Scan, analysis-run and summary schemas."""

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from app.db.models import (
    AnalysisStage,
    FindingCategory,
    FindingStatus,
    RunStatus,
    ScanConfiguration,
    ScanStatus,
    Severity,
)
from app.schemas.common import TimestampedORMModel


class ScanCreate(BaseModel):
    repository_id: uuid.UUID
    configuration: ScanConfiguration = ScanConfiguration.repoverix


class AnalysisRunRead(TimestampedORMModel):
    scan_id: uuid.UUID
    stage: AnalysisStage
    tool_name: str | None
    status: RunStatus
    started_at: datetime | None
    finished_at: datetime | None
    output: dict[str, Any] | None


class ScanRead(TimestampedORMModel):
    repository_id: uuid.UUID
    status: ScanStatus
    configuration: ScanConfiguration
    started_at: datetime | None
    finished_at: datetime | None
    summary: dict[str, Any] | None
    llm_token_usage: dict[str, Any] | None
    error: str | None


class ScanDetail(ScanRead):
    analysis_runs: list[AnalysisRunRead] = Field(default_factory=list)


class FindingSummary(BaseModel):
    """Aggregated finding counts used by the dashboard."""

    total: int = 0
    by_category: dict[str, int] = Field(default_factory=lambda: {c.value: 0 for c in FindingCategory})
    by_severity: dict[str, int] = Field(default_factory=lambda: {s.value: 0 for s in Severity})
    by_status: dict[str, int] = Field(default_factory=lambda: {s.value: 0 for s in FindingStatus})


class DashboardSummary(BaseModel):
    total_repositories: int
    total_scans: int
    findings: FindingSummary
