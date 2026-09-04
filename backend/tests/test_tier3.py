"""Tests for the Tier-3 research features: multi-agent analysis, self-improving
rule/prompt selection, cross-repository learning, historical vulnerability
pattern mining, and predictive defect-risk modeling.
"""

import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path

import pytest

from app.analysis import agents, crosslearn, ruleselection, vulnmining
from app.analysis.parsing import parse_source
from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Repository,
    RepositoryInsight,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    SourceType,
)

FIXTURES = Path(__file__).parent / "fixtures" / "repos"
GIT_AVAILABLE = shutil.which("git") is not None


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


def _finding(db, scan: Scan, external_id: str, file_path: str, line: int, rule: str) -> Finding:
    finding = Finding(
        scan_id=scan.id,
        external_id=external_id,
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title=f"Finding {external_id}",
        description="test",
        file_path=file_path,
        line_start=line,
        line_end=line,
        source=FindingSource.static,
    )
    db.add(finding)
    return finding


async def _seed_repo(db, user, name="t3-repo", path: Path | None = None) -> Repository:
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


async def _seed_scan(db, repo: Repository, created=None) -> Scan:
    scan = Scan(
        repository_id=repo.id, configuration=ScanConfiguration.repoverix, status=ScanStatus.completed
    )
    if created:
        scan.created_at = created
    db.add(scan)
    await db.flush()
    return scan


# --------------------------------------------------------------------------- 18. multi-agent


class TestMultiAgent:
    def test_critical_security_drives_consensus(self):
        findings = [
            {"title": "SQLi", "severity": "critical", "status": "verified", "file_path": "app.py"},
            {"title": "RCE", "severity": "high", "status": "verified", "file_path": "app.py"},
        ]
        health = {
            "average_score": 9.0,
            "files_scored": 4,
            "worst_files": ["app.py", "db.py"],
        }
        git = {
            "available": False,
            "reason": "no_git_history",
            "files": [],
        }
        smells = {"smell_count": 0, "smells": []}
        deps = {"vulnerable_reachable": 0, "unreachable_count": 0}
        result = agents.run_multi_agent(
            findings=findings,
            health=health,
            git=git,
            smells=smells,
            deps=deps,
            flagged_by_quality=["app.py"],
            flagged_by_churn=[],
        )
        assert any(a["agent"] == "security" and a["verdict"] == "critical" for a in result["agents"])
        assert result["overall_risk"] >= 2  # one of five lenses is critical
        assert result["recommendations"]

    def test_converging_evidence_detected(self):
        result = agents.run_multi_agent(
            findings=[{"title": "X", "severity": "medium", "status": "verified", "file_path": "auth.py"}],
            health={"average_score": 5.0, "files_scored": 6, "worst_files": ["auth.py", "x.py"]},
            git={"available": False, "reason": "no_git_history", "files": []},
            smells={"smell_count": 0, "smells": []},
            deps={"vulnerable_reachable": 0, "unreachable_count": 0},
            flagged_by_quality=["auth.py", "x.py"],
            flagged_by_churn=["auth.py"],
        )
        conv = result["converging_evidence"]
        assert any(c["file"] == "auth.py" and len(c["agents"]) >= 2 for c in conv)

    def test_healthy_repo_is_calm(self):
        result = agents.run_multi_agent(
            findings=[],
            health={"average_score": 9.5, "files_scored": 5, "worst_files": []},
            git={"available": False, "reason": "no_git_history", "files": []},
            smells={"smell_count": 0, "smells": []},
            deps={"vulnerable_reachable": 0, "unreachable_count": 0},
            flagged_by_quality=[],
            flagged_by_churn=[],
        )
        assert result["overall_risk"] < 3
        assert all(a["verdict"] == "ok" for a in result["agents"])


# --------------------------------------------------------------------------- 19. self-improvement


class TestRuleSelection:
    def test_rule_stats_aggregate(self):
        scans = [
            {"rule": "RVX-SQLI-001", "status": "verified"},
            {"rule": "RVX-SQLI-001", "status": "rejected"},
            {"rule": "RVX-EXEC-001", "status": "verified"},
        ]
        stats = ruleselection.compute_rule_stats(scans, [])
        assert stats["rule_count"] == 2
        sqli = next(r for r in stats["rules"] if r["rule"] == "RVX-SQLI-001")
        assert sqli["precision"] == 0.5
        assert sqli["false_positive_rate"] == 0.5

    def test_explores_until_enough_samples(self):
        scans = [{"rule": "RVX-X", "status": "verified"}, {"rule": "RVX-X", "status": "rejected"}]
        stats = ruleselection.compute_rule_stats(scans, [])
        rec = ruleselection.recommend_strategy(stats["rules"])
        assert rec["exploring"] is True

    def test_exploits_and_deweights_high_fp_rules(self):
        rows = [
            {
                "rule": "RVX-GOOD",
                "total": 10,
                "verified": 9,
                "rejected": 1,
                "false_positive_rate": 0.1,
                "precision": 0.9,
            },
            {
                "rule": "RVX-NOISY",
                "total": 10,
                "verified": 2,
                "rejected": 6,
                "false_positive_rate": 0.6,
                "precision": 0.2,
            },
        ]
        rec = ruleselection.recommend_strategy(rows)
        assert rec["exploring"] is False
        assert rec["mode"].startswith("exploiting")
        assert rec["rule_profile"]["RVX-GOOD"] > rec["rule_profile"]["RVX-NOISY"]
        assert "RVX-NOISY" in rec["deweighted_rules"]


# --------------------------------------------------------------------------- 20. cross-repository learning


class TestCrossLearn:
    def test_recurring_patterns_and_transfer(self):
        repos = [
            {
                "name": "svc-a",
                "languages": ["python"],
                "findings": [
                    {
                        "rule": "RVX-SQLI-001",
                        "category": "security",
                        "status": "verified",
                        "file_path": "app/auth.py",
                    },
                    {
                        "rule": "RVX-EXEC-001",
                        "category": "security",
                        "status": "verified",
                        "file_path": "app/exec.py",
                    },
                ],
            },
            {
                "name": "svc-b",
                "languages": ["python"],
                "findings": [
                    {
                        "rule": "RVX-SQLI-001",
                        "category": "security",
                        "status": "verified",
                        "file_path": "lib/auth.py",
                    },
                    {
                        "rule": "RVX-SQLI-001",
                        "category": "security",
                        "status": "probable",
                        "file_path": "api/auth.py",
                    },
                ],
            },
            {
                "name": "svc-c",
                "languages": ["python"],
                "findings": [
                    {
                        "rule": "RVX-WEAK-HASH",
                        "category": "security",
                        "status": "rejected",
                        "file_path": "x.py",
                    },
                ],
            },
        ]
        result = crosslearn.learn_patterns(repos)
        assert result["repositories_analyzed"] == 3
        top = result["recurring_patterns"][0]
        assert top["rule"] == "RVX-SQLI-001" and top["occurrences"] == 3
        # risky file role from auth.py in two repos
        assert any("auth" in role["file_role"] for role in result["risky_file_roles"])
        # transfer suggestion points svc-c to check SQLi
        transfer = result["transfer_suggestions"]
        assert any(t["rule"] == "RVX-SQLI-001" and "svc-c" in t["check_also"] for t in transfer)


# --------------------------------------------------------------------------- 21. vuln mining


@pytest.fixture
def git_bug_history(tmp_path):
    if not GIT_AVAILABLE:
        pytest.skip("git not installed")
    repo = tmp_path / "hist"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "dev@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Dev"], cwd=repo, check=True)

    def commit(message: str, author: str, content: str) -> None:
        (repo / "app.py").write_text(content, encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, check=True, capture_output=True)
        env = {
            "GIT_AUTHOR_NAME": author,
            "GIT_COMMITTER_NAME": author,
            "GIT_AUTHOR_EMAIL": f"{author}@x.io",
            "GIT_COMMITTER_EMAIL": f"{author}@x.io",
        }
        subprocess.run(["git", "commit", "-q", "-m", message], cwd=repo, check=True, env=env)

    commit("initial scaffold", "alice", "def run():\n    return 1\n")
    # buggy line introduced at line 2 by bob
    commit(
        "add search feature", "bob", "def run(name):\n    return 'SELECT * FROM t WHERE n=' + name\n"
    )
    # fix commit later
    commit(
        "fix: parameterize query",
        "alice",
        "def run(name):\n    return 'SELECT * FROM t WHERE n=%s', name\n",
    )
    return repo


@pytest.mark.asyncio
async def test_vuln_mining_blames_introducing_commit(git_bug_history):
    findings = [
        {
            "rule": "RVX-SQLI-001",
            "severity": "critical",
            "file_path": "app.py",
            "line_start": 2,
            "line_end": 2,
        }
    ]
    result = await vulnmining.mine_vulnerability_history(git_bug_history, findings)
    assert result["available"] is True
    assert result["findings_analyzed"] == 1
    row = result["findings"][0]
    assert row["status"] == "introduced"
    assert row["author"] == "bob"  # bob introduced the vulnerable line
    assert result["top_introducing_authors"][0]["author"] == "bob"
    assert row["age_days"] >= 0


@pytest.mark.asyncio
async def test_vuln_mining_degrades_without_git(tmp_path):
    (tmp_path / "app.py").write_text("x = 1\n", encoding="utf-8")
    result = await vulnmining.mine_vulnerability_history(tmp_path, [{"file_path": "app.py", "line_start": 1}])
    assert result["available"] is False
    assert result["reason"] == "no_git_history"


# --------------------------------------------------------------------------- 22. risk model


class TestRiskModel:
    def test_ranks_flagged_files_first(self):
        from app.analysis import riskmodel

        # 20 files; 4 genuinely bad ones (low defect-risk score = risky, high churn)
        health = []
        git = []
        flagged = set()
        for i in range(20):
            bad = i % 5 == 0
            path = f"mod{i}.py"
            lenses = {
                "defect_risk": 3.0 if bad else 9.0,
                "maintainability": 9.0,
                "performance": 9.0,
            }
            health.append({"path": path, "lines": 120, "symbols": 12, "lenses": lenses})
            git.append(
                {
                    "path": path,
                    "churn": 8.0 if bad else 0.5,
                    "bug_fixes": 3 if bad else 0,
                    "bus_factor": 1.0 if bad else 2.5,
                }
            )
            if bad:
                flagged.add(path)
        rows, labels, paths = riskmodel.extract_features(health, git, flagged)
        model = riskmodel.train_and_evaluate(rows, labels, paths)
        assert model["positive_files"] == 4
        assert model["evaluation"]["precision_at_k"] >= 0.5
        # the top predicted file should be one of the flagged ones
        assert model["predictions"][0]["actual_finding"] is True
        # coefficients interpretable: defect-risk lens and churn are predictive.
        # defect_risk is a health *score* (10 = healthy), so a strongly negative
        # weight means low scores predict findings.
        coefs = {c["feature"]: c["weight"] for c in model["coefficients"]}
        assert abs(coefs["defect_risk"]) > abs(coefs["performance"])


# --------------------------------------------------------------------------- API


@pytest.mark.asyncio
async def test_multi_agent_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    parsed = _parse_dir(FIXTURES / "vulnerable_app")
    from app.analysis.health import compute_health

    insight = RepositoryInsight(
        repository_id=repo.id, status="ready", health=compute_health(parsed), generated_at=datetime.now(UTC)
    )
    db_session.add(insight)
    await db_session.commit()

    response = await client.get(f"/api/v1/repositories/{repo.id}/multi-agent", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["agent_count"] == 5
    assert "overall_risk" in body
    agents_seen = {a["agent"] for a in body["agents"]}
    assert {"security", "quality", "churn", "architecture", "dependencies"} <= agents_seen


@pytest.mark.asyncio
async def test_self_improvement_and_learning_routes(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user, name="t3-learner")
    scan = await _seed_scan(db_session, repo)
    finding = _finding(db_session, scan, "t3-1", "app.py", 53, "RVX-SQLI-001")
    db_session.add(finding)
    await db_session.flush()
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.sink,
            file_path="app.py",
            line_start=53,
            description="sink",
            order_index=0,
            extra={"rule": "RVX-SQLI-001"},
        )
    )
    await db_session.commit()

    response = await client.get(
        f"/api/v1/repositories/{repo.id}/self-improvement", headers=auth_headers
    )
    assert response.status_code == 200
    body = response.json()
    assert body["stats"]["rule_count"] >= 1
    assert body["recommendation"]["exploring"] is True

    response = await client.get("/api/v1/learning/patterns", headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["repositories_analyzed"] == 1


@pytest.mark.asyncio
async def test_risk_model_route(client, auth_headers, db_session, test_user):
    repo = await _seed_repo(db_session, test_user)
    parsed = _parse_dir(FIXTURES / "vulnerable_app")
    from app.analysis.health import compute_health

    insight = RepositoryInsight(
        repository_id=repo.id, status="ready", health=compute_health(parsed), generated_at=datetime.now(UTC)
    )
    db_session.add(insight)
    scan = await _seed_scan(db_session, repo)
    finding = _finding(db_session, scan, "t3-risk", "app.py", 53, "RVX-SQLI-001")
    db_session.add(finding)
    await db_session.commit()

    response = await client.get(f"/api/v1/repositories/{repo.id}/risk-model", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["available"] is True
    assert body["samples"] >= 2
    assert body["coefficients"]
    assert body["predictions"]
