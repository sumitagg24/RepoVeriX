"""Tests for the Tier-2 feature set: natural-language repository query,
architecture smells, health timeline, patch quality, impact analysis,
change explanation, and the finding conversational assistant.
"""

from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.analysis import archsmells, changeexplain, query
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.parsing import parse_source
from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    HealthSnapshot,
    Patch,
    PatchStatus,
    Repository,
    RepositoryInsight,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    SourceType,
    VerificationRun,
    VerificationStatus,
)

FIXTURES = Path(__file__).parent / "fixtures" / "repos"


def _parse_dir(root: Path) -> dict:
    parsed = {}
    for full in root.rglob("*"):
        if full.is_file() and full.suffix in (".py", ".js", ".ts"):
            rel = full.relative_to(root).as_posix()
            lang = {".py": "python", ".js": "javascript", ".ts": "typescript"}[full.suffix]
            try:
                parsed[rel] = parse_source(
                    full.read_text(encoding="utf-8", errors="replace"), lang, rel
                )
            except Exception:
                continue
    return parsed


def _finding(
    db, scan: Scan, external_id: str, file_path: str, line: int, function: str | None = None
) -> Finding:
    finding = Finding(
        scan_id=scan.id,
        external_id=external_id,
        category=FindingCategory.security,
        severity=Severity.critical,
        status=FindingStatus.verified,
        confidence=0.95,
        title=f"Potential SQL Injection ({external_id})",
        description="Query string built by concatenation.",
        impact="An attacker-controlled value reaches a SQL string.",
        recommendation="Parameterize the query.",
        file_path=file_path,
        function_name=function,
        line_start=line,
        line_end=line,
        source=FindingSource.static,
    )
    db.add(finding)
    return finding


async def _seed_scan(db, repo: Repository, created=None) -> Scan:
    scan = Scan(
        repository_id=repo.id, configuration=ScanConfiguration.repoverix, status=ScanStatus.completed
    )
    if created:
        scan.created_at = created
    db.add(scan)
    await db.flush()
    return scan


async def _seed_repo(db, user, name="tier2", path: Path | None = None) -> Repository:
    repo = Repository(
        owner_id=user.id,
        name=name,
        source_type=SourceType.github,
        storage_path=str(path or (FIXTURES / "vulnerable_app")),
        status="ingested",
    )
    db.add(repo)
    await db.commit()
    await db.refresh(repo)
    return repo


# --------------------------------------------------------------------------- 11. NL repository query


class TestNaturalLanguageQuery:
    def _ctx(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_app")
        graph = KnowledgeGraph(list(parsed.values()))
        from app.analysis.health import compute_health

        health = compute_health(parsed)
        git = {"available": False, "reason": "no_git_history"}
        wiki = {"pages": [], "files": 0, "total_parseable": len(parsed)}
        from app.analysis.intel import build_architecture

        architecture = build_architecture(parsed)
        findings = [
            {
                "title": "Potential SQL Injection",
                "severity": "critical",
                "status": "verified",
                "confidence": 0.95,
                "file_path": "app.py",
                "line_start": 53,
            }
        ]
        return graph, health, git, wiki, architecture, findings

    def test_intent_detection(self):
        assert query.detect_intent("where are the hotspots?") == "hotspots"
        assert query.detect_intent("who owns app.py?") == "ownership"
        assert query.detect_intent("how healthy is this repo?") == "health"
        assert query.detect_intent("how many files are there?") == "stats"
        assert query.detect_intent("any vulnerabilities?") == "findings"
        assert query.detect_intent("who calls search_users?") == "callers"

    def test_answer_health_and_findings(self):
        graph, health, git, wiki, architecture, findings = self._ctx()
        r = query.answer_question(
            "how is the code health?",
            graph=graph,
            health=health,
            git=git,
            wiki=wiki,
            architecture=architecture,
            findings=findings,
        )
        assert r["mode"] == "deterministic"
        assert r["intent"] == "health"
        assert f"{health['average_score']}/10" in r["answer"]

        r2 = query.answer_question(
            "what vulnerabilities were found?",
            graph=graph,
            health=health,
            git=git,
            wiki=wiki,
            architecture=architecture,
            findings=findings,
        )
        assert r2["intent"] == "findings"
        assert "SQL Injection" in r2["answer"]

    def test_answer_caller_and_stats(self):
        graph, health, git, wiki, architecture, findings = self._ctx()
        r = query.answer_question(
            "how many files and functions?",
            graph=graph,
            health=health,
            git=git,
            wiki=wiki,
            architecture=architecture,
            findings=findings,
        )
        assert r["intent"] == "stats"
        assert "parseable files" in r["answer"]

    def test_answer_unknown_degrades_gracefully(self):
        graph, health, git, wiki, architecture, findings = self._ctx()
        r = query.answer_question(
            "tell me a joke about this repository?",
            graph=graph,
            health=health,
            git=git,
            wiki=wiki,
            architecture=architecture,
            findings=findings,
        )
        assert r["intent"] == "unknown"
        assert "I couldn't map" in r["answer"]


@pytest.mark.asyncio
async def test_repository_query_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    parsed = _parse_dir(FIXTURES / "vulnerable_app")
    health = __import__("app.analysis.health", fromlist=["compute_health"]).compute_health(parsed)
    insight = RepositoryInsight(
        repository_id=repo.id, status="ready", health=health, generated_at=datetime.now(UTC)
    )
    db_session.add(insight)
    await db_session.commit()

    response = await client.post(
        f"/api/v1/repositories/{repo.id}/query",
        json={"question": "how is the overall code health?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic"
    assert body["intent"] == "health"
    assert body["answer"]


# --------------------------------------------------------------------------- 12. architecture smells


class TestArchitectureSmells:
    def test_cycle_detected(self):
        # top-level modules a.py <-> b.py form a two-node cycle
        parsed = {
            "a.py": parse_source("import b\n\ndef a():\n    return b.b2()\n", "python", "a.py"),
            "b.py": parse_source("import a\n\ndef b2():\n    return a.a()\n", "python", "b.py"),
        }
        result = archsmells.detect_smells(parsed)
        types = {s["smell"] for s in result["smells"]}
        assert "dependency_cycle" in types
        cycle = next(s for s in result["smells"] if s["smell"] == "dependency_cycle")
        assert set(cycle["modules"]) == {"a", "b"}

    def test_hub_module_detected(self):
        files: dict[str, str] = {"lib/core.py": "def serve():\n    pass\n"}
        for i in range(9):
            files[f"mod{i}.py"] = "import lib.core\n\ndef f():\n    return lib.core.serve()\n"
        parsed = {}
        for path, src in files.items():
            parsed[path] = parse_source(src, "python", path)
        result = archsmells.detect_smells(parsed)
        hubs = [s for s in result["smells"] if s["smell"] == "hub_module"]
        assert any(s["modules"][0] == "lib" for s in hubs)
        assert result["smell_count"] >= 1


@pytest.mark.asyncio
async def test_architecture_smells_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    response = await client.get(
        f"/api/v1/repositories/{repo.id}/architecture-smells", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert "smells" in body
    assert body["module_count"] >= 1


# --------------------------------------------------------------------------- 13. health timeline


@pytest.mark.asyncio
async def test_health_timeline_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    old = datetime(2026, 1, 1, tzinfo=UTC)
    recent = datetime(2026, 2, 1, tzinfo=UTC)
    for created, commit, score in ((old, "aaaa111", 4.2), (recent, "bbbb222", 6.8)):
        row = HealthSnapshot(
            repository_id=repo.id,
            commit_sha=commit,
            average_score=score,
            files_scored=5,
            distribution={"1-3": 2, "4-6": 2, "7-8": 1, "9-10": 0},
            worst_files=["app.py"],
        )
        row.created_at = created
        db_session.add(row)
    await db_session.commit()

    response = await client.get(
        f"/api/v1/repositories/{repo.id}/health-timeline", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["count"] == 2
    scores = [p["average_score"] for p in body["points"]]
    assert scores == [4.2, 6.8]  # chronological


# --------------------------------------------------------------------------- 14. patch quality


class TestPatchQuality:
    def test_unverified_patch_scores_by_shape(self):
        from app.analysis.patchquality import score_patch

        patch = Patch(
            diff=(
                "--- a/app.py\n+++ b/app.py\n@@ -10,3 +10,4 @@ def search(name):\n"
                "     query = 'SELECT * FROM users WHERE name = %s'\n"
                "+    cursor.execute(query, (name,))\n+    conn.commit()\n"
            ),
            explanation="Parameterize the query so user input cannot alter SQL.",
            status=PatchStatus.candidate,
        )
        result = score_patch(patch, [])
        assert 0 <= result["score"] <= 100
        assert result["verified"] is False
        criteria = {b["criterion"] for b in result["breakdown"]}
        assert "scope" in criteria and "verification" in criteria

    def test_verified_repair_scores_high(self):
        from app.analysis.patchquality import score_patch

        patch = Patch(
            diff=(
                "--- a/app.py\n+++ b/app.py\n@@ -10,3 +10,4 @@ def search(name):\n"
                "     query = 'SELECT * FROM users WHERE name = %s'\n"
                "+    cursor.execute(query, (name,))\n+    conn.commit()\n"
            ),
            explanation="Parameterized query fixes the injection.",
            status=PatchStatus.verified,
        )
        run = VerificationRun(
            status=VerificationStatus.verified_repair,
            patch_applied=True,
            tests_passed=True,
            static_passed=True,
            finding_still_detected=False,
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        run.created_at = datetime(2026, 1, 1, tzinfo=UTC)
        result = score_patch(patch, [run])
        assert result["verified"] is True
        assert result["score"] >= 70

    def test_failed_verification_scores_low(self):
        from app.analysis.patchquality import score_patch

        bad_diff = "--- a/x.py\n+++ b/x.py\n@@ -1 +1,2 @@\n+    print('debug')\n"
        patch = Patch(diff=bad_diff, status=PatchStatus.failed)
        run = VerificationRun(
            status=VerificationStatus.repair_failed,
            tests_passed=False,
            finding_still_detected=True,
            started_at=datetime(2026, 1, 1, tzinfo=UTC),
        )
        run.created_at = datetime(2026, 1, 1, tzinfo=UTC)
        result = score_patch(patch, [run])
        assert result["verification_status"] == "repair_failed"
        assert result["score"] < 70


@pytest.mark.asyncio
async def test_patch_quality_route(client, auth_headers, db_session, test_user):

    repo = await _seed_repo(db_session, test_user)
    scan = await _seed_scan(db_session, repo)
    finding = _finding(db_session, scan, "t2-patch-q", "app.py", 12)
    db_session.add(finding)
    await db_session.flush()
    patch = Patch(
        finding_id=finding.id,
        diff="--- a/app.py\n+++ b/app.py\n@@ -12,3 +12,4 @@ def x():\n+    # fix\n",
        explanation="WIP",
        generated_by="test",
        status=PatchStatus.candidate,
    )
    db_session.add(patch)
    await db_session.commit()

    response = await client.get(f"/api/v1/patches/{patch.id}/quality", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert "score" in body and "breakdown" in body


# --------------------------------------------------------------------------- 15. impact analysis


@pytest.mark.asyncio
async def test_finding_impact_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    scan = await _seed_scan(db_session, repo)
    finding = _finding(db_session, scan, "t2-impact", "app.py", 53, function="search_users")
    db_session.add(finding)
    await db_session.flush()
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.source_input,
            file_path="app.py",
            line_start=50,
            description="request.args['name'] enters here",
            order_index=0,
        )
    )
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.sink,
            file_path="app.py",
            line_start=53,
            description="cursor.execute(query)",
            order_index=1,
        )
    )
    await db_session.commit()

    response = await client.get(f"/api/v1/findings/{finding.id}/impact", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["finding_id"] == str(finding.id)
    assert len(body["why_it_matters"]) >= 2
    assert body["worst_case"]
    assert body["fix_direction"]
    assert body["severity"] == "critical"
    # evidence chain preserved
    kinds = [e["kind"] for e in body["evidence_chain"]]
    assert kinds == ["source_input", "sink"]


# --------------------------------------------------------------------------- 16. change explanation


class TestChangeExplanation:
    def test_build_explanation_from_audit(self):
        audit = {
            "changed_files": ["app.py", "tests/test_app.py"],
            "added_lines": 12,
            "removed_lines": 3,
            "changed_symbols": [{"name": "app:search_users", "file": "app.py"}],
            "blast_radius": {"caller_files": {"routes.py": 2}, "caller_count": 2},
            "tests_to_run": ["tests/test_app.py"],
            "missing_companion_files": [],
            "untested_changed_files": [],
            "risk_score": 3.1,
            "risk_components": {
                "size": 1.0,
                "blast_radius": 1.2,
                "risky_files": 0.0,
                "missing_tests": 0.0,
                "missing_companions": 0.0,
            },
            "directives": ["may_break", "tests_to_run"],
        }
        result = changeexplain.build_explanation(audit)
        assert result["risk_score"] == 3.1
        assert result["risk_label"] == "moderate-risk"
        assert "2 file(s)" in result["summary"]
        assert any("callers" in b for b in result["bullets"])
        per_file = {f["path"]: f for f in result["per_file"]}
        assert per_file["app.py"]["symbols_changed"] == ["app:search_users"]


@pytest.mark.asyncio
async def test_explain_change_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    diff = """diff --git a/app.py b/app.py
index 1111111..2222222 100644
--- a/app.py
+++ b/app.py
@@ -12,3 +12,4 @@ def search_users(name):
     query = f"SELECT * FROM users WHERE name = '{name}'"
+    log.debug("searching for %s", name)
     cursor.execute(query)
"""
    response = await client.post(
        f"/api/v1/repositories/{repo.id}/explain-change",
        json={"diff": diff},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["summary"]
    assert "risk_label" in body
    assert body["per_file"]


# --------------------------------------------------------------------------- 17. finding chat


class TestFindingChat:
    def _finding(self):
        scan = Scan(
            repository_id=None,
            configuration=ScanConfiguration.repoverix,
            status=ScanStatus.completed,
        )
        scan.repository_id = None  # type: ignore[assignment]
        f = Finding(
            scan=scan,
            external_id="rvx-chat",
            category=FindingCategory.security,
            severity=Severity.critical,
            status=FindingStatus.verified,
            confidence=0.9,
            title="SQL Injection in search_users",
            description="User input reaches a raw SQL string.",
            recommendation="Use parameterized queries.",
            file_path="app.py",
            function_name="search_users",
            line_start=53,
            line_end=53,
            source=FindingSource.static,
        )
        f.evidence = [
            Evidence(kind=EvidenceKind.source_input, description="request input", order_index=0),
            Evidence(kind=EvidenceKind.transformation, description="f-string concat", order_index=1),
            Evidence(kind=EvidenceKind.sink, description="cursor.execute", order_index=2),
        ]
        return f

    def test_what_intent(self):
        from app.analysis import findingchat

        r = findingchat.answer_finding_question("what is this finding?", self._finding())
        assert r["intent"] == "what"
        assert "SQL Injection" in r["answer"]

    def test_confidence_and_evidence(self):
        from app.analysis import findingchat

        r = findingchat.answer_finding_question("how confident is this?", self._finding())
        assert r["intent"] == "confidence"
        assert "90%" in r["answer"]

        r2 = findingchat.answer_finding_question("show me the evidence chain", self._finding())
        assert r2["intent"] == "evidence"
        assert "sink" in r2["answer"]

    def test_fix_and_similar(self):
        from app.analysis import findingchat

        r = findingchat.answer_finding_question("how do I fix it?", self._finding())
        assert r["intent"] == "fix"
        assert "parameterized" in r["answer"].lower()

        r2 = findingchat.answer_finding_question(
            "are there similar findings?", self._finding(), similar=[self._finding()]
        )
        assert r2["intent"] == "similar"
        assert "other scan" in r2["answer"]


@pytest.mark.asyncio
async def test_finding_chat_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    scan = await _seed_scan(db_session, repo)
    finding = _finding(db_session, scan, "t2-chat", "app.py", 12)
    db_session.add(finding)
    await db_session.commit()

    response = await client.post(
        f"/api/v1/findings/{finding.id}/chat",
        json={"question": "what is this finding about?"},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deterministic"
    assert body["intent"] == "what"
    assert body["answer"]
    assert body["sources"]
