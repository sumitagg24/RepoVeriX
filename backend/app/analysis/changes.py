"""PR / change auditing: blast radius, missing companions, impact scoring.

Given a ``base...head`` ref pair (or a raw unified diff), this module answers
the reviewer's questions deterministically:

- which files and symbols the change touches
- blast radius: callers of changed symbols and files importing changed files
- missing companion files (historical co-change partners absent from the diff)
- the tests a diff actually exercises
- affected API endpoints, security/auth code and database code
- a 0-100 change-risk score with a documented, evidence-based formula

Everything is computed from the working copy's git history and the knowledge
graph — no LLM.

Risk formula (documented; every factor is deterministic):

    score = scope*10 + blast_radius*20 + api_surface*10 + tests*10
          + companions*5 + security*20 + database*10 + history*15

Each factor is normalised to 0..1 then weighted. ``security`` and ``database``
are derived from the symbol table of the changed files (auth/session/permission
symbols, dangerous sinks, SQL/ORM names) — never from an LLM. ``history`` uses
git churn over the last 200 commits when history exists, else it scores 0 and
reports the reason. Bands: <25 LOW, 25-49 MEDIUM, 50-74 HIGH, >=75 CRITICAL.
"""

from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path

from app.analysis import gitintel
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.models import ParsedFile
from app.analysis.process import run_command

_MAX_CHANGED_FILES = 200
_TEST_PATH_RE = re.compile(r"(^|/)(test_|tests?/|.*\.(test|spec)\.)", re.IGNORECASE)


@dataclass
class DiffHunk:
    file: str
    added_lines: set[int]
    removed_lines: set[int]


def parse_unified_diff(text: str) -> list[DiffHunk]:
    """Parse a unified diff into per-file added/removed line sets (1-based).

    Handles ``--unified=0`` output: hunk headers carry the new/old start
    lines, and each ``+``/``-`` body line increments its own counter.
    """
    hunks: list[DiffHunk] = []
    current: DiffHunk | None = None
    new_line = old_line = 0
    for raw in text.splitlines():
        file_match = re.match(r"^\+\+\+ b/(.+)$", raw)
        if file_match:
            current = DiffHunk(file=file_match.group(1), added_lines=set(), removed_lines=set())
            hunks.append(current)
            continue
        hunk_match = re.match(r"^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@", raw)
        if hunk_match:
            old_line = int(hunk_match.group(1))
            new_line = int(hunk_match.group(2))
            continue
        if current is None:
            continue
        if raw.startswith("+") and not raw.startswith("+++"):
            current.added_lines.add(new_line)
            new_line += 1
        elif raw.startswith("-") and not raw.startswith("---"):
            current.removed_lines.add(old_line)
            old_line += 1
    return hunks


async def git_diff(src: Path, base: str, head: str) -> tuple[list[DiffHunk], str]:
    """Compute ``base...head`` diff hunks from the working copy."""
    result = await run_command(
        ["git", "diff", "--unified=0", f"{base}...{head}"],
        cwd=src,
        timeout_seconds=120,
        max_output_chars=2_000_000,
    )
    if not result.ok:
        raise ValueError((result.stderr or result.stdout)[-400:])
    return parse_unified_diff(result.stdout), result.stdout


async def _file_activity_async(src: Path) -> tuple[dict[str, set[str]], dict[str, int]]:
    """From the last 200 commits: co-change partners and per-file commit counts.

    Returns ``(partners, churn)`` where ``churn[f]`` is how many of the last
    200 commits touched file ``f`` (the ``history`` risk factor input)."""
    result = await run_command(
        ["git", "log", "--pretty=format:" + gitintel._LOG_FORMAT, "--name-only", "-200"],
        cwd=src,
        timeout_seconds=60,
        max_output_chars=800_000,
    )
    if not result.ok:
        return {}, {}
    partners: dict[str, set[str]] = {}
    churn: dict[str, int] = {}
    for commit in gitintel._parse_log(result.stdout):
        files = commit["files"]
        assert isinstance(files, list)
        for f in files:
            partners.setdefault(f, set()).update(g for g in files if g != f)
            churn[f] = churn.get(f, 0) + 1
    return partners, churn


async def _co_change_map_async(src: Path) -> dict[str, set[str]]:
    """Files changed together in the last N commits (excluding the diff's own)."""
    partners, _churn = await _file_activity_async(src)
    return partners


_AUTH_SYMBOL_RE = re.compile(
    r"(auth|login|logout|signin|sign_up|oauth|session|permission|authorize|role|jwt|token|password|2fa|mfa)",
    re.IGNORECASE,
)
_SECURITY_SINK_RE = re.compile(
    r"(\beval\s*\(|\bexec\s*\(|os\.system|subprocess\.(run|call|Popen|check_output)|popen|shell\s*=\s*True|pickle\.load|yaml\.load|marshal\.loads|deserialize|sendmail|set_cookie|csrf)",
    re.IGNORECASE,
)
_DB_SYMBOL_RE = re.compile(
    r"(\bSELECT|\bINSERT\s+INTO|\bUPDATE|\bDELETE\s+FROM|execute\w*\s*\(|executemany|cursor\s*[=(]|sqlite3|sqlalchemy|create_engine|psycopg|\bquery\b|\bfind_one\b|insert_one|update_one|delete_one|\.commit\s*\(|\.rollback\s*\()",
    re.IGNORECASE,
)
_ROUTE_RE = re.compile(
    r"@\w+(\.\w+)*\.(get|post|put|delete|patch|route)\s*\(|\b(app|router|api)\.(get|post|put|delete|patch)\s*\(",
    re.IGNORECASE,
)


def risk_level_for(score: float) -> str:
    """Map a 0-100 impact score to LOW / MEDIUM / HIGH / CRITICAL."""
    if score >= 75:
        return "critical"
    if score >= 50:
        return "high"
    if score >= 25:
        return "medium"
    return "low"


def _changed_source_lines(parsed_files: dict[str, ParsedFile], file_path: str) -> list[str]:
    pf = parsed_files.get(file_path)
    return pf.source.splitlines() if pf is not None else []


def _affected_api_endpoints(parsed_files: dict[str, ParsedFile], changed_files: list[str]) -> list[dict]:
    """Route-registering lines inside changed files (FastAPI/Flask/Express patterns)."""
    out: list[dict] = []
    for file_path in changed_files:
        lines = _changed_source_lines(parsed_files, file_path)
        for i, line in enumerate(lines, start=1):
            m = _ROUTE_RE.search(line)
            if m:
                route = line.strip()[:160]
                out.append({"file": file_path, "line": i, "route": route})
    return out


def _symbols_in_changed(graph: KnowledgeGraph, changed_files: list[str]) -> list:
    hits = []
    for file_path in changed_files:
        for ref in graph.function_symbols(file_path):
            hits.append(ref)
    return hits


def _line_hits(
    parsed_files: dict[str, ParsedFile], changed_files: list[str], regex: re.Pattern[str]
) -> list[dict]:
    """Call/statement text inside changed files matching ``regex`` (per line)."""
    hits: list[dict] = []
    for file_path in changed_files:
        lines = _changed_source_lines(parsed_files, file_path)
        for i, line in enumerate(lines, start=1):
            m = regex.search(line)
            if m:
                hits.append(
                    {
                        "name": line.strip()[:80],
                        "file": file_path,
                        "line_start": i,
                        "line_end": i,
                    }
                )
    return hits


def _security_symbol_hits(
    graph: KnowledgeGraph,
    changed_files: list[str],
    parsed_files: dict[str, ParsedFile],
) -> list[dict]:
    """Auth/session/permission symbols and dangerous sinks in changed files.

    Symbol names cover auth roles/sessions; call text covers dangerous sinks
    (eval/os.system/subprocess/shell=True/pickle.load/...). Deduplicated by
    (file, line) so a login handler that calls eval() counts once.
    """
    hits: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for ref in _symbols_in_changed(graph, changed_files):
        name = ref.qualified_name
        if _AUTH_SYMBOL_RE.search(name) or _SECURITY_SINK_RE.search(name):
            key = (ref.file_path, ref.line_start)
            if key not in seen:
                seen.add(key)
                hits.append(
                    {
                        "name": name,
                        "file": ref.file_path,
                        "line_start": ref.line_start,
                        "line_end": ref.line_end,
                    }
                )
    for hit in _line_hits(parsed_files, changed_files, _SECURITY_SINK_RE):
        key = (hit["file"], hit["line_start"])
        if key not in seen:
            seen.add(key)
            hits.append(hit)
    return hits


def _database_symbol_hits(
    graph: KnowledgeGraph,
    changed_files: list[str],
    parsed_files: dict[str, ParsedFile],
) -> list[dict]:
    """SQL / ORM / database-touching symbols and call text in changed files."""
    hits: list[dict] = []
    seen: set[tuple[str, int]] = set()
    for ref in _symbols_in_changed(graph, changed_files):
        name = ref.qualified_name
        if _DB_SYMBOL_RE.search(name):
            key = (ref.file_path, ref.line_start)
            if key not in seen:
                seen.add(key)
                hits.append(
                    {
                        "name": name,
                        "file": ref.file_path,
                        "line_start": ref.line_start,
                        "line_end": ref.line_end,
                    }
                )
    for hit in _line_hits(parsed_files, changed_files, _DB_SYMBOL_RE):
        key = (hit["file"], hit["line_start"])
        if key not in seen:
            seen.add(key)
            hits.append(hit)
    return hits


def changed_symbols(
    graph: KnowledgeGraph,
    hunk: DiffHunk,
) -> list[dict]:
    """Symbols whose line span intersects the diff's changed lines."""
    touched = hunk.added_lines | hunk.removed_lines
    out: list[dict] = []
    for ref in graph.function_symbols(hunk.file):
        span = range(ref.line_start, ref.line_end + 1)
        if any(line in span for line in touched):
            out.append(
                {
                    "name": ref.qualified_name,
                    "kind": ref.kind,
                    "file": hunk.file,
                    "line_start": ref.line_start,
                    "line_end": ref.line_end,
                }
            )
    return out


def test_files_for(graph: KnowledgeGraph, files: list[str]) -> list[str]:
    """Test files that import any of ``files`` (graph-based, not name guessing)."""
    tests: set[str] = set()
    for file_path in files:
        for importer in graph.files_importing(file_path):
            if _TEST_PATH_RE.search(importer):
                tests.add(importer)
    return sorted(tests)


async def analyze_change(
    src: Path,
    parsed_files: dict[str, ParsedFile],
    hunks: list[DiffHunk],
    *,
    health_by_file: dict[str, float] | None = None,
) -> dict:
    """Full change audit payload (risk, blast radius, directives)."""
    graph = KnowledgeGraph(list(parsed_files.values()))
    changed_files = sorted({h.file for h in hunks if h.file in parsed_files})
    changed_files_all = sorted({h.file for h in hunks})
    added_lines = sum(len(h.added_lines) for h in hunks)

    # changed symbols + blast radius (callers outside the change)
    symbol_hits = [s for h in hunks for s in changed_symbols(graph, h)]
    blast_callers: dict[str, int] = Counter()
    for sym_ref in symbol_hits:
        ref = graph.find_qualified(sym_ref["name"])
        if ref is None:
            continue
        for caller_q in graph.callers_of_ref(ref):
            caller_ref = graph.find_qualified(caller_q)
            if caller_ref is not None and caller_ref.file_path not in changed_files:
                blast_callers[caller_ref.file_path] += 1

    importing_files = sorted(
        {
            importer
            for f in changed_files
            for importer in graph.files_importing(f)
            if importer not in changed_files
        }
    )
    tests_to_run = test_files_for(graph, changed_files)

    # missing companion files + churn from git co-change history
    co_change, churn = await _file_activity_async(src)
    expected_partners = {p for f in changed_files for p in co_change.get(f, set())}
    missing_companions = sorted(expected_partners - set(changed_files_all))[:20]
    churn_files = sum(1 for f in changed_files if churn.get(f, 0) > 0)

    # ---- evidence-grounded impact factors (each normalised 0..1 then weighted) ----
    untested = [
        f
        for f in changed_files
        if not any(t.startswith("tests/") or t.endswith("_test") for t in tests_to_run)
    ]
    if health_by_file:
        unhealthy = [f for f in changed_files if health_by_file.get(f, 10) < 6]
    else:
        unhealthy = []

    affected_apis = _affected_api_endpoints(parsed_files, changed_files)
    security_hits = _security_symbol_hits(graph, changed_files, parsed_files)
    db_hits = _database_symbol_hits(graph, changed_files, parsed_files)

    size_n = min(1.0, len(changed_files) / 20 + added_lines / 800)
    blast_n = min(1.0, sum(blast_callers.values()) / 8 + len(importing_files) / 12)
    api_n = min(1.0, len(affected_apis) / 3)
    gap = (len(untested) / len(changed_files)) if changed_files else 0.0
    tests_n = min(1.0, gap * 1.5)
    companions_n = min(1.0, len(missing_companions) / 5)
    security_n = min(1.0, (len(security_hits) + len(unhealthy)) * 0.8)
    db_n = min(1.0, len(db_hits) / 3)
    history_n = min(1.0, churn_files / 12) if churn_files else 0.0

    factors = [
        ("size", "Changed files + added lines", size_n, 10),
        ("blast_radius", "Callers and importers outside the diff", blast_n, 20),
        ("api_surface", "Affected API endpoints in changed files", api_n, 10),
        ("tests", "Changed code without exercising tests", tests_n, 10),
        ("companions", "Missing historical co-change files", companions_n, 5),
        ("security", "Auth/session/permission and security-sensitive code", security_n, 20),
        ("database", "SQL/ORM/database code touched", db_n, 10),
        ("history", "Git churn of changed files (recent commits)", history_n, 15),
    ]
    risk_score = sum(n * weight for _k, _l, n, weight in factors)
    risk_score = round(min(100.0, risk_score), 1)
    level = risk_level_for(risk_score)

    directives: list[str] = []
    if blast_callers:
        directives.append("may_break")
    if missing_companions:
        directives.append("missing_cochanges")
    if untested:
        directives.append("missing_tests")
    if tests_to_run:
        directives.append("tests_to_run")
    if security_hits:
        directives.append("security_sensitive")
    if affected_apis:
        directives.append("api_surface")

    return {
        "changed_files": changed_files_all,
        "added_lines": added_lines,
        "removed_lines": sum(len(h.removed_lines) for h in hunks),
        "changed_symbols": symbol_hits[:40],
        "blast_radius": {
            "caller_files": dict(blast_callers.most_common(15)),
            "importing_files": importing_files[:15],
            "caller_count": sum(blast_callers.values()),
        },
        "tests_to_run": tests_to_run,
        "missing_companion_files": missing_companions,
        "untested_changed_files": untested,
        "affected_apis": affected_apis[:25],
        "security_context": {
            "auth_and_security_symbols": [s for s in security_hits[:25]],
            "database_symbols": [s for s in db_hits[:25]],
            "unhealthy_changed_files": unhealthy[:15],
        },
        "risk_score": risk_score,
        "risk_level": level,
        "risk_components": {k: round(n * weight, 2) for k, _l, n, weight in factors},
        "risk_factors": [
            {
                "key": k,
                "label": label,
                "weight": weight,
                "value": round(n, 3),
                "contribution": round(n * weight, 2),
            }
            for k, label, n, weight in factors
        ],
        "risk_formula": (
            "0-100 = size(10) + blast_radius(20) + api_surface(10) + tests(10) "
            "+ companions(5) + security(20) + database(10) + history(15); "
            "levels: <25 LOW, 25-49 MEDIUM, 50-74 HIGH, >=75 CRITICAL"
        ),
        "directives": directives,
    }
