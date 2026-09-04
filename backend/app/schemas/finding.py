"""Finding and evidence schemas."""

import uuid
from typing import Any

from pydantic import Field

from app.db.models import EvidenceKind, FindingCategory, FindingSource, FindingStatus, Severity
from app.schemas.common import TimestampedORMModel
from app.schemas.verification import PatchRead


class EvidenceRead(TimestampedORMModel):
    finding_id: uuid.UUID
    kind: EvidenceKind
    file_path: str | None
    line_start: int | None
    line_end: int | None
    snippet: str | None
    description: str
    order_index: int
    metadata: dict[str, Any] = Field(
        default_factory=dict, validation_alias="extra", serialization_alias="metadata"
    )


class FindingRead(TimestampedORMModel):
    scan_id: uuid.UUID
    external_id: str
    category: FindingCategory
    severity: Severity
    status: FindingStatus
    confidence: float = Field(ge=0.0, le=1.0)
    title: str
    description: str
    impact: str | None
    recommendation: str | None
    file_path: str
    function_name: str | None
    line_start: int | None
    line_end: int | None
    source: FindingSource


class FindingDetail(FindingRead):
    evidence: list[EvidenceRead] = Field(default_factory=list)
    patches: list[PatchRead] = Field(default_factory=list)
