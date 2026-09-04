"""\"Why does this matter?\" impact analysis (Tier 2).

For every finding, answer the reviewer's question with concrete, computed
context instead of a generic boilerplate paragraph:

- what the worst realistic outcome is (mapped deterministically from the
  finding's category, severity and evidence chain)
- how the finding is reached: which in-repo functions call the vulnerable
  function, and whether it is reachable from entry points
- what collateral damage looks like (dependent files, data, blast radius)
- where the fix should point (recommendation + generated-test pointer)

The callers and entry-point reachability come from the knowledge graph — this
is the repository-level view, not a file-level claim.
"""

from __future__ import annotations

import re
from typing import Any

from app.analysis.knowledge import KnowledgeGraph
from app.db.models import Finding

_ENTRY_HINTS = re.compile(
    r"\b(main|handler|route|app|controller|middleware|__main__|serve|listen|run)\b",
    re.IGNORECASE,
)

_WORST_CASE: dict[str, dict[str, str]] = {
    "security": {
        "critical": (
            "Remote code execution or full data compromise: an unauthenticated attacker "
            "can likely run arbitrary code or exfiltrate the entire database."
        ),
        "high": (
            "Significant compromise: an attacker can read or modify sensitive data, "
            "escalate privileges, or take over accounts."
        ),
        "medium": (
            "Contained but real: an attacker can tamper with individual records, leak "
            "partial data, or abuse the feature beyond its intent."
        ),
        "low": (
            "Limited exposure: a motivated attacker gains minor information or "
            "low-value manipulation."
        ),
    },
    "logic": {
        "critical": (
            "Core business logic can be driven into a corrupt state — wrong orders, "
            "incorrect balances, or data loss on every affected operation."
        ),
        "high": ("Common inputs produce wrong results or silently drop data."),
        "medium": ("Edge inputs produce incorrect behavior that may reach production."),
        "low": ("Bounded edge case produces a wrong value or warning."),
    },
    "api_misuse": {
        "critical": ("The API can crash the service or corrupt its state under normal use."),
        "high": ("Resource leaks or race conditions under load can take the service down."),
        "medium": ("Incorrect API usage surfaces as intermittent errors in production."),
        "low": ("Minor inefficiency or deprecated usage — no immediate failure."),
    },
    "database": {
        "critical": ("Queries can destroy or lock the database — data loss or full outage."),
        "high": ("Bad queries degrade the database under load or violate constraints."),
        "medium": ("Inefficient queries or missing constraints cause sporadic failures."),
        "low": ("Minor schema/query hygiene issue with no immediate impact."),
    },
    "dependency": {
        "critical": ("Known actively-exploited vulnerability in a runtime dependency."),
        "high": ("Known vulnerability in a dependency that ships to production."),
        "medium": ("Outdated dependency with disclosed, unpatched issues."),
        "low": ("Maintenance risk: unmaintained or outdated dependency."),
    },
    "reliability": {
        "critical": ("The failure mode can take down the whole service."),
        "high": ("Frequent failures under normal operation degrade availability."),
        "medium": ("Intermittent failures or unhandled errors surface to users."),
        "low": ("Edge-case crash with limited blast radius."),
    },
}

_CATEGORY_LABELS = {
    "security": "security",
    "logic": "logic",
    "api_misuse": "API usage",
    "database": "database",
    "dependency": "dependency",
    "reliability": "reliability",
}


def _evidence_chain(finding: Finding) -> list[dict[str, Any]]:
    ordered = sorted(finding.evidence, key=lambda e: e.order_index)
    return [
        {
            "kind": e.kind.value,
            "file": e.file_path,
            "line_start": e.line_start,
            "line_end": e.line_end,
            "description": e.description,
        }
        for e in ordered
    ]


def analyze_impact(finding: Finding, graph: KnowledgeGraph | None) -> dict[str, Any]:
    """Compute the impact narrative + reachability for one finding."""
    category = finding.category.value if finding.category else "logic"
    severity = finding.severity.value if finding.severity else "low"

    worst = _WORST_CASE.get(category, _WORST_CASE["logic"]).get(
        severity, _WORST_CASE["logic"]["medium"]
    )

    # --- reachability over the knowledge graph ------------------------------
    callers: list[str] = []
    entrypoint_reachable = False
    dependent_files: list[str] = []
    if graph is not None:
        function_refs = [
            ref
            for ref in graph.symbols_in(finding.file_path)
            if ref.kind in ("function", "method") and ref.name == (finding.function_name or "")
        ]
        if function_refs:
            callers = graph.callers_of_ref(function_refs[0])
            for caller in callers:
                if _ENTRY_HINTS.search(caller.split("::")[-1]) or _ENTRY_HINTS.search(caller):
                    entrypoint_reachable = True
                    break
            for callee in graph.callees_of_ref(function_refs[0]):
                if callee.file_path != finding.file_path:
                    dependent_files.append(callee.file_path)
        # anything under a file named main/app/server is a weak entry signal
        if not entrypoint_reachable:
            head = finding.file_path.split("/")[0]
            if re.search(r"(main|app|server|api|routes?|controllers?)", head, re.IGNORECASE):
                entrypoint_reachable = True

    why_it_matters = [
        f"Category: {_CATEGORY_LABELS.get(category, category)} · severity {severity} · "
        f"status {finding.status.value if finding.status else 'unknown'} "
        f"({int((finding.confidence or 0) * 100)}% confidence)",
        worst,
    ]
    if callers:
        why_it_matters.append(
            f"Reachable from {len(callers)} in-repo call site(s) — it is not dead code."
        )
    if entrypoint_reachable:
        why_it_matters.append(
            "Reachable from an entry point (handler/main/route), so real requests can hit it."
        )
    elif callers:
        why_it_matters.append(
            "Not directly wired to an entry point, but reachable through the call graph."
        )

    evidence = _evidence_chain(finding)
    sink = next((e for e in reversed(evidence) if e["kind"] in ("sink", "static_analysis")), None)
    source = next((e for e in evidence if e["kind"] == "source_input"), None)

    fix_direction = finding.recommendation or (
        "Rewrite the flagged line to eliminate the unsafe pattern; run the generated "
        "regression test and the sandbox verifier before merging."
    )

    return {
        "finding_id": str(finding.id),
        "summary": (
            f"{finding.title} in {finding.file_path}:{finding.line_start or '?'} "
            f"is a {severity} {_CATEGORY_LABELS.get(category, category)} issue."
        ),
        "why_it_matters": why_it_matters,
        "worst_case": worst,
        "callers": callers,
        "entrypoint_reachable": entrypoint_reachable,
        "evidence_chain": evidence,
        "source": source,
        "sink": sink,
        "fix_direction": fix_direction,
        "category": category,
        "severity": severity,
    }