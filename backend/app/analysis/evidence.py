"""Candidate → finding assembly and evidence validation.

The pipeline principle: the LLM proposes, evidence and execution verify. This
module is where candidate issues are turned into database findings with an
explicit status:

- VERIFIED   — deterministic repository evidence (source → transform → sink
               chain or a strong self-contained rule) backs the claim
- PROBABLE   — evidence suggests the issue but it cannot be fully established
- REJECTED   — not persisted: ungrounded / contradicted claims are dropped and
               recorded in the stage output for research recall analysis

An LLM verdict can raise confidence or downgrade a candidate, but a positive
verdict alone never upgrades a candidate to VERIFIED unless deterministic
repository evidence already supports it (Section 26 / 63 of the spec).
"""

from __future__ import annotations

import hashlib
from dataclasses import dataclass, field
from typing import Any

from app.analysis.knowledge import KnowledgeGraph
from app.analysis.models import Candidate, EvidenceDraft, ParsedFile, StaticFinding
from app.db.models import (
    EvidenceKind,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Severity,
)

_STRONG_RULES = {
    # deterministic, self-contained chains produced by the built-in detectors
    "RVX-SQLI-001",
    "RVX-SQLI-JS-001",
    "RVX-CMDI-001",
    "RVX-CMDI-JS-001",
    "RVX-SECRET-001",
    "RVX-SECRET-002",
    "RVX-SECRET-JS-001",
    "RVX-EVAL-001",
    "RVX-EVAL-JS-001",
    "RVX-CRYPTO-001",
}

_RULE_TITLES = {
    "RVX-SQLI-001": "Potential SQL Injection",
    "RVX-SQLI-JS-001": "Potential SQL Injection",
    "RVX-CMDI-001": "Potential Command Injection",
    "RVX-CMDI-JS-001": "Potential Command Injection",
    "RVX-SECRET-001": "Hardcoded Secret Detected",
    "RVX-SECRET-002": "Hardcoded Secret Detected (Keyword Argument)",
    "RVX-SECRET-JS-001": "Hardcoded Secret Detected",
    "RVX-EVAL-001": "Unsafe Dynamic Code Execution",
    "RVX-EVAL-JS-001": "Unsafe Dynamic Code Execution",
    "RVX-CRYPTO-001": "Weak Cryptographic Hash",
    "RVX-EXCEPT-001": "Broad Exception Swallows Errors",
}

_RULE_IMPACT = {
    "RVX-SQLI-001": "An attacker-controlled value may be injected into a SQL query, allowing data exfiltration, modification or deletion.",
    "RVX-SQLI-JS-001": "An attacker-controlled value may be injected into a SQL query, allowing data exfiltration, modification or deletion.",
    "RVX-CMDI-001": "An attacker may be able to execute arbitrary operating system commands on the host.",
    "RVX-CMDI-JS-001": "An attacker may be able to execute arbitrary operating system commands on the host.",
    "RVX-SECRET-001": "A credential embedded in source is exposed to anyone with repository access and to any process reading the code.",
    "RVX-SECRET-002": "A credential embedded in source is exposed to anyone with repository access and to any process reading the code.",
    "RVX-SECRET-JS-001": "A credential embedded in source is exposed to anyone with repository access and to any process reading the code.",
    "RVX-EVAL-001": "Dynamic execution of non-constant code can lead to code injection.",
    "RVX-EVAL-JS-001": "Dynamic execution of non-constant code can lead to code injection.",
    "RVX-CRYPTO-001": "The hash function is not cryptographically secure; integrity/confidentiality guarantees are weakened.",
    "RVX-EXCEPT-001": "Errors are silently ignored, hiding failures and making debugging harder.",
}

_RULE_RECOMMENDATION = {
    "RVX-SQLI-001": "Use parameterized queries / prepared statements and never interpolate values into SQL text.",
    "RVX-SQLI-JS-001": "Use parameterized queries / prepared statements and never interpolate values into SQL text.",
    "RVX-CMDI-001": "Avoid shell execution with dynamic content; use argument lists (shell=False) and validate input.",
    "RVX-CMDI-JS-001": "Avoid exec() with dynamic content; pass argument arrays and validate input.",
    "RVX-SECRET-001": "Move the secret to environment variables / a secret manager and rotate the exposed value.",
    "RVX-SECRET-002": "Move the secret to environment variables / a secret manager and rotate the exposed value.",
    "RVX-SECRET-JS-001": "Move the secret to environment variables / a secret manager and rotate the exposed value.",
    "RVX-EVAL-001": "Avoid eval/exec; use safe parsers or explicit dispatch instead.",
    "RVX-EVAL-JS-001": "Avoid eval / new Function; use safe parsers or explicit dispatch instead.",
    "RVX-CRYPTO-001": "Use a keyed, collision-resistant construction (e.g. HMAC-SHA256) for security purposes.",
    "RVX-EXCEPT-001": "Catch specific exceptions and handle or log them instead of swallowing everything.",
}


@dataclass
class FindingSpec:
    """A validated finding ready to persist."""

    external_id: str
    category: FindingCategory
    severity: Severity
    status: FindingStatus
    confidence: float
    title: str
    description: str
    impact: str | None
    recommendation: str | None
    file_path: str
    function_name: str | None
    line_start: int | None
    line_end: int | None
    source: FindingSource
    evidence: list[EvidenceDraft] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)
    match_keys: list[str] = field(default_factory=list)  # deterministic keys for re-analysis


# --------------------------------------------------------------------------- helpers


def _external_id(key: str) -> str:
    return hashlib.sha1(key.encode("utf-8")).hexdigest()[:16]


def dedupe_static_findings(findings: list[StaticFinding]) -> list[StaticFinding]:
    """De-duplicate findings from multiple tools that hit the same spot."""
    seen: dict[str, StaticFinding] = {}
    # prefer built-in detectors (stronger chains) over external tools
    for finding in sorted(findings, key=lambda f: (f.tool != "repoverix-builtin", f.tool)):
        # merge by rule|file|line_start (collapse line_end variants)
        key = f"{finding.rule}|{finding.file_path}|{finding.line_start}"
        if key in seen:
            existing = seen[key]
            if not existing.evidence and finding.evidence:
                existing.evidence = finding.evidence
                existing.message = f"{existing.message} {finding.message}".strip()
            continue
        seen[key] = finding
    return list(seen.values())


def enclosing_function(graph: KnowledgeGraph, file_path: str, line_start: int, line_end: int) -> str | None:
    for ref in graph.function_symbols(file_path):
        if ref.line_start <= line_start and (line_end or line_start) <= ref.line_end:
            return ref.qualified_name.split(":")[-1]
    return None


def candidates_from_static(
    findings: list[StaticFinding],
    graph: KnowledgeGraph,
    parsed_files: dict[str, ParsedFile],
) -> list[Candidate]:
    """Group normalized static findings into pipeline candidates."""
    out: list[Candidate] = []
    for finding in dedupe_static_findings(findings):
        pf = parsed_files.get(finding.file_path)
        if pf is None:
            continue
        func = enclosing_function(graph, finding.file_path, finding.line_start, finding.line_end)
        rule_title = _RULE_TITLES.get(finding.rule, finding.message[:80])
        evidence = list(finding.evidence)
        # if tool evidence was empty, at least record the tool result as evidence
        if not evidence:
            evidence = [
                EvidenceDraft(
                    kind=EvidenceKind.static_analysis,
                    file_path=finding.file_path,
                    line_start=finding.line_start,
                    line_end=finding.line_end,
                    snippet=_slice(pf.source, finding.line_start, finding.line_end),
                    description=f"{finding.tool} rule {finding.rule}: {finding.message[:300]}",
                    extra={"tool": finding.tool, "rule": finding.rule},
                )
            ]
        evidence.sort(key=lambda e: e.order_index)
        # stable ordering: source/transform first, sink later
        kind_rank = {
            EvidenceKind.source_input: 0,
            EvidenceKind.transformation: 1,
            EvidenceKind.call_relationship: 2,
            EvidenceKind.static_analysis: 3,
            EvidenceKind.sink: 4,
            EvidenceKind.llm_reasoning: 5,
        }
        for i, node in enumerate(evidence):
            node.order_index = i
            _ = kind_rank
        out.append(
            Candidate(
                key=finding.key,
                title=rule_title,
                category=finding.category,
                severity=finding.severity,
                file_path=finding.file_path,
                line_start=finding.line_start,
                line_end=finding.line_end,
                function_name=func,
                description=finding.message,
                static_findings=[finding],
                evidence=evidence,
                base_confidence=finding.confidence,
                source="static",
            )
        )
    return out


def candidates_from_llm_claims(
    claims: list[dict[str, Any]],
    graph: KnowledgeGraph,
    parsed_files: dict[str, ParsedFile],
) -> list[Candidate]:
    """Ground raw LLM review claims and build candidates (source = llm)."""
    out: list[Candidate] = []
    for claim in claims:
        file_path = (claim.get("file_path") or "").strip()
        line_start = int(claim.get("line_start") or 0)
        line_end = int(claim.get("line_end") or line_start)
        pf = parsed_files.get(file_path)
        if pf is None:
            continue
        line_count = len(pf.source.splitlines())
        grounded = 1 <= line_start <= line_count and 1 <= line_end <= line_count and line_end >= line_start
        if not grounded:
            continue
        func = enclosing_function(graph, file_path, line_start, line_end)
        try:
            category = FindingCategory(claim.get("category", "logic"))
            severity = Severity(claim.get("severity", "medium"))
        except ValueError:
            category, severity = FindingCategory.logic, Severity.medium
        evidence = [
            EvidenceDraft(
                kind=EvidenceKind.llm_reasoning,
                file_path=file_path,
                line_start=line_start,
                line_end=line_end,
                snippet=_slice(pf.source, line_start, line_end),
                description=(claim.get("reasoning") or claim.get("claim") or "")[:500],
                extra={"model_confidence": float(claim.get("confidence") or 0.0)},
            )
        ]
        out.append(
            Candidate(
                key=f"llm|{file_path}|{line_start}|{line_end}|{claim.get('title', '')[:40]}",
                title=claim.get("title") or "LLM-identified issue",
                category=category,
                severity=severity,
                file_path=file_path,
                line_start=line_start,
                line_end=line_end,
                function_name=func,
                description=claim.get("claim") or (claim.get("reasoning") or "")[:400],
                static_findings=[],
                evidence=evidence,
                llm_assessment={
                    "verdict": "confirmed",
                    "confidence": float(claim.get("confidence") or 0.0),
                    "reasoning": claim.get("reasoning", ""),
                },
                base_confidence=float(claim.get("confidence") or 0.4) * 0.6,
                source="llm",
            )
        )
    return out


def _slice(source: str, start: int, end: int | None = None) -> str:
    lines = source.splitlines()
    end = min(end or start, len(lines))
    if start < 1:
        start = 1
    return "\n".join(lines[start - 1 : end])


# --------------------------------------------------------------------------- validation


_SEVERITY_ORDER = {sev: i for i, sev in enumerate(Severity)}


def finalize_candidate(
    candidate: Candidate,
    llm_assessment: dict[str, Any] | None,
    *,
    llm_used: bool,
    config_name: str,
) -> FindingSpec | None:
    """Apply evidence validation and produce a FindingSpec (or drop the candidate)."""
    direct_chain = any(e.kind != EvidenceKind.llm_reasoning for e in candidate.evidence)
    strong_rule = any(f.rule in _STRONG_RULES for f in candidate.static_findings)
    deterministic = direct_chain and strong_rule

    static_finding = candidate.static_findings[0] if candidate.static_findings else None
    source_label = candidate.source

    if candidate.source == "llm":
        return _finalize_llm_only(candidate, config_name)

    base_conf = candidate.base_confidence
    llm_conf: float | None = None
    verdict: str | None = None
    reasoning = ""
    assumptions: list[str] = []
    if llm_assessment:
        verdict = str(llm_assessment.get("verdict") or "probable")
        try:
            llm_conf = float(llm_assessment.get("confidence") or 0.0)
        except (TypeError, ValueError):
            llm_conf = 0.0
        reasoning = str(llm_assessment.get("reasoning") or "")
        assumptions = llm_assessment.get("assumptions") or []
        if not isinstance(assumptions, list):
            assumptions = []

    # decide status
    status: FindingStatus
    if not llm_used:
        # static-only configuration: deterministic built-in rules are verified;
        # external tool hits stay probable (rules are heuristic)
        status = FindingStatus.verified if (deterministic or strong_rule) else FindingStatus.probable
    else:
        verdict = verdict or "probable"
        if verdict == "confirmed":
            status = (
                FindingStatus.verified if (deterministic or candidate.grounded) else FindingStatus.probable
            )
            if not deterministic and candidate.source == "static":
                # LLM confirmed + static anchor, but no deterministic chain
                status = FindingStatus.probable if candidate.base_confidence < 0.7 else status
        elif verdict == "probable":
            status = FindingStatus.probable
        elif verdict == "insufficient_evidence":
            if not deterministic:
                return None
            status = FindingStatus.probable
        elif verdict == "false_positive":
            if not deterministic:
                return None
            status = FindingStatus.probable
            base_conf *= 0.5
        else:
            status = FindingStatus.probable

    # confidence blending (system confidence score, not calibrated probability)
    confidence = base_conf
    if llm_used and llm_conf is not None:
        deterministic_bonus = 0.08 if deterministic else 0.0
        if verdict == "confirmed":
            confidence = 0.55 * base_conf + 0.45 * llm_conf + deterministic_bonus
        elif verdict == "probable":
            confidence = 0.6 * base_conf + 0.4 * llm_conf
        else:
            confidence = base_conf * (0.5 if verdict == "false_positive" else 0.85)
    confidence = max(0.0, min(1.0, round(confidence, 3)))

    # severity: deterministic rules are the floor; LLM may only raise
    severity = candidate.severity
    if llm_assessment:
        try:
            llm_sev = Severity(llm_assessment.get("severity") or candidate.severity.value)
            if _SEVERITY_ORDER[llm_sev] > _SEVERITY_ORDER[severity]:
                severity = llm_sev
        except ValueError:
            pass

    # assemble description + evidence (LLM node appended)
    description_parts = [candidate.description.strip()]
    if reasoning:
        description_parts.append(f"\n\nLLM reasoning: {reasoning[:800]}")
    if assumptions:
        description_parts.append(
            "\n\nAssumptions made by the model: " + "; ".join(str(a)[:200] for a in assumptions[:5])
        )
    description = "".join(description_parts)

    evidence = list(candidate.evidence)
    if llm_assessment:
        evidence.append(
            EvidenceDraft(
                kind=EvidenceKind.llm_reasoning,
                description=f"LLM assessment: verdict={verdict}, confidence={llm_conf or 0.0:.2f}",
                file_path=candidate.file_path,
                line_start=candidate.line_start,
                line_end=candidate.line_end,
                snippet=None,
                extra={
                    "verdict": verdict,
                    "model_confidence": llm_conf,
                    "model": llm_assessment.get("model"),
                },
            )
        )
    evidence.sort(key=lambda e: e.order_index)
    for i, node in enumerate(evidence):
        node.order_index = i

    rule = static_finding.rule if static_finding else "unknown"
    # attach the rule id to the first evidence node so downstream consumers
    # (SARIF ruleId, generated-test contracts, dedup member rules) can read it
    if evidence and not any((n.extra or {}).get("rule") for n in evidence):
        first = evidence[0]
        first.extra = dict(first.extra or {})
        first.extra["rule"] = rule

    external_id = _external_id(f"{rule}|{candidate.file_path}|{candidate.line_start}")

    spec = FindingSpec(
        external_id=external_id,
        category=candidate.category,
        severity=severity,
        status=status,
        confidence=confidence,
        title=_RULE_TITLES.get(rule) or candidate.title,
        description=description,
        impact=_RULE_IMPACT.get(rule),
        recommendation=_RULE_RECOMMENDATION.get(rule),
        file_path=candidate.file_path,
        function_name=candidate.function_name,
        line_start=candidate.line_start,
        line_end=candidate.line_end,
        source=FindingSource.static if source_label == "static" else FindingSource.hybrid,
        evidence=evidence,
        extra={
            "rule": rule,
            "tool": static_finding.tool if static_finding else None,
            "configuration": config_name,
            "verdict": verdict,
        },
        match_keys=[candidate.key],
    )
    return spec


def _finalize_llm_only(candidate: Candidate, config_name: str) -> FindingSpec | None:
    """LLM-only findings can never reach VERIFIED without execution evidence."""
    verdict = str((candidate.llm_assessment or {}).get("verdict") or "probable")
    llm_conf = float((candidate.llm_assessment or {}).get("confidence") or 0.0)
    reasoning = str((candidate.llm_assessment or {}).get("reasoning") or "")
    if verdict == "confirmed" and candidate.grounded:
        status = FindingStatus.probable  # code-grounded only; no execution evidence
        confidence = min(0.65, 0.4 + 0.4 * llm_conf)
    else:
        status = FindingStatus.probable
        confidence = min(0.5, 0.35 + 0.3 * llm_conf)
    if confidence <= 0.35:
        return None

    evidence = list(candidate.evidence)
    for i, node in enumerate(evidence):
        node.order_index = i
    description = (candidate.description or "").strip()
    if reasoning:
        description += f"\n\nLLM reasoning: {reasoning[:800]}"
    external_id = _external_id(f"llm|{candidate.file_path}|{candidate.line_start}|{candidate.title[:20]}")
    return FindingSpec(
        external_id=external_id,
        category=candidate.category,
        severity=candidate.severity,
        status=status,
        confidence=round(confidence, 3),
        title=candidate.title,
        description=description,
        impact=None,
        recommendation=None,
        file_path=candidate.file_path,
        function_name=candidate.function_name,
        line_start=candidate.line_start,
        line_end=candidate.line_end,
        source=FindingSource.llm,
        evidence=evidence,
        extra={"configuration": config_name, "verdict": verdict, "source": "llm_only"},
        match_keys=[candidate.key],
    )
