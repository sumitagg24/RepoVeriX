"""Dependency reachability: how a declared dependency could be used by the repo.

For every dependency we answer *what evidence supports reachability* with four
statuses:

DIRECTLY_REACHABLE
    Repository source imports the package's module root (import sites listed).
INDIRECTLY_REACHABLE
    The package is not declared at the top level but appears in a lockfile that
    enumerates the dependency tree — it can only be reached through other
    packages, so it cannot be excluded without resolving the tree.
NOT_REACHABLE
    Only claimed with positive evidence: the repository vendors/shadow the
    package name itself (a top-level module with the same import root), so the
    external package is not importable from this source tree.
UNKNOWN
    The package is declared but no import site was found and no structural
    evidence exists either way. Absence of a search hit is **never** treated as
    "proven unreachable" — that would overstate the evidence.

Rows keep the legacy ``reachable`` / ``triage`` fields (computed from the same
evidence) so earlier callers keep working.
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from pathlib import Path

from app.analysis.discovery import discover_project
from app.analysis.models import ParsedFile

# Directly reachable -> triage label used by older consumers.
_TRIAGE_VULN = {
    "DIRECTLY_REACHABLE": "reachable-vulnerable",
    "INDIRECTLY_REACHABLE": "indirectly-reachable",
    "NOT_REACHABLE": "not-reachable",
    "UNKNOWN": "vulnerable-unknown",
}
_TRIAGE_SAFE = {
    "DIRECTLY_REACHABLE": "reachable",
    "INDIRECTLY_REACHABLE": "indirectly-reachable",
    "NOT_REACHABLE": "not-reachable",
    "UNKNOWN": "unreachable",
}

_LOCKFILES = ("package-lock.json", "yarn.lock", "pnpm-lock.yaml", "poetry.lock", "Pipfile.lock", "uv.lock")


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


def _lockfile_packages(src: Path) -> dict[str, Path]:
    """Package names mentioned by a lockfile -> which lockfile proved it.

    A lockfile that enumerates the full dependency tree (npm/yarn/pnpm lock,
    poetry, pipenv, uv) is structural evidence of *transitive* membership when
    the package is absent from the top-level manifest.
    """
    found: dict[str, Path] = {}
    for lock in _LOCKFILES:
        path = src / lock
        if not path.is_file():
            continue
        try:
            text = path.read_text(encoding="utf-8", errors="replace")[:4_000_000]
        except OSError:
            continue
        if lock == "package-lock.json":
            try:
                data = json.loads(text)
                for key in (data.get("packages") or {}).keys():
                    if key and not key.startswith("node_modules/"):
                        continue
                    name = (key or "").rsplit("node_modules/", 1)[-1]
                    if name and "/" not in name:
                        found.setdefault(_normalize(name.split("@")[0]), path)
            except json.JSONDecodeError:
                pass
            continue
        if lock == "yarn.lock":
            for m in re.finditer(r'^"?([@\w.\-]+)@', text, re.MULTILINE):
                found.setdefault(_normalize(m.group(1).split("@")[-1].strip('"')), path)
            continue
        if lock == "poetry.lock":
            for m in re.finditer(r'^name\s*=\s*"([^"]+)"', text, re.MULTILINE):
                found.setdefault(_normalize(m.group(1)), path)
            continue
        if lock in ("Pipfile.lock", "uv.lock"):
            # Pipfile.lock is JSON; uv.lock is TOML-ish ``name = "pkg"`` lines.
            try:
                data = json.loads(text)
                for section in ("default", "develop"):
                    for key in (data.get(section) or {}).keys():
                        found.setdefault(_normalize(key), path)
            except json.JSONDecodeError:
                for m in re.finditer(r'name\s*=\s*"([^"]+)"', text):
                    found.setdefault(_normalize(m.group(1)), path)
            continue
    return found


def _shadowed_import_root(parsed_files: dict[str, ParsedFile], root: str) -> str | None:
    """Positive NOT_REACHABLE evidence: repo defines a module that shadows root."""
    root = root.replace("-", "_")
    for path in parsed_files:
        first = path.split("/")[0]
        if first == root or first.rsplit(".", 1)[0] == root:
            return path
    return None


def analyze_reachability(
    src: Path,
    parsed_files: dict[str, ParsedFile],
    *,
    vulnerability_counts: dict[str, int] | None = None,
    vulnerability_details: dict[str, list[dict]] | None = None,
) -> dict:
    """Return per-dependency reachability from manifest + import + lockfile evidence.

    ``vulnerability_counts`` maps normalized dep name -> vulnerability count
    (legacy). ``vulnerability_details`` maps normalized dep name -> list of
    advisory dicts (``{"id", "cvss", "summary", "affected"}``) attached to the
    matching rows for the UI.
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
                "top_level": True,
            },
        )

    lockfiles = _lockfile_packages(src)

    importers_by_root: dict[str, set[str]] = defaultdict(set)
    for path, pf in parsed_files.items():
        for root in _import_roots(pf.imports):
            importers_by_root[root].add(path)

    # Transitive-only packages: in the lockfile tree but not a top-level manifest dep.
    for key, lock in lockfiles.items():
        if key not in by_name:
            by_name[key] = {
                "name": key,
                "version": None,
                "ecosystem": None,
                "importers": [],
                "top_level": False,
            }
            by_name[key]["lockfile"] = str(lock)

    vuln_details = vulnerability_details or {}
    rows: list[dict] = []
    for key, dep in by_name.items():
        importers = sorted(importers_by_root.get(key, set()))
        vuln_count = (vulnerability_counts or {}).get(key, 0)
        details = vuln_details.get(key) or []
        vuln_count = max(vuln_count, len(details))
        evidence: list[str] = []
        if importers:
            status = "DIRECTLY_REACHABLE"
            evidence.append(f"{len(importers)} import site(s): " + ", ".join(importers[:5]))
            if len(importers) > 5:
                evidence[-1] += f" (+{len(importers) - 5} more)"
        elif dep.get("top_level") and _shadowed_import_root(parsed_files, key):
            status = "NOT_REACHABLE"
            evidence.append(
                f"the repository defines its own module at "
                f"{_shadowed_import_root(parsed_files, key)}; the external package "
                "is shadowed and not importable from this source tree"
            )
        elif not dep.get("top_level") and dep.get("lockfile"):
            status = "INDIRECTLY_REACHABLE"
            evidence.append(
                f"not a top-level manifest dependency; present in the dependency tree "
                f"({Path(dep['lockfile']).name}) so it can only be reached through "
                "other packages — reachability cannot be excluded without resolving the tree"
            )
        else:
            status = "UNKNOWN"
            evidence.append(
                "declared but no import site found in repository source; no structural "
                "evidence proves reachability either way (absence of a hit is not "
                "proof of non-reachability)"
            )

        triage = _TRIAGE_VULN[status] if vuln_count else _TRIAGE_SAFE[status]
        recommendation = _recommendation(status, vuln_count, dep.get("top_level", True))
        rows.append(
            {
                "name": dep["name"],
                "version": dep["version"],
                "ecosystem": dep["ecosystem"],
                "reachable": status == "DIRECTLY_REACHABLE",
                "importer_count": len(importers),
                "importers": importers[:15],
                "known_vulnerabilities": vuln_count,
                "reachability_status": status,
                "reachability_evidence": evidence,
                "top_level": bool(dep.get("top_level")),
                "recommendation": recommendation,
                "vulnerabilities": details,
                "triage": triage,
            }
        )

    def _order(row: dict) -> tuple:
        status_rank = {
            "DIRECTLY_REACHABLE": 0,
            "INDIRECTLY_REACHABLE": 1,
            "UNKNOWN": 2,
            "NOT_REACHABLE": 3,
        }[row["reachability_status"]]
        return (status_rank, -row["known_vulnerabilities"], row["name"])

    rows.sort(key=_order)
    counts: dict[str, int] = defaultdict(int)
    for r in rows:
        counts[r["reachability_status"]] += 1
    return {
        "dependencies": rows,
        "reachable_count": sum(1 for r in rows if r["reachable"]),
        "unreachable_count": sum(1 for r in rows if not r["reachable"]),
        "vulnerable_reachable": sum(
            1 for r in rows if r["known_vulnerabilities"] and r["reachability_status"] == "DIRECTLY_REACHABLE"
        ),
        "status_counts": dict(counts),
    }


def _recommendation(status: str, vuln_count: int, top_level: bool) -> str:
    if status == "DIRECTLY_REACHABLE":
        if vuln_count:
            return "Imported and known-vulnerable — upgrade or remediate now."
        return "Imported by repository code; keep up to date."
    if status == "INDIRECTLY_REACHABLE":
        if vuln_count:
            return (
                "Transitive dependency with known vulnerabilities — upgrade the "
                "top-level package that pulls it in."
            )
        return "Transitive dependency; audit when upgrading its parent."
    if status == "NOT_REACHABLE":
        return "Shadowed by in-repository code; the external package cannot be imported."
    if vuln_count:
        return "Known vulnerability but no usage proven — verify manually before assuming exposure."
    if not top_level:
        return "Lockfile-only entry; exposure unproven."
    return "No import evidence found; treat exposure as unproven, not proven safe."
