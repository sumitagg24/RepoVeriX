"""Dashboard and summary routes."""

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import Finding, FindingCategory, FindingStatus, Repository, Scan, Severity
from app.schemas.scan import DashboardSummary, FindingSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated dashboard summary for the current user."""
    # Total repositories
    repo_count = await db.execute(
        select(func.count(Repository.id)).where(Repository.owner_id == current_user.id)
    )
    total_repositories = repo_count.scalar() or 0

    # Total scans
    scan_count = await db.execute(
        select(func.count(Scan.id))
        .join(Repository)
        .where(Repository.owner_id == current_user.id)
    )
    total_scans = scan_count.scalar() or 0

    # Findings summary across all user's scans
    finding_total = await db.execute(
        select(func.count(Finding.id))
        .join(Scan)
        .join(Repository)
        .where(Repository.owner_id == current_user.id)
    )
    total_findings = finding_total.scalar() or 0

    # By category
    category_result = await db.execute(
        select(Finding.category, func.count(Finding.id))
        .join(Scan)
        .join(Repository)
        .where(Repository.owner_id == current_user.id)
        .group_by(Finding.category)
    )
    by_category = {cat.value: 0 for cat in FindingCategory}
    for cat, count in category_result.all():
        by_category[cat.value] = count

    # By severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .join(Scan)
        .join(Repository)
        .where(Repository.owner_id == current_user.id)
        .group_by(Finding.severity)
    )
    by_severity = {sev.value: 0 for sev in Severity}
    for sev, count in severity_result.all():
        by_severity[sev.value] = count

    # By status
    status_result = await db.execute(
        select(Finding.status, func.count(Finding.id))
        .join(Scan)
        .join(Repository)
        .where(Repository.owner_id == current_user.id)
        .group_by(Finding.status)
    )
    by_status = {st.value: 0 for st in FindingStatus}
    for st, count in status_result.all():
        by_status[st.value] = count

    findings = FindingSummary(
        total=total_findings,
        by_category=by_category,
        by_severity=by_severity,
        by_status=by_status,
    )

    return DashboardSummary(
        total_repositories=total_repositories,
        total_scans=total_scans,
        findings=findings,
    )