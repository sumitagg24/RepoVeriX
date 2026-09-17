"""Repository access control (personal + organization RBAC).

Every route that loads a repository-scoped resource resolves access through
this module so authorization cannot drift between endpoints:

- Personal repositories: owner-only (unchanged behaviour).
- Organization repositories: any active member has **read/scan** access;
  management actions (delete, member management) require ``admin``; owner-only
  actions (delete the org) require ``owner``. Roles: ``member`` < ``admin`` <
  ``owner`` (rank on :class:`~app.db.models.OrgRole`).

A user who is neither the owner nor an org member gets the same 404 an
anonymous request would get — access denials never confirm that a resource
exists (IDOR guard).
"""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Organization, OrganizationMember, OrgRole, Repository, Scan


class AccessDenied(Exception):
    """Raised when the user has no access; callers map it to 404."""


def requires(role: str) -> OrgRole:
    """Minimum role for an action class."""
    return {
        "read": OrgRole.member,
        "admin": OrgRole.admin,
        "owner": OrgRole.owner,
    }[role]


async def role_for(db: AsyncSession, repo: Repository, user_id) -> OrgRole | None:
    """Resolve the caller's role on a repository.

    Returns ``owner``-equivalent privilege for the personal owner, the org
    role for members, or ``None`` when the caller has no access at all.
    """
    if repo.owner_id == user_id:
        return OrgRole.owner
    if repo.org_id is None:
        return None
    membership = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == repo.org_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    return membership.role if membership is not None else None


async def can_read(db: AsyncSession, repo: Repository, user_id) -> bool:
    role = await role_for(db, repo, user_id)
    return role is not None


async def can_manage(db: AsyncSession, repo: Repository, user_id) -> bool:
    """Delete/configure the repository: personal owner or org admin+."""
    role = await role_for(db, repo, user_id)
    return role is not None and role.rank >= requires("admin").rank


async def load_repository(db: AsyncSession, repository_id: uuid.UUID, user_id) -> Repository:
    """Load a repository the user may read, or raise :class:`AccessDenied`."""
    repo = (await db.execute(select(Repository).where(Repository.id == repository_id))).scalar_one_or_none()
    if repo is None or not await can_read(db, repo, user_id):
        raise AccessDenied("repository_not_found")
    return repo


async def load_scan(db: AsyncSession, scan_id: uuid.UUID, user_id) -> Scan:
    """Load a scan whose repository the user may read, or raise."""
    scan = (
        await db.execute(
            select(Scan).join(Repository, Repository.id == Scan.repository_id).where(Scan.id == scan_id)
        )
    ).scalar_one_or_none()
    if scan is None:
        raise AccessDenied("scan_not_found")
    repo = (await db.execute(select(Repository).where(Repository.id == scan.repository_id))).scalar_one()
    if not await can_read(db, repo, user_id):
        raise AccessDenied("scan_not_found")
    return scan


async def user_organizations(db: AsyncSession, user_id) -> list[tuple[Organization, OrgRole]]:
    """All organizations the user belongs to, with their roles."""
    rows = (
        await db.execute(
            select(Organization, OrganizationMember.role)
            .join(OrganizationMember, OrganizationMember.organization_id == Organization.id)
            .where(OrganizationMember.user_id == user_id)
            .order_by(Organization.created_at)
        )
    ).all()
    return [(org, role) for org, role in rows]


async def require_role(
    db: AsyncSession, organization_id: uuid.UUID, user_id, minimum: str
) -> OrganizationMember:
    """Return the membership when the user holds at least ``minimum`` role."""
    member = (
        await db.execute(
            select(OrganizationMember).where(
                OrganizationMember.organization_id == organization_id,
                OrganizationMember.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if member is None or member.role.rank < requires(minimum).rank:
        raise AccessDenied("insufficient_role")
    return member
