"""Dependency reachability: which declared dependencies does the code actually use?

A vulnerable dependency that no source file imports cannot be exploited from
this repository. For every manifest dependency we match its module root
against the parsed import graph and report reachable/unreachable plus the
importing files — so vulnerability triage can skip dead weight.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from app.analysis.discovery import discover_project
from app.analysis.models import ParsedFile


def _normalize(name: str) -> str:
    return name.strip().lower().replace("_", "-").replace(".", "-")


def _import_roots(imports) -> set[str]:
    roots: set[str] = set()
    for imp in imports:
        module = imp.module
        if module.startswith("."):
            continue  # relative import -> in-repo
        root = module.split(".")[0].split("/")[0]
        if root:
            roots.add(_normalize(root))
    return roots


def analyze_reachability(
    src: Path,
    parsed_files: dict[str, ParsedFile],
    *,
    vulnerability_counts: dict[str, int] | None = None,
) -> dict:
    """Return per-dependency reachability from the manifest + import graph.

    ``vulnerability_counts`` maps normalized dep name -> number of known
    vulnerabilities (from the latest scan's Dependency rows, if any).
    """
    manifest = discover_project(src, "directory")
    by_name: dict[str, dict] = {}
    for dep in manifest.dependencies:
        key = _normalize(dep["name"])
        by_name.setdefault(
            key,
            {
                "name": dep["name"],
                "version": dep["version"],
                "ecosystem": dep["ecosystem"],
                "importers": [],
            },
        )

    importers_by_root: dict[str, set[str]] = defaultdict(set)
    for path, pf in parsed_files.items():
        for root in _import_roots(pf.imports):
            importers_by_root[root].add(path)

    rows: list[dict] = []
    for key, dep in by_name.items():
        importers = sorted(importers_by_root.get(key, set()))
        vuln_count = (vulnerability_counts or {}).get(key, 0)
        rows.append(
            {
                "name": dep["name"],
                "version": dep["version"],
                "ecosystem": dep["ecosystem"],
                "reachable": bool(importers),
                "importer_count": len(importers),
                "importers": importers[:15],
                "known_vulnerabilities": vuln_count,
                "triage": (
                    "reachable-vulnerable"
                    if importers and vuln_count
                    else "reachable"
                    if importers
                    else "vulnerable-unreachable"
                    if vuln_count
                    else "unreachable"
                ),
            }
        )

    rows.sort(key=lambda r: (not r["reachable"], r["name"]))
    return {
        "dependencies": rows,
        "reachable_count": sum(1 for r in rows if r["reachable"]),
        "unreachable_count": sum(1 for r in rows if not r["reachable"]),
        "vulnerable_reachable": sum(1 for r in rows if r["triage"] == "reachable-vulnerable"),
    }