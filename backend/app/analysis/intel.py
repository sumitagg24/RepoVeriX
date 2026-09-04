"""Repository intelligence bundle: file wiki + architecture graph.

The intelligence layer is computed on demand from the working copy,
independently of scan runs:

- **wiki**: a structural doc page per parseable file — module docstring,
  symbol inventory, imports, and hot call targets. Deterministic; an optional
  LLM call can upgrade a page to prose (see the API route).
- **architecture**: a directory-level dependency graph (imports resolved
  between top-level modules) suitable for a layered diagram.

Both feed the ``/repositories/{id}/intelligence`` endpoint together with
``health.compute_health`` and ``gitintel.analyze_git_history``.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

from app.analysis import gitintel, health
from app.analysis.discovery import walk_repo_files
from app.analysis.models import ParsedFile
from app.analysis.parsing import is_supported, parse_source
from app.core.config import get_settings

_MAX_WIKI_FILES = 120


# --------------------------------------------------------------------------- wiki


def _top_calls(pf: ParsedFile, limit: int = 8) -> list[dict[str, int]]:
    counts: Counter[str] = Counter(c.callee for c in pf.calls)
    return [{"callee": name, "calls": n} for name, n in counts.most_common(limit)]


def _docstring(pf: ParsedFile) -> str:
    from app.analysis.health import _module_docstring

    return _module_docstring(pf.source, pf.language)


def _build_wiki_page(pf: ParsedFile) -> dict[str, Any]:
    symbols = [
        {
            "name": s.name,
            "kind": s.kind,
            "line_start": s.line_start,
            "line_end": s.line_end,
            "params": (s.extra or {}).get("params"),
        }
        for s in pf.symbols
    ]
    imports = [i.module for i in pf.imports[:30]]
    return {
        "path": pf.path,
        "language": pf.language,
        "title": pf.path.rsplit("/", 1)[-1],
        "docstring": _docstring(pf)[:500] or None,
        "summary": (
            f"{sum(1 for s in pf.symbols if s.kind in ('function', 'method'))} functions, "
            f"{sum(1 for s in pf.symbols if s.kind == 'class')} classes, "
            f"{len(pf.imports)} imports, {len(pf.calls)} call sites"
        ),
        "symbols": symbols,
        "imports": imports,
        "top_calls": _top_calls(pf),
        "lines": len(pf.source.splitlines()),
    }


def build_wiki(parsed_files: dict[str, ParsedFile]) -> dict[str, Any]:
    """Build structural docs for up to ``intel_wiki_max_files`` files."""
    settings = get_settings()
    cap = min(settings.intel_wiki_max_files, _MAX_WIKI_FILES)
    ranked = sorted(parsed_files.values(), key=lambda pf: (len(pf.symbols), len(pf.source)), reverse=True)
    pages = [_build_wiki_page(pf) for pf in ranked[:cap]]
    return {
        "files": len(pages),
        "total_parseable": len(parsed_files),
        "pages": pages,
    }


# --------------------------------------------------------------------------- architecture


def _group_of(path: str) -> str:
    """Top-level module for a path: 'app/api/x.py' -> 'app', 'main.py' -> 'main'."""
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[0]
    return parts[0].rsplit(".", 1)[0]


def build_architecture(parsed_files: dict[str, ParsedFile]) -> dict[str, Any]:
    """Directory-level import graph with layering metadata for rendering."""
    groups: dict[str, dict[str, int]] = {}
    for pf in parsed_files.values():
        g = _group_of(pf.path)
        groups.setdefault(g, {"symbols": 0, "files": 0, "imports": 0})
        groups[g]["symbols"] += len(pf.symbols)
        groups[g]["files"] += 1
        groups[g]["imports"] += len(pf.imports)

    edges: Counter[tuple[str, str]] = Counter()
    for pf in parsed_files.values():
        src_group = _group_of(pf.path)
        for imp in pf.imports:
            target = imp.module.split(".")[0]
            if target in groups and target != src_group:
                edges[(src_group, target)] += 1

    # longest-path layering (roots first) for a stable left-to-right layout
    adjacency: dict[str, set[str]] = defaultdict(set)
    for a, b in edges:
        adjacency[b].add(a)
    depth: dict[str, int] = {}
    for node in groups:
        stack = [(node, 0)]
        seen: set[str] = set()
        while stack:
            current, d = stack.pop()
            if current in seen:
                continue
            seen.add(current)
            depth[current] = max(depth.get(current, 0), d)
            for parent in adjacency[current]:
                stack.append((parent, d + 1))

    nodes = [
        {
            "id": g,
            "label": g,
            "files": data["files"],
            "symbols": data["symbols"],
            "imports": data["imports"],
            "layer": depth.get(g, 0),
        }
        for g, data in groups.items()
    ]
    top_edges = [{"from": a, "to": b, "weight": n} for (a, b), n in edges.most_common(30)]
    return {"nodes": nodes, "edges": top_edges}


# --------------------------------------------------------------------------- compute bundle


async def compute_intelligence(src: Path) -> dict[str, Any]:
    """Compute the full intelligence bundle for a working copy.

    Returns a dict keyed by ``health`` / ``git`` / ``wiki`` / ``architecture``.
    """
    settings = get_settings()
    files_raw, _ignored = walk_repo_files(src)
    files_raw = files_raw[: settings.intel_max_files]

    parsed: dict[str, ParsedFile] = {}
    for full in files_raw:
        lang = _language_of(full)
        if lang is None or not is_supported(lang):
            continue
        rel = full.relative_to(src).as_posix()
        try:
            text = full.read_text(encoding="utf-8", errors="replace")
            parsed[rel] = parse_source(text, lang, rel)
        except Exception:
            continue

    return {
        "health": health.compute_health(parsed),
        "git": await gitintel.analyze_git_history(src),
        "wiki": build_wiki(parsed),
        "architecture": build_architecture(parsed),
    }


def _language_of(path: Path) -> str | None:
    from app.analysis.discovery import LANGUAGE_BY_EXT

    return LANGUAGE_BY_EXT.get(path.suffix.lower())
