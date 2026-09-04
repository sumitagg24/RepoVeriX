"""Tests for the Tier-1 feature set: PR audit, change risk, evidence graph,
counterexample validation, test generation, attack paths, dependency
reachability, regression detection, deduplication, SARIF export.
"""

import shutil
import subprocess
from pathlib import Path

import pytest

from app.analysis import attackpaths, counterexamples, depreach, testgen
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.parsing import parse_source
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

FIXTURES = Path(__file__).parent / "fixtures" / "repos"
GIT_AVAILABLE = shutil.which("git") is not None


def _parse(root: Path) -> dict:
    parsed = {}
    for full in root.rglob("*"):
        if full.is_file() and full.suffix in (".py", ".js", ".ts"):
            rel = full.relative_to(root).as_posix()
            lang = {".py": "python", ".js": "javascript", ".ts": "typescript"}[full.suffix]
            try:
                parsed[rel] = parse_source(full.read_text(encoding="utf-8", errors="replace"), lang, rel)
            except Exception:
                continue
    return parsed


def _finding(
    db, scan: Scan, external_id: str, file_path: str, line: int, rule: str, severity=Severity.high
) -> Finding:
    finding = Finding(
        scan_id=scan.id,
        external_id=external_id,
        category=FindingCategory.security,
        severity=severity,
        status=FindingStatus.verified,
        confidence=0.9,
        title=f"Finding {external_id}",
        description="test finding",
        file_path=file_path,
        line_start=line,
        line_end=line,
        source=FindingSource.static,
    )
    db.add(finding)
    return finding


async def _seed_scan(db, repo, created, configuration=ScanConfiguration.repoverix):
    scan = Scan(repository_id=repo.id, configuration=configuration, status=ScanStatus.completed)
    scan.created_at = created
    db.add(scan)
    await db.flush()
    return scan


# --------------------------------------------------------------------------- 1+2. PR audit / change risk


@pytest.fixture
def git_repo_with_branch(tmp_path):
    if not GIT_AVAILABLE:
        pytest.skip("git not installed")
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "dev@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Dev"], cwd=repo, check=True)

    def commit(message: str, files: dict[str, str]) -> None:
        for name, content in files.items():
            (repo / name).write_text(content, encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, check=True, capture_output=True)
        subprocess.run(["git", "commit", "-q", "-m", message], cwd=repo, check=True, capture_output=True)

    commit(
        "baseline",
        {
            "app.py": "def helper():\n    return 1\n\n\ndef public():\n    return helper()\n",
            "utils.py": "def util():\n    return 2\n",
        },
    )
    subprocess.run(["git", "checkout", "-q", "-b", "feature"], cwd=repo, check=True)
    commit(
        "feature: change public()",
        {
            "app.py": (
                "def helper():\n    return 1\n\n\ndef public():\n    return helper() * 2\n"
                "\n\ndef new_feature():\n    return 42\n"
            )
        },
    )
    subprocess.run(["git", "checkout", "-q", "main"], cwd=repo, check=True)
    return repo


@pytest.mark.asyncio
async def test_change_audit_refs(client, auth_headers, db_session, test_user, git_repo_with_branch):
    from app.db.models import Repository, SourceType

    repo = Repository(
        owner_id=test_user.id,
        name="git-audit",
        source_type=SourceType.git,
        storage_path=str(git_repo_with_branch),
        status="ingested",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)

    response = await client.post(
        f"/api/v1/repositories/{repo.id}/change-audit",
        json={"base": "main", "head": "feature"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["changed_files"] == ["app.py"]
    assert body["added_lines"] >= 3
    assert 0 <= body["risk_score"] <= 100
    assert body["risk_level"] in ("low", "medium", "high", "critical")
    assert "risk_components" in body
    assert "risk_factors" in body
    assert "risk_formula" in body
    # public() changed -> helper() callers include public() but no outside callers
    assert "directives" in body
    # the audit was persisted
    stored = await db_session.execute(
        __import__("sqlalchemy").select(__import__("app.db.models", fromlist=["ChangeAudit"]).ChangeAudit)
    )
    assert stored.scalar_one_or_none() is not None


@pytest.mark.asyncio
async def test_change_audit_raw_diff(client, auth_headers, db_session, test_user):
    from app.db.models import Repository, SourceType

    repo = Repository(
        owner_id=test_user.id,
        name="diff-audit",
        source_type=SourceType.zip,
        storage_path=str(FIXTURES / "vulnerable_app"),
        status="ingested",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)

    diff = """--- a/app.py
+++ b/app.py
@@ -12,3 +12,4 @@ def search_users(name):
     query = f"SELECT * FROM users WHERE name = '{name}'"
-    cursor.execute(query)
+    cursor.execute(query, (name,))
+    conn.commit()
"""
    response = await client.post(
        f"/api/v1/repositories/{repo.id}/change-audit",
        json={"diff": diff},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "diff"
    assert body["changed_files"] == ["app.py"]
    assert body["risk_score"] >= 0


# --------------------------------------------------------------------------- 3. evidence graph


@pytest.mark.asyncio
async def test_evidence_graph(client, auth_headers, db_session, test_repository):
    scan = await _seed_scan(db_session, test_repository, __import__("datetime").datetime(2026, 1, 1))
    finding = _finding(db_session, scan, "rvx-1", "app.py", 10, "RVX-SQLI-001")
    db_session.add(finding)
    await db_session.flush()
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.source_input,
            file_path="app.py",
            line_start=8,
            description="user input",
            order_index=0,
        )
    )
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.sink,
            file_path="app.py",
            line_start=10,
            description="execute sink",
            order_index=1,
        )
    )
    await db_session.commit()

    response = await client.get(
        f"/api/v1/repositories/{test_repository.id}/evidence-graph", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["finding_count"] == 1
    kinds = {n["kind"] for n in body["nodes"]}
    assert "finding" in kinds and "evidence" in kinds and "file" in kinds
    assert any(e["kind"] == "flows" for e in body["edges"])


# --------------------------------------------------- 4. counterexample / proof-of-absence


class TestCounterexamples:
    def test_sanitizer_on_path_yields_proof(self, tmp_path):
        source = (
            "def search(name):\n"
            "    safe = sanitize(name)\n"
            "    query = f\"SELECT * FROM users WHERE name = '{safe}'\"\n"
            "    cursor.execute(query)\n"
        )
        pf = parse_source(source, "python", "app.py")
        proof = counterexamples.validate_counterexample(pf, [2], [4])
        assert proof is not None
        assert proof["found"] is True
        assert proof["sanitizer"] == "sanitize"
        assert "cannot manifest" in proof["explanation"]

    def test_no_sanitizer_returns_none(self, tmp_path):
        source = (
            "def search(name):\n"
            "    query = f\"SELECT * FROM users WHERE name = '{name}'\"\n"
            "    cursor.execute(query)\n"
        )
        pf = parse_source(source, "python", "app.py")
        assert counterexamples.validate_counterexample(pf, [2], [3]) is None

    @pytest.mark.asyncio
    async def test_endpoint_on_vulnerable_fixture(self, client, auth_headers, db_session, test_user):
        from app.db.models import Repository, SourceType

        repo = Repository(
            owner_id=test_user.id,
            name="vuln-ce",
            source_type=SourceType.zip,
            storage_path=str(FIXTURES / "vulnerable_app"),
            status="ingested",
        )
        db_session.add(repo)
        await db_session.commit()
        from app.analysis.ingest import source_dir

        shutil.copytree(FIXTURES / "vulnerable_app", source_dir(str(repo.id)), dirs_exist_ok=True)
        scan = await _seed_scan(db_session, repo, __import__("datetime").datetime(2026, 1, 1))
        finding = _finding(db_session, scan, "rvx-ce-1", "app.py", 29, "RVX-SQLI-001")
        db_session.add(finding)
        await db_session.flush()
        db_session.add(
            Evidence(
                finding_id=finding.id,
                kind=EvidenceKind.source_input,
                file_path="app.py",
                line_start=27,
                description="name",
                order_index=0,
            )
        )
        db_session.add(
            Evidence(
                finding_id=finding.id,
                kind=EvidenceKind.sink,
                file_path="app.py",
                line_start=29,
                description="execute",
                order_index=1,
            )
        )
        await db_session.commit()

        response = await client.post(
            f"/api/v1/findings/{finding.id}/validate-counterexample", headers=auth_headers
        )
        assert response.status_code == 200
        # the fixture interpolates straight into SQL -> no sanitizer -> no counterexample
        assert response.json()["counterexample"] is None


# --------------------------------------------------------------------------- 5. automated test generation


class TestTestGen:
    @pytest.mark.asyncio
    async def test_template_generation_and_defect_demonstration(
        self, client, auth_headers, db_session, test_user
    ):
        from app.db.models import Repository, SourceType

        repo = Repository(
            owner_id=test_user.id,
            name="vuln-tg",
            source_type=SourceType.zip,
            storage_path=str(FIXTURES / "vulnerable_app"),
            status="ingested",
        )
        db_session.add(repo)
        await db_session.commit()
        from app.analysis.ingest import source_dir

        shutil.copytree(FIXTURES / "vulnerable_app", source_dir(str(repo.id)), dirs_exist_ok=True)
        scan = await _seed_scan(db_session, repo, __import__("datetime").datetime(2026, 1, 1))
        finding = _finding(db_session, scan, "rvx-tg-1", "app.py", 29, "RVX-SQLI-001")
        db_session.add(finding)
        await db_session.flush()
        db_session.add(
            Evidence(
                finding_id=finding.id,
                kind=EvidenceKind.static_analysis,
                description="rule",
                order_index=0,
                extra={"rule": "RVX-SQLI-001"},
            )
        )
        await db_session.commit()

        response = await client.post(f"/api/v1/findings/{finding.id}/generate-test", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["generated_by"] == "repoverix-template"
        assert "test_no_" in body["test_code"]
        assert "assert not matches" in body["test_code"]

        # execute: the contract test must FAIL on the vulnerable code
        src = FIXTURES / "vulnerable_app"
        from app.analysis.verify import LocalRunner

        outcome = await testgen.run_generated_test(
            src, "test_gen_x.py", body["test_code"], runner=LocalRunner()
        )
        assert outcome["passed"] is False  # defect demonstrated

    def test_no_template_returns_none(self, db_session, test_scan):
        finding = _finding(db_session, test_scan, "rvx-other", "app.py", 5, "RVX-UNKNOWN")
        db_session.add(finding)
        # no deterministic template for this rule -> template layer returns None
        assert testgen.template_test(finding) is None


# --------------------------------------------------------------------------- 6. attack paths


def test_attack_paths_vulnerable_app():
    parsed = _parse(FIXTURES / "vulnerable_app")
    graph = KnowledgeGraph(list(parsed.values()))
    result = attackpaths.find_attack_paths(graph, parsed)
    assert result["path_count"] >= 1
    sinks = {p["sink"] for p in result["paths"]}
    assert sinks  # execute / eval / subprocess.call present in the fixture
    assert any(p["length"] >= 2 for p in result["paths"])


# --------------------------------------------------------------------------- 7. dependency reachability


def test_dependency_reachability_vulnerable_app():
    parsed = _parse(FIXTURES / "vulnerable_app")
    result = depreach.analyze_reachability(FIXTURES / "vulnerable_app", parsed)
    names = {r["name"] for r in result["dependencies"]}
    assert "flask" in names
    by_name = {r["name"]: r for r in result["dependencies"]}
    # the fixture imports only stdlib -> declared deps are unreachable (dead weight)
    assert by_name["flask"]["reachable"] is False
    assert "unreachable_count" in result


# --------------------------------------------------------------------------- 8. regression detection


@pytest.mark.asyncio
async def test_regression_between_scans(client, auth_headers, db_session, test_repository):
    from datetime import datetime

    scan_a = await _seed_scan(db_session, test_repository, datetime(2026, 1, 1))
    scan_b = await _seed_scan(db_session, test_repository, datetime(2026, 2, 1))
    scan_c = await _seed_scan(db_session, test_repository, datetime(2026, 3, 1))

    a1 = _finding(db_session, scan_a, "keep-1", "app.py", 10, "RVX-A")
    a2 = _finding(db_session, scan_a, "gone-1", "app.py", 20, "RVX-B")
    b1 = _finding(db_session, scan_b, "keep-1", "app.py", 10, "RVX-A")
    c1 = _finding(db_session, scan_c, "keep-1", "app.py", 10, "RVX-A")
    c2 = _finding(db_session, scan_c, "new-1", "utils.py", 5, "RVX-C")
    c3 = _finding(db_session, scan_c, "gone-1", "app.py", 20, "RVX-B")  # reintroduced
    for f in (a1, a2, b1, c1, c2, c3):
        db_session.add(f)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/repositories/{test_repository.id}/regression", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["total_before"] == 1  # scan_b
    assert body["total_after"] == 3  # scan_c
    assert "keep-1" in body["still_present"]
    assert "new-1" in body["new"]
    assert "gone-1" in body["reintroduced"]
    assert body["new_findings"][0]["title"].startswith("Finding")


# --------------------------------------------------------------------------- 9. deduplication


@pytest.mark.asyncio
async def test_dedup_clusters(client, auth_headers, db_session, test_scan):
    f1 = _finding(db_session, test_scan, "x1", "app.py", 10, "RVX-SQLI-001")
    f2 = _finding(db_session, test_scan, "x2", "app.py", 11, "ruff-S608")
    f3 = _finding(db_session, test_scan, "x3", "other.py", 3, "RVX-EVAL-001")
    for f in (f1, f2, f3):
        db_session.add(f)
    await db_session.commit()

    response = await client.get(f"/api/v1/scans/{test_scan.id}/dedup", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["total_findings"] == 3
    assert body["cluster_count"] == 1
    assert body["clusters"][0]["size"] == 2
    assert body["clusters"][0]["file_path"] == "app.py"


# --------------------------------------------------------------------------- 10. SARIF export


@pytest.mark.asyncio
async def test_sarif_export(client, auth_headers, db_session, test_repository):
    from datetime import datetime

    scan = await _seed_scan(db_session, test_repository, datetime(2026, 1, 1))
    finding = _finding(
        db_session, scan, "rvx-sarif", "app.py", 29, "RVX-SQLI-001", severity=Severity.critical
    )
    db_session.add(finding)
    await db_session.flush()
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.static_analysis,
            description="rule",
            order_index=0,
            extra={"rule": "RVX-SQLI-001"},
        )
    )
    await db_session.commit()

    response = await client.get(f"/api/v1/scans/{scan.id}/sarif", headers=auth_headers)
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/sarif+json")
    document = response.json()
    assert document["version"] == "2.1.0"
    run = document["runs"][0]
    assert run["tool"]["driver"]["name"] == "RepoVeriX"
    assert len(run["results"]) == 1
    result = run["results"][0]
    assert result["level"] == "error"
    assert result["ruleId"] == "RVX-SQLI-001"
    assert result["locations"][0]["physicalLocation"]["region"]["startLine"] == 29
    assert result["properties"]["status"] == "verified"