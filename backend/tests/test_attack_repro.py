"""Spec tests: attack-path risk/entry typing, dependency reachability statuses,
and reproduction-test outcome taxonomy + patched proof-of-fix runs."""

import shutil
from pathlib import Path

import pytest

from app.analysis import attackpaths, depreach, testgen
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.parsing import parse_source
from app.analysis.patchops import make_unified_diff
from app.analysis.testgen import _classify_outcome
from app.analysis.verify import LocalRunner

REPO = Path(__file__).parent / "fixtures" / "repos" / "vulnerable_app"


def _parse(root: Path) -> dict:
    parsed = {}
    for full in root.rglob("*"):
        if full.is_file() and full.suffix in (".py", ".js", ".ts", ".pyi"):
            rel = full.relative_to(root).as_posix()
            lang = {".py": "python", ".js": "javascript", ".ts": "typescript", ".pyi": "python"}[full.suffix]
            try:
                parsed[rel] = parse_source(full.read_text(encoding="utf-8", errors="replace"), lang, rel)
            except Exception:
                continue
    return parsed


# --------------------------------------------------------------------------- attack paths


def test_attack_path_entry_risk_and_categories():
    parsed = _parse(REPO)
    graph = KnowledgeGraph(list(parsed.values()))
    result = attackpaths.find_attack_paths(graph, parsed)
    assert result["verified_count"] >= 1
    for path in result["paths"]:
        assert path["status"] in ("VERIFIED", "PROBABLE")
        assert 0 <= path["risk_score"] <= 100
        assert path["risk_level"] in ("LOW", "MEDIUM", "HIGH", "CRITICAL")
        assert path["sink_category"]
        assert isinstance(path["risk_factors"], dict)
        assert all(
            {"function", "file", "line"} <= set(step) for step in path["steps"]
        )


def test_attack_path_http_chain_verified(tmp_path: Path):
    (tmp_path / "web.py").write_text(
        "from flask import request\n"
        "from helpers import save\n"
        "\n"
        "def handle_upload():\n"
        "    name = request.form['file']\n"
        "    return save(name)\n",
        encoding="utf-8",
    )
    (tmp_path / "helpers.py").write_text(
        "def save(name):\n"
        "    return store(name)\n"
        "\n"
        "\n"
        "def store(name):\n"
        "    with open('uploads/' + name, 'w') as handle:\n"
        "        handle.write(name)\n",
        encoding="utf-8",
    )
    parsed = _parse(tmp_path)
    graph = KnowledgeGraph(list(parsed.values()))
    result = attackpaths.find_attack_paths(graph, parsed)
    http_chains = [
        p
        for p in result["paths"]
        if p["status"] == "VERIFIED" and p["entry_point"]["type"] == "http"
    ]
    assert http_chains, "expected a VERIFIED HTTP-handler chain"
    chain = max(http_chains, key=lambda p: p["length"])
    assert chain["source"] == "web:handle_upload"
    # deterministic score: filesystem sink weight 80 * http reach 1.0 * 3 hops = 80
    assert chain["risk_score"] == 80
    assert chain["risk_level"] == "HIGH"
    assert chain["sink_category"] == "filesystem"


def test_attack_path_calls_unresolved_flagged_probable(tmp_path: Path):
    """An entry point whose data flow leaves the parsed graph is PROBABLE,
    never silently claimed as a verified exploit."""
    (tmp_path / "cli.py").write_text(
        "import sys\n"
        "\n"
        "def main():\n"
        "    arg = sys.argv[1]\n"
        "    return process(arg)\n",
        encoding="utf-8",
    )
    parsed = _parse(tmp_path)
    graph = KnowledgeGraph(list(parsed.values()))
    result = attackpaths.find_attack_paths(graph, parsed)
    probable = [p for p in result["paths"] if p["status"] == "PROBABLE"]
    assert probable, "expected at least one PROBABLE open end"
    assert all("note" in p for p in probable)


# --------------------------------------------------------------------------- dependency reachability


def _py_repo(root: Path, requirements: str, files: dict[str, str]) -> Path:
    (root / "requirements.txt").write_text(requirements, encoding="utf-8")
    for name, content in files.items():
        full = root / name
        full.parent.mkdir(parents=True, exist_ok=True)
        full.write_text(content, encoding="utf-8")
    return root


def test_reachability_statuses_python(tmp_path: Path):
    root = _py_repo(
        tmp_path,
        "flask==2.2.5\nrequests==2.25.0\npydantic==1.10.0\ndemo==1.0.0\n",
        {
            "app.py": "from flask import Flask\nimport requests\napp = Flask(__name__)\n",
            "demo.py": "VERSION = '1.0.0'\n",
        },
    )
    parsed = _parse(root)
    result = depreach.analyze_reachability(root, parsed)
    by_name = {r["name"]: r for r in result["dependencies"]}

    # imported from source -> DIRECTLY_REACHABLE with importer evidence
    assert by_name["flask"]["reachability_status"] == "DIRECTLY_REACHABLE"
    assert by_name["flask"]["importers"] == ["app.py"]
    assert by_name["requests"]["reachability_status"] == "DIRECTLY_REACHABLE"

    # declared but no import site -> UNKNOWN, never NOT_REACHABLE from absence
    assert by_name["pydantic"]["reachability_status"] == "UNKNOWN"
    assert "absence of a hit is not proof" in by_name["pydantic"]["reachability_evidence"][0]

    # positive evidence only: the repo vendors its own module -> NOT_REACHABLE
    assert by_name["demo"]["reachability_status"] == "NOT_REACHABLE"
    assert "shadowed" in by_name["demo"]["reachability_evidence"][0]

    # legacy fields still populated for older consumers
    assert by_name["flask"]["reachable"] is True
    assert by_name["pydantic"]["reachable"] is False
    assert result["status_counts"]["DIRECTLY_REACHABLE"] == 2
    assert result["status_counts"]["UNKNOWN"] == 1
    assert result["status_counts"]["NOT_REACHABLE"] == 1


def test_reachability_vulnerability_details(tmp_path: Path):
    root = _py_repo(
        tmp_path,
        "flask==2.2.5\npydantic==1.10.0\n",
        {"app.py": "from flask import Flask\napp = Flask(__name__)\n"},
    )
    parsed = _parse(root)
    result = depreach.analyze_reachability(
        root,
        parsed,
        vulnerability_counts={"flask": 1},
        vulnerability_details={
            "flask": [{"id": "CVE-2023-1234", "cvss": 9.8, "summary": "path traversal"}]
        },
    )
    by_name = {r["name"]: r for r in result["dependencies"]}
    flask = by_name["flask"]
    assert flask["known_vulnerabilities"] == 1
    assert flask["vulnerabilities"][0]["cvss"] == 9.8
    assert flask["triage"] == "reachable-vulnerable"
    assert "upgrade or remediate" in flask["recommendation"].lower()


def test_reachability_transitive_lockfile(tmp_path: Path):
    root = tmp_path
    (root / "package.json").write_text(
        '{"name":"demo","dependencies":{"express":"^4.18.0"}}\n', encoding="utf-8"
    )
    (root / "package-lock.json").write_text(
        json_lock({"express": "4.18.2", "axios": "0.27.2"}), encoding="utf-8"
    )
    (root / "index.js").write_text(
        "import express from 'express';\n"
        "const app = express();\n",
        encoding="utf-8",
    )
    parsed = _parse(root)
    result = depreach.analyze_reachability(root, parsed)
    by_name = {r["name"]: r for r in result["dependencies"]}

    assert by_name["express"]["reachability_status"] == "DIRECTLY_REACHABLE"
    # axios: transitive-only (lockfile tree, not a top-level manifest dep)
    assert by_name["axios"]["reachability_status"] == "INDIRECTLY_REACHABLE"
    evidence = " ".join(by_name["axios"]["reachability_evidence"]).lower()
    assert "lockfile" in evidence or "dependency tree" in evidence


def json_lock(versions: dict[str, str]) -> str:
    pkgs = {"": {"name": "demo", "dependencies": {}}}
    for name, version in versions.items():
        pkgs[f"node_modules/{name}"] = {"version": version}
    import json

    return json.dumps({"name": "demo", "version": "1.0.0", "lockfileVersion": 3, "packages": pkgs})


def test_classify_outcome_taxonomy():
    outcome, _ = _classify_outcome(True, 0, [])
    assert outcome == "TEST_DOES_NOT_REPRODUCE"
    outcome, _ = _classify_outcome(False, 1, [{"outcome": "failed"}])
    assert outcome == "TEST_REPRODUCES_BUG"
    outcome, _ = _classify_outcome(False, 2, [])
    assert outcome == "TEST_FAILED_TO_EXECUTE"
    outcome, _ = _classify_outcome(False, 2, [{"outcome": "error"}])
    assert outcome == "TEST_FAILED_TO_EXECUTE"


# --------------------------------------------------------------------------- reproduction tests


def _sql_vulnerable_app(root: Path) -> Path:
    src = root / "app.py"
    src.write_text(
        "import sqlite3\n"
        "\n"
        "def search_users(username):\n"
        "    query = f\"SELECT * FROM users WHERE username = {username}\"\n"
        "    return sqlite3.connect('db.sqlite').execute(query)\n",
        encoding="utf-8",
    )
    return root


def _contract_test_code() -> str:
    return (
        "import re\n"
        "import pathlib\n"
        "\n"
        "SOURCE = pathlib.Path(__file__).resolve().parent.parent / 'app.py'\n"
        "PATTERN = re.compile(\n"
        "    r\"(execute|executemany|query)\\s*\\(\\s*f['\\\"]\"\n"
        "    r\"|query\\s*=\\s*f['\\\"]\",\n"
        "    re.IGNORECASE,\n"
        ")\n"
        "\n"
        "\n"
        "def test_no_vulnerable_sql_pattern():\n"
        "    source = SOURCE.read_text(encoding='utf-8', errors='replace')\n"
        "    matches = re.findall(PATTERN, source)\n"
        "    assert not matches, f'Vulnerable pattern still present: {matches}'\n"
    )


async def test_reproduction_taxonomy_reproduces_then_fix(tmp_path: Path):
    root = _sql_vulnerable_app(tmp_path)
    code = _contract_test_code()

    baseline = await testgen.run_generated_test(root, "test_gen_demo.py", code, runner=LocalRunner())
    assert baseline["passed"] is False
    assert baseline["outcome"] == "TEST_REPRODUCES_BUG"
    assert baseline["tests"], "expected parsed per-test results"

    # the same reproduction test against the patched version must PASS
    vulnerable = root.joinpath("app.py").read_text(encoding="utf-8")
    patched = (
        "import sqlite3\n"
        "\n"
        "def search_users(username):\n"
        "    query = 'SELECT * FROM users WHERE username = ?'\n"
        "    return sqlite3.connect('db.sqlite').execute(query, (username,))\n"
    )
    patch_text = make_unified_diff(vulnerable, patched, "app.py")
    fixed = await testgen.run_generated_test(
        root, "test_gen_demo.py", code, runner=LocalRunner(), patch_diff=patch_text
    )
    assert fixed["patch_applied"] is True
    assert fixed["patched_files"] == ["app.py"]
    assert fixed["passed"] is True
    assert fixed["outcome"] == "TEST_DOES_NOT_REPRODUCE"


async def test_reproduction_taxonomy_infra_failure(tmp_path: Path):
    root = _sql_vulnerable_app(tmp_path)
    # syntax error in the generated test -> collection error, not a defect signal
    code = "def test_broken(:\n    pass\n"
    outcome = await testgen.run_generated_test(root, "test_gen_bad.py", code, runner=LocalRunner())
    assert outcome["passed"] is False
    assert outcome["outcome"] == "TEST_FAILED_TO_EXECUTE"


@pytest.mark.skipif(shutil.which("git") is None, reason="git not available")
async def test_reproduction_patch_that_does_not_apply(tmp_path: Path):
    root = _sql_vulnerable_app(tmp_path)
    code = _contract_test_code()
    patch_text = make_unified_diff("completely different old text", "new text", "app.py")
    outcome = await testgen.run_generated_test(
        root, "test_gen_demo.py", code, runner=LocalRunner(), patch_diff=patch_text
    )
    assert outcome["patch_applied"] is False
    assert outcome["outcome"] == "TEST_FAILED_TO_EXECUTE"
