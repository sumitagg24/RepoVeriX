"""Finding conversational assistant (Tier 2).

Answers questions *about a single finding* using its own evidence chain,
verification state and repository context. Deterministic intents cover the
questions reviewers actually ask (what / where / why / how to fix / how
confident / similar findings / verification status); an optional LLM upgrade
grounds open-ended questions in the same evidence (repository content is
quoted as data, never as instructions — prompt-injection safe by construction).
"""

from __future__ import annotations

from typing import Any

from app.db.models import Finding

_INTENT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("fix", ("fix", "patch", "repair", "solve", "remediate", "recommend")),
    ("confidence", ("confiden", "sure", "certain", "trust", "reliable")),
    ("similar", ("similar", "same", "other finding", "elsewhere", "more like")),
    ("verify", ("verif", "test pass", "sandbox", "run", "proven")),
    ("why", ("why", "matter", "impact", "danger", "risk", "worse", "exploit")),
    ("where", ("where", "line", "location", "file", "which file")),
    ("evidence", ("evidence", "proof", "source", "sink", "chain", "flow")),
    ("what", ("what", "is this", "about", "describe", "summary")),
]

_INTENT_TITLES = {
    "what": "Finding summary",
    "where": "Location",
    "why": "Why it matters",
    "evidence": "Evidence chain",
    "confidence": "Confidence",
    "similar": "Similar findings",
    "verify": "Verification state",
    "fix": "How to fix",
    "unknown": "Finding context",
}


def detect_intent(question: str) -> str:
    q = question.lower()
    for intent, needles in _INTENT_RULES:
        if any(n in q for n in needles):
            return intent
    return "unknown"


def _evidence_rows(finding: Finding) -> list[dict[str, Any]]:
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


def _patch_state(finding: Finding) -> list[dict[str, Any]]:
    out = []
    for patch in finding.patches:
        runs = sorted(patch.verification_runs, key=lambda r: r.created_at, reverse=True)
        latest = runs[0] if runs else None
        out.append(
            {
                "patch_id": str(patch.id),
                "status": patch.status.value,
                "verification": latest.status.value if latest else None,
                "tests_passed": latest.tests_passed if latest else None,
            }
        )
    return out


def answer_finding_question(
    question: str,
    finding: Finding,
    *,
    similar: list[Finding] | None = None,
    snippet: str | None = None,
) -> dict[str, Any]:
    """Deterministic answer about one finding. ``similar`` = same-rule findings
    in other scans of the repository (resolved by the route)."""
    intent = detect_intent(question)
    sev = finding.severity.value if finding.severity else "unknown"
    status = finding.status.value if finding.status else "unknown"
    conf = finding.confidence or 0.0

    if intent == "what":
        answer = (
            f"**{finding.title}** — {sev} {finding.category.value if finding.category else ''} issue, "
            f"{status} at {int(conf * 100)}% confidence.\n\n{finding.description}"
        )
    elif intent == "where":
        answer = f"The issue is in `{finding.file_path}`"
        if finding.function_name:
            answer += f" in `{finding.function_name}`"
        if finding.line_start:
            answer += f" at lines {finding.line_start}"
            if finding.line_end and finding.line_end != finding.line_start:
                answer += f"-{finding.line_end}"
        answer += "."
        if snippet:
            answer += f"\n\n```\n{snippet[:600]}\n```"
    elif intent == "why":
        impact = finding.impact or (
            "This issue can lead to incorrect, insecure or unreliable behavior "
            "depending on how the flagged code is reached."
        )
        answer = f"**Why it matters:** {impact}"
    elif intent == "evidence":
        rows = _evidence_rows(finding)
        if not rows:
            answer = "This finding has no evidence chain recorded."
        else:
            chain = "\n".join(
                f"- {r['kind'].replace('_', ' ')}: {r['description']}"
                + (f" (`{r['file']}`:{r['line_start']})" if r["file"] else "")
                for r in rows
            )
            answer = f"Evidence chain ({len(rows)} nodes):\n{chain}"
    elif intent == "confidence":
        basis = ", ".join(
            {e.kind.value.replace("_", " ") for e in finding.evidence}
        ) or "no evidence recorded"
        answer = (
            f"Confidence is {int(conf * 100)}% with status **{status}**. "
            f"This is computed from evidence, not model bravado. Evidence present: {basis}."
        )
    elif intent == "similar":
        if not similar:
            answer = "No other scans record the same finding signature yet."
        else:
            lines = "\n".join(
                f"- scan {s.scan.created_at.date() if s.scan.created_at else '?'}: {s.status.value} "
                f"({int((s.confidence or 0) * 100)}%)"
                for s in similar[:5]
            )
            answer = f"Same finding signature across {len(similar)} other scan(s):\n{lines}"
    elif intent == "verify":
        patches = _patch_state(finding)
        if not patches:
            answer = "No patches have been verified for this finding yet — generate a fix and run the sandbox."
        else:
            lines = "\n".join(
                f"- patch {p['patch_id'][:8]} → {p['verification']}"
                + (f" (tests {'passed' if p['tests_passed'] else 'failed'})" if p["tests_passed"] is not None else "")
                for p in patches[:5]
            )
            answer = f"Verification state ({len(patches)} patch(es)):\n{lines}"
    elif intent == "fix":
        rec = finding.recommendation or (
            "Eliminate the flagged unsafe pattern at the evidence sink, then generate a "
            "regression test and verify the patch in the sandbox."
        )
        answer = f"**Suggested fix:** {rec}"
    else:
        rows = _evidence_rows(finding)
        answer = (
            f"**{finding.title}** — {sev}, {status}, {int(conf * 100)}% confidence in "
            f"`{finding.file_path}`"
            + (f":{finding.line_start}" if finding.line_start else "")
            + f".\n\nEvidence: {len(rows)} nodes. Ask about the evidence chain, why it matters, "
            "how confident this is, how to fix it, similar findings, or verification state."
        )

    sources: list[dict[str, Any]] = [
        {"kind": "finding", "file": finding.file_path, "line_start": finding.line_start}
    ]
    if snippet:
        sources.append({"kind": "source", "file": finding.file_path})
    return {
        "question": question,
        "intent": intent,
        "intent_title": _INTENT_TITLES[intent],
        "answer": answer,
        "sources": sources,
        "mode": "deterministic",
    }