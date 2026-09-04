"""Tests for RepoVeriX-Bench: metrics math and a real end-to-end experiment run."""

import json
from pathlib import Path

import pytest

from app.benchmark.experiments import run_all, run_experiment
from app.benchmark.metrics import compute_metrics, finding_rule, match_findings
from app.db.models import ScanConfiguration

ROOT = Path(__file__).resolve().parents[2]
FIXTURES = Path(__file__).parent / "fixtures" / "repos"


def _defect(file_path="app.py", function="f", line=10, rule="RVX-SQLI-001"):
    d = {"file_path": file_path, "line_start": line, "rule": rule, "description": "x"}
    if function:
        d["function_name"] = function
    return d


def _finding(title="Potential SQL Injection", file_path="app.py", function="f", line=10):
    return {
        "file_path": file_path,
        "function_name": function,
        "line_start": line,
        "title": title,
        "severity": "high",
        "evidence": [],
    }


# --------------------------------------------------------------------------- metrics


def test_perfect_run():
    findings = [_finding(), _finding(title="Hardcoded Secret Detected", function="g", line=20)]
    defects = [
        _defect(function="f", line=10),
        _defect(function="g", line=20, rule="RVX-SECRET-001"),
    ]
    m = compute_metrics(findings, defects)
    assert m["tp"] == 2 and m["fp"] == 0 and m["fn"] == 0
    assert m["precision"] == 1.0 and m["recall"] == 1.0 and m["f1"] == 1.0
    assert m["false_positive_rate"] == 0.0


def test_extra_finding_is_false_positive():
    findings = [_finding(), _finding(title="Something Else", function="z", line=99)]
    defects = [_defect()]
    m = compute_metrics(findings, defects)
    assert m["tp"] == 1 and m["fp"] == 1 and m["fn"] == 0
    assert m["precision"] == 0.5 and m["recall"] == 1.0
    assert m["f1"] == pytest.approx(0.6667, abs=1e-3)


def test_missed_defect_is_false_negative():
    findings = [_finding(function="f")]
    defects = [_defect(function="f"), _defect(function="g", line=20, rule="RVX-EVAL-001")]
    m = compute_metrics(findings, defects)
    assert m["tp"] == 1 and m["fp"] == 0 and m["fn"] == 1
    assert m["recall"] == 0.5
    assert m["f1"] == pytest.approx(0.6667, abs=1e-3)


def test_no_data_means_none():
    m = compute_metrics([], [])
    assert m["tp"] == 0 and m["fp"] == 0 and m["fn"] == 0
    assert m["precision"] is None and m["recall"] is None and m["f1"] is None


def test_line_tolerance_matching():
    # no function attribution on either side -> location is the only signal
    findings = [_finding(function=None, line=12)]
    defects = [_defect(function=None, line=10)]  # within default tolerance 6
    assert match_findings(findings, defects)[0]
    strict = match_findings(findings, defects, line_tolerance=1)
    assert not strict[0]


def test_function_mismatch_blocks_match():
    findings = [_finding(function="a")]
    defects = [_defect(function="b", line=100)]  # far line + wrong function
    hits, _unmatched = match_findings(findings, defects)
    assert hits == []


def test_rule_language_variants_compare_equal():
    findings = [
        {
            "file_path": "src/server.js",
            "function_name": None,
            "line_start": 18,
            "title": "Potential SQL Injection",
            "evidence": [
                {"kind": "static_analysis", "description": "x", "extra": {"rule": "RVX-SQLI-JS-001"}}
            ],
        }
    ]
    defects = [_defect(file_path="src/server.js", function=None, line=18, rule="RVX-SQLI-JS-001")]
    hits, _unmatched = match_findings(findings, defects)
    assert len(hits) == 1


def test_finding_rule_recovery():
    assert finding_rule(_finding()) == "RVX-SQLI-001"  # title fallback
    with_evidence = {
        "title": "Potential SQL Injection",
        "evidence": [{"kind": "static_analysis", "description": "rule RVX-SQLI-JS-001 fired", "extra": {}}],
    }
    assert finding_rule(with_evidence) == "RVX-SQLI-JS-001"  # description regex
    metadata = {
        "title": "Potential SQL Injection",
        "evidence": [{"kind": "static_analysis", "description": "sink", "extra": {"rule": "RVX-CMDI-001"}}],
    }
    assert finding_rule(metadata) == "RVX-CMDI-001"  # metadata wins


# --------------------------------------------------------------------------- real experiment


async def test_static_only_experiment_on_vulnerable_app(tmp_path):
    db_path = tmp_path / "exp.db"
    outcome = await run_experiment(
        FIXTURES / "vulnerable_app",
        ScanConfiguration.static_only,
        db_path=db_path,
        repo_name="vulnerable_app",
    )
    assert outcome["scan_status"] == "completed"
    findings = outcome["findings"]
    assert len(findings) >= 6
    titles = {f["title"] for f in findings}
    assert "Potential SQL Injection" in titles
    assert "Hardcoded Secret Detected" in titles

    ground_truth = json.loads((ROOT / "bench/ground_truth/vulnerable_app.json").read_text(encoding="utf-8"))
    m = compute_metrics(findings, ground_truth["defects"])
    # every seeded defect in the Python demo is caught by the built-in rules
    assert m["precision"] == 1.0 and m["recall"] == 1.0
    assert m["false_positive_rate"] == 0.0


async def test_run_all_writes_reports(tmp_path):
    out = tmp_path / "reports"
    results = await run_all(
        ROOT / "bench/configs/experiments.json",
        out,
        root=ROOT,
        only_repos=["vulnerable_js"],
        only_configs=["static_only"],
    )
    assert len(results) == 1
    r = results[0]
    assert r["repository"] == "vulnerable_js"
    assert r["metrics"]["ground_truth_defects"] == 4
    assert r["metrics"]["tp"] == 4 and r["metrics"]["fp"] == 0
    artifact = out / "vulnerable_js__static_only.json"
    assert artifact.exists()
    payload = json.loads(artifact.read_text(encoding="utf-8"))
    assert payload["reproducibility"]["timestamp_utc"]
    assert (out / "summary.md").exists()
    summary_text = (out / "summary.md").read_text(encoding="utf-8")
    assert "vulnerable_js" in summary_text
    assert "| 1.0000 | 1.0000 | 1.0000 |" in summary_text
