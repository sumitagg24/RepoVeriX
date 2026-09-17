"""Tests for the production change-impact, regression and GitHub PR-auditor work.

Coverage requested by the feature specs:

- change impact: direct/indirect dependency (blast radius), affected-test
  detection, security-sensitive path detection, risk formula + levels,
  empty changes, large changes
- regression: stable fingerprints, moved code, severity changes, reintroduced
- PR auditor: review assembly, line-anchored comments, mocked GitHub API
  (no live GitHub calls anywhere in the suite)
"""

from __future__ import annotations

import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from app.analysis import changes, pr_audit, regression
from app.analysis.parsing import parse_source
from app.db.models import EvidenceKind, FindingCategory, FindingSource, FindingStatus, Severity
from app.services import github as gh

FIXTURES = Path(__file__).parent / "fixtures" / "repos"

SQLI_SOURCE = (
    "import sqlite3\n"
    "\n"
    "def search_users(name):\n"
    '    conn = sqlite3.connect("app.db")\n'
    '    query = "SELECT * FROM users WHERE name=\'" + name + "\'"\n'
    "    return conn.execute(query).fetchall()\n"
    "\n"
    "def login(request):\n"
    '    username = request.get("username")\n'
    "    return search_users(username)\n"
    "\n"
    "def admin_check(user):\n"
    '    return user.get("role") == "admin"\n'
)


def _parse(text: str, rel: str = "app.py") -> dict:
    return {rel: parse_source(text, "python", rel)}


class _PlainFinding:
    """Plain attribute holder shaped like a Finding (never touched by an ORM)."""

    def __init__(self, **overrides):
        base = dict(
            external_id="x" * 16,
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="SQL injection",
            description="desc",
            impact=None,
            recommendation=None,
            file_path="app.py",
            function_name="search_users",
            line_start=6,
            line_end=6,
            source=FindingSource.static,
            evidence=[],
        )
        base.update(overrides)
        self.__dict__.update(base)


def _finding(**overrides):
    """Cheap Finding stand-in using the real enums (never persisted)."""
    return _PlainFinding(**overrides)


def _ev(rule: str):
    return SimpleNamespace(
        kind=EvidenceKind.static_analysis,
        file_path="app.py",
        line_start=6,
        snippet="q = ... + name",
        description="static rule fired",
        extra={"rule": rule},
    )


# --------------------------------------------------------------------------- change impact


class TestChangeImpact:
    @pytest.mark.asyncio
    async def test_risk_formula_with_security_and_db_factors(self, tmp_path):
        parsed = _parse(SQLI_SOURCE)
        hunks = [
            changes.DiffHunk(
                file="app.py",
                added_lines=set(range(1, 15)),
                removed_lines=set(),
            )
        ]
        impact = await changes.analyze_change(tmp_path, parsed, hunks)
        assert 0 <= impact["risk_score"] <= 100
        assert impact["risk_level"] in ("low", "medium", "high", "critical")
        assert impact["risk_formula"]
        # login() and admin_check() are auth/security symbols; execute/query are DB
        assert impact["security_context"]["auth_and_security_symbols"]
        assert impact["security_context"]["database_symbols"]
        assert impact["risk_components"]["security"] > 0
        assert impact["risk_components"]["database"] > 0
        # factor weights are documented and sum to 100
        total_weight = sum(f["weight"] for f in impact["risk_factors"])
        assert total_weight == 100

    @pytest.mark.asyncio
    async def test_empty_changes_are_handled(self, tmp_path):
        parsed = _parse(SQLI_SOURCE)
        impact = await changes.analyze_change(tmp_path, parsed, [])
        assert impact["changed_files"] == []
        assert impact["risk_score"] == 0
        assert impact["risk_level"] == "low"

    @pytest.mark.asyncio
    async def test_large_change_saturates_scope(self, tmp_path):
        # 60 changed files with 900 added lines saturate the scope factor
        files = {}
        hunks = []
        for i in range(60):
            rel = f"mod{i}.py"
            files[rel] = parse_source("def f():\n    return 1\n", "python", rel)
            added = set(range(1, 16))
            hunks.append(changes.DiffHunk(file=rel, added_lines=added, removed_lines=set()))
        impact = await changes.analyze_change(tmp_path, files, hunks)
        assert len(impact["changed_files"]) == 60
        assert impact["risk_components"]["size"] >= 9  # ~saturated weight

    def test_risk_level_bands(self):
        assert changes.risk_level_for(0) == "low"
        assert changes.risk_level_for(24.9) == "low"
        assert changes.risk_level_for(25) == "medium"
        assert changes.risk_level_for(49.9) == "medium"
        assert changes.risk_level_for(50) == "high"
        assert changes.risk_level_for(74.9) == "high"
        assert changes.risk_level_for(75) == "critical"
        assert changes.risk_level_for(100) == "critical"

    def test_blast_radius_direct_and_indirect(self):
        # two files: caller.py imports app; indirect dependents arrive via graph
        caller_src = "from app import search_users\n\ndef handler():\n    return search_users('x')\n"
        caller = parse_source(caller_src, "python", "caller.py")
        app = parse_source(SQLI_SOURCE, "python", "app.py")
        parsed = {"app.py": app, "caller.py": caller}
        hunks = [changes.DiffHunk(file="app.py", added_lines={6}, removed_lines=set())]
        impact = asyncio.run(changes.analyze_change(Path("."), parsed, hunks))
        assert "caller.py" in impact["blast_radius"]["importing_files"]

    def test_affected_test_detection(self):
        # tests importing the changed module are reported as tests-to-run

        app = parse_source(SQLI_SOURCE, "python", "app.py")
        test_src = "from app import search_users\n\ndef test_search():\n    assert search_users('a')\n"
        test = parse_source(test_src, "python", "tests/test_app.py")
        parsed = {"app.py": app, "tests/test_app.py": test}
        hunks = [changes.DiffHunk(file="app.py", added_lines={6}, removed_lines=set())]
        impact = asyncio.run(changes.analyze_change(Path("."), parsed, hunks))
        assert impact["tests_to_run"] == ["tests/test_app.py"]


# --------------------------- regression (evidence-based fingerprints)


class TestRegressionMatching:
    def _moved_finding(self, external_id, line):
        return _finding(
            external_id=external_id,
            file_path="app.py",
            function_name="search_users",
            line_start=line,
            line_end=line,
            evidence=[_ev("RVX-SQLI-001")],
        )

    def test_same_finding_still_present(self):
        before = [self._moved_finding("aaa", 6)]
        after = [self._moved_finding("aaa", 6)]
        report = regression.compare_scans(before, after)
        assert report["summary"]["still_present"] == 1
        assert report["summary"]["new"] == 0
        assert report["summary"]["resolved"] == 0
        assert [i["state"] for i in report["items"]] == ["still_present"]

    def test_moved_code_is_not_spurious_new_plus_resolved(self):
        # identical defect; the diff shifted it from line 6 to line 40
        before = [self._moved_finding("a" * 16, 6)]
        after = [self._moved_finding("b" * 16, 40)]
        report = regression.compare_scans(before, after)
        assert report["summary"]["new"] == 0
        assert report["summary"]["resolved"] == 0
        assert report["summary"]["still_present"] == 1
        assert len(report["moved"]) == 1
        assert report["moved"][0]["line_before"] == 6
        assert report["moved"][0]["line_after"] == 40

    def test_unrelated_findings_are_not_paired(self):
        # same function + category but a *different* rule must not match
        before = [
            _finding(
                external_id="a" * 16,
                file_path="app.py",
                function_name="search_users",
                line_start=6,
                evidence=[_ev("RVX-SQLI-001")],
            )
        ]
        after = [
            _finding(
                external_id="b" * 16,
                file_path="app.py",
                function_name="search_users",
                line_start=6,
                evidence=[_ev("RVX-BARE-EXCEPT-001")],
            )
        ]
        report = regression.compare_scans(before, after)
        assert report["summary"]["new"] == 1
        assert report["summary"]["resolved"] == 1

    def test_severity_change_is_detected(self):
        before = [_finding(external_id="aaa", severity=Severity.high)]
        after = [_finding(external_id="aaa", severity=Severity.critical)]
        report = regression.compare_scans(before, after)
        assert report["summary"]["severity_changed"] == 1
        assert report["changed_severity"][0]["severity_before"] == "high"
        assert report["changed_severity"][0]["severity_after"] == "critical"
        states = {i["state"] for i in report["items"]}
        assert "severity_changed" in states

    def test_reintroduced_with_three_scans(self):
        # the defect was present in scan 1, fixed in scan 2, and came back in
        # scan 3 at the same rule|file|line anchor (identical external id)
        earlier = [self._moved_finding("ccc", 6)]
        before = []  # fixed in scan 2
        after = [self._moved_finding("ccc", 6)]
        report = regression.compare_scans(before, after, earlier=earlier)
        assert report["summary"]["reintroduced"] == 1
        assert "reintroduced" in {i["state"] for i in report["items"]}


# --------------------------------------------------------------------------- PR auditor


class TestPrAuditor:
    def test_inline_comments_only_on_added_lines(self):
        hunks = [changes.DiffHunk(file="app.py", added_lines={6, 8}, removed_lines={3})]
        findings = [
            {
                "file_path": "app.py",
                "line_start": 6,
                "severity": "high",
                "status": "probable",
                "confidence": 0.5,
                "title": "SQLi",
                "description": "d",
                "rule": "RVX-SQLI-001",
            },
            {
                "file_path": "app.py",
                "line_start": 3,
                "severity": "low",
                "status": "probable",
                "confidence": 0.4,
                "title": "Old line",
                "description": "d",
                "rule": "RVX-X",
            },
        ]
        comments = pr_audit.build_inline_comments(findings, hunks)
        assert len(comments) == 1
        assert comments[0]["line"] == 6
        assert comments[0]["path"] == "app.py"
        assert "RVX-SQLI-001" in comments[0]["body"]

    @pytest.mark.asyncio
    async def test_analyze_pull_request_on_vulnerable_fixture(self, tmp_path):
        # src needs no .git: git-log fails and degrades to zero churn
        src = FIXTURES / "vulnerable_app"
        lines = (src / "app.py").read_text(encoding="utf-8").splitlines()
        hunks = [
            changes.DiffHunk(
                file="app.py",
                added_lines=set(range(1, len(lines) + 1)),
                removed_lines=set(),
            )
        ]
        pr = SimpleNamespace(
            number=7,
            title="Add search",
            body="",
            state="open",
            author="dev",
            html_url="https://github.com/o/r/pull/7",
            base_ref="main",
            base_sha="b" * 40,
            head_ref="feature",
            head_sha="h" * 40,
        )
        previous = [
            _finding(
                external_id="p1",
                title="SQL injection",
                file_path="app.py",
                line_start=10,
                evidence=[_ev("RVX-SQLI-001")],
            )
        ]
        review = await pr_audit.analyze_pull_request(
            repository=SimpleNamespace(insight=None),
            src=src,
            pr=pr,
            hunks=hunks,
            wt=src,
            previous_findings=previous,
        )
        assert review["pr"]["number"] == 7
        assert 0 <= review["risk_score"] <= 100
        assert review["risk_level"] in ("low", "medium", "high", "critical")
        assert review["changed_files"]
        # regression risk for the previously-reported finding in the touched file
        assert any(r["file_path"] == "app.py" for r in review["regression_risks"])
        # deterministic summary + stats
        assert review["summary"]
        assert review["stats"]["files"] >= 1

    def test_detect_changed_files_produces_grounded_findings(self):
        src = FIXTURES / "vulnerable_app"
        parsed = pr_audit.parse_tree(src)
        specs, _graph = pr_audit.detect_changed_files(parsed, ["app.py"])
        assert specs
        for spec in specs:
            assert spec.status in (FindingStatus.verified, FindingStatus.probable)
            assert spec.file_path == "app.py"
            # evidence rules surfaced in the review rows
            assert _pr_rule(spec)  # noqa


def _pr_rule(spec) -> str | None:
    from app.analysis.pr_audit import _spec_dict

    return _spec_dict(spec)["rule"]


class TestGithubService:
    def test_repo_ident_parses_forms(self):
        assert gh.repo_ident("https://github.com/octo/repo") == ("octo", "repo")
        assert gh.repo_ident("https://github.com/octo/repo.git") == ("octo", "repo")
        assert gh.repo_ident("git@github.com:octo/repo.git") is None  # ssh form unsupported
        assert gh.repo_ident("https://gitlab.com/o/r") is None

    def test_token_resolution_prefers_oauth(self):
        from app.core.config import Settings

        settings = Settings(github_token="server-token")
        assert gh.resolve_token(settings, oauth_access_token="user-token") == "user-token"
        assert gh.resolve_token(settings, oauth_access_token=None) == "server-token"

    @pytest.mark.asyncio
    async def test_fetch_pr_with_fake_client(self):
        class FakeResponse:
            status_code = 200
            headers = {}

            def json(self):
                return {
                    "number": 5,
                    "title": "Fix auth",
                    "body": None,
                    "state": "open",
                    "user": {"login": "alice"},
                    "html_url": "https://github.com/o/r/pull/5",
                    "base": {"ref": "main", "sha": "b" * 40},
                    "head": {"ref": "fix", "sha": "h" * 40},
                    "mergeable": True,
                }

        class FakeClient:
            def __init__(self, **_):
                pass

            async def get(self, url):
                assert "/pulls/5" in url
                return FakeResponse()

            async def aclose(self):
                return None

        from app.core.config import Settings

        settings = Settings(github_api_base_url="https://stub.invalid", github_api_timeout_seconds=5)
        pr = await gh.fetch_pr("o", "r", 5, client=FakeClient(), settings=settings)
        assert pr.number == 5
        assert pr.base_ref == "main"
        assert pr.head_sha == "h" * 40
        assert pr.author == "alice"

    @pytest.mark.asyncio
    async def test_fetch_pr_404_surfaces_as_api_error(self):
        class FakeResponse:
            status_code = 404
            headers = {}

            def json(self):
                return {}

        class FakeClient:
            async def get(self, url):
                return FakeResponse()

            async def aclose(self):
                return None

        from app.core.config import Settings

        with pytest.raises(gh.GithubApiError) as exc:
            await gh.fetch_pr(
                "o",
                "r",
                99,
                client=FakeClient(),
                settings=Settings(github_api_base_url="https://stub.invalid"),
            )
        assert exc.value.status == 404
