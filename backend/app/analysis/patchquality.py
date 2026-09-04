"""Patch quality scoring (Tier 2).

A candidate patch gets a deterministic 0-100 quality score before and after
sandbox verification, combining hard verification signals (tests, static
checks, re-detection) with patch-shape signals (scope, minimality, hygiene).
Every point is attributable: the response lists each criterion with its
contribution so reviewers can see *why* a patch scored the way it did.
"""

from __future__ import annotations

import re
from typing import Any

from app.db.models import Patch, VerificationRun

_DEBUG_PRINT_RE = re.compile(r"^\+\s*(print\(|console\.log\()", re.MULTILINE)
_TRAILING_WS_RE = re.compile(r"^\+\S.*[ \t]+$", re.MULTILINE)
_TODO_RE = re.compile(r"^\+\s*#.*\b(TODO|FIXME|HACK)\b", re.MULTILINE)


def _diff_stats(diff: str) -> dict[str, Any]:
    files: set[str] = set()
    added = removed = 0
    for line in diff.splitlines():
        if line.startswith("+++ b/"):
            files.add(line[6:])
        elif line.startswith("+") and not line.startswith("+++"):
            added += 1
        elif line.startswith("-") and not line.startswith("---"):
            removed += 1
    return {"files": sorted(files), "added": added, "removed": removed}


def _looks_like_test(path: str) -> bool:
    return bool(re.search(r"(^|/)(test_|tests?/|.*\.(test|spec)\.)", path, re.IGNORECASE))


def score_patch(patch: Patch, verification_runs: list[VerificationRun]) -> dict[str, Any]:
    """Score one patch. ``verification_runs`` may be empty (not yet verified)."""
    breakdown: list[dict[str, Any]] = []
    total = 50.0  # neutral baseline; signals move it up or down

    def add(criterion: str, points: float, detail: str) -> None:
        nonlocal total
        breakdown.append({"criterion": criterion, "points": round(points, 1), "detail": detail})
        total += points

    # ---- verification signals (the strongest evidence) ---------------------
    ordered_runs = sorted(verification_runs, key=lambda r: r.created_at, reverse=True)
    latest = ordered_runs[0] if ordered_runs else None
    if latest is not None:
        status = latest.status.value
        if status == "verified_repair":
            add("verification", 35, "Sandbox verified the repair: issue no longer detected")
        elif status == "repair_failed":
            add("verification", -25, "Sandbox failed: " + (latest.logs or "")[:140])
        elif status == "repair_not_verified":
            add("verification", -8, "Sandbox could not confirm the fix")
        else:
            add("verification", 0, f"Verification {status}")
        if latest.tests_passed:
            add("tests", 8, "Repository tests passed after applying the patch")
        elif latest.tests_passed is False:
            add("tests", -18, "Tests failed after applying the patch")
        if latest.static_passed:
            add("static", 4, "Static analysis stayed clean after the patch")
        elif latest.static_passed is False:
            add("static", -8, "Static analysis flagged new issues after the patch")
        if latest.finding_still_detected is False:
            add("reanalysis", 8, "Re-analysis confirms the finding disappeared")
        elif latest.finding_still_detected:
            add("reanalysis", -20, "Re-analysis still detects the original issue")
    else:
        add("verification", 0, "Not verified yet — score reflects patch shape only")

    # ---- shape signals -----------------------------------------------------
    stats = _diff_stats(patch.diff or "")
    raw_file = patch.finding.file_path or "" if patch.finding else None
    finding_file = raw_file.replace("\\", "/") if raw_file else None
    touches_finding = False
    if finding_file:
        touches_finding = finding_file in stats["files"] or any(
            f.endswith("/" + finding_file) for f in stats["files"]
        )
    if touches_finding:
        add("scope", 12, "Patch edits the file where the finding lives")
    else:
        add("scope", -6, "Patch does not touch the finding's file")

    if len(stats["files"]) <= 3:
        add("minimality", 6, f"Touches only {len(stats['files'])} file(s)")
    elif len(stats["files"]) > 8:
        add("minimality", -10, f"Large blast radius: {len(stats['files'])} files changed")

    if any(_looks_like_test(f) for f in stats["files"]):
        add("tests_added", 8, "The diff adds or updates test files")
    else:
        add("tests_added", -3, "No test changes in the diff")

    if stats["added"] <= 60:
        add("size", 5, f"Compact change: +{stats['added']}/-{stats['removed']} lines")
    elif stats["added"] > 200:
        add("size", -7, f"Large change: +{stats['added']} added lines — hard to review safely")

    if _DEBUG_PRINT_RE.search(patch.diff or ""):
        add("hygiene", -6, "Adds debug print/console.log statements")
    if _TRAILING_WS_RE.search(patch.diff or ""):
        add("hygiene", -3, "Introduces trailing whitespace")
    if _TODO_RE.search(patch.diff or ""):
        add("hygiene", -3, "Adds TODO/FIXME markers")

    if patch.explanation and len(patch.explanation.strip()) > 20:
        add("documentation", 4, "Patch includes a substantive explanation")

    total = max(0.0, min(100.0, round(total, 1)))
    grade = "excellent" if total >= 85 else "good" if total >= 70 else "fair" if total >= 50 else "poor"
    return {
        "score": total,
        "grade": grade,
        "verified": latest is not None,
        "verification_status": latest.status.value if latest else None,
        "breakdown": breakdown,
        "stats": stats,
    }