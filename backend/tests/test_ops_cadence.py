"""Tests for the RepoVeriX Operational Cadence Runner.

Verifies that all 7 operational cadence checkpoints execute cleanly and return PASS status.
"""

import sys
from pathlib import Path

# Add repo root to sys.path
repo_root = Path(__file__).resolve().parent.parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

from scripts.ops_cadence import run_ops_cadence  # noqa: E402


def test_ops_cadence_runner_passes():
    report = run_ops_cadence("http://127.0.0.1:9999", "v0.3.1", is_test_mode=True)
    assert report["overall_status"] == "PASS"
    results = report["cadence_results"]
    assert "1_synthetic_monitoring" in results
    assert "2_dependency_security_audit" in results
    assert "3_backup_pitr_restoration" in results
    assert "4_performance_benchmark" in results
    assert "5_incident_response_triage" in results
    assert "6_pre_release_gatekeeper" in results
    assert "7_pre_tag_commit_verification" in results

    assert results["2_dependency_security_audit"]["passed"] is True
    assert results["3_backup_pitr_restoration"]["passed"] is True
    assert results["5_incident_response_triage"]["passed"] is True
    assert results["7_pre_tag_commit_verification"]["passed"] is True
