"""External static-analysis tool adapters.

Every tool is *capability-detected*: if the binary is not installed the adapter
returns ``ToolRun(available=False)`` and the caller degrades gracefully instead
of failing the scan.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.analysis.models import StaticFinding, ToolRun
from app.analysis.parsing import ParsedFile  # noqa: F401  (re-export for convenience)
from app.analysis.process import run_command
from app.db.models import FindingCategory, Severity

# ruff rule -> (category, severity)  (S = flake8-bandit port, B = bugbear)
_RUFF_SEVERITY: dict[str, tuple[FindingCategory, Severity]] = {}


def _ruff_meta(rule: str) -> tuple[FindingCategory, Severity]:
    if rule.startswith("S"):
        if rule in {"S105", "S106", "S107"}:
            return FindingCategory.security, Severity.high
        if rule in {"S608", "S608a", "S608b", "S701"}:
            return FindingCategory.security, Severity.critical
        if rule in {"S601", "S602", "S604", "S605", "S606", "S607"}:
            return FindingCategory.security, Severity.high
        if rule in {"S311", "S324"}:
            return FindingCategory.security, Severity.low
        if rule.startswith("S3"):
            return FindingCategory.security, Severity.low
        if rule.startswith("S2"):
            return FindingCategory.security, Severity.low
        if rule.startswith("S1"):
            return FindingCategory.security, Severity.medium
        return FindingCategory.security, Severity.medium
    if rule.startswith("B"):
        return FindingCategory.logic, Severity.low if rule.startswith("B0") and rule in {
            "B006",
            "B007",
        } else Severity.medium
    return FindingCategory.logic, Severity.low


async def run_ruff(root: Path, languages: list[str]) -> ToolRun:
    """Run ``ruff check --select S,B`` and normalize JSON output."""
    # ruff only checks python files; nothing to do for pure JS/TS repos
    if "python" not in languages:
        return ToolRun(tool="ruff", available=False, error="No Python files to check")
    try:
        result = await run_command(
            [
                "ruff",
                "check",
                ".",
                "--select",
                "S,B",
                "--output-format",
                "json",
                "--quiet",
                "--isolated",  # never honour configuration embedded in the scanned repo
            ],
            cwd=root,
            timeout_seconds=120,
        )
    except FileNotFoundError:
        return ToolRun(tool="ruff", available=False, error="ruff is not installed on this host")
    except TimeoutError:
        return ToolRun(tool="ruff", available=False, error="ruff timed out")

    if result.returncode not in (0, 1):  # 1 = findings, other = error
        return ToolRun(
            tool="ruff",
            available=True,
            succeeded=False,
            error=(result.stderr or result.stdout).strip()[-800:],
        )

    findings: list[StaticFinding] = []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return ToolRun(tool="ruff", available=True, succeeded=False, error="Unparseable ruff output")

    for item in payload:
        code = item.get("code") or item.get("rule", {}).get("code", "S")
        location = item.get("location", {})
        filename = item.get("filename", "")
        rel = filename.replace("\\", "/")
        category, severity = _ruff_meta(code)
        # ruff severity: it only reports selected rules, so this is a real hit;
        # keep confidence moderate - rules are heuristic
        findings.append(
            StaticFinding(
                tool="ruff",
                rule=code,
                file_path=rel,
                line_start=location.get("row", 0),
                line_end=location.get("end_row", location.get("row", 0)),
                severity=severity,
                category=category,
                message=item.get("message", ""),
                confidence=0.7 if code.startswith("B") else 0.65,
                evidence=[],
                extra={"fix": item.get("fix"), "rule_description": item.get("message", "")[:300]},
            )
        )
    return ToolRun(tool="ruff", available=True, succeeded=True, findings=findings)


_BANDIT_SEV = {"LOW": Severity.low, "MEDIUM": Severity.medium, "HIGH": Severity.high}


async def run_bandit(root: Path, languages: list[str]) -> ToolRun:
    """Run bandit over the python sources when installed."""
    if "python" not in languages:
        return ToolRun(tool="bandit", available=False, error="No Python files to check")
    try:
        result = await run_command(
            ["bandit", "-r", ".", "-f", "json", "-q", "--silent"],
            cwd=root,
            timeout_seconds=180,
        )
    except FileNotFoundError:
        return ToolRun(tool="bandit", available=False, error="bandit is not installed on this host")
    except TimeoutError:
        return ToolRun(tool="bandit", available=False, error="bandit timed out")

    if not result.ok:
        return ToolRun(tool="bandit", available=False, error=(result.stderr or result.stdout).strip()[-500:])

    findings: list[StaticFinding] = []
    try:
        payload = json.loads(result.stdout)
    except json.JSONDecodeError:
        return ToolRun(tool="bandit", available=True, succeeded=False, error="Unparseable bandit output")

    for issue in payload.get("results", []):
        filename = issue.get("filename", "").replace("\\", "/")
        sev = _BANDIT_SEV.get(issue.get("issue_severity", "MEDIUM"), Severity.medium)
        conf = {"LOW": 0.5, "MEDIUM": 0.7, "HIGH": 0.9}.get(issue.get("issue_confidence", "MEDIUM"), 0.7)
        findings.append(
            StaticFinding(
                tool="bandit",
                rule=issue.get("test_id", "UNKNOWN"),
                file_path=filename,
                line_start=issue.get("line_number", 0),
                line_end=issue.get("line_number", 0),
                severity=sev,
                category=FindingCategory.security,
                message=issue.get("issue_text", ""),
                confidence=conf,
                evidence=[],
                extra={"rule_description": (issue.get("issue_text") or "")[:300]},
            )
        )
    return ToolRun(tool="bandit", available=True, succeeded=True, findings=findings)


async def run_external_tools(root: Path, languages: list[str]) -> list[ToolRun]:
    """Run all capable external tools."""
    return [
        await run_ruff(root, languages),
        await run_bandit(root, languages),
    ]


def tool_versions() -> dict[str, str | None]:
    """Record available analyzer versions for reproducibility metadata."""
    out: dict[str, str | None] = {}
    try:
        import subprocess

        for tool in ("ruff", "bandit"):
            try:
                proc = subprocess.run([tool, "--version"], capture_output=True, text=True, timeout=10)
                out[tool] = proc.stdout.splitlines()[0] if proc.stdout else proc.stderr.splitlines()[0]
            except Exception:
                out[tool] = None
    except Exception:
        pass
    return out
