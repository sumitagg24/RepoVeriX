"""Counterexample-based finding validation (the validator opposes the claim).

A finding asserts ``source -> ... -> sink``. This engine does not ask another
LLM "is it correct?" — it runs a deterministic battery of checks against the
repository evidence and only then decides:

- claim grounding   — does the evidence actually trace a source to a sink?
- sanitizer guard   — is a sanitizer/validator applied before the sink?
- parameterization  — is the sink a parameterized / prepared / ORM-built call?
- framework guards  — framework-level protections on the sink path (authz)
- exception safety  — is the sink wrapped in try/except?
- test support      — do repository tests reference the suspected function?

Outcomes are recorded as ``supporting`` / ``contradicting`` evidence so every
verdict is auditable. The classifier is deterministic:

- a *contradicting* guard on the sink path  -> REJECTED (claim not supported)
- complete source->sink chain + strong rule -> VERIFIED (deterministic rules)
- chain present but evidence incomplete    -> PROBABLE

Every result is logged (see ValidationRun) so experiments can later compute
verified/probable/rejected rates and false-positive reduction.
"""

from __future__ import annotations

import re

from app.analysis import counterexamples
from app.analysis.models import ParsedFile
from app.db.models import Finding, FindingSource, FindingStatus

_STRONG_RULES = {
    "RVX-SQLI-001",
    "RVX-CMDI-001",
    "RVX-SECRET-001",
    "RVX-EVAL-001",
    "RVX-CRYPTO-001",
    "RVX-PICKLE-001",
}

_SOURCE_KINDS = {"source_input", "transformation", "call_relationship"}
_SINK_KINDS = {"sink", "static_analysis"}

# Parameterized-call markers that neutralise SQL/command/deserialisation claims.
_PARAM_SQL_RE = re.compile(
    r"\?\s*[,)]|%s\b|%(\(\w+\))?s\b|params\s*=|\.execute\([^)]*,[^)]*\)"
    r"|\.query\([^)]*,[^)]*\)|prepared_stmt|PreparedStatement|bind_param\w*\(",
    re.IGNORECASE,
)
_AUTH_GUARD_RE = re.compile(
    r"(is_admin|is_authenticated|require_auth|require_login|login_required|require_role|has_role"
    r"|check_permission|check_role|permission_required|authorize|authorization\b|enforce_|403|401)"
    r"|\b(can_|may_)\w+",
    re.IGNORECASE,
)
_EXCEPTION_RE = re.compile(r"try\s*:|except\s+\w*\s*:|catch\s*\(|try\s*\{", re.IGNORECASE)


def _line_text(pf: ParsedFile, line: int) -> str:
    lines = pf.source.splitlines()
    if not lines or line < 1:
        return ""
    return lines[min(line, len(lines)) - 1]


def _sink_window(pf: ParsedFile, sink_line: int, radius: int = 4) -> str:
    lines = pf.source.splitlines()
    if not lines:
        return ""
    lo = max(0, sink_line - radius - 1)
    hi = min(len(lines), sink_line + radius)
    return "\n".join(lines[lo:hi])


def _enclosing_span(pf: ParsedFile, line: int) -> tuple[int, int]:
    """Approximate function/block span containing ``line`` from the symbol model.

    Falls back to a ±25-line window so guard scans stay local and cheap.
    """
    symbols = getattr(pf, "symbols", None) or []
    for sym in symbols:
        if getattr(sym, "kind", None) in ("function", "method", "class_"):
            start, end = sym.line_start, sym.line_end
            if start <= line <= end:
                return (start, end)
    return (max(1, line - 25), line + 25)


def _evidence_of(finding: Finding, kinds: set[str]) -> list[dict]:
    return [
        {
            "kind": e.kind.value,
            "file_path": e.file_path,
            "line_start": e.line_start,
            "snippet": e.snippet,
            "description": e.description[:400],
        }
        for e in sorted(finding.evidence, key=lambda x: x.order_index)
        if e.kind.value in kinds
    ]


def _rule_of(finding: Finding) -> str | None:
    for ev in finding.evidence:
        extra = ev.extra or {}
        if isinstance(extra.get("rule"), str) and extra["rule"]:
            return extra["rule"]
    return None


def validate_finding(
    finding: Finding,
    pf: ParsedFile,
    *,
    test_references: list[dict] | None = None,
) -> dict:
    """Run the validation battery; returns a structured, auditable verdict."""
    rule = _rule_of(finding)
    source_nodes = _evidence_of(finding, _SOURCE_KINDS)
    sink_nodes = _evidence_of(finding, _SINK_KINDS)
    source_lines = [n["line_start"] for n in source_nodes if n["line_start"]]
    sink_lines = [n["line_start"] for n in sink_nodes if n["line_start"]]

    claim = (
        f"{finding.title} in {finding.file_path}"
        f"{':' + str(finding.line_start) if finding.line_start else ''} — "
        f"{finding.description[:240]}"
    )

    checks: list[dict] = []
    supporting: list[dict] = []
    contradicting: list[dict] = []

    # 1. claim grounding: does the evidence chain actually exist?
    chain_ok = bool(source_nodes and sink_nodes and sink_lines)
    if source_lines:
        chain_ok = chain_ok and min(source_lines) <= min(sink_lines)
    checks.append(
        {
            "key": "claim_grounding",
            "label": "Evidence traces a source to a sink",
            "passed": chain_ok,
            "detail": (f"source nodes: {len(source_nodes)}, sink nodes: {len(sink_nodes)}"),
        }
    )
    if chain_ok:
        supporting.append(
            {
                "kind": "flow",
                "label": "Source→sink chain",
                "detail": f"{len(source_nodes)} source/transform nodes, {len(sink_nodes)} sink nodes",
            }
        )
    else:
        contradicting.append(
            {
                "kind": "flow",
                "label": "Incomplete chain",
                "detail": "No full source→sink path in the evidence",
            }
        )

    # 2. sanitizer guard (deterministic counterexample)
    sanitizer_proof = None
    if pf is not None and sink_lines:
        sanitizer_proof = counterexamples.validate_counterexample(
            pf, source_lines, sink_lines, extra_terms=[finding.function_name or ""]
        )
    guard_found = sanitizer_proof is not None
    checks.append(
        {
            "key": "sanitizer_guard",
            "label": "Sanitizer/validator guards the sink path",
            "passed": guard_found,
            "detail": (
                f"{sanitizer_proof['sanitizer']}() at line {sanitizer_proof['sanitizer_line']}"
                if sanitizer_proof
                else "no sanitizer applied to the value reaching the sink"
            ),
        }
    )
    if sanitizer_proof:
        contradicting.append(
            {
                "kind": "counterexample",
                "label": "Sanitizer neutralises the path",
                "detail": sanitizer_proof["explanation"],
                "sanitizer": sanitizer_proof["sanitizer"],
                "sanitizer_line": sanitizer_proof["sanitizer_line"],
            }
        )

    # 3. parameterized / framework-protected sink
    parameterized = False
    if sink_lines:
        sink_text = _sink_window(pf, min(sink_lines))
        parameterized = bool(_PARAM_SQL_RE.search(sink_text))
        # an executed statement with zero dynamic arguments is effectively constant
        if not parameterized:
            call_line = _line_text(pf, min(sink_lines))
            if _PARAM_SQL_RE.search(call_line):
                parameterized = True
    checks.append(
        {
            "key": "parameterized_sink",
            "label": "Sink uses parameterized / prepared execution",
            "passed": parameterized,
            "detail": (
                "parameterized call markers found near the sink"
                if parameterized
                else "raw string execution pattern"
            ),
        }
    )
    if parameterized:
        contradicting.append(
            {
                "kind": "framework",
                "label": "Parameterized execution",
                "detail": "The sink call separates data from code (parameterized / prepared statement)",
            }
        )

    # 4. authorization guard (contextual; only recorded, not verdict-changing alone)
    authz_seen = False
    authz_detail = "no authorization guard observed in the enclosing block"
    if sink_lines:
        start, end = _enclosing_span(pf, min(sink_lines))
        body = "\n".join(pf.source.splitlines()[start - 1 : end])
        if _AUTH_GUARD_RE.search(body):
            authz_seen = True
            match = _AUTH_GUARD_RE.search(body)
            authz_detail = f"authorization guard token observed: {match.group(0) if match else 'present'}"
    checks.append(
        {
            "key": "authorization_guard",
            "label": "Authorization check protects the path",
            "passed": authz_seen,
            "detail": authz_detail,
        }
    )

    # 5. exception handling around the sink
    handled = False
    if sink_lines:
        start, end = _enclosing_span(pf, min(sink_lines))
        body = "\n".join(pf.source.splitlines()[start - 1 : end])
        handled = bool(_EXCEPTION_RE.search(body))
    checks.append(
        {
            "key": "exception_handling",
            "label": "Sink wrapped in try/catch",
            "passed": handled,
            "detail": (
                "exception handling present in the enclosing block"
                if handled
                else "no try/catch around the sink"
            ),
        }
    )

    # 6. repository tests reference the suspected code path
    refs = test_references or []
    checks.append(
        {
            "key": "test_support",
            "label": "Tests reference the suspected function",
            "passed": len(refs) > 0,
            "detail": (
                f"{len(refs)} test reference(s): "
                + ", ".join(f"{r.get('file')}:{r.get('line', '?')}" for r in refs[:3])
                if refs
                else "no test references the suspected function"
            ),
        }
    )
    if refs:
        supporting.append(
            {"kind": "test", "label": "Test references", "detail": f"{len(refs)} reference(s) found in tests"}
        )

    # 7. targeted static re-analysis marker (the rule that fired, if any)
    strong = bool(rule and rule in _STRONG_RULES)
    checks.append(
        {
            "key": "deterministic_rule",
            "label": "Deterministic strong rule",
            "passed": strong,
            "detail": rule or "no rule recorded on the evidence",
        }
    )
    if strong:
        supporting.append(
            {
                "kind": "static",
                "label": "Strong rule",
                "detail": f"rule {rule} fired deterministically",
            }
        )

    # ---- classification (deterministic, documented) --------------------------
    # Only path-level guards refute a claim. An incomplete chain is not a
    # counterexample — it caps the verdict at PROBABLE instead.
    refutations = [c for c in contradicting if c["kind"] in ("counterexample", "framework")]
    contradictions = len(refutations)
    complete_chain = chain_ok and (strong or finding.source == FindingSource.static.value)
    if contradictions:
        status = FindingStatus.rejected
        confidence = min(0.95, 0.7 + 0.1 * contradictions)
        explanation = (
            "The claim is not supported: deterministic counterexample evidence shows "
            + "; ".join(c["label"].lower() for c in contradicting)
            + "."
        )
    elif complete_chain:
        status = FindingStatus.verified
        confidence = min(0.97, 0.8 + (0.05 if strong else 0.0) + (0.05 if handled else 0.0))
        explanation = "Evidence supports the claim: a full source→sink chain is present" + (
            " with a deterministic strong rule." if strong else "."
        )
    else:
        status = FindingStatus.probable
        confidence = 0.55 + (0.1 if chain_ok else 0.0)
        explanation = (
            "The claim is plausible but the evidence is incomplete — no deterministic "
            "chain and no counterexample guard was found."
        )

    return {
        "claim": claim,
        "rule": rule,
        "original_status": finding.status.value,
        "original_confidence": round(finding.confidence, 3),
        "final_status": status.value,
        "confidence": round(confidence, 3),
        "explanation": explanation,
        "checks": checks,
        "supporting_evidence": supporting,
        "contradicting_evidence": contradicting,
        "counterexample": sanitizer_proof,
        "source_nodes": source_nodes[:6],
        "sink_nodes": sink_nodes[:6],
    }
