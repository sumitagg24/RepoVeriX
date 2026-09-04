"""PR / change auditing: blast radius, missing companions, risk scoring.

Given a ``base...head`` ref pair (or a raw unified diff), this module answers
the reviewer's questions deterministically:

- which files and symbols the change touches
- blast radius: callers of changed symbols and files importing changed files
- missing companion files (historical co-change partners absent from the diff)
- the tests a diff actually exercises
- a 0-10 change-risk score with concrete directives (may_break,
  missing_cochanges, missing_tests, tests_to_run)

Everything is computed from the working copy's git history and the knowledge
graph — no LLM.
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


async def _co_change_map_async(src: Path) -> dict[str, set[str]]:
    """Files changed together in the last N commits (excluding the diff's own)."""
    result = await run_command(
        ["git", "log", "--pretty=format:" + gitintel._LOG_FORMAT, "--name-only", "-200"],
        cwd=src,
        timeout_seconds=60,
        max_output_chars=800_000,
    )
    if not result.ok:
        return {}
    partners: dict[str, set[str]] = {}
    for commit in gitintel._parse_log(result.stdout):
        files = commit["files"]
        assert isinstance(files, list)
        for f in files:
            partners.setdefault(f, set()).update(g for g in files if g != f)
    return partners


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

    # missing companion files from git co-change history
    co_change = await _co_change_map_async(src)
    expected_partners = {p for f in changed_files for p in co_change.get(f, set())}
    missing_companions = sorted(expected_partners - set(changed_files_all))[:20]

    # risk components (0-10)
    size_score = min(3.0, len(changed_files) / 3 + added_lines / 300)
    blast_score = min(3.0, len(blast_callers) / 5 + len(importing_files) / 8)
    riskiness = 0.0
    if health_by_file:
        risky = [f for f in changed_files if health_by_file.get(f, 10) < 6]
        riskiness = min(2.0, len(risky) * 0.6)
    missing_test_score = 0.0
    untested = [
        f
        for f in changed_files
        if not any(t.startswith("tests/") or t.endswith("_test") for t in tests_to_run)
    ]
    if changed_files:
        missing_test_score = min(1.5, len(untested) / max(1, len(changed_files)) * 2)
    companion_score = min(1.0, len(missing_companions) * 0.2)

    risk = round(min(10.0, size_score + blast_score + riskiness + missing_test_score + companion_score), 1)

    directives: list[str] = []
    if blast_callers:
        directives.append("may_break")
    if missing_companions:
        directives.append("missing_cochanges")
    if untested:
        directives.append("missing_tests")
    if tests_to_run:
        directives.append("tests_to_run")

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
        "risk_score": risk,
        "risk_components": {
            "size": round(size_score, 2),
            "blast_radius": round(blast_score, 2),
            "risky_files": round(riskiness, 2),
            "missing_tests": round(missing_test_score, 2),
            "missing_companions": round(companion_score, 2),
        },
        "directives": directives,
    }