"""Defect-level metrics for RepoVeriX-Bench experiments.

Findings (what the system reported) are matched against a ground-truth defect
list (what the benchmark seeded). Every ground-truth defect maps to at most one
reported finding; reported findings that match no defect count as false
positives. Metrics follow the standard definitions:

    precision        = TP / (TP + FP)      (reported findings that are real)
    recall           = TP / (TP + FN)      (real defects that were reported)
    F1               = 2PR / (P + R)
    false_positive_rate = FP / (TP + FP)

Ratios are reported as ``None`` when their denominator is zero (no data yet);
callers decide how to render that (e.g. "TBD" until real runs exist). Numbers
are computed only from actual runs — nothing here is fabricated.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

_DEFAULT_LINE_TOLERANCE = 6


@dataclass
class FindingHit:
    """One reported finding that matched a ground-truth defect."""

    finding_index: int
    defect_index: int


def finding_rule(finding: dict[str, Any]) -> str:
    """Recover the detector rule for a reported finding (dict form).

    Mirrors ``app.analysis.repair.finding_rule`` for DB rows: rule metadata on
    evidence, otherwise a title lookup.
    """
    _RULE_BY_TITLE = {
        "Potential SQL Injection": "RVX-SQLI-001",
        "Potential Command Injection": "RVX-CMDI-001",
        "Hardcoded Secret Detected": "RVX-SECRET-001",
        "Unsafe Dynamic Code Execution": "RVX-EVAL-001",
        "Weak Cryptographic Hash": "RVX-CRYPTO-001",
    }
    import re

    for ev in finding.get("evidence") or []:
        extra = ev.get("extra") or ev.get("metadata") or {}
        if extra.get("rule"):
            return str(extra["rule"])
        description = str(ev.get("description") or "")
        m = re.search(r"rule\s+(RVX-[A-Z0-9-]+|S\d+|B\d+)", description)
        if m:
            return m.group(1)
    return _RULE_BY_TITLE.get(str(finding.get("title") or ""), "unknown")


def _rule_family(code: str) -> str:
    """Normalize a rule code for comparison (language variants compare equal).

    ``RVX-SQLI-JS-001`` and ``RVX-SQLI-001`` are the same rule family for the
    JavaScript and Python detectors; the ``-JS``/``-TS`` marker only records
    which language grammar produced the finding.
    """
    for marker in ("-JS", "-TS"):
        code = code.replace(marker, "")
    return code


def match_findings(
    findings: list[dict[str, Any]],
    defects: list[dict[str, Any]],
    *,
    line_tolerance: int = _DEFAULT_LINE_TOLERANCE,
) -> tuple[list[FindingHit], list[int]]:
    """Greedily match findings to defects; returns (hits, unmatched_finding_indices).

    A finding matches a defect when the file matches and either the enclosing
    function matches, the reported line is within ``line_tolerance`` of the
    defect line, or both locations are unknown. ``rule`` equality (after
    language-variant normalization) is required when the defect declares a rule
    the finding can resolve.
    """
    hits: list[FindingHit] = []
    used_findings: set[int] = set()

    for defect_index, defect in enumerate(defects):
        expected_rule = defect.get("rule")
        for f_index, finding in enumerate(findings):
            if f_index in used_findings:
                continue
            if str(finding.get("file_path")) != str(defect.get("file_path")):
                continue
            if expected_rule:
                actual = finding_rule(finding)
                if actual != "unknown" and _rule_family(actual) != _rule_family(str(expected_rule)):
                    continue

            d_fn = defect.get("function_name")
            f_fn = finding.get("function_name")
            d_line = defect.get("line_start")
            f_line = finding.get("line_start")
            fn_both = bool(d_fn and f_fn)
            ln_both = bool(d_line and f_line)
            fn_match = fn_both and str(f_fn) == str(d_fn)
            ln_match = ln_both and abs(int(f_line) - int(d_line)) <= line_tolerance

            if fn_both:
                location_ok = fn_match or ln_match
            elif ln_both:
                location_ok = ln_match
            elif not (d_fn or f_fn or d_line or f_line):
                location_ok = True  # no locator on either side: nothing contradicts
            else:
                location_ok = False  # one side located, the other not: ambiguous
            if not location_ok:
                continue
            hits.append(FindingHit(finding_index=f_index, defect_index=defect_index))
            used_findings.add(f_index)
            break

    unmatched = [i for i in range(len(findings)) if i not in used_findings]
    return hits, unmatched


def compute_metrics(
    findings: list[dict[str, Any]],
    defects: list[dict[str, Any]],
    *,
    line_tolerance: int = _DEFAULT_LINE_TOLERANCE,
) -> dict[str, Any]:
    """Compute the standard detection metrics for one experiment run."""
    hits, unmatched = match_findings(findings, defects, line_tolerance=line_tolerance)
    tp = len(hits)
    fp = len(unmatched)
    fn = len(defects) - tp

    def _ratio(num: int, den: int) -> float | None:
        if den <= 0:
            return None
        return round(num / den, 4)

    precision = _ratio(tp, tp + fp)
    recall = _ratio(tp, tp + fn)
    f1 = None
    if precision is not None and recall is not None and (precision + recall) > 0:
        f1 = round(2 * precision * recall / (precision + recall), 4)
    fpr = _ratio(fp, tp + fp)

    return {
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "false_positive_rate": fpr,
        "reported_findings": len(findings),
        "ground_truth_defects": len(defects),
        "matched": [{"finding": h.finding_index, "defect": h.defect_index} for h in hits],
        "unmatched_findings": unmatched,
    }


def load_ground_truth(path) -> list[dict[str, Any]]:
    """Load a ground-truth defect list from a JSON file."""
    import json

    with open(path, encoding="utf-8") as fh:
        payload = json.load(fh)
    if isinstance(payload, dict):
        payload = payload.get("defects", [])
    return payload
