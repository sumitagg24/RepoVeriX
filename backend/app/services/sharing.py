"""Sanitised public report assembly for secret-URL sharing.

:class:`~app.db.models.ReportShare` rows carry no authentication, so anything
served from the public endpoint must assume an anonymous, untrusted audience.
The private report (``app/services/reporting.py``) contains material a public
URL must never expose:

- evidence code snippets and file paths (source exfiltration of private repos)
- repository source URLs (may embed private org/repo names)
- LLM token usage and cost data
- scan warnings and internals

:func:`build_public_report` therefore assembles a deliberately reduced view:
counts, distributions, per-finding verdicts without code, and verification
outcomes. Verify the share (exists, not revoked, not expired) *before*
assembling; the route enforces that.
"""

from __future__ import annotations

import secrets
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Finding, Patch, ReportShare, Repository, Scan


def new_share_token() -> str:
    """Generate a 256-bit urlsafe token for a share link."""
    return secrets.token_urlsafe(32)


async def create_share(db: AsyncSession, scan_id, user_id, days: int | None = None) -> ReportShare:
    """Create (or replace) the share for a scan owned by ``user_id``."""
    scan_result = await db.execute(
        select(Scan).join(Repository).where(Scan.id == scan_id, Repository.owner_id == user_id)
    )
    if scan_result.scalar_one_or_none() is None:
        raise LookupError("scan_not_found")

    # One live share per scan: revoke any previous share so old links die when
    # a new link is minted (revocation must be able to catch every copy).
    previous = (
        (
            await db.execute(
                select(ReportShare).where(ReportShare.scan_id == scan_id, ReportShare.revoked_at.is_(None))
            )
        )
        .scalars()
        .all()
    )
    for row in previous:
        row.revoked_at = datetime.now(UTC)

    expires_at = None
    if days is not None:
        if not 1 <= days <= 365:
            raise ValueError("expiry_days_out_of_range")
        from datetime import timedelta

        expires_at = datetime.now(UTC) + timedelta(days=days)

    share = ReportShare(
        scan_id=scan_id,
        token=new_share_token(),
        created_by=user_id,
        expires_at=expires_at,
    )
    db.add(share)
    await db.commit()
    await db.refresh(share)
    return share


async def resolve_share(db: AsyncSession, token: str) -> ReportShare | None:
    """Return the share only when it exists, is not revoked and not expired."""
    share = (await db.execute(select(ReportShare).where(ReportShare.token == token))).scalar_one_or_none()
    if share is None or share.revoked_at is not None:
        return None
    if share.expires_at is not None and share.expires_at <= datetime.now(UTC):
        return None
    return share


async def build_public_report(db: AsyncSession, share: ReportShare) -> dict[str, Any] | None:
    """Assemble the sanitised report served at the public endpoint."""
    scan_result = await db.execute(
        select(Scan).options(selectinload(Scan.repository)).where(Scan.id == share.scan_id)
    )
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        return None
    repo: Repository = scan.repository

    findings_result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.patches).selectinload(Patch.verification_runs),
            selectinload(Finding.evidence),
        )
        .where(Finding.scan_id == scan.id)
        .order_by(Finding.severity, Finding.created_at)
    )
    findings = list(findings_result.scalars().all())

    def _public_finding(f: Finding) -> dict[str, Any]:
        verdicts = [r.status.value for p in f.patches for r in p.verification_runs]
        return {
            "external_id": f.external_id,
            "title": f.title,
            "category": f.category.value,
            "severity": f.severity.value,
            "status": f.status.value,
            "confidence": round(f.confidence, 2),
            # Coarse location: file basename + line numbers only. No directory
            # structure, no code, no snippets — enough for a reader to see
            # *what kind* of issue exists and where roughly, not to reconstruct
            # the source.
            "file": (f.file_path or "").rsplit("/", 1)[-1] if f.file_path else None,
            "line_start": f.line_start,
            "line_end": f.line_end,
            "evidence_kinds": sorted({e.kind.value for e in f.evidence}),
            "repair_attempted": bool(f.patches),
            "repair_verified": "verified_repair" in verdicts,
        }

    by_severity: dict[str, int] = {}
    by_status: dict[str, int] = {}
    for f in findings:
        by_severity[f.severity.value] = by_severity.get(f.severity.value, 0) + 1
        by_status[f.status.value] = by_status.get(f.status.value, 0) + 1

    return {
        "report_version": 1,
        "shared_at": datetime.now(UTC).isoformat(),
        "repository": {
            # Name only. source_url can embed private org names; never exposed.
            "name": repo.name,
            "source_type": repo.source_type.value,
            "languages": repo.primary_languages or [],
        },
        "scan": {
            "status": scan.status.value,
            "configuration": scan.configuration.value,
            "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
        },
        "summary": {
            "total_findings": len(findings),
            "by_severity": by_severity,
            "by_status": by_status,
            "repairs_attempted": sum(1 for f in findings if f.patches),
            "repairs_verified": sum(
                1
                for f in findings
                if any(r.status.value == "verified_repair" for p in f.patches for r in p.verification_runs)
            ),
        },
        "findings": [_public_finding(f) for f in findings],
    }


async def record_view(db: AsyncSession, share: ReportShare) -> None:
    """Best-effort view counter (never blocks serving the report)."""
    try:
        share.view_count += 1
        share.last_viewed_at = datetime.now(UTC)
        await db.commit()
    except Exception:  # noqa: BLE001 - counting must never break viewing
        await db.rollback()
