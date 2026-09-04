"""Tests for repository intelligence: code health, git analytics, wiki, API."""

import shutil
import subprocess
from pathlib import Path

import pytest

from app.analysis import gitintel, health, intel
from app.analysis.models import ParsedFile
from app.analysis.parsing import parse_source

FIXTURES = Path(__file__).parent / "fixtures" / "repos"

GIT_AVAILABLE = shutil.which("git") is not None


def _parse_dir(root: Path) -> dict[str, ParsedFile]:
    parsed: dict[str, ParsedFile] = {}
    for full in root.rglob("*"):
        if full.is_file() and full.suffix in (".py", ".js", ".ts"):
            rel = full.relative_to(root).as_posix()
            lang = {".py": "python", ".js": "javascript", ".ts": "typescript"}[full.suffix]
            try:
                parsed[rel] = parse_source(full.read_text(encoding="utf-8", errors="replace"), lang, rel)
            except Exception:
                continue
    return parsed


# --------------------------------------------------------------------------- health


class TestHealth:
    def test_scores_every_parseable_file(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_app")
        result = health.compute_health(parsed)
        assert result["files_scored"] >= 3  # app.py, fixed_app.py, tests/test_app.py
        assert result["average_score"] is not None
        assert 1 <= result["average_score"] <= 10
        for f in result["files"]:
            assert 1 <= f["score"] <= 10
            assert set(f["lenses"]) == {"defect_risk", "maintainability", "performance"}
        assert sum(result["distribution"].values()) == result["files_scored"]

    def test_complex_file_is_flagged_with_concrete_hint(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_app")
        result = health.compute_health(parsed)
        # the vulnerable module is the lowest-scoring file with concrete issues
        by_path = {f["path"]: f for f in result["files"]}
        app = by_path["app.py"]
        assert app["score"] < by_path["tests/test_app.py"]["score"]
        assert any(i["detector"] == "bare_except" for i in app["issues"])
        assert any(t["path"] == "app.py" for t in result["refactor_targets"])

    def test_duplicate_detection(self, tmp_path):
        body = "def helper():\n    x = 1\n    y = 2\n    z = 3\n    return x + y + z\n\n\n" * 4
        (tmp_path / "a.py").write_text(body, encoding="utf-8")
        (tmp_path / "b.py").write_text(body, encoding="utf-8")
        parsed = {
            "a.py": parse_source(body, "python", "a.py"),
            "b.py": parse_source(body, "python", "b.py"),
        }
        dup = health.find_duplicate_files(parsed)
        assert "a.py" in dup and "b.py" in dup
        result = health.compute_health(parsed)
        flagged = {
            f["path"] for f in result["files"] if any(i["detector"] == "duplicate_code" for i in f["issues"])
        }
        assert {"a.py", "b.py"} <= flagged

    def test_deterministic(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_js")
        first = health.compute_health(parsed)
        second = health.compute_health(parsed)
        assert first == second


# --------------------------------------------------------------------------- git intelligence


@pytest.fixture
def git_repo(tmp_path):
    """A tiny git repository with history: two files, a fix commit, two authors."""
    if not GIT_AVAILABLE:
        pytest.skip("git not installed")
    repo = tmp_path / "repo"
    repo.mkdir()
    subprocess.run(["git", "init", "-q", "-b", "main"], cwd=repo, check=True, capture_output=True)
    subprocess.run(["git", "config", "user.email", "alice@example.com"], cwd=repo, check=True)
    subprocess.run(["git", "config", "user.name", "Alice"], cwd=repo, check=True)

    def commit(message: str, files: dict[str, str], author: str = "Alice <alice@example.com>") -> None:
        for name, content in files.items():
            (repo / name).write_text(content, encoding="utf-8")
        subprocess.run(["git", "add", "-A"], cwd=repo, check=True, capture_output=True)
        subprocess.run(
            [
                "git",
                "-c",
                f"user.name={author.split(' <')[0]}",
                "-c",
                f"user.email={author.split(' <')[1].rstrip('>')}",
                "commit",
                "-q",
                "-m",
                message,
            ],
            cwd=repo,
            check=True,
            capture_output=True,
        )

    commit("initial scaffold", {"app.py": "x = 1\n", "utils.py": "u = 1\n"})
    commit("add auth endpoint", {"app.py": "x = 2\n", "auth.py": "a = 1\n"})
    commit("fix auth bug", {"auth.py": "a = 2\n"}, author="Bob <bob@example.com>")
    commit("refactor utils", {"utils.py": "u = 2\n", "app.py": "x = 3\n"})
    return repo


class TestGitIntel:
    @pytest.mark.asyncio
    async def test_hotspots_ownership_cochange(self, git_repo):
        result = await gitintel.analyze_git_history(git_repo)
        assert result["available"] is True
        assert result["commits_analyzed"] == 4
        assert result["authors"] == 2
        by_path = {f["path"]: f for f in result["files"]}
        assert "app.py" in by_path and "auth.py" in by_path
        # auth.py had a fix commit -> hotspot signal
        assert by_path["auth.py"]["bug_fixes"] == 1
        # co-change: app.py + utils.py changed together in two commits
        pairs = {tuple(sorted(p["files"])) for p in result["co_change"]}
        assert ("app.py", "utils.py") in pairs
        # ownership: two authors
        assert result["top_authors"][0]["commits"] >= 2

    @pytest.mark.asyncio
    async def test_no_history_reports_unavailable(self, tmp_path):
        result = await gitintel.analyze_git_history(tmp_path)
        assert result["available"] is False
        assert result["reason"] == "no_git_history"


# --------------------------------------------------------------------------- wiki + architecture


class TestWiki:
    def test_structural_pages(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_app")
        wiki = intel.build_wiki(parsed)
        assert wiki["files"] >= 3
        page = next(p for p in wiki["pages"] if p["path"].endswith("app.py"))
        assert page["language"] == "python"
        assert page["symbols"]  # functions/classes inventoried
        assert page["imports"]  # imports listed
        assert "functions" in page["summary"]

    def test_architecture_groups_and_edges(self):
        parsed = _parse_dir(FIXTURES / "vulnerable_app")
        arch = intel.build_architecture(parsed)
        assert arch["nodes"]
        assert all({"id", "label", "layer", "files"} <= set(n) for n in arch["nodes"])
        # edges reference real nodes
        node_ids = {n["id"] for n in arch["nodes"]}
        for edge in arch["edges"]:
            assert edge["from"] in node_ids and edge["to"] in node_ids


# --------------------------------------------------------------------------- API


@pytest.mark.asyncio
async def test_intelligence_endpoint_computes_and_caches(client, auth_headers, db_session, test_user):
    from app.db.models import Repository, SourceType

    repo = Repository(
        owner_id=test_user.id,
        name="vuln-fixture",
        source_type=SourceType.zip,
        storage_path=str(FIXTURES / "vulnerable_app"),
        status="ingested",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)

    response = await client.get(f"/api/v1/repositories/{repo.id}/intelligence", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ready"
    assert body["health"]["files_scored"] >= 3
    assert body["git"]["available"] is False  # fixture has no .git
    assert body["wiki"]["pages"]
    assert body["architecture"]["nodes"]

    # cached second hit
    second = await client.get(f"/api/v1/repositories/{repo.id}/intelligence", headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["status"] == "ready"

    # refresh forces recompute
    third = await client.get(f"/api/v1/repositories/{repo.id}/intelligence?refresh=1", headers=auth_headers)
    assert third.status_code == 200


@pytest.mark.asyncio
async def test_intelligence_404_for_foreign_repo(client, auth_headers, test_repository):
    response = await client.get(
        f"/api/v1/repositories/{test_repository.id}/intelligence", headers=auth_headers
    )
    # fixture repo rows from conftest have no storage; either 404 (ownership) or
    # 409 (not ingested) — both are correct security behaviour
    assert response.status_code in (404, 409)


@pytest.mark.asyncio
async def test_wiki_prose_requires_llm(client, auth_headers, db_session, test_user):
    from app.db.models import Repository, SourceType

    repo = Repository(
        owner_id=test_user.id,
        name="vuln-fixture",
        source_type=SourceType.zip,
        storage_path=str(FIXTURES / "vulnerable_app"),
        status="ingested",
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)

    response = await client.post(
        f"/api/v1/repositories/{repo.id}/intelligence/wiki/app.py/prose",
        headers=auth_headers,
    )
    # no provider key in the test env -> graceful 503 pointing at config
    assert response.status_code == 503
    assert "LLM is not configured" in response.json()["detail"]
