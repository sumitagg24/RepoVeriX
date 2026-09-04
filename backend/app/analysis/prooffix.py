"""Proof-of-Fix record: aggregate what actually happened when a patch was
validated against its finding.

The critical rule of this module: a fix is NEVER marked verified because an
LLM (or the repair generator) said it is correct. The decision is derived
deterministically from recorded execution evidence:

    VERIFIED_FIX         patch applied, static checks clean, tests passed and
                         the original finding is no longer detected.
    REJECTED_FIX         hard evidence against the patch: it failed to apply,
                         broke tests, introduced static issues, or the
                         original finding is still detected.
    PARTIALLY_VERIFIED   validation could not complete, but what ran showed no
                         counter-evidence (e.g. sandbox runner unavailable
                         after some checks passed).
    UNVERIFIABLE         the environment prevented meaningful validation and
                         nothing produced evidence either way.

Every check is stored as ``passed=True/False/None`` where ``None`` means "no
evidence available" — absence of a check is never presented as a pass.
"""

from __future__ import annotations

from app.analysis.patchops import PatchError, diff_stats, parse_patch
from app.db.models import GeneratedTest, Patch, VerificationRun, VerificationStatus

VERDICT_BY_RUN = {
    VerificationStatus.verified_repair: "VERIFIED_FIX",
    VerificationStatus.repair_failed: "REJECTED_FIX",
}

_CHECK_DEFS = [
    ("patch_applied", "Candidate patch applied cleanly"),
    ("static_no_new_issues", "Static analysis found no new issues"),
    ("tests_passed", "Repository tests passed"),
    ("original_finding_gone", "Original finding no longer detected after patch"),
    ("no_critical_regression", "No critical regression detected"),
]


def run_decision(run: VerificationRun | None) -> dict:
    """Map one verification run onto the Proof-of-Fix decision vocabulary."""
    if run is None:
        return {
            "decision": None,
            "state": "pending",
            "reason": "No verification run recorded yet for this patch.",
        }
    status = run.status
    if status == VerificationStatus.verified_repair:
        return {
            "decision": "VERIFIED_FIX",
            "state": "verified",
            "reason": (
                "Patch applied; static checks clean; tests passed; "
                "original finding no longer detected."
            ),
        }
    if status == VerificationStatus.repair_failed:
        if not run.patch_applied:
            return {
                "decision": "REJECTED_FIX",
                "state": "rejected",
                "reason": "The patch failed to apply in the isolated environment.",
            }
        if run.tests_passed is False:
            return {
                "decision": "REJECTED_FIX",
                "state": "rejected",
                "reason": "Repository tests failed with the patch applied.",
            }
        if run.static_passed is False:
            return {
                "decision": "REJECTED_FIX",
                "state": "rejected",
                "reason": "The patch introduced new static-analysis issues.",
            }
        if run.finding_still_detected:
            return {
                "decision": "REJECTED_FIX",
                "state": "rejected",
                "reason": "The original finding is still detected after the patch.",
            }
        return {
            "decision": "REJECTED_FIX",
            "state": "rejected",
            "reason": "Validation failed without a recorded pass (see run logs).",
        }
    # repair_not_verified / pending / running
    logs = (run.logs or "").lower()
    ran_anything = run.patch_applied or run.tests_passed is not None or run.static_passed is not None
    if status == VerificationStatus.repair_not_verified and not ran_anything:
        if "docker" in logs or "runner" in logs or "sandbox" in logs:
            return {
                "decision": "UNVERIFIABLE",
                "state": "unverifiable",
                "reason": (
                    "The environment prevented validation (no runner/sandbox available); "
                    "no evidence either way."
                ),
            }
        return {
            "decision": "UNVERIFIABLE",
            "state": "unverifiable",
            "reason": "Validation did not complete; no recorded evidence either way.",
        }
    return {
        "decision": "PARTIALLY_VERIFIED",
        "state": "partial",
        "reason": "Validation could not complete, but recorded checks showed no counter-evidence.",
    }


def _run_checks(run: VerificationRun, reproduction: dict | None = None) -> list[dict]:
    checks: list[dict] = []
    values = {
        "patch_applied": bool(run.patch_applied) if run.patch_applied is not None else None,
        "static_no_new_issues": run.static_passed,
        "tests_passed": run.tests_passed,
        "original_finding_gone": (
            None if run.finding_still_detected is None else (not run.finding_still_detected)
        ),
        "no_critical_regression": None,  # requires a fresh scan after the patch
    }
    for key, label in _CHECK_DEFS:
        checks.append(
            {
                "key": key,
                "label": label,
                "passed": values[key],
                "detail": _check_detail(key, values[key], run, reproduction),
            }
        )
    return checks


def _check_detail(key: str, passed: bool | None, run: VerificationRun, reproduction: dict | None) -> str:
    if key == "original_finding_gone":
        if passed is True:
            return "Re-analysis on the patched copy no longer detects the finding."
        if passed is False:
            return "Re-analysis still detects the original finding after the patch."
        return "No re-analysis recorded for this run."
    if key == "tests_passed":
        if passed is None:
            return "No test execution recorded (runner unavailable)."
        return "Repository test suite passed inside the isolated sandbox." if passed else \
            "Repository tests failed inside the isolated sandbox."
    if key == "static_no_new_issues":
        if passed is None:
            return "No static comparison recorded."
        return "Static comparison found no new issues." if passed else "Static comparison found new issues."
    if key == "patch_applied":
        return "Patch applied in the isolated copy." if passed else "Patch could not be applied."
    if key == "no_critical_regression":
        return "Requires a fresh scan after the patch; not asserted from this run."
    return ""


def proof_for_patch(patch: Patch, reproduction: dict | None = None) -> dict:
    """Full proof record for a single patch (its best run drives the decision)."""
    runs = sorted(patch.verification_runs, key=lambda r: r.created_at)
    latest = runs[-1] if runs else None
    decision = run_decision(latest)
    checks = _run_checks(latest, reproduction) if latest else [
        {"key": key, "label": label, "passed": None, "detail": "Not run yet."}
        for key, label in _CHECK_DEFS
    ]

    changed_files: list[str] = []
    changed_lines = 0
    try:
        changed_files = sorted({p.old_path for p in parse_patch(patch.diff)})
        added, removed = diff_stats(patch.diff)
        changed_lines = added + removed
    except PatchError:
        pass

    return {
        "patch_id": str(patch.id),
        "patch_status": patch.status.value if hasattr(patch.status, "value") else str(patch.status),
        "generated_by": patch.generated_by,
        "changed_files": changed_files,
        "changed_line_count": changed_lines,
        "decision": decision["decision"],
        "state": decision["state"],
        "decision_reason": decision["reason"],
        "checks": checks,
        "runs": [
            {
                "id": str(r.id),
                "status": r.status.value if hasattr(r.status, "value") else str(r.status),
                "decision": run_decision(r)["decision"],
                "patch_applied": r.patch_applied,
                "deps_installed": r.deps_installed,
                "tests_passed": r.tests_passed,
                "static_passed": r.static_passed,
                "finding_still_detected": r.finding_still_detected,
                "started_at": r.started_at.isoformat() if r.started_at else None,
                "finished_at": r.finished_at.isoformat() if r.finished_at else None,
                "log_excerpt": (r.logs or "")[-2000:],
                "test_count": len(r.test_results),
            }
            for r in runs
        ],
    }


def reproduction_summary(test: GeneratedTest | None) -> dict | None:
    """Latest reproduction-test outcome for the finding (from generated_tests)."""
    if test is None:
        return None
    result = test.result or {}
    return {
        "test_id": str(test.id),
        "generated_by": test.generated_by,
        "outcome": result.get("outcome"),
        "outcome_detail": result.get("outcome_detail"),
        "patch_applied": result.get("patch_applied"),
        "patched_files": result.get("patched_files"),
        "summary": (result.get("summary") or "")[-2000:],
    }


def evidence_before(finding) -> list[dict]:
    """Deterministic snapshot of the finding's evidence chain (pre-patch)."""
    out = []
    for ev in sorted(finding.evidence, key=lambda e: e.order_index or 0):
        out.append(
            {
                "kind": ev.kind.value if hasattr(ev.kind, "value") else str(ev.kind),
                "description": (ev.description or "")[:300],
                "file": ev.file_path,
                "line": ev.line_start,
                "snippet": (ev.snippet or "")[:500] if ev.snippet else None,
            }
        )
    return out
