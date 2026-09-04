"""Architecture smell detection (Tier 2).

Deterministic analysis of the repository's import/dependency graph for
structural problems: hub modules (excessive fan-in), dependency tangles
(cycles), god modules, unstable modules, and orphaned modules. Each smell
carries the involved modules and a concrete remediation, computed purely from
parse results — no LLM.
"""

from __future__ import annotations

from collections import Counter, defaultdict
from typing import Any

from app.analysis.models import ParsedFile

# fan-in above this marks a hub module
_HUB_FAN_IN = 6
# groups whose size or symbol count dominate the repo by this factor
_GOD_GROUP_RATIO = 0.45
# a module is unstable when dependents < deps / 3 and deps >= 4
_UNSTABLE_MIN_DEPS = 4


def _group_of(path: str) -> str:
    parts = path.split("/")
    if len(parts) >= 2:
        return parts[0]
    return parts[0].rsplit(".", 1)[0]


def _build_graph(parsed_files: dict[str, ParsedFile]) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Return (module -> imported modules, module -> importing modules)."""
    modules = {_group_of(p) for p in parsed_files}
    out: dict[str, set[str]] = defaultdict(set)
    inn: dict[str, set[str]] = defaultdict(set)
    for pf in parsed_files.values():
        src = _group_of(pf.path)
        for imp in pf.imports:
            root = imp.module.split(".")[0]
            if root in modules and root != src:
                out[src].add(root)
                inn[root].add(src)
    return dict(out), dict(inn)


def _cycles(graph: dict[str, set[str]]) -> list[list[str]]:
    """Tarjan SCCs of size >= 2 (dependency tangles)."""

    def _tarjan(nodes: list[str]) -> list[list[str]]:
        index: dict[str, int] = {}
        lowlink: dict[str, int] = {}
        stack: list[str] = []
        on_stack: set[str] = set()
        result: list[list[str]] = []
        counter = [0]

        def strongconnect(v: str) -> None:
            index[v] = lowlink[v] = counter[0]
            counter[0] += 1
            stack.append(v)
            on_stack.add(v)
            for w in graph.get(v, set()):
                if w not in index:
                    strongconnect(w)
                    lowlink[v] = min(lowlink[v], lowlink[w])
                elif w in on_stack:
                    lowlink[v] = min(lowlink[v], index[w])
            if lowlink[v] == index[v]:
                comp: list[str] = []
                while True:
                    w = stack.pop()
                    on_stack.discard(w)
                    comp.append(w)
                    if w == v:
                        break
                if len(comp) > 1:
                    result.append(sorted(comp))

        for node in nodes:
            if node not in index:
                strongconnect(node)
        return result

    return _tarjan(list(graph.keys()))


def detect_smells(parsed_files: dict[str, ParsedFile]) -> dict[str, Any]:
    """Detect architectural smells from the module import graph."""
    out, inn = _build_graph(parsed_files)
    modules = set(out) | set(inn)
    smells: list[dict[str, Any]] = []

    # 1. hub modules — too many dependents
    for module, dependents in sorted(inn.items(), key=lambda kv: -len(kv[1])):
        if len(dependents) >= _HUB_FAN_IN:
            smells.append(
                {
                    "smell": "hub_module",
                    "severity": "high" if len(dependents) >= 10 else "medium",
                    "modules": [module],
                    "detail": f"{len(dependents)} modules import {module}",
                    "remediation": (
                        "Split the module by responsibility or extract the shared core "
                        "behind stable interfaces so dependents stop importing a monolith."
                    ),
                }
            )

    # 2. dependency tangles (cycles)
    for comp in _cycles(out):
        smells.append(
            {
                "smell": "dependency_cycle",
                "severity": "high" if len(comp) >= 4 else "medium",
                "modules": comp,
                "detail": "modules import each other in a cycle",
                "remediation": (
                    "Break the cycle by extracting the shared dependency into a lower layer "
                    "or inverting one edge with an interface/callback."
                ),
            }
        )

    # 3. god modules — dominate file/symbol counts
    total_symbols = sum(len(pf.symbols) for pf in parsed_files.values()) or 1
    per_group: dict[str, tuple[int, int]] = defaultdict(lambda: (0, 0))
    for pf in parsed_files.values():
        g = _group_of(pf.path)
        files, syms = per_group[g]
        per_group[g] = (files + 1, syms + len(pf.symbols))
    for module, (files, syms) in sorted(per_group.items(), key=lambda kv: -kv[1][1]):
        if syms / total_symbols >= _GOD_GROUP_RATIO and syms >= 20:
            smells.append(
                {
                    "smell": "god_module",
                    "severity": "medium",
                    "modules": [module],
                    "detail": f"{files} files, {syms} symbols ({syms / total_symbols:.0%} of the repo)",
                    "remediation": (
                        "Decompose the module: group symbols by responsibility and move "
                        "cohesive clusters into their own modules."
                    ),
                }
            )

    # 4. unstable modules — depend on much, depended on by little
    for module in modules:
        deps = len(out.get(module, set()))
        dependents = len(inn.get(module, set()))
        if deps >= _UNSTABLE_MIN_DEPS and dependents < deps / 3:
            smells.append(
                {
                    "smell": "unstable_module",
                    "severity": "low",
                    "modules": [module],
                    "detail": f"depends on {deps} modules but only {dependents} depend on it",
                    "remediation": (
                        "This module is a leaf with heavy coupling — changes ripple through "
                        "its dependents. Invert dependencies with interfaces where possible."
                    ),
                }
            )

    # 5. orphan modules — nothing imports them and they import nothing
    for module in sorted(modules):
        if not out.get(module) and not inn.get(module):
            smells.append(
                {
                    "smell": "orphan_module",
                    "severity": "low",
                    "modules": [module],
                    "detail": "no imports in or out of this module",
                    "remediation": (
                        "Likely dead code or an entry-point module. Confirm it is wired up, "
                        "or delete it."
                    ),
                }
            )

    smells.sort(key=lambda s: {"high": 0, "medium": 1, "low": 2}[s["severity"]])
    counts: Counter[str] = Counter(s["smell"] for s in smells)
    return {
        "module_count": len(modules),
        "edge_count": sum(len(v) for v in out.values()),
        "smell_count": len(smells),
        "by_type": dict(counts),
        "smells": smells,
    }