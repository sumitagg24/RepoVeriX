"""Plans, entitlement checks and usage accounting.

A single source of truth for the product's pricing model. All limits live in
the ``PLANS`` table in this module — the database stores only the user's
current plan name and monthly usage counters.

Usage is counted in **monthly periods** keyed by ``User.current_period_end``.
When that timestamp is in the past (or null for Free accounts, which use a
rolling 30-day window from first use), counters roll over to zero before any
entitlement check, so every user resets monthly.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status

from app.core.config import get_settings
from app.db.models import PlanName

PERIOD_DAYS = get_settings().billing_period_days


@dataclass(frozen=True)
class PlanLimits:
    """Exposed limits for one plan (used by the billing API and UI)."""

    name: str
    display_name: str
    price_monthly: int  # cents
    max_repositories: int
    scans_per_month: int
    fixes_per_month: int
    verifications_per_month: int
    llm_enabled: bool
    sandbox_enabled: bool
    collaborators: int
    highlights: tuple[str, ...]


PLANS: dict[str, PlanLimits] = {
    PlanName.free.value: PlanLimits(
        name="free",
        display_name="Free",
        price_monthly=0,
        max_repositories=3,
        scans_per_month=5,
        fixes_per_month=2,
        verifications_per_month=2,
        llm_enabled=False,
        sandbox_enabled=False,
        collaborators=1,
        highlights=(
            "3 repositories",
            "5 scans / month",
            "Static + hybrid findings",
            "2 candidate fixes",
            "2 sandbox verifications",
        ),
    ),
    PlanName.pro.value: PlanLimits(
        name="pro",
        display_name="Pro",
        price_monthly=2900,
        max_repositories=20,
        scans_per_month=60,
        fixes_per_month=30,
        verifications_per_month=30,
        llm_enabled=True,
        sandbox_enabled=True,
        collaborators=1,
        highlights=(
            "20 repositories",
            "60 scans / month",
            "LLM reasoning included",
            "Unlimited findings & evidence",
            "Sandboxed verified repairs",
            "PDF / Markdown reports",
        ),
    ),
    PlanName.team.value: PlanLimits(
        name="team",
        display_name="Team",
        price_monthly=9900,
        max_repositories=100,
        scans_per_month=400,
        fixes_per_month=200,
        verifications_per_month=200,
        llm_enabled=True,
        sandbox_enabled=True,
        collaborators=5,
        highlights=(
            "100 repositories",
            "400 scans / month",
            "5 collaborators",
            "Priority queue & support",
            "Audit history & reports",
            "Everything in Pro",
        ),
    ),
}

# Stripes price IDs per plan; wired to Stripe in production (billing service).
STRIPE_PRICE_IDS: dict[str, str] = {
    PlanName.pro.value: get_settings().stripe_pro_price_id or "",
    PlanName.team.value: get_settings().stripe_team_price_id or "",
}


def _as_utc(dt: datetime | None) -> datetime | None:
    """SQLite stores ``DateTime(timezone=True)`` values without tzinfo; treat
    them as UTC so comparisons against aware ``datetime.now(UTC)`` work."""
    if dt is None or dt.tzinfo is not None:
        return dt
    return dt.replace(tzinfo=UTC)


def get_plan(plan: str | PlanName) -> PlanLimits:
    key = plan.value if isinstance(plan, PlanName) else str(plan)
    limits = PLANS.get(key)
    if limits is None:
        return PLANS[PlanName.free.value]
    return limits


def current_period(user) -> datetime:
    """The end of the user's current billing period (always in the future)."""
    period_end = _as_utc(user.current_period_end)
    if period_end and period_end > datetime.now(UTC):
        return period_end
    return datetime.now(UTC) + timedelta(days=PERIOD_DAYS)


def rollover_if_needed(db, user) -> None:
    """Reset monthly counters when the current period has lapsed.

    Called before every entitlement check so a user whose period flipped (or a
    Free user whose rolling window expired) starts a fresh budget.
    """
    period_end = _as_utc(user.current_period_end)
    if period_end and period_end <= datetime.now(UTC):
        user.scans_used = 0
        user.fixes_used = 0
        user.verifications_used = 0
        user.current_period_end = datetime.now(UTC) + timedelta(days=PERIOD_DAYS)
        db.add(user)


async def repo_count(db, user_id: uuid.UUID) -> int:
    from sqlalchemy import func, select

    from app.db.models import Repository

    result = await db.execute(select(func.count(Repository.id)).where(Repository.owner_id == user_id))
    return int(result.scalar() or 0)


async def assert_can_import_repository(db, user) -> None:
    """Block creating a repository when the plan's repository cap is reached."""
    rollover_if_needed(db, user)
    limits = get_plan(user.plan)
    if await repo_count(db, user.id) >= limits.max_repositories:
        _raise_upgrade("repository-cap", limits)


async def assert_can_scan(db, user) -> None:
    """Block starting a scan when the monthly scan budget is exhausted."""
    rollover_if_needed(db, user)
    limits = get_plan(user.plan)
    if user.scans_used >= limits.scans_per_month:
        _raise_upgrade("scan-quota", limits)
    user.scans_used += 1
    db.add(user)


async def assert_can_generate_fix(db, user) -> None:
    rollover_if_needed(db, user)
    limits = get_plan(user.plan)
    if user.fixes_used >= limits.fixes_per_month:
        _raise_upgrade("fix-quota", limits)
    user.fixes_used += 1
    db.add(user)


async def assert_can_verify(db, user) -> None:
    rollover_if_needed(db, user)
    limits = get_plan(user.plan)
    if user.verifications_used >= limits.verifications_per_month:
        _raise_upgrade("verify-quota", limits)
    user.verifications_used += 1
    db.add(user)


def _raise_upgrade(reason: str, limits: PlanLimits) -> None:
    raise HTTPException(
        status_code=status.HTTP_402_PAYMENT_REQUIRED,
        detail=f"You've reached your {limits.display_name} plan limit",
        headers={"X-Upgrade-Reason": reason},
    )
