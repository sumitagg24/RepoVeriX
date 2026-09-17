"""Tests for startup job recovery (crash/restart never leaves jobs stuck)."""

import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from app.analysis.recovery import recover_stale_jobs
from app.db.models import (
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Patch,
    PatchStatus,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    VerificationRun,
    VerificationStatus,
)


async def _full_job_chain(db_session: AsyncSession, test_repository, test_user):
    """Scan + finding + patch + verification rows for FK-correct inserts."""
    scan = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.pending,
    )
    db_session.add(scan)
    await db_session.flush()

    finding = Finding(
        scan_id=scan.id,
        external_id="RVX-REC-0001",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="Recovery fixture",
        description="fixture",
        file_path="app.py",
        line_start=1,
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.flush()

    patch = Patch(
        finding_id=finding.id,
        diff="-a\n+b\n",
        explanation="fixture",
        generated_by="test",
        status=PatchStatus.candidate,
    )
    db_session.add(patch)
    await db_session.flush()
    return scan, finding, patch


@pytest.mark.asyncio
async def test_recover_stale_scans(db_engine, db_session, test_repository, test_user):
    """Running/pending scans become failed; terminal scans are untouched."""
    stale = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.static_llm,
        status=ScanStatus.running,
    )
    stale2 = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.static_only,
        status=ScanStatus.pending,
    )
    done = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.completed,
    )
    db_session.add_all([stale, stale2, done])
    await db_session.commit()

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    result = await recover_stale_jobs(factory)
    assert result["scans_recovered"] == 2
    assert result["verifications_recovered"] == 0

    async with factory() as check:
        from sqlalchemy import select

        rows = (await check.execute(select(Scan))).scalars().all()
        by_status = {s.configuration: s for s in rows}
        assert by_status[ScanConfiguration.static_llm].status == ScanStatus.failed
        error = by_status[ScanConfiguration.static_llm].error or ""
        assert "restart" in error
        assert by_status[ScanConfiguration.static_only].status == ScanStatus.failed
        assert by_status[ScanConfiguration.repoverix].status == ScanStatus.completed


@pytest.mark.asyncio
async def test_recover_stale_verifications(db_engine, db_session, test_repository, test_user):
    """Pending/running verifications become repair_not_verified; verified stays."""
    scan, finding, patch = await _full_job_chain(db_session, test_repository, test_user)

    running = VerificationRun(patch_id=patch.id, status=VerificationStatus.running)
    pending = VerificationRun(patch_id=patch.id, status=VerificationStatus.pending)
    finished = VerificationRun(patch_id=patch.id, status=VerificationStatus.verified_repair)
    db_session.add_all([running, pending, finished])
    await db_session.commit()

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    result = await recover_stale_jobs(factory)
    assert result["verifications_recovered"] == 2

    async with factory() as check:
        from sqlalchemy import select

        runs = (await check.execute(select(VerificationRun))).scalars().all()
        by_status = {r.status: r for r in runs}
        assert VerificationStatus.repair_not_verified in by_status
        assert by_status[VerificationStatus.repair_not_verified].finished_at is not None
        assert "restart" in (by_status[VerificationStatus.repair_not_verified].logs or "")
        assert VerificationStatus.verified_repair in by_status  # untouched


@pytest.mark.asyncio
async def test_recover_idempotent(db_engine, db_session, test_repository, test_user):
    """Running recovery twice recovers nothing the second time."""
    scan = Scan(
        repository_id=test_repository.id,
        configuration=ScanConfiguration.static_only,
        status=ScanStatus.running,
    )
    db_session.add(scan)
    await db_session.commit()

    factory = async_sessionmaker(db_engine, class_=AsyncSession, expire_on_commit=False)
    first = await recover_stale_jobs(factory)
    second = await recover_stale_jobs(factory)
    assert first["scans_recovered"] == 1
    assert second["scans_recovered"] == 0
