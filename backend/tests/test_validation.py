"""Tests for the counterexample-based finding validation engine and its research log.

The validator must oppose the claim deterministically:

- a sanitizer/parameterized sink guards the path  -> REJECTED with the proof
- a complete source->sink chain + strong rule      -> VERIFIED
- evidence present but incomplete                  -> PROBABLE

Research logging must record before/after status so false-positive reduction
(flips to REJECTED) can be measured.
"""

from __future__ import annotations

import shutil
from datetime import datetime
from pathlib import Path

import pytest

from app.analysis import validation
from app.analysis.parsing import parse_source
from app.db.models import EvidenceKind, FindingCategory, FindingSource, FindingStatus, Severity

FIXTURES = Path(__file__).parent / "fixtures" / "repos"


class _F:
    def __init__(self, **kw):
        base = dict(
            external_id="x" * 16,
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.85,
            title="SQL injection",
            description="User input reaches SQL execution without sanitization.",
            impact=None,
            recommendation="Use a parameterized query",
            file_path="app.py",
            function_name="search_users",
            line_start=4,
            line_end=4,
            source=FindingSource.static,
            evidence=[],
        )
        base.update(kw)
        self.__dict__.update(base)


def _ev(kind: str, line: int, extra=None, snippet=None):
    return type(
        "Ev",
        (),
        {
            "kind": EvidenceKind(kind),
            "file_path": "app.py",
            "line_start": line,
            "line_end": line,
            "snippet": snippet,
            "description": f"{kind} node at {line}",
            "order_index": line,
            "extra": extra or {},
        },
    )()


class TestValidationEngine:
    def test_guarded_sink_is_rejected_with_proof(self):
        source = (
            "def search(name):\n"
            "    safe = sanitize(name)\n"
            "    query = f\"SELECT * FROM users WHERE name = '{safe}'\"\n"
            "    cursor.execute(query)\n"
        )
        pf = parse_source(source, "python", "app.py")
        finding = _F(
            function_name="search",
            evidence=[_ev("source_input", 2), _ev("sink", 4, extra={"rule": "RVX-SQLI-001"})]
        )
        result = validation.validate_finding(finding, pf)
        assert result["final_status"] == "rejected"
        assert result["counterexample"] is not None
        assert result["contradicting_evidence"]
        keys = {c["key"] for c in result["checks"]}
        assert "sanitizer_guard" in keys
        guard = next(c for c in result["checks"] if c["key"] == "sanitizer_guard")
        assert guard["passed"] is True
        assert result["confidence"] >= 0.7
        assert "not supported" in result["explanation"]

    def test_parameterized_sink_is_rejected(self):
        source = (
            "def search(name):\n"
            "    conn = sqlite3.connect('db')\n"
            "    return conn.execute('SELECT * FROM users WHERE name = ?', (name,))\n"
        )
        pf = parse_source(source, "python", "app.py")
        finding = _F(
            function_name="search",
            evidence=[_ev("source_input", 2), _ev("sink", 4, extra={"rule": "RVX-SQLI-001"})],
        )
        result = validation.validate_finding(finding, pf)
        assert result["final_status"] == "rejected"
        param = next(c for c in result["checks"] if c["key"] == "parameterized_sink")
        assert param["passed"] is True

    def test_complete_chain_is_verified(self):
        source = (
            "def search(name):\n"
            "    query = f\"SELECT * FROM users WHERE name = '{name}'\"\n"
            "    cursor.execute(query)\n"
        )
        pf = parse_source(source, "python", "app.py")
        finding = _F(
            function_name="search",
            line_start=3,
            evidence=[_ev("source_input", 2), _ev("sink", 3, extra={"rule": "RVX-SQLI-001"})],
        )
        result = validation.validate_finding(finding, pf)
        assert result["final_status"] == "verified"
        assert result["confidence"] >= 0.8
        assert not result["contradicting_evidence"]

    def test_incomplete_chain_is_probable(self):
        source = "def search(name):\n    return name\n"
        pf = parse_source(source, "python", "app.py")
        finding = _F(
            function_name="search",
            status=FindingStatus.probable,
            evidence=[_ev("sink", 2, extra={"rule": "RVX-SQLI-001"})],
        )
        result = validation.validate_finding(finding, pf)
        assert result["final_status"] == "probable"

    def test_checks_battery_is_structured(self):
        source = (
            "def search(name):\n"
            "    query = f\"SELECT * FROM users WHERE name = '{name}'\"\n"
            "    cursor.execute(query)\n"
        )
        pf = parse_source(source, "python", "app.py")
        finding = _F(
            function_name="search",
            evidence=[_ev("source_input", 2), _ev("sink", 3, extra={"rule": "RVX-SQLI-001"})],
        )
        refs = [{"file": "tests/test_app.py", "line": 5}]
        result = validation.validate_finding(finding, pf, test_references=refs)
        keys = [c["key"] for c in result["checks"]]
        for expected in (
            "claim_grounding",
            "sanitizer_guard",
            "parameterized_sink",
            "authorization_guard",
            "exception_handling",
            "test_support",
            "deterministic_rule",
        ):
            assert expected in keys
        assert result["claim"]
        assert result["explanation"]
        assert isinstance(result["confidence"], float)


# --------------------------------------------------------------------------- endpoint + research log


async def _finding(db_session, scan, external_id, file_path, line, rule):
    from app.analysis.evidence import _external_id
    from app.db.models import Evidence
    from app.db.models import Finding as DBFinding

    f = DBFinding(
        scan_id=scan.id,
        external_id=_external_id(f"{rule}|{file_path}|{line}"),
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.85,
        title="SQL injection",
        description="User input reaches SQL execution without sanitization.",
        impact=None,
        recommendation="Use a parameterized query",
        file_path=file_path,
        function_name="search",
        line_start=line,
        line_end=line,
        source=FindingSource.static,
    )
    db_session.add(f)
    await db_session.flush()
    db_session.add_all(
        [
            Evidence(
                finding_id=f.id,
                kind=EvidenceKind.source_input,
                file_path=file_path,
                line_start=line - 1,
                description="name",
                order_index=0,
            ),
            Evidence(
                finding_id=f.id,
                kind=EvidenceKind.sink,
                file_path=file_path,
                line_start=line,
                description="execute",
                order_index=1,
                extra={"rule": rule},
            ),
        ]
    )
    await db_session.flush()
    return f


async def _seed_repo_and_scan(db_session, test_user):
    from app.analysis.ingest import source_dir
    from app.db.models import Repository, Scan, ScanConfiguration, ScanStatus, SourceType

    repo = Repository(
        owner_id=test_user.id,
        name="vuln-val",
        source_type=SourceType.zip,
        storage_path=str(FIXTURES / "vulnerable_app"),
        status="ingested",
    )
    db_session.add(repo)
    await db_session.commit()
    shutil.copytree(FIXTURES / "vulnerable_app", source_dir(str(repo.id)), dirs_exist_ok=True)
    scan = Scan(
        repository_id=repo.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.completed,
        started_at=datetime(2026, 1, 1),
        finished_at=datetime(2026, 1, 1),
    )
    db_session.add(scan)
    await db_session.commit()
    return repo, scan


@pytest.mark.asyncio
async def test_validate_endpoint_logs_research_run(client, auth_headers, db_session, test_user):
    from sqlalchemy import select

    from app.db.models import ValidationRun

    repo, scan = await _seed_repo_and_scan(db_session, test_user)
    finding = await _finding(db_session, scan, "val-1", "app.py", 29, "RVX-SQLI-001")
    await db_session.commit()

    response = await client.post(f"/api/v1/findings/{finding.id}/validate", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["final_status"] in ("verified", "probable", "rejected")
    assert body["validation_run_id"]
    assert len(body["checks"]) >= 6

    # research log row persisted
    row_result = await db_session.execute(select(ValidationRun).where(ValidationRun.finding_id == finding.id))
    run = row_result.scalar_one()
    assert run.status_after == body["final_status"]
    assert run.status_before == "verified"

    # stats endpoint reports candidates and transitions
    stats = await client.get(
        f"/api/v1/learning/validation-stats?repository_id={repo.id}",
        headers=auth_headers,
    )
    assert stats.status_code == 200
    data = stats.json()
    assert data["candidates"] >= 1
    assert data["after"].get(body["final_status"], 0) >= 1
    assert data["transitions"].get(f"verified -> {body['final_status']}", 0) >= 1
