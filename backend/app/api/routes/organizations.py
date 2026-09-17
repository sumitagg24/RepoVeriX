"""Organization (team) routes: create, members, roles, repositories.

Role model (see ``app/services/access.py``): member < admin < owner.

- member: read org repositories, run scans, see findings.
- admin:  + add/remove members, assign roles below admin, attach/detach repos.
- owner:  + rename org, remove admins, delete the org.

Invitations are email-based *within existing accounts*: adding a member
requires the invited user to already have an account (no email sending yet —
the invite API records the membership directly and returns the assigned role).
"""

from __future__ import annotations

import re
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    Finding,
    FindingFeedback,
    FindingStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    Patch,
    PatchStatus,
    Repository,
    Scan,
    ScanStatus,
    Severity,
    User,
    VerificationRun,
)
from app.schemas.common import TimestampedORMModel
from app.services import access

router = APIRouter(prefix="/organizations", tags=["organizations"])

_SLUG_RE = re.compile(r"^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$")


class OrgCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    slug: str | None = Field(default=None, max_length=64)


class OrgRead(TimestampedORMModel):
    name: str
    slug: str
    created_by: uuid.UUID | None


class MemberAdd(BaseModel):
    email: str = Field(min_length=3, max_length=320)
    role: OrgRole = OrgRole.member


class MemberRead(TimestampedORMModel):
    organization_id: uuid.UUID
    user_id: uuid.UUID
    role: OrgRole
    email: str | None = None
    full_name: str | None = None


class RepoAttach(BaseModel):
    repository_id: uuid.UUID


def _org_read(org: Organization) -> OrgRead:
    return OrgRead.model_validate(org)


def _member_read(member: OrganizationMember, user: User | None = None) -> MemberRead:
    return MemberRead(
        id=member.id,
        created_at=member.created_at,
        updated_at=member.updated_at,
        organization_id=member.organization_id,
        user_id=member.user_id,
        role=member.role,
        email=user.email if user else None,
        full_name=user.full_name if user else None,
    )


@router.post("", response_model=OrgRead, status_code=status.HTTP_201_CREATED)
async def create_organization(
    payload: OrgCreate,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create an organization; the creator becomes its owner."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "create_org"))

    slug = (payload.slug or payload.name).strip().lower()
    slug = re.sub(r"[^a-z0-9-]+", "-", slug).strip("-")
    if not _SLUG_RE.match(slug):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Slug must be 3–64 chars: lowercase letters, digits, hyphens",
        )
    exists = (await db.execute(select(Organization.id).where(Organization.slug == slug))).scalar_one_or_none()
    if exists:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Slug already taken")

    org = Organization(name=payload.name.strip(), slug=slug, created_by=current_user.id)
    db.add(org)
    await db.flush()
    db.add(OrganizationMember(organization_id=org.id, user_id=current_user.id, role=OrgRole.owner))
    await db.commit()
    await db.refresh(org)
    return _org_read(org)


@router.get("", response_model=list[OrgRead])
async def list_my_organizations(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Organizations the caller belongs to."""
    pairs = await access.user_organizations(db, current_user.id)
    return [_org_read(org) for org, _role in pairs]


@router.get("/{org_id}/members", response_model=list[MemberRead])
async def list_members(
    org_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List members (any member of the org may see the roster)."""
    await access.require_role(db, org_id, current_user.id, "read")
    rows = (
        await db.execute(
            select(OrganizationMember, User)
            .join(User, User.id == OrganizationMember.user_id)
            .where(OrganizationMember.organization_id == org_id)
            .order_by(OrganizationMember.created_at)
        )
    ).all()
    return [_member_read(member, user) for member, user in rows]


@router.post("/{org_id}/members", response_model=MemberRead, status_code=status.HTTP_201_CREATED)
async def add_member(
    org_id: uuid.UUID,
    payload: MemberAdd,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Add an existing account to the org (admin+). Owners may add admins."""
    actor = await access.require_role(db, org_id, current_user.id, "admin")
    if payload.role == OrgRole.owner and actor.role != OrgRole.owner:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can add owners")

    email = payload.email.strip().lower()
    user = (await db.execute(select(User).where(User.email == email))).scalar_one_or_none()
    if user is None:
        # Do not reveal whether an account exists to non-owners; but membership
        # requires an account, so 404 with an actionable message is correct.
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No RepoVeriX account exists for that email — they must sign up first",
        )
    existing = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == org_id,
                OrganizationMember.user_id == user.id,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Already a member")

    member = OrganizationMember(
        organization_id=org_id,
        user_id=user.id,
        role=payload.role,
        invited_by=current_user.id,
    )
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return _member_read(member, user)


@router.delete("/{org_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    org_id: uuid.UUID,
    member_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Remove a member (admin+). An owner can only be removed by another owner."""
    actor = await access.require_role(db, org_id, current_user.id, "admin")
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.id == member_id,
                OrganizationMember.organization_id == org_id,
            )
        )
    ).scalar_one_or_none()
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.role == OrgRole.owner:
        if actor.role != OrgRole.owner:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can remove owners")
        owners = (
            (
                await db.execute(
                    select(OrganizationMember).where(
                        OrganizationMember.organization_id == org_id,
                        OrganizationMember.role == OrgRole.owner,
                    )
                )
            )
            .scalars()
            .all()
        )
        if len(owners) <= 1:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot remove the last owner — transfer ownership first",
            )
    if member.user_id == current_user.id and member.role == OrgRole.owner:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Owners cannot remove themselves — transfer ownership first",
        )
    await db.delete(member)
    await db.commit()


@router.post("/{org_id}/repositories", status_code=status.HTTP_201_CREATED)
async def attach_repository(
    org_id: uuid.UUID,
    payload: RepoAttach,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Move one of the caller's personal repositories into the org (admin+)."""
    await access.require_role(db, org_id, current_user.id, "admin")
    repo = (
        await db.execute(
            select(Repository).where(
                Repository.id == payload.repository_id,
                Repository.owner_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if repo is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Repository not found among your personal repositories",
        )
    repo.org_id = org_id
    await db.commit()
    return {"repository_id": str(repo.id), "org_id": str(org_id)}


@router.delete("/{org_id}/repositories/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def detach_repository(
    org_id: uuid.UUID,
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a repository to personal scope (admin+, repo owner only)."""
    await access.require_role(db, org_id, current_user.id, "admin")
    repo = (
        await db.execute(
            select(Repository).where(
                Repository.id == repository_id,
                Repository.org_id == org_id,
                Repository.owner_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if repo is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found in this org")
    repo.org_id = None
    await db.commit()


@router.get("/{org_id}/repositories", response_model=list[dict])
async def list_org_repositories(
    org_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Repositories belonging to the org (any member)."""
    await access.require_role(db, org_id, current_user.id, "read")
    repos = (
        (
            await db.execute(
                select(Repository).where(Repository.org_id == org_id).order_by(Repository.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        {
            "id": str(r.id),
            "name": r.name,
            "status": r.status,
            "source_type": r.source_type.value,
            "languages": r.primary_languages or [],
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in repos
    ]


# ------------------------------------------------------------------ team dashboard


async def _org_repo_ids(db: AsyncSession, org_id: uuid.UUID) -> list[uuid.UUID]:
    return list((await db.execute(select(Repository.id).where(Repository.org_id == org_id))).scalars().all())


async def _finding_breakdown(db: AsyncSession, repo_ids: list[uuid.UUID]) -> dict:
    """Finding counts (status/severity/category) over an org's repositories.

    Empty ``repo_ids`` short-circuits so SQLAlchemy never renders ``IN ()``.
    """
    if not repo_ids:
        zero = {s.value: 0 for s in Severity}
        return {
            "total": 0,
            "by_severity": zero,
            "by_status": {s.value: 0 for s in FindingStatus},
            "verified_critical_high": 0,
        }
    rows = (
        await db.execute(
            select(Finding.severity, Finding.status, func.count(Finding.id))
            .join(Scan, Scan.id == Finding.scan_id)
            .where(Scan.repository_id.in_(repo_ids))
            .group_by(Finding.severity, Finding.status)
        )
    ).all()
    by_severity = {s.value: 0 for s in Severity}
    by_status = {s.value: 0 for s in FindingStatus}
    total = 0
    verified_critical_high = 0
    for severity, fstatus, count in rows:
        by_severity[severity.value] += count
        by_status[fstatus.value] += count
        total += count
        if fstatus == FindingStatus.verified and severity in (Severity.critical, Severity.high):
            verified_critical_high += count
    return {
        "total": total,
        "by_severity": by_severity,
        "by_status": by_status,
        "verified_critical_high": verified_critical_high,
    }


@router.get("/{org_id}/dashboard", response_model=dict)
async def org_team_dashboard(
    org_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Team dashboard: aggregated activity and risk across the org's repos.

    Readable by every member — this is exactly the data they can already see
    repository-by-repository, aggregated once.
    """
    await access.require_role(db, org_id, current_user.id, "read")
    repo_ids = await _org_repo_ids(db, org_id)

    repo_rows = (
        await db.execute(
            select(Repository.id, Repository.name, Repository.status, Repository.default_branch)
            .where(Repository.org_id == org_id)
            .order_by(Repository.created_at.desc())
        )
    ).all()

    scans_total = 0
    scans_completed = 0
    last_scan_at: str | None = None
    if repo_ids:
        counts = (
            await db.execute(
                select(func.count(Scan.id), func.max(Scan.finished_at)).where(
                    Scan.repository_id.in_(repo_ids)
                )
            )
        ).one()
        scans_total = counts[0] or 0
        completed = (
            await db.execute(
                select(func.count(Scan.id)).where(
                    Scan.repository_id.in_(repo_ids), Scan.status == ScanStatus.completed
                )
            )
        ).scalar()
        scans_completed = completed or 0
        if counts[1] is not None:
            last_scan_at = counts[1].isoformat()

    findings = await _finding_breakdown(db, repo_ids)

    fixes_verified = 0
    fixes_failed = 0
    if repo_ids:
        patch_rows = (
            await db.execute(
                select(VerificationRun.status, func.count(VerificationRun.id))
                .join(Patch, Patch.id == VerificationRun.patch_id)
                .join(Finding, Finding.id == Patch.finding_id)
                .join(Scan, Scan.id == Finding.scan_id)
                .where(Scan.repository_id.in_(repo_ids))
                .group_by(VerificationRun.status)
            )
        ).all()
        for vstatus, count in patch_rows:
            if vstatus == VerificationRun.verified_repair:
                fixes_verified += count
            elif vstatus in (VerificationRun.repair_failed, VerificationRun.repair_not_verified):
                fixes_failed += count

    members = (
        await db.execute(
            select(OrganizationMember.role, func.count(OrganizationMember.id))
            .where(OrganizationMember.organization_id == org_id)
            .group_by(OrganizationMember.role)
        )
    ).all()
    member_counts = {role.value: count for role, count in members}

    return {
        "organization_id": str(org_id),
        "repositories": [
            {
                "id": str(rid),
                "name": name,
                "status": status,
                "default_branch": branch,
            }
            for rid, name, status, branch in repo_rows
        ],
        "repository_count": len(repo_rows),
        "member_counts": member_counts,
        "scans": {"total": scans_total, "completed": scans_completed, "last_scan_at": last_scan_at},
        "findings": findings,
        "fixes": {"verified": fixes_verified, "failed_or_unverified": fixes_failed},
    }


# ------------------------------------------------------------------ security / compliance center


def _risk_level(findings: dict) -> str:
    """Deterministic org posture band from verified/probable critical+high."""
    hot = findings["verified_critical_high"]
    if hot >= 10:
        return "critical"
    if hot >= 4:
        return "high"
    if hot >= 1:
        return "medium"
    if findings["total"] > 0:
        return "low"
    return "none"


@router.get("/{org_id}/security-center", response_model=dict)
async def org_security_center(
    org_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Security & compliance posture for the organization.

    Everything here is derived from recorded evidence (findings, verification
    runs, user feedback) — no synthetic scores.
    """
    await access.require_role(db, org_id, current_user.id, "read")
    repo_ids = await _org_repo_ids(db, org_id)
    findings = await _finding_breakdown(db, repo_ids)

    # Per-repo posture rows for the coverage table.
    repo_posture: list[dict] = []
    if repo_ids:
        rows = (
            await db.execute(
                select(Repository.id, Repository.name)
                .where(Repository.org_id == org_id)
                .order_by(Repository.name)
            )
        ).all()
        finding_counts = {
            rid: count
            for rid, count in (
                await db.execute(
                    select(Scan.repository_id, func.count(Finding.id))
                    .join(Finding, Finding.scan_id == Scan.id)
                    .where(Scan.repository_id.in_(repo_ids))
                    .group_by(Scan.repository_id)
                )
            ).all()
        }
        for rid, name in rows:
            repo_posture.append(
                {
                    "repository_id": str(rid),
                    "repository_name": name,
                    "findings_total": finding_counts.get(rid, 0),
                }
            )

    # Feedback-based detection quality (the false-positive learning loop).
    feedback = {"correct": 0, "incorrect": 0, "already_fixed": 0, "not_useful": 0}
    if repo_ids:
        fb_rows = (
            await db.execute(
                select(FindingFeedback.verdict, func.count(FindingFeedback.id))
                .join(Finding, Finding.id == FindingFeedback.finding_id)
                .join(Scan, Scan.id == Finding.scan_id)
                .where(Scan.repository_id.in_(repo_ids))
                .group_by(FindingFeedback.verdict)
            )
        ).all()
        for verdict, count in fb_rows:
            if verdict in feedback:
                feedback[verdict] += count
    total_feedback = sum(feedback.values())
    agreed = feedback["correct"] + feedback["already_fixed"]

    # Fix pipeline health.
    patches_total = 0
    patches_verified = 0
    if repo_ids:
        patch_rows = (
            await db.execute(
                select(Patch.status, func.count(Patch.id))
                .join(Finding, Finding.id == Patch.finding_id)
                .join(Scan, Scan.id == Finding.scan_id)
                .where(Scan.repository_id.in_(repo_ids))
                .group_by(Patch.status)
            )
        ).all()
        for pstatus, count in patch_rows:
            patches_total += count
            if pstatus == PatchStatus.verified:
                patches_verified += count

    open_verified = findings["by_status"].get("verified", 0)
    posture_score = max(0, 100 - findings["verified_critical_high"] * 10 - open_verified * 2)

    return {
        "organization_id": str(org_id),
        "posture_score": posture_score,
        "risk_level": _risk_level(findings),
        "findings": findings,
        "coverage": {
            "repositories": len(repo_posture),
            "scanned_repositories": sum(1 for r in repo_posture if r["findings_total"] > 0),
            "per_repository": repo_posture,
        },
        "detection_quality": {
            "feedback_total": total_feedback,
            "verdicts": feedback,
            "agreement_ratio": round(agreed / total_feedback, 3) if total_feedback else None,
        },
        "fix_pipeline": {"patches_total": patches_total, "patches_verified": patches_verified},
    }
