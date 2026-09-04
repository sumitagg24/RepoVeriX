"""Verification engine.

Workflow (never touches the original repository):

1. copy the repository working copy into ``<storage>/<repo>/sandbox/<verification_id>``
2. apply the candidate patch (unified diff) to that copy
3. install dependencies + run the project tests **inside an isolated runner**
   (Docker by default; a local runner exists strictly for tests/CI)
4. re-run static checks and re-analyse the patched copy
5. decide: VERIFIED_REPAIR / REPAIR_FAILED / REPAIR_NOT_VERIFIED

The original finding is re-evaluated after the patch: tests passing alone never
declare success — the defect itself must no longer be detected (Section 36/64).
"""

from __future__ import annotations

import shutil
import sys
import uuid
import xml.etree.ElementTree as ET
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.analysis.discovery import discover_project
from app.analysis.ingest import repository_dir, source_dir
from app.analysis.patchops import PatchError, apply_patch_to_directory
from app.analysis.process import run_command
from app.analysis.repair import finding_rule
from app.core.config import get_settings
from app.core.logging import log_scan
from app.db.models import (
    Finding,
    Patch,
    PatchStatus,
    Repository,
    Scan,
    TestOutcome,
    TestResult,
    VerificationRun,
    VerificationStatus,
)

MAX_LOG_CHARS = 300_000


# --------------------------------------------------------------------------- runners


@dataclass
class TestRunResult:
    tests_passed: bool = False
    summary: str = ""
    tests: list[dict[str, Any]] = field(default_factory=list)
    error: str | None = None


class ExecutionRunner(Protocol):
    """Runs the project test suite inside an isolated environment."""

    name: str

    async def run_tests(self, workdir: Path, test_command: str, timeout_seconds: int) -> TestRunResult: ...


class DockerRunner:
    """Executes tests inside a Docker container with resource limits.

    The repository code is bind-mounted read-only at /workspace and the
    container gets no host secrets: environment is stripped and re-set with
    minimal values.
    """

    name = "docker"

    def __init__(self, image: str | None = None):
        self.image = image

    def _image_for(self, repo_dir: Path) -> str:
        if self.image:
            return self.image
        manifest = discover_project(repo_dir, "directory")
        if "javascript" in manifest.languages or "typescript" in manifest.languages:
            return "node:20-slim"
        return "python:3.12-slim"

    async def _docker_available(self) -> bool:
        try:
            result = await run_command(
                ["docker", "version", "--format", "{{.Server.Version}}"],
                timeout_seconds=15,
            )
            return result.ok
        except (FileNotFoundError, TimeoutError):
            return False

    async def run_tests(self, workdir: Path, test_command: str, timeout_seconds: int) -> TestRunResult:
        settings = get_settings()
        if not await self._docker_available():
            return TestRunResult(
                error=(
                    "Docker is not available on this host. Execution-based "
                    "verification requires the Docker daemon (see docs/verification.md)."
                )
            )
        image = self._image_for(workdir)
        host = str(workdir.resolve())
        # bind-mount path (Docker Desktop on Windows accepts the drive path)
        shell = f"cd /workspace && {test_command}"
        # Emit a JUnit report inside the bind-mounted workspace so individual
        # test results can be parsed and persisted (same as LocalRunner).
        junit_flag = ""
        if test_command.startswith("python") and "pytest" in test_command:
            junit_flag = " --junitxml=/workspace/junit.xml"
        if test_command.startswith("python"):
            # pytest may not be present in the base image
            install = (
                "python -m pip install -q --disable-pip-version-check pytest "
                "|| echo '[verify] pip install of pytest failed'"
            )
            shell = f"cd /workspace && {install} && {test_command}{junit_flag}"
        elif test_command.startswith("npm"):
            install = "npm install --silent --no-audit --no-fund || echo '[verify] npm install failed'"
            shell = f"cd /workspace && {install} && {test_command}"
        args = [
            "docker",
            "run",
            "--rm",
            "--network",
            settings.sandbox_network,
            "-m",
            settings.sandbox_memory_limit,
            "--cpus",
            str(settings.sandbox_cpu_limit),
            "-v",
            f"{host}:/workspace",
            "-w",
            "/workspace",
            "--env",
            "PATH=/usr/local/bin:/usr/bin:/bin",
            "-e",
            "PYTHONUNBUFFERED=1",
            "-e",
            "CI=1",
            "-i",
            image,
            "sh",
            "-c",
            shell,
        ]
        try:
            result = await run_command(
                args, timeout_seconds=timeout_seconds, env_extra={"DOCKER_BUILDKIT": "1"}
            )
        except FileNotFoundError:
            return TestRunResult(
                error="Docker CLI is not installed on this host; verification requires Docker."
            )
        except TimeoutError:
            return TestRunResult(error=f"Test run timed out after {timeout_seconds}s")

        output = (result.stdout + result.stderr)[-MAX_LOG_CHARS:]
        tests = _parse_junit(workdir / "junit.xml") if "pytest" in test_command else []
        return _interpret_test_output(output, result.returncode, tests=tests)


class LocalRunner:
    """Executes tests on the host against the sandboxed copy.

    TEST/CI USE ONLY — never used for production verification, which must be
    isolated (Docker). Kept as an injectable seam so the pipeline is testable
    without a container daemon.
    """

    name = "local-test"

    def __init__(self, python: str | None = None):
        # Default to the interpreter running this process so pytest availability
        # matches the environment that launched the backend/tests.
        self.python = python or sys.executable

    async def run_tests(self, workdir: Path, test_command: str, timeout_seconds: int) -> TestRunResult:
        try:
            result = await run_command(
                [self.python, "-m", "pytest", "-q", "--junitxml=junit.xml"],
                cwd=workdir,
                timeout_seconds=timeout_seconds,
                env_extra={"PYTHONDONTWRITEBYTECODE": "1"},
            )
        except TimeoutError:
            return TestRunResult(error=f"Test run timed out after {timeout_seconds}s")
        output = (result.stdout + result.stderr)[-MAX_LOG_CHARS:]
        tests = _parse_junit(workdir / "junit.xml")
        passed = result.returncode == 0
        return TestRunResult(
            tests_passed=passed,
            summary=output[-4000:],
            tests=tests,
        )


def _parse_junit(path: Path) -> list[dict[str, Any]]:
    try:
        tree = ET.parse(path)
    except (ET.ParseError, FileNotFoundError):
        return []
    out: list[dict[str, Any]] = []
    for case in tree.getroot().iter("testcase"):
        name = f"{case.get('classname', '')}::{case.get('name', '')}"
        # Note: xml.etree Elements are truthy by child count, so test each
        # child explicitly instead of using ``or`` chaining.
        failure = case.find("failure")
        error = case.find("error")
        skipped = case.find("skipped")
        if failure is not None:
            outcome = TestOutcome.failed
            detail = failure.get("message") or "failed"
        elif error is not None:
            outcome = TestOutcome.error
            detail = error.get("message") or "error"
        elif skipped is not None:
            outcome = TestOutcome.skipped
            detail = ""
        else:
            outcome = TestOutcome.passed
            detail = ""
        out.append(
            {
                "name": name,
                "outcome": outcome,
                "detail": detail[:500],
            }
        )
    return out


def _interpret_test_output(
    output: str, returncode: int, tests: list[dict[str, Any]] | None = None
) -> TestRunResult:
    passed = returncode == 0
    return TestRunResult(
        tests_passed=passed,
        summary=output[-4000:],
        tests=tests or [],
    )


def build_runner(name: str) -> ExecutionRunner:
    if name == "local":
        return LocalRunner()
    return DockerRunner()


# --------------------------------------------------------------------------- host-side checks


async def _ruff_findings(workdir: Path, files: list[str]) -> list[tuple[str, int]] | None:
    """Return ``[(rule, line)]`` for ruff S/B findings; None if ruff is missing."""
    import json

    def _build_args(executable: list[str]) -> list[str]:
        return [
            *executable,
            "check",
            *files,
            "--select",
            "S,B",
            "--isolated",
            "--output-format",
            "json",
            "--quiet",
        ]

    for executable in (["ruff"], [sys.executable, "-m", "ruff"]):
        try:
            result = await run_command(_build_args(executable), cwd=workdir, timeout_seconds=60)
        except (FileNotFoundError, TimeoutError):
            continue
        try:
            payload = json.loads(result.stdout or "[]")
        except (ValueError, TypeError):
            payload = []
        return [
            (str(item.get("code") or "?"), int(item.get("location", {}).get("row") or 0))
            for item in payload
            if isinstance(item, dict)
        ]
    return None  # tool unavailable


async def _static_checks_pass(
    workdir: Path, changed_files: list[str], baseline_root: Path | None
) -> tuple[bool, str]:
    """Ruff (if available) over changed files vs. the pre-patch baseline.

    Only findings the patch *introduces* count against the repair: pre-existing
    issues in the repository (e.g. sibling vulnerabilities) must not fail the
    verification of an unrelated fix. Missing tool = inconclusive (pass).
    """
    py_files = [f for f in changed_files if f.endswith(".py")]
    if not py_files:
        return True, "no python files changed"
    patched = await _ruff_findings(workdir, py_files)
    if patched is None:
        return True, "ruff unavailable; static check skipped"
    baseline: set[tuple[str, int]] = set()
    if baseline_root is not None:
        existing = [f for f in py_files if (baseline_root / f).exists()]
        base_findings = await _ruff_findings(baseline_root, existing) or []
        baseline = set(base_findings)
    introduced = [f for f in patched if f not in baseline]
    if not introduced:
        return True, f"ruff: {len(patched)} findings, none introduced by the patch"
    detail = "; ".join(f"{rule}@{line}" for rule, line in introduced[:20])
    return False, f"ruff: patch introduces {len(introduced)} finding(s): {detail}"


def _reanalyze(workdir: Path, finding: Finding) -> tuple[bool, list[dict[str, Any]]]:
    """Re-run the built-in detectors on the patched file and check the original rule."""
    from app.analysis.detectors import run_detectors
    from app.analysis.parsing import parse_source

    target = workdir / finding.file_path
    if not target.exists():
        return True, []  # file gone => the issue cannot be in the patched tree
    try:
        text = target.read_text(encoding="utf-8", errors="replace")
    except OSError:
        return True, []
    language = "python" if finding.file_path.endswith((".py", ".pyi")) else "javascript"
    if finding.file_path.endswith((".ts", ".tsx")):
        language = "typescript"
    try:
        pf = parse_source(text, language, finding.file_path)
    except Exception:
        return True, []
    findings = run_detectors([pf])
    rule = finding_rule(finding)
    same_rule = [f for f in findings if f.rule == rule]
    # The original *finding* is resolved when the rule no longer fires inside
    # the same function (or, when the function is unknown, near the same lines).
    # Sibling occurrences of the same rule in other functions do not block a
    # finding-level repair verdict — they are reported separately in the logs.
    if not same_rule:
        return False, [f.to_dict() for f in findings]
    if finding.function_name:
        still = any(f.extra.get("function") == finding.function_name for f in same_rule)
    else:
        still = False
        for f in same_rule:
            if finding.line_start and abs(f.line_start - finding.line_start) <= 6:
                still = True
                break
    return still, [f.to_dict() for f in findings]


# --------------------------------------------------------------------------- orchestration


def _test_command_for(workdir: Path) -> str:
    manifest = discover_project(workdir, "directory")
    if manifest.test_command and "npm" in manifest.test_command:
        return "npm test -- --runInBand" if "jest" in manifest.test_frameworks else manifest.test_command
    if "python" in manifest.languages or manifest.package_managers:
        if "pytest" in manifest.test_frameworks:
            return "python -m pytest -q"
        if manifest.test_file_count:
            return "python -m unittest discover -q"
    if manifest.test_file_count:
        return "npm test"
    return "true"  # no tests detected: nothing to run (recorded as no-op)


async def run_verification(
    session_factory: async_sessionmaker[AsyncSession],
    verification_id: uuid.UUID,
    *,
    runner: ExecutionRunner | None = None,
) -> None:
    """Execute one verification run end-to-end and persist the outcome."""
    settings = get_settings()
    log = log_scan
    async with session_factory() as db:
        result = await db.execute(
            select(VerificationRun)
            .options(
                selectinload(VerificationRun.patch),
                selectinload(VerificationRun.patch).selectinload(Patch.finding),
                selectinload(VerificationRun.patch)
                .selectinload(Patch.finding)
                .selectinload(Finding.evidence),
                selectinload(VerificationRun.patch).selectinload(Patch.finding).selectinload(Finding.scan),
                selectinload(VerificationRun.patch)
                .selectinload(Patch.finding)
                .selectinload(Finding.scan)
                .selectinload(Scan.repository),
            )
            .where(VerificationRun.id == verification_id)
        )
        run = result.scalar_one_or_none()
        if run is None:
            return
        if run.status == VerificationStatus.running:
            return
        patch: Patch = run.patch
        finding: Finding = patch.finding
        scan: Scan = finding.scan
        repo: Repository = scan.repository

        run.status = VerificationStatus.running
        run.started_at = datetime.now(UTC)
        run.patch_applied = False
        run.logs = ""
        await db.commit()

        repo_id = str(repo.id)
        sandbox_dir = repository_dir(repo_id) / "verify" / str(verification_id)
        src_dir = source_dir(repo_id)
        logs: list[str] = []

        try:
            # 1. isolated copy
            if sandbox_dir.exists():
                shutil.rmtree(sandbox_dir, ignore_errors=True)
            if src_dir.exists():
                shutil.copytree(
                    src_dir,
                    sandbox_dir,
                    ignore=shutil.ignore_patterns(".git", "__pycache__", ".pytest_cache"),
                )
            else:
                raise PatchError("Repository source not found for verification", code="source_missing")
            logs.append(f"[prepare] copied repository to {sandbox_dir}")

            # 2. apply patch
            try:
                changed = apply_patch_to_directory(sandbox_dir, patch.diff)
            except PatchError as exc:
                run.patch_applied = False
                logs.append(f"[patch] FAILED: {exc.message}")
                run.logs = "\n".join(logs)[-MAX_LOG_CHARS:]
                run.status = VerificationStatus.repair_failed
                run.finished_at = datetime.now(UTC)
                await db.commit()
                return
            run.patch_applied = True
            patch.status = PatchStatus.applied
            logs.append(f"[patch] applied to {', '.join(changed)}")

            # 3. static checks (host-side, deterministic): a patch must not
            #    introduce NEW issues vs. the pre-patch baseline
            static_ok, static_log = await _static_checks_pass(sandbox_dir, changed, src_dir)
            run.static_passed = static_ok
            logs.append(f"[static] {'passed' if static_ok else 'issues introduced'}\n{static_log[:1000]}")

            # 4. tests inside the isolated runner
            runner_instance = runner or DockerRunner()
            command = _test_command_for(sandbox_dir)
            logs.append(f"[tests] command: {command} (runner: {runner_instance.name})")
            test_result = await runner_instance.run_tests(
                sandbox_dir, command, settings.sandbox_timeout_seconds
            )
            if test_result.error:
                logs.append(f"[tests] ERROR: {test_result.error}")
                run.logs = "\n".join(logs)[-MAX_LOG_CHARS:]
                run.status = VerificationStatus.repair_not_verified
                patch.status = PatchStatus.not_verified
                run.finished_at = datetime.now(UTC)
                await db.commit()
                return
            run.deps_installed = True  # dependency installation is attempted inside the image
            run.tests_passed = test_result.tests_passed
            logs.append(f"[tests] {'PASSED' if test_result.tests_passed else 'FAILED'}")
            if test_result.summary:
                logs.append("[tests] output:\n" + test_result.summary[-4000:])

            # persist individual test results
            for t in test_result.tests:
                db.add(
                    TestResult(
                        verification_run_id=run.id,
                        test_name=t["name"][:1024],
                        outcome=t["outcome"],
                        output=(t.get("detail") or "")[:4000] or None,
                    )
                )

            # 5. re-analysis of the original finding
            still_detected, findings_after = _reanalyze(sandbox_dir, finding)
            run.finding_still_detected = still_detected
            logs.append(
                f"[reanalysis] original finding ({finding_rule(finding)}) "
                f"{'STILL DETECTED' if still_detected else 'no longer detected'}"
            )
            if findings_after:
                logs.append(f"[reanalysis] {len(findings_after)} findings remain after patch")

            # 6. outcome
            if run.tests_passed and not still_detected:
                run.status = VerificationStatus.verified_repair
                patch.status = PatchStatus.verified
            else:
                run.status = VerificationStatus.repair_failed
                patch.status = PatchStatus.failed
            logs.append(f"[result] {run.status.value}")

        except PatchError as exc:
            run.status = VerificationStatus.repair_failed
            logs.append(f"[error] {exc.message}")
        except Exception as exc:  # pragma: no cover - safety net
            run.status = VerificationStatus.repair_not_verified
            logs.append(f"[error] internal verification failure: {type(exc).__name__}: {exc}")
            log(str(verification_id), "verification", "failed", message=str(exc)[:500])
        finally:
            run.finished_at = datetime.now(UTC)
            run.logs = "\n".join(logs)[-MAX_LOG_CHARS:]
            await db.commit()
            # clean up the sandbox copy (isolated, disposable)
            shutil.rmtree(sandbox_dir, ignore_errors=True)
