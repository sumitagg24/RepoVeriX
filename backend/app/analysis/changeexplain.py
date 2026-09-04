"""Commit / change explanation (Tier 2).

Turns a change-audit payload into a readable, human-verifiable narrative:
what the diff does, which symbols it touches, what could break, what is
missing, and what to run. Deterministic by default; the API layer can append
an LLM prose paragraph when a provider is configured.
"""

from __future__ import annotations

from typing import Any


def risk_label(score: float) -> str:
    # bands mirror changes.risk_level_for but on prose labels
    if score >= 75:
        return "very high-risk"
    if score >= 50:
        return "high-risk"
    if score >= 25:
        return "moderate-risk"
    return "low-risk"


def build_explanation(audit: dict[str, Any]) -> dict[str, Any]:
    """Deterministic narrative built from ``changes.analyze_change`` output."""
    files = audit.get("changed_files", [])
    added = audit.get("added_lines", 0)
    removed = audit.get("removed_lines", 0)
    symbols = audit.get("changed_symbols", [])
    blast = audit.get("blast_radius", {})
    risk = audit.get("risk_score", 0.0)

    per_file: list[dict[str, Any]] = []
    for path in files:
        syms = [s for s in symbols if s.get("file") == path]
        note: str | None = None
        if path in blast.get("caller_files", {}):
            note = f"{blast['caller_files'][path]} external caller(s) — interface change risk"
        elif path in blast.get("importing_files", []):
            note = "imported by files outside the change"
        per_file.append(
            {
                "path": path,
                "symbols_changed": [s["name"] for s in syms],
                "note": note,
            }
        )

    areas = sorted({p.split("/")[0] for p in files})
    bullets: list[str] = []
    if symbols:
        names = ", ".join(sorted({s["name"].split("::")[-1] for s in symbols})[:8])
        bullets.append(f"Touches {len(symbols)} symbol(s): {names}.")
    if blast.get("caller_count"):
        bullets.append(
            f"{blast['caller_count']} callers outside the diff could be affected "
            f"(blast radius over the call graph)."
        )
    if audit.get("missing_companion_files"):
        companions = ", ".join(audit["missing_companion_files"][:5])
        bullets.append(f"Git history says these usually change together with this diff: {companions}.")
    if audit.get("untested_changed_files"):
        untested = ", ".join(audit["untested_changed_files"][:5])
        bullets.append(f"Changed files with no exercising test: {untested}.")
    if audit.get("tests_to_run"):
        bullets.append("Run: " + ", ".join(audit["tests_to_run"][:5]) + ".")
    else:
        bullets.append("No test files import the changed files — consider adding coverage.")

    components = audit.get("risk_components", {})
    why_risk = [
        f"size {components.get('size', 0)}",
        f"blast radius {components.get('blast_radius', 0)}",
        f"API surface {components.get('api_surface', 0)}",
        f"missing tests {components.get('tests', 0)}",
        f"missing companions {components.get('companions', 0)}",
        f"security/auth {components.get('security', 0)}",
        f"database {components.get('database', 0)}",
        f"history/churn {components.get('history', 0)}",
    ]
    if audit.get("risk_level"):
        why_risk.append(f"level {audit['risk_level']}")

    return {
        "risk_score": risk,
        "risk_label": risk_label(risk),
        "summary": (
            f"This change touches {len(files)} file(s) (+{added}/-{removed} lines) across "
            f"{len(areas)} area(s): {', '.join(areas)}."
        ),
        "bullets": bullets,
        "per_file": per_file,
        "risk_components": why_risk,
        "directives": audit.get("directives", []),
    }