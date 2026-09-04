"""Proof-of-Fix record tests: deterministic decision mapping from recorded
verification evidence (never from an LLM's self-assessment)."""

from datetime import UTC, datetime
from types import SimpleNamespace

from app.analysis import prooffix
from app.db.models import VerificationStatus


def _run(**kw) -> SimpleNamespace:
    base = dict(
        id="run-1",
        created_at=datetime.now(UTC),
        status=VerificationStatus.verified_repair,
        patch_applied=True,
        deps_installed=True,
        tests_passed=True,
        static_passed=True,
        finding_still_detected=False,
        started_at=datetime.now(UTC),
        finished_at=datetime.now(UTC),
        logs="[tests] PASSED\n[reanalysis] no longer detected",
        test_results=[],
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _patch(runs, diff_text="--- a/app.py\n+++ b/app.py\n@@ -1 +1 @@\n-old\n+new\n") -> SimpleNamespace:
    return SimpleNamespace(
        id="patch-1",
        status="verified",
        generated_by="repoverix-template",
        diff=diff_text,
        verification_runs=runs,
    )


def test_verified_repair_maps_to_verified_fix():
    run = _run()
    decision = prooffix.run_decision(run)
    assert decision["decision"] == "VERIFIED_FIX"
    assert decision["state"] == "verified"


def test_failed_to_apply_is_rejected():
    run = _run(status=VerificationStatus.repair_failed, patch_applied=False)
    decision = prooffix.run_decision(run)
    assert decision["decision"] == "REJECTED_FIX"
    assert "apply" in decision["reason"].lower()


def test_tests_failed_is_rejected():
    run = _run(status=VerificationStatus.repair_failed, tests_passed=False)
    assert prooffix.run_decision(run)["decision"] == "REJECTED_FIX"


def test_issue_still_detected_is_rejected():
    run = _run(status=VerificationStatus.repair_failed, finding_still_detected=True)
    assert prooffix.run_decision(run)["decision"] == "REJECTED_FIX"


def test_no_runner_evidence_is_unverifiable():
    run = _run(
        status=VerificationStatus.repair_not_verified,
        patch_applied=False,
        tests_passed=None,
        static_passed=None,
        logs="[tests] ERROR: Docker is not available on this host",
    )
    decision = prooffix.run_decision(run)
    assert decision["decision"] == "UNVERIFIABLE"
    assert decision["state"] == "unverifiable"


def test_partial_after_some_checks():
    run = _run(
        status=VerificationStatus.repair_not_verified,
        patch_applied=True,
        static_passed=True,
        tests_passed=None,
        finding_still_detected=None,
        logs="[tests] ERROR: runner timed out",
    )
    decision = prooffix.run_decision(run)
    assert decision["decision"] == "PARTIALLY_VERIFIED"


def test_checks_never_invent_a_pass():
    run = _run(
        status=VerificationStatus.repair_not_verified,
        patch_applied=False,
        tests_passed=None,
        static_passed=None,
        logs="[tests] ERROR: Docker is not available on this host",
    )
    record = prooffix.proof_for_patch(_patch([run]))
    assert record["decision"] == "UNVERIFIABLE"
    by_key = {c["key"]: c for c in record["checks"]}
    # absence of evidence must be None, never True
    assert by_key["tests_passed"]["passed"] is None
    assert by_key["no_critical_regression"]["passed"] is None


def test_record_fields_and_decision():
    record = prooffix.proof_for_patch(_patch([_run()]))
    assert record["decision"] == "VERIFIED_FIX"
    assert record["patch_id"] == "patch-1"
    assert "app.py" in record["changed_files"]
    assert len(record["runs"]) == 1
    passed = {c["key"] for c in record["checks"] if c["passed"] is True}
    assert {"patch_applied", "static_no_new_issues", "tests_passed", "original_finding_gone"} <= passed
    assert record["runs"][0]["status"] == "verified_repair"


def test_pending_patch_is_honest():
    record = prooffix.proof_for_patch(_patch([]))
    assert record["decision"] is None
    assert record["state"] == "pending"
    assert all(c["passed"] is None for c in record["checks"])
