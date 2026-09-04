"""Tests for the scan report endpoint and rendering."""

from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Patch,
    PatchStatus,
    Severity,
    VerificationRun,
    VerificationStatus,
)
from app.db.models import (
    TestOutcome as DBTestOutcome,
)
from app.db.models import (
    TestResult as DBTestResult,
)
from app.services.reporting import render_markdown


async def _seed_rich_scan(db_session, test_scan):
    """Seed one finding with evidence + patch + verification under test_scan."""
    finding = Finding(
        scan_id=test_scan.id,
        external_id="RVX-DEMO-0001",
        category=FindingCategory.security,
        severity=Severity.critical,
        status=FindingStatus.verified,
        confidence=0.95,
        title="Potential SQL Injection",
        description="User input is interpolated into a SQL query.",
        impact="Database compromise",
        recommendation="Use parameterized queries",
        file_path="app.py",
        function_name="search_users",
        line_start=53,
        line_end=53,
        source=FindingSource.hybrid,
    )
    db_session.add(finding)
    await db_session.flush()

    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.source_input,
            file_path="app.py",
            line_start=50,
            description="User-controlled `name` reaches the query builder",
            order_index=0,
        )
    )
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.sink,
            file_path="app.py",
            line_start=53,
            description="cursor.execute on an f-string query",
            order_index=1,
        )
    )
    diff_lines = [
        "--- a/app.py",
        "+++ b/app.py",
        "@@ -52,2 +52,2 @@",
        "-    query = f\"SELECT * FROM users WHERE name = '{name}'\"",
        "-    cursor.execute(query)",
        '+    query = "SELECT * FROM users WHERE name = ?"',
        "+    cursor.execute(query, (name,))",
    ]
    patch = Patch(
        finding_id=finding.id,
        diff="\n".join(diff_lines) + "\n",
        explanation="Parameterize the query",
        generated_by="repoverix-template",
        status=PatchStatus.verified,
    )
    db_session.add(patch)
    await db_session.flush()

    run = VerificationRun(
        patch_id=patch.id,
        status=VerificationStatus.verified_repair,
        patch_applied=True,
        deps_installed=True,
        tests_passed=True,
        static_passed=True,
        finding_still_detected=False,
    )
    db_session.add(run)
    await db_session.flush()
    db_session.add(
        DBTestResult(
            verification_run_id=run.id,
            test_name="tests/test_app.py::test_search_returns_matching_rows",
            outcome=DBTestOutcome.passed,
        )
    )
    await db_session.commit()
    await db_session.refresh(finding)
    return finding


async def test_report_json(client, db_session, test_user, test_repository, test_scan, auth_headers):
    await _seed_rich_scan(db_session, test_scan)

    response = await client.get(f"/api/v1/scans/{test_scan.id}/report?format=json", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")

    payload = response.json()
    assert payload["repository"]["name"] == "test-repo"
    assert payload["counts"]["total"] == 1
    assert payload["counts"]["by_severity"]["critical"] == 1
    assert payload["counts"]["by_status"]["verified"] == 1

    finding = payload["findings"][0]
    assert finding["external_id"] == "RVX-DEMO-0001"
    assert finding["title"] == "Potential SQL Injection"
    kinds = [e["kind"] for e in finding["evidence"]]
    assert kinds == ["source_input", "sink"]
    assert finding["patches"][0]["status"] == "verified"
    assert finding["patches"][0]["verification_runs"][0]["status"] == "verified_repair"
    assert finding["patches"][0]["verification_runs"][0]["finding_still_detected"] is False


async def test_report_markdown(client, db_session, test_scan, auth_headers):
    await _seed_rich_scan(db_session, test_scan)

    response = await client.get(f"/api/v1/scans/{test_scan.id}/report?format=markdown", headers=auth_headers)
    assert response.status_code == 200
    assert "text/markdown" in response.headers["content-type"]

    md = response.text
    assert md.startswith("# RepoVeriX Audit Report — test-repo")
    assert "Potential SQL Injection" in md
    assert "Verified Repair" not in md  # rendered from run status below
    assert "verified_repair" in md
    assert "```diff" in md
    assert "Findings Summary" in md


async def test_report_rendering_helpers():
    report = {
        "generated_at_utc": "2026-01-01T00:00:00Z",
        "scan": {"status": "completed", "configuration": "repoverix", "error": None},
        "repository": {
            "name": "demo",
            "languages": ["Python"],
            "files": 4,
            "functions": 3,
            "classes": 1,
            "test_files": 1,
            "dependencies": 2,
        },
        "counts": {
            "total": 1,
            "by_severity": {"critical": 1, "high": 0, "medium": 0, "low": 0, "info": 0},
            "by_status": {"verified": 1, "probable": 0, "rejected": 0},
        },
        "findings": [
            {
                "external_id": "F-1",
                "title": "Potential SQL Injection",
                "severity": "critical",
                "status": "verified",
                "confidence": 0.9,
                "category": "security",
                "source": "static",
                "file_path": "app.py",
                "function_name": "search",
                "line_start": 5,
                "line_end": 5,
                "description": "desc",
                "impact": None,
                "recommendation": None,
                "evidence": [
                    {"kind": "sink", "description": "execute", "file_path": "app.py", "line_start": 5}
                ],
                "patches": [
                    {
                        "status": "verified",
                        "generated_by": "repoverix-template",
                        "explanation": None,
                        "created_at": None,
                        "diff": "- old\n+ new",
                        "verification_runs": [],
                    }
                ],
            }
        ],
    }
    md = render_markdown(report)
    assert "## Potential SQL Injection (`F-1`)" in md
    assert "**Total findings: 1**" in md
    assert "- Severity: **critical**  ·  Status: `verified`  ·  Confidence: 0.90" in md


async def test_report_rejects_unknown_format(client, test_scan, auth_headers):
    response = await client.get(f"/api/v1/scans/{test_scan.id}/report?format=xml", headers=auth_headers)
    assert response.status_code == 422
