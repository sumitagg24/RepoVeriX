"""Tests for Production Operations Automation Scripts.

Verifies monitoring/alerting, backup PITR verification, incident response triage,
dependency security audit, and release gatekeeper scripts.
"""

import sys
from pathlib import Path

# Add repo root to sys.path so scripts module can be imported
repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from scripts.check_dependency_security import run_dependency_security_check  # noqa: E402
from scripts.incident_response_triage import run_incident_response_triage  # noqa: E402
from scripts.monitoring_alerting import run_monitoring_checks  # noqa: E402
from scripts.prepare_next_release import prepare_next_release  # noqa: E402
from scripts.verify_backup_pitr import run_backup_pitr_simulation  # noqa: E402


def test_monitoring_checks_structure():
    # Pass a dummy URL to test report generation structure
    res = run_monitoring_checks("http://127.0.0.1:9999")
    assert "checks" in res
    assert "liveness" in res["checks"]
    assert "readiness" in res["checks"]


def test_backup_pitr_simulation_passes():
    res = run_backup_pitr_simulation()
    assert res["overall_status"] == "PASS"
    assert res["steps"]["backup_creation"]["passed"] is True
    assert res["steps"]["restore_verification"]["passed"] is True
    assert res["steps"]["integrity_check"]["passed"] is True


def test_incident_response_triage_passes():
    res = run_incident_response_triage()
    assert res["overall_status"] == "PASS"
    assert res["verifications"]["log_redaction"]["passed"] is True
    assert res["verifications"]["session_invalidation"]["passed"] is True


def test_dependency_security_check_passes():
    res = run_dependency_security_check(repo_root)
    assert res["overall_status"] == "PASS"
    assert res["checks"]["lockfile_determinism"]["passed"] is True
    assert res["checks"]["pyproject_pinned"]["passed"] is True


def test_prepare_next_release_gatekeeper():
    res = prepare_next_release("v0.3.1")
    assert "latest_release_tag" in res
    assert "release_gate_status" in res
