"""SARIF 2.1.0 export for scan findings.

Turns persisted findings into the industry-standard Static Analysis Results
Interchange Format so RepoVeriX output drops into GitHub Code Scanning, VS
Code, and any other SARIF consumer. Rule metadata is derived from the finding
rows; snippets come from the repository working copy when available.
"""

from __future__ import annotations

from pathlib import Path

from app.db.models import Finding, Scan

_SEVERITY_LEVEL = {
    "critical": "error",
    "high": "error",
    "medium": "warning",
    "low": "note",
    "info": "note",
}

_SCHEMA = "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-schema-2.1.0.json"


def _rule_id(finding: Finding) -> str:
    if finding.evidence:
        meta = finding.evidence[0].extra or {}
        rule = meta.get("rule") or meta.get("rule_id")
        if rule:
            return str(rule)
    return finding.external_id


def build_sarif(findings: list[Finding], scan: Scan, source_root: Path | None) -> dict:
    """Build a complete SARIF 2.1.0 document for one scan."""
    rules: dict[str, dict] = {}
    results: list[dict] = []

    for finding in findings:
        # REJECTED findings are not active security results — they stay out of
        # the exported SARIF so downstream consumers (e.g. GitHub Code
        # Scanning) never see them as live alerts.
        if finding.status.value == "rejected":
            continue
        rule_id = _rule_id(finding)
        rules.setdefault(
            rule_id,
            {
                "id": rule_id,
                "name": finding.title[:200],
                "shortDescription": {"text": finding.title[:200]},
                "fullDescription": {"text": (finding.description or finding.title)[:2000]},
                "defaultConfiguration": {"level": _SEVERITY_LEVEL.get(finding.severity.value, "warning")},
                "properties": {"category": finding.category.value, "source": finding.source.value},
            },
        )

        location: dict = {
            "physicalLocation": {
                "artifactLocation": {"uri": finding.file_path},
            }
        }
        if finding.line_start:
            region: dict = {"startLine": finding.line_start}
            if finding.line_end and finding.line_end >= finding.line_start:
                region["endLine"] = finding.line_end
            snippet = _snippet(source_root, finding)
            if snippet:
                region["snippet"] = {"text": snippet}
            location["physicalLocation"]["region"] = region

        result: dict = {
            "ruleId": rule_id,
            "level": _SEVERITY_LEVEL.get(finding.severity.value, "warning"),
            "message": {"text": (finding.description or finding.title)[:2000]},
            "locations": [location],
            "fingerprints": {"repoverixFindingKey/v1": finding.external_id},
            "properties": {
                "severity": finding.severity.value,
                "status": finding.status.value,
                "confidence": finding.confidence,
                "category": finding.category.value,
                "externalId": finding.external_id,
            },
        }
        results.append(result)

    return {
        "$schema": _SCHEMA,
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "RepoVeriX",
                        "informationUri": "https://github.com/sumitagg24/RepoVeriX",
                        "version": "0.1.0",
                        "rules": list(rules.values()),
                    }
                },
                "results": results,
                "automationDetails": {
                    "id": f"repoverix/{scan.id}",
                    "description": {"text": f"RepoVeriX scan {scan.id} ({scan.configuration.value})"},
                },
                "columnKind": "utf16CodeUnits",
            }
        ],
    }


def _snippet(source_root: Path | None, finding: Finding) -> str | None:
    if source_root is None:
        return None
    full = source_root / finding.file_path
    try:
        lines = full.read_text(encoding="utf-8", errors="replace").splitlines()
    except OSError:
        return None
    if not finding.line_start or finding.line_start < 1:
        return None
    lo = max(0, finding.line_start - 1)
    hi = min(len(lines), (finding.line_end or finding.line_start) + 2)
    return "\n".join(lines[lo:hi])[:4000]
