"""Finding feedback routes — the false-positive learning loop.

Users mark findings as correct / incorrect / already-fixed / not-useful.
Verdicts are per (finding, user); re-submitting replaces the previous verdict
so the aggregate always reflects current judgement. Aggregates feed detection
quality metrics; a finding's pipeline status is deliberately untouched — the
evidence engine owns that, feedback only annotates it.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, computed_field
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import Finding, FindingFeedback, Repository, Scan
from app.schemas.common import TimestampedORMModel

router = APIRouter(prefix="/findings", tags=["feedback"])

FeedbackVerdict = Literal["correct", "incorrect", "already_fixed", "not_useful"]


class FeedbackRequest(BaseModel):
    verdict: FeedbackVerdict
    note: str | None = Field(default=None, max_length=2000)


class FeedbackRead(TimestampedORMModel):
    finding_id: uuid.UUID
    user_id: uuid.UUID
    verdict: str
    note: str | None


class FeedbackSummary(BaseModel):
    """Aggregate verdicts for one finding (across all users)."""

    total: int = 0
    correct: int = 0
    incorrect: int = 0
    already_fixed: int = 0
    not_useful: int = 0

    @computed_field  # type: ignore[prop-decorator]
    @property
    def false_positive_share(self) -> float | None:
        """Share of incorrect verdicts among all verdicts (None when empty)."""
        if self.total == 0:
            return None
        return round(self.incorrect / self.total, 3)


async def _owned_finding(db: AsyncSession, finding_id: uuid.UUID, user_id) -> Finding:
    result = await db.execute(
        select(Finding)
        .join(Scan, Scan.id == Finding.scan_id)
        .join(Repository, Repository.id == Scan.repository_id)
        .where(Finding.id == finding_id, Repository.owner_id == user_id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.post("/{finding_id}/feedback", response_model=FeedbackRead, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    finding_id: uuid.UUID,
    payload: FeedbackRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Record (or replace) the caller's verdict on a finding."""
    await _owned_finding(db, finding_id, current_user.id)

    existing = (
        await db.execute(
            select(FindingFeedback).where(
                FindingFeedback.finding_id == finding_id,
                FindingFeedback.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        existing.verdict = payload.verdict
        existing.note = payload.note
        await db.commit()
        await db.refresh(existing)
        return existing

    row = FindingFeedback(
        finding_id=finding_id,
        user_id=current_user.id,
        verdict=payload.verdict,
        note=payload.note,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.get("/{finding_id}/feedback", response_model=FeedbackRead | None)
async def get_my_feedback(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Any:
    """Return the caller's own verdict for a finding (or null)."""
    await _owned_finding(db, finding_id, current_user.id)
    row = (
        await db.execute(
            select(FindingFeedback).where(
                FindingFeedback.finding_id == finding_id,
                FindingFeedback.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    return row


@router.get("/{finding_id}/feedback/summary", response_model=FeedbackSummary)
async def get_feedback_summary(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackSummary:
    """Aggregate verdicts for a finding — the quality signal for research."""
    await _owned_finding(db, finding_id, current_user.id)
    rows = (
        await db.execute(
            select(FindingFeedback.verdict, func.count())
            .where(FindingFeedback.finding_id == finding_id)
            .group_by(FindingFeedback.verdict)
        )
    ).all()
    summary = FeedbackSummary()
    for verdict_value, count in rows:
        setattr(summary, verdict_value, count)
        summary.total += count
    return summary


@router.delete("/{finding_id}/feedback", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_feedback(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """Withdraw the caller's verdict."""
    await _owned_finding(db, finding_id, current_user.id)
    await db.execute(
        delete(FindingFeedback).where(
            FindingFeedback.finding_id == finding_id,
            FindingFeedback.user_id == current_user.id,
        )
    )
    await db.commit()
