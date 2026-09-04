"""SARIF 2.1.0 export tests.

Structural schema validation (no external jsonschema dependency) plus the
spec rules: RepoVeriX status preserved, REJECTED findings never exported as
active results, severity mapped to SARIF levels, fingerprints attached.
"""

import pytest

from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
)
from app.services.sarif import build_sarif


def _finding(
    scan: Scan,
    title: str,
    severity: Severity,
    status: FindingStatus,
    line: int,
    rule: str = "RVX-SQLI-001",
) -> Finding:
    finding = Finding(
        scan=scan,
        external_id=f"ext-{title.lower().replace(' ', '-')}",
        category=FindingCategory.security,
        severity=severity,
        status=status,
        source=FindingSource.hybrid,
        confidence=0.9,
        title=title,
        description=f"{title} description",
        file_path="src/app.py",
        line_start=line,
    )
    finding.evidence = [
        Evidence(
            kind=EvidenceKind.static_analysis,
            description="rule hit",
            order_index=0,
            extra={"rule": rule},
        )
    ]
    return finding


@pytest.fixture
def scan() -> Scan:
    return Scan(
        status=ScanStatus.completed,
        configuration=ScanConfiguration.repoverix,
    )


def _assert_schema(doc: dict) -> None:
    # SARIF 2.1.0 top level
    assert doc["version"] == "2.1.0"
    assert doc["$schema"].startswith("https://docs.oasis-open.org/sarif/")
    runs = doc["runs"]
    assert isinstance(runs, list) and runs
    run = runs[0]
    for key in ("tool", "results", "columnKind", "automationDetails"):
        assert key in run
    assert run["columnKind"] == "utf16CodeUnits"
    driver = run["tool"]["driver"]
    assert driver["name"] == "RepoVeriX"
    assert isinstance(driver["rules"], list)
    for result in run["results"]:
        for key in ("ruleId", "level", "message", "locations", "fingerprints", "properties"):
            assert key in result, key
        loc = result["locations"][0]["physicalLocation"]
        assert "artifactLocation" in loc
        if "region" in loc:
            assert "startLine" in loc["region"]
        assert "repoverixFindingKey/v1" in result["fingerprints"]


def test_sarif_structure_and_schema(scan: Scan) -> None:
    findings = [
        _finding(scan, "SQL injection", Severity.critical, FindingStatus.verified, 10),
        _finding(scan, "Command injection", Severity.high, FindingStatus.probable, 20),
    ]
    doc = build_sarif(findings, scan, None)
    _assert_schema(doc)
    levels = {r["level"] for r in doc["runs"][0]["results"]}
    assert levels == {"error"}  # critical/high -> error per severity map


def test_sarif_mapping_and_fingerprints(scan: Scan) -> None:
    findings = [
        _finding(scan, "SQL injection", Severity.critical, FindingStatus.verified, 10),
        _finding(scan, "Secret leak", Severity.low, FindingStatus.probable, 30, rule="RVX-SECRET-001"),
    ]
    doc = build_sarif(findings, scan, None)
    results = doc["runs"][0]["results"]
    levels = {r["level"] for r in results}
    assert levels == {"error", "note"}  # critical -> error, low -> note
    by_rule = {r["ruleId"]: r for r in results}
    # rule id derived from the finding's evidence rule, not the DB id
    assert "RVX-SQLI-001" in by_rule
    assert by_rule["RVX-SQLI-001"]["properties"]["status"] == "verified"
    assert by_rule["RVX-SQLI-001"]["properties"]["confidence"] == 0.9
    assert by_rule["RVX-SQLI-001"]["locations"][0]["physicalLocation"]["region"]["startLine"] == 10
    secret = next(r for r in results if r["ruleId"] == "RVX-SECRET-001")
    assert secret["properties"]["status"] == "probable"


def test_rejected_findings_not_exported(scan: Scan) -> None:
    findings = [
        _finding(scan, "Verified SQLi", Severity.critical, FindingStatus.verified, 10),
        _finding(scan, "Rejected noise", Severity.high, FindingStatus.rejected, 40),
    ]
    doc = build_sarif(findings, scan, None)
    results = doc["runs"][0]["results"]
    assert len(results) == 1
    assert results[0]["properties"]["status"] == "verified"
    assert not any("Rejected" in r["message"]["text"] for r in results)


def test_sarif_region_and_snippet(scan: Scan) -> None:
    finding = _finding(scan, "XSS", Severity.medium, FindingStatus.verified, 12)
    doc = build_sarif([finding], scan, None)
    region = doc["runs"][0]["results"][0]["locations"][0]["physicalLocation"]["region"]
    assert region["startLine"] == 12
