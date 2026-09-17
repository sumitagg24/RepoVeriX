"""First-run onboarding: status and completion.

``GET /onboarding/status`` derives each checklist step from actual repository
evidence (connected OAuth accounts, accessible repositories, scans) so the UI
can never claim progress the database does not support. ``POST
/onboarding/complete`` records that the user finished — or deliberately
skipped — the checklist; it is idempotent and never resets progress.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import ColumnElement, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import OAuthAccount, OrganizationMember, Repository, Scan, User
from app.schemas.onboarding import (
    OnboardingCompleteResponse,
    OnboardingRepositoryHint,
    OnboardingStatusResponse,
    OnboardingStepKey,
    OnboardingStepStatus,
)

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


async def _org_ids(db: AsyncSession, user_id) -> list:
    """IDs of the organizations the user belongs to."""
    return list(
        (
            await db.execute(
                select(OrganizationMember.organization_id).where(OrganizationMember.user_id == user_id)
            )
        )
        .scalars()
        .all()
    )


def _repository_scope(user_id, org_ids: list) -> ColumnElement[bool]:
    """Repositories the user can see: personal ones plus their organizations'."""
    scope = Repository.owner_id == user_id
    if org_ids:
        scope = scope | Repository.org_id.in_(org_ids)  # type: ignore[union-attr]
    return scope


@router.get("/status", response_model=OnboardingStatusResponse)
async def onboarding_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingStatusResponse:
    """Evidence-based onboarding progress for the current user."""
    providers = list(
        (await db.execute(select(OAuthAccount.provider).where(OAuthAccount.user_id == current_user.id)))
        .scalars()
        .all()
    )

    scope = _repository_scope(current_user.id, await _org_ids(db, current_user.id))

    latest = (
        await db.execute(select(Repository).where(scope).order_by(Repository.created_at.desc()).limit(1))
    ).scalar_one_or_none()

    scan_count = (
        await db.execute(
            select(func.count())
            .select_from(Scan)
            .join(Repository, Scan.repository_id == Repository.id)
            .where(scope)
        )
    ).scalar_one()

    steps: dict[OnboardingStepKey, OnboardingStepStatus] = {
        "connect_provider": OnboardingStepStatus(
            done=bool(providers),
            detail=", ".join(sorted(providers)) if providers else None,
        ),
        "add_repository": OnboardingStepStatus(
            done=latest is not None,
            detail=latest.name if latest else None,
        ),
        "run_first_scan": OnboardingStepStatus(
            done=scan_count > 0,
            detail=None,
        ),
    }
    return OnboardingStatusResponse(
        completed=current_user.onboarding_completed_at is not None,
        completed_at=current_user.onboarding_completed_at,
        steps=steps,
        latest_repository=OnboardingRepositoryHint(id=str(latest.id), name=latest.name) if latest else None,
    )


@router.post("/complete", response_model=OnboardingCompleteResponse)
async def complete_onboarding(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OnboardingCompleteResponse:
    """Mark the onboarding checklist finished (explicitly or via skip).

    Idempotent: the first completion timestamp wins and is never overwritten.
    """
    if current_user.onboarding_completed_at is None:
        current_user.onboarding_completed_at = datetime.now(UTC)
        db.add(current_user)
        await db.commit()
        await db.refresh(current_user)
    return OnboardingCompleteResponse(
        completed=True,
        completed_at=current_user.onboarding_completed_at,
    )
