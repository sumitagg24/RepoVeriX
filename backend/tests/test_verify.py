"""Tests for candidate repair generation and the verification engine.

The flagship workflow under test:

    finding -> generate_repair (deterministic template)
            -> Patch row -> VerificationRun
            -> run_verification against an isolated copy of the repository
            -> tests + static checks + re-analysis
            -> VERIFIED_REPAIR / REPAIR_FAILED

Repairs are never applied to the original repository: verification copies the
scan working copy into a sandbox first. Tests use the LocalRunner (host pytest
inside the sandbox copy); production uses the DockerRunner.
"""

import shutil
import tempfile
import uuid
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker
from sqlalchemy.orm import selectinload

from app.analysis.ingest import source_dir
from app.analysis.models import AnalysisError
from app.analysis.orchestrate import run_scan
from app.analysis.patchops import apply_patch_to_directory, render_patch
from app.analysis.repair import generate_repair
from app.analysis.verify import LocalRunner, run_verification
from app.db.models import (
    Finding,
    Patch,
    PatchStatus,
    ScanConfiguration,
    VerificationRun,
    VerificationStatus,
)
from app.db.models import (
    TestOutcome as DBTestOutcome,
)
from app.db.models import (
    TestResult as DBTestResult,
)
try:
    from tests.test_orchestrator import _seed_repo_scan, zip_from_dir
except ImportError:
    from backend.tests.test_orchestrator import _seed_repo_scan, zip_from_dir

FIXTURES = Path(__file__).parent / "fixtures" / "repos"


async def _scan_findings(db_engine, repo_bytes: bytes) -> tuple[async_sessionmaker, list[Finding], str]:
    """Scan a fixture repo and return (session_factory, findings, repo_id)."""
    factory, scan_id, repo_id = await _seed_repo_scan(db_engine, repo_bytes, ScanConfiguration.static_only)
    await run_scan(factory, scan_id)
    async with factory() as db:
        findings = list(
            (
                await db.execute(
                    select(Finding).options(selectinload(Finding.evidence)).where(Finding.scan_id == scan_id)
                )
            ).scalars()
        )
    return factory, findings, repo_id


def _pick_sqli(findings: list[Finding], function_name: str = "search_users") -> Finding:
    return next(
        f for f in findings if f.title == "Potential SQL Injection" and f.function_name == function_name
    )


async def _seed_patch_and_run(factory, finding, diff: str, generated_by: str) -> tuple[uuid.UUID, uuid.UUID]:
    async with factory() as db:
        patch = Patch(
            finding_id=finding.id,
            diff=diff,
            explanation="test patch",
            generated_by=generated_by,
            status=PatchStatus.candidate,
        )
        db.add(patch)
        await db.commit()
        await db.refresh(patch)
        run = VerificationRun(patch_id=patch.id, status=VerificationStatus.pending)
        db.add(run)
        await db.commit()
        await db.refresh(run)
        return patch.id, run.id


# --------------------------------------------------------------------------- repair generation


async def test_sqli_template_produces_parameterized_patch(db_engine):
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, findings, repo_id = await _scan_findings(db_engine, repo_bytes=zip_bytes)
    finding = _pick_sqli(findings)

    result = await generate_repair(finding, source_root=source_dir(str(repo_id)), provider=None)
    assert result.generated_by == "repoverix-template"
    assert "parameterized" in result.description
    assert "+" in result.diff
    assert "execute(" in result.diff
    assert ", (" in result.diff  # parameter tuple appended to execute call
    # the patch parses cleanly and targets exactly the affected file (applied to
    # a scratch copy so the working copy stays untouched)
    scratch = Path(tempfile.mkdtemp(prefix="rvx-apply-"))
    shutil.copytree(source_dir(str(repo_id)), scratch, dirs_exist_ok=True)
    assert apply_patch_to_directory(scratch, result.diff) == ["app.py"]
    shutil.rmtree(scratch, ignore_errors=True)


async def test_template_declines_and_raises_when_shape_changed(db_engine):
    """No matching template shape and no LLM provider -> explicit AnalysisError."""
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, findings, repo_id = await _scan_findings(db_engine, repo_bytes=zip_bytes)
    # "Broad Exception Swallows Errors" has no deterministic template rule, so
    # without an LLM provider the repair is unavailable -> explicit error
    finding = next(f for f in findings if f.title == "Broad Exception Swallows Errors")

    try:
        await generate_repair(finding, source_root=source_dir(str(repo_id)), provider=None)
        raise AssertionError("expected AnalysisError for unsupported template")
    except AnalysisError as exc:
        assert exc.code == "repair_unavailable"


# --------------------------------------------------------------------------- verification engine


async def test_verification_flow_verifies_good_repair(db_engine):
    """The flagship demo: template SQLi repair -> tests pass -> defect gone."""
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, findings, repo_id = await _scan_findings(db_engine, repo_bytes=zip_bytes)
    finding = _pick_sqli(findings)
    repair = await generate_repair(finding, source_root=source_dir(str(repo_id)), provider=None)

    patch_id, run_id = await _seed_patch_and_run(factory, finding, repair.diff, repair.generated_by)
    await run_verification(factory, run_id, runner=LocalRunner())

    async with factory() as db:
        run = await db.get(VerificationRun, run_id)
        assert run.status == VerificationStatus.verified_repair
        assert run.patch_applied is True
        assert run.tests_passed is True
        assert run.finding_still_detected is False
        assert run.finished_at is not None
        assert "no longer detected" in (run.logs or "")
        patch = await db.get(Patch, patch_id)
        assert patch.status == PatchStatus.verified

        test_rows = list(
            (
                await db.execute(select(DBTestResult).where(DBTestResult.verification_run_id == run_id))
            ).scalars()
        )
        assert len(test_rows) >= 4
        assert {t.outcome for t in test_rows} == {DBTestOutcome.passed}

        # the sandbox copy must be cleaned up after the run
        sandbox = source_dir(str(repo_id)).parent / "verify" / str(run_id)
        assert not sandbox.exists()

    # the original working copy was never touched by the verification flow
    app_text = (source_dir(str(repo_id)) / "app.py").read_text(encoding="utf-8")
    assert "WHERE name = '{name}'" in app_text


async def test_verification_fails_when_repair_does_not_fix(db_engine):
    """A cosmetic-only patch keeps the defect -> tests fail -> REPAIR_FAILED."""
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, findings, repo_id = await _scan_findings(db_engine, repo_bytes=zip_bytes)
    finding = _pick_sqli(findings)
    app_text = (source_dir(str(repo_id)) / "app.py").read_text(encoding="utf-8")
    bogus_diff = render_patch([("app.py", app_text, app_text + "\n# cosmetic change")])

    patch_id, run_id = await _seed_patch_and_run(factory, finding, bogus_diff, "test")
    await run_verification(factory, run_id, runner=LocalRunner())

    async with factory() as db:
        run = await db.get(VerificationRun, run_id)
        assert run.status == VerificationStatus.repair_failed
        assert run.patch_applied is True
        assert run.tests_passed is False  # the injection test still fails
        assert run.finding_still_detected is True
        patch = await db.get(Patch, patch_id)
        assert patch.status == PatchStatus.failed


async def test_verification_reports_unavailable_runner(db_engine):
    """No usable runner -> repair_not_verified with an explicit, stored error."""
    zip_bytes = zip_from_dir(FIXTURES / "vulnerable_app", wrapper="demo-repo")
    factory, findings, repo_id = await _scan_findings(db_engine, repo_bytes=zip_bytes)
    finding = _pick_sqli(findings)
    repair = await generate_repair(finding, source_root=source_dir(str(repo_id)), provider=None)

    patch_id, run_id = await _seed_patch_and_run(factory, finding, repair.diff, repair.generated_by)

    class UnavailableRunner:
        name = "docker"

        async def run_tests(self, workdir, test_command, timeout_seconds):
            return type(
                "R",
                (),
                {
                    "tests_passed": False,
                    "error": "Docker is not available on this host. Execution-based "
                    "verification requires the Docker daemon (see docs/verification.md).",
                    "tests": [],
                    "summary": "",
                },
            )()

    await run_verification(factory, run_id, runner=UnavailableRunner())

    async with factory() as db:
        run = await db.get(VerificationRun, run_id)
        assert run.status == VerificationStatus.repair_not_verified
        assert "Docker is not available" in (run.logs or "")
        patch = await db.get(Patch, patch_id)
        assert patch.status == PatchStatus.not_verified


def test_parse_junit_extracts_individual_tests(tmp_path):
    """JUnit XML produced inside the Docker sandbox yields per-test rows."""
    junit = tmp_path / "junit.xml"
    junit.write_text(
        """<?xml version="1.0" encoding="utf-8"?>
<testsuite name="pytest" tests="3" failures="1" errors="0" skipped="0">
  <testcase classname="test_app" name="test_search_ok" time="0.01"/>
  <testcase classname="test_app" name="test_injection_blocked" time="0.02">
    <failure message="assert 1 == 0">traceback here</failure>
  </testcase>
  <testcase classname="test_app" name="test_skipped" time="0.0">
    <skipped message="needs db"/>
  </testcase>
</testsuite>
""",
        encoding="utf-8",
    )
    from app.analysis.verify import _parse_junit

    rows = _parse_junit(junit)
    assert [r["name"] for r in rows] == [
        "test_app::test_search_ok",
        "test_app::test_injection_blocked",
        "test_app::test_skipped",
    ]
    assert rows[0]["outcome"] == "passed"
    assert rows[1]["outcome"] == "failed"
    assert rows[2]["outcome"] == "skipped"
    assert "assert 1 == 0" in rows[1]["detail"]


def test_interpret_test_output_carries_parsed_tests():
    """DockerRunner now carries parsed per-test rows into the result."""
    from app.analysis.verify import _interpret_test_output

    result = _interpret_test_output("4 passed in 0.3s", 0, tests=[{"name": "x", "outcome": "passed"}])
    assert result.tests_passed is True
    assert result.tests == [{"name": "x", "outcome": "passed"}]

    result = _interpret_test_output("1 failed", 1)
    assert result.tests_passed is False
    assert result.tests == []
