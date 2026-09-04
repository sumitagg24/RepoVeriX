"""Patch and verification schemas."""

import uuid
from datetime import datetime

from pydantic import Field

from app.db.models import PatchStatus, TestOutcome, VerificationStatus
from app.schemas.common import TimestampedORMModel


class PatchRead(TimestampedORMModel):
    finding_id: uuid.UUID
    diff: str
    explanation: str | None
    generated_by: str
    status: PatchStatus


class TestResultRead(TimestampedORMModel):
    verification_run_id: uuid.UUID
    test_name: str
    outcome: TestOutcome
    duration_ms: int | None
    output: str | None


class VerificationRunRead(TimestampedORMModel):
    patch_id: uuid.UUID
    status: VerificationStatus
    patch_applied: bool
    deps_installed: bool
    tests_passed: bool | None
    static_passed: bool | None
    finding_still_detected: bool | None
    logs: str | None
    started_at: datetime | None
    finished_at: datetime | None


class VerificationRunDetail(VerificationRunRead):
    test_results: list[TestResultRead] = Field(default_factory=list)
