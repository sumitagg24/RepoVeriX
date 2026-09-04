"""Deterministic per-file code health (RepoVeriX intelligence layer).

Inspired by the code-health layer of codebase-intelligence tools: every file
gets a 1-10 score across three lenses (defect risk, maintainability,
performance) computed from **deterministic** detectors — no LLM, no cloud,
pure Python over tree-sitter parse results and source text. Each detector
emits concrete, actionable hints (\"Extract method: process_order (lines
41-93, 14 branches)\") rather than vague warnings.

The detector weights are deliberately conservative; the score is an ordinal
signal meant to rank files, not an absolute verdict.
"""

from __future__ import annotations

import re
from typing import Any

from app.analysis.models import ParsedFile

# --------------------------------------------------------------------------- detectors

_BRANCH_RE = re.compile(r"\b(if|elif|for|while|except|case|catch|switch|when)\b|\?")
_BOOL_RE = re.compile(r"\b(and|or)\b")
_LONG_LINE_RE = re.compile(r".{121,}")
_TODO_RE = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b")
_BARE_EXCEPT_RE = re.compile(r"except\s*:.*(?:\n|$)|except\s+Exception\s*:.*(?:\n|$)|catch\s*\{[^}]*\}")
_MODULE_DOCSTRING_RE = re.compile(r'^\s*(?:"""([\s\S]*?)"""|\'\'\'([\s\S]*?)\'\'\')', re.MULTILINE)
_JS_DOC_BLOCK_RE = re.compile(r"^\s*/\*\*([\s\S]*?)\*/", re.MULTILINE)

DETECTOR_NAMES = (
    "cyclomatic_complexity",
    "long_function",
    "deep_nesting",
    "god_class",
    "large_file",
    "high_import_coupling",
    "todo_density",
    "low_comment_ratio",
    "duplicate_code",
    "bare_except",
    "untested_module",
    "long_lines",
)

# detector -> (lens, severity weight) ; weight is the score penalty per hit
_WEIGHTS: dict[str, tuple[str, float]] = {
    "cyclomatic_complexity": ("defect_risk", 0.9),
    "bare_except": ("defect_risk", 1.1),
    "untested_module": ("defect_risk", 0.5),
    "long_function": ("maintainability", 0.8),
    "deep_nesting": ("maintainability", 0.6),
    "god_class": ("maintainability", 0.9),
    "large_file": ("maintainability", 0.7),
    "high_import_coupling": ("maintainability", 0.6),
    "todo_density": ("maintainability", 0.5),
    "low_comment_ratio": ("maintainability", 0.4),
    "duplicate_code": ("maintainability", 0.8),
    "long_lines": ("maintainability", 0.4),
}


# --------------------------------------------------------------------------- helpers


def _lines(source: str) -> list[str]:
    return source.splitlines()


def _comment_ratio(source: str, language: str) -> float:
    if not source.strip():
        return 0.0
    if language == "python":
        comment = re.findall(r"^\s*#.*$", source, re.MULTILINE)
        docstrings = len(re.findall(r'"""[\s\S]*?"""|\'\'\'[\s\S]*?\'\'\'', source))
    else:
        comment = re.findall(r"^\s*//.*$", source, re.MULTILINE)
        docstrings = len(re.findall(r"/\*[\s\S]*?\*/", source))
    return (len(comment) + docstrings * 3) / len(_lines(source))


def _nesting_depth(lines: list[str], language: str) -> int:
    """Max structural nesting: indentation for Python, brace depth otherwise."""
    depth = 0
    max_depth = 0
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if language == "python":
            indent = len(line) - len(line.lstrip(" "))
            max_depth = max(max_depth, indent // 4)
        else:
            depth += stripped.count("{") - stripped.count("}")
            depth = max(0, depth)
            max_depth = max(max_depth, depth)
    return max_depth


def _module_docstring(source: str, language: str) -> str:
    if language == "python":
        match = _MODULE_DOCSTRING_RE.match(source)
        if match:
            return (match.group(1) or match.group(2) or "").strip()[:400]
    else:
        match = _JS_DOC_BLOCK_RE.match(source)
        if match:
            return match.group(1).strip()[:400]
    return ""


# --------------------------------------------------------------------------- clone detection

_CLONE_MIN_LINES = 8


def _normalized_signature(source: str) -> tuple[str, ...]:
    """Normalize a file into a signature tuple (strip comments/whitespace)."""
    sig: list[str] = []
    for line in source.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith(("#", "//", "*", "/*")):
            continue
        sig.append(re.sub(r"\s+", " ", stripped))
    return tuple(sig)


def find_duplicate_files(files: dict[str, ParsedFile]) -> dict[str, list[str]]:
    """Group files whose normalized bodies share a long identical run.

    Returns a map of representative file -> sibling files (pairwise matches,
    deduplicated), used by the duplicate-code detector.
    """
    buckets: dict[tuple[str, ...], list[str]] = {}
    for path, pf in files.items():
        sig = _normalized_signature(pf.source)
        if len(sig) < _CLONE_MIN_LINES:
            continue
        buckets.setdefault(sig, []).append(path)

    duplicates: dict[str, list[str]] = {}
    for _, paths in buckets.items():
        if len(paths) < 2:
            continue
        for path in paths:
            duplicates.setdefault(path, []).extend(p for p in paths if p != path)
    return duplicates


# --------------------------------------------------------------------------- per-file scoring


def _test_counterpart(path: str) -> str | None:
    """Best-effort test-file name for ``path`` (mirror of discovery's regex)."""
    name = path.rsplit("/", 1)[-1]
    stem = name.rsplit(".", 1)[0] if "." in name else name
    ext = name.rsplit(".", 1)[-1] if "." in name else ""
    candidates = [f"test_{stem}.{ext}", f"{stem}_test.{ext}", f"{stem}.test.{ext}", f"{stem}.spec.{ext}"]
    for candidate in candidates:
        if candidate != name:
            yield candidate


def _score_file(
    path: str,
    pf: ParsedFile | None,
    source: str,
    *,
    duplicate_of: list[str] | None = None,
    test_files: set[str],
) -> dict[str, Any]:
    language = pf.language if pf else "unknown"
    lines = _lines(source)
    line_count = len(lines)
    issues: list[dict[str, str]] = []

    def add(detector: str, title: str, detail: str) -> None:
        lens, _ = _WEIGHTS[detector]
        issues.append({"lens": lens, "detector": detector, "title": title, "detail": detail[:300]})

    # --- defect risk ---
    if pf:
        for sym in pf.symbols:
            if sym.kind not in ("function", "method"):
                continue
            body = lines[sym.line_start - 1 : sym.line_end]
            branches = len(_BRANCH_RE.findall("\n".join(body)))
            branches += len(_BOOL_RE.findall("\n".join(body)))
            if branches >= 12:
                add(
                    "cyclomatic_complexity",
                    "High cyclomatic complexity",
                    f"{sym.qualified_name} (lines {sym.line_start}-{sym.line_end}) "
                    f"has ~{branches} decision points",
                )
    if _BARE_EXCEPT_RE.search(source):
        add(
            "bare_except",
            "Bare or silent exception handling",
            "except without a named error type, or a handler that only passes",
        )

    test_basenames = {t.rsplit("/", 1)[-1] for t in test_files}
    if pf and any(sym.kind in ("function", "method") for sym in pf.symbols):
        has_test = any(c in test_basenames for c in _test_counterpart(path)) or any(
            path.startswith(d) for d in ("tests/", "test/")
        )
        if not has_test and not path.startswith(("tests/", "test/")):
            add(
                "untested_module",
                "No matching test file",
                f"no {path.rsplit('/', 1)[-1]} counterpart under tests/",
            )

    # --- maintainability ---
    if pf:
        for sym in pf.symbols:
            if sym.kind not in ("function", "method"):
                continue
            span = sym.line_end - sym.line_start + 1
            if span > 60:
                add(
                    "long_function",
                    "Long function",
                    f"extract method: {sym.name} spans {span} lines (lines {sym.line_start}-{sym.line_end})",
                )
        if language == "python":
            for cls in [s for s in pf.symbols if s.kind == "class"]:
                methods = [s for s in pf.symbols if s.kind == "method" and s.extra.get("class") == cls.name]
                span = cls.line_end - cls.line_start + 1
                if len(methods) >= 10 or span > 250:
                    add(
                        "god_class",
                        "God class",
                        f"{cls.name} has {len(methods)} methods over {span} lines — split responsibilities",
                    )
        max_nest = _nesting_depth(lines, language)
        if max_nest >= 6:
            add("deep_nesting", "Deeply nested logic", f"nesting depth reaches ~{max_nest} levels")
    if line_count > 400:
        add("large_file", "Large file", f"{line_count} lines — consider splitting into modules")
    if pf and len(pf.imports) > 15:
        add(
            "high_import_coupling",
            "High import coupling",
            f"{len(pf.imports)} imports — consider facade modules",
        )
    if _TODO_RE.search(source):
        todo_count = len(_TODO_RE.findall(source))
        if todo_count >= 3:
            add("todo_density", "Unresolved markers", f"{todo_count} TODO/FIXME/HACK markers left in code")
    if line_count > 150 and _comment_ratio(source, language) < 0.05:
        add("low_comment_ratio", "Undocumented module", f"<5% comment ratio over {line_count} lines")
    if duplicate_of:
        add(
            "duplicate_code",
            "Duplicate code",
            f"identical body to {', '.join(duplicate_of[:3])} — extract shared helper",
        )
    long_lines = sum(1 for line in lines if _LONG_LINE_RE.match(line))
    if long_lines >= 5:
        add("long_lines", "Long lines", f"{long_lines} lines exceed 120 characters")

    # --- performance lens (I/O in loops, O(n^2) patterns) ---
    perf_hits = 0
    if pf:
        for sym in pf.symbols:
            if sym.kind not in ("function", "method"):
                continue
            body = "\n".join(lines[sym.line_start - 1 : sym.line_end])
            loop_io = len(re.findall(r"(open\(|requests\.|urllib|fetch\(|http\.)", body))
            if loop_io and re.search(r"\b(for|while)\b", body):
                perf_hits += 1
                add(
                    "io_in_loop",
                    "I/O inside loop",
                    f"{sym.qualified_name} performs I/O inside a loop — hoist it out",
                )
    # aggregate lens scores
    scores = {"defect_risk": 10.0, "maintainability": 10.0, "performance": 10.0}
    for issue in issues:
        if issue["detector"] == "io_in_loop":
            scores["performance"] = max(1.0, scores["performance"] - 0.8)
            continue
        lens = issue["lens"]
        scores[lens] = max(1.0, scores[lens] - _WEIGHTS[issue["detector"]][1])
    if perf_hits:
        scores["performance"] = max(1.0, scores["performance"] - 0.8 * perf_hits)

    overall = max(1.0, round(sum(scores.values()) / 3, 1))
    return {
        "path": path,
        "language": language,
        "lines": line_count,
        "symbols": len(pf.symbols) if pf else 0,
        "score": overall,
        "lenses": {k: round(v, 1) for k, v in scores.items()},
        "issues": issues[:8],
    }


# --------------------------------------------------------------------------- entry point


def compute_health(
    parsed_files: dict[str, ParsedFile],
    raw_sources: dict[str, tuple[str, str]] | None = None,
) -> dict[str, Any]:
    """Score every parseable file plus raw sources of other languages.

    ``raw_sources`` maps path -> (source, language) for files that were not
    tree-sitter parsed (e.g. unsupported languages); they get the source-level
    detectors only.
    """
    duplicates = find_duplicate_files(parsed_files)
    test_files = {p for p, pf in parsed_files.items() if _looks_like_test(p) or pf is None}

    files_all: dict[str, ParsedFile | None] = dict(parsed_files)
    for path, (_source, _lang) in (raw_sources or {}).items():
        files_all.setdefault(path, None)

    results: list[dict[str, Any]] = []
    for path in sorted(files_all):
        pf = files_all[path]
        if pf is not None:
            source = pf.source
        else:
            source = raw_sources.get(path, ("", ""))[0]
        if not source.strip():
            continue
        results.append(
            _score_file(
                path,
                pf,
                source,
                duplicate_of=duplicates.get(path),
                test_files=test_files,
            )
        )

    # repo-level aggregates
    scores = [r["score"] for r in results]
    avg = round(sum(scores) / len(scores), 1) if scores else None
    buckets = {"1-3": 0, "4-6": 0, "7-8": 0, "9-10": 0}
    for s in scores:
        if s <= 3:
            buckets["1-3"] += 1
        elif s <= 6:
            buckets["4-6"] += 1
        elif s <= 8:
            buckets["7-8"] += 1
        else:
            buckets["9-10"] += 1

    worst = sorted(results, key=lambda r: (r["score"], -r["lines"]))[:10]
    refactor_targets = sorted(
        (r for r in results if r["issues"]),
        key=lambda r: (r["lenses"]["maintainability"], r["score"]),
    )[:10]

    return {
        "detector_count": len(DETECTOR_NAMES),
        "files_scored": len(results),
        "average_score": avg,
        "distribution": buckets,
        "files": results,
        "worst_files": [r["path"] for r in worst],
        "refactor_targets": [
            {
                "path": r["path"],
                "score": r["score"],
                "lenses": r["lenses"],
                "issues": r["issues"][:3],
            }
            for r in refactor_targets
        ],
    }


def _looks_like_test(path: str) -> bool:
    name = path.rsplit("/", 1)[-1]
    return bool(re.search(r"^(test_|.*_test\.|.*\.(test|spec)\.)", name) or "/tests/" in f"/{path}")
