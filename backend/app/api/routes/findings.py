"""Finding and evidence routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_user, get_db
from app.db.models import Finding, Repository, Scan
from app.schemas.finding import FindingDetail, FindingRead

router = APIRouter(prefix="/findings", tags=["findings"])


@router.get("", response_model=list[FindingRead])
async def list_findings(
    scan_id: uuid.UUID | None = None,
    repository_id: uuid.UUID | None = None,
    category: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List findings with optional filters."""
    query = select(Finding).join(Scan).join(Repository).where(Repository.owner_id == current_user.id)

    if scan_id:
        query = query.where(Finding.scan_id == scan_id)
    if repository_id:
        query = query.where(Scan.repository_id == repository_id)
    if category:
        query = query.where(Finding.category == category)
    if severity:
        query = query.where(Finding.severity == severity)
    if status:
        query = query.where(Finding.status == status)

    query = query.order_by(Finding.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{finding_id}", response_model=FindingDetail)
async def get_finding(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single finding with its evidence and patches."""
    result = await db.execute(
        select(Finding)
        .options(selectinload(Finding.evidence), selectinload(Finding.patches))
        .join(Scan)
        .join(Repository)
        .where(
            Finding.id == finding_id,
            Repository.owner_id == current_user.id,
        )
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.get("/scan/{scan_id}/summary")
async def get_scan_findings_summary(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated finding counts for a scan."""
    # Verify scan ownership
    scan_result = await db.execute(
        select(Scan)
        .join(Repository)
        .where(
            Scan.id == scan_id,
            Repository.owner_id == current_user.id,
        )
    )
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    from app.db.models import FindingCategory, FindingStatus, Severity

    # Total count
    total_result = await db.execute(select(func.count(Finding.id)).where(Finding.scan_id == scan_id))
    total = total_result.scalar() or 0

    # By category
    category_result = await db.execute(
        select(Finding.category, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.category)
    )
    by_category = {cat.value: 0 for cat in FindingCategory}
    for cat, count in category_result.all():
        by_category[cat.value] = count

    # By severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.severity)
    )
    by_severity = {sev.value: 0 for sev in Severity}
    for sev, count in severity_result.all():
        by_severity[sev.value] = count

    # By status
    status_result = await db.execute(
        select(Finding.status, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.status)
    )
    by_status = {st.value: 0 for st in FindingStatus}
    for st, count in status_result.all():
        by_status[st.value] = count

    return {
        "total": total,
        "by_category": by_category,
        "by_severity": by_severity,
        "by_status": by_status,
    }
