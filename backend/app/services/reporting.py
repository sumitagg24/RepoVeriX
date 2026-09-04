"""Scan report assembly and rendering.

A report bundles everything needed to understand one audit: repository facts,
severity/status distributions, every finding with its evidence chain, and each
candidate patch with its verification outcomes. Two formats are supported from
one structure: JSON (machine-readable, research-friendly) and Markdown
(human-readable, printable).
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.models import Evidence, Finding, Patch, Repository, Scan, VerificationRun

_SNIPPET_LIMIT = 800


async def build_scan_report(db: AsyncSession, scan_id, user_id) -> dict[str, Any] | None:
    """Assemble the full report dict for a scan owned by ``user_id``."""
    scan_result = await db.execute(
        select(Scan)
        .options(selectinload(Scan.repository))
        .join(Repository)
        .where(Scan.id == scan_id, Repository.owner_id == user_id)
    )
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        return None
    repo: Repository = scan.repository

    findings_result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.patches).selectinload(Patch.verification_runs),
        )
        .where(Finding.scan_id == scan.id)
        .order_by(Finding.severity, Finding.file_path)
    )
    findings = list(findings_result.scalars().all())

    total = len(findings)
    by_severity: dict[str, int] = {}
    by_status: dict[str, int] = {}
    by_category: dict[str, int] = {}
    for f in findings:
        by_severity[f.severity.value] = by_severity.get(f.severity.value, 0) + 1
        by_status[f.status.value] = by_status.get(f.status.value, 0) + 1
        by_category[f.category.value] = by_category.get(f.category.value, 0) + 1

    summary = scan.summary or {}
    repository_meta = summary.get("repository") or {}

    return {
        "generated_at_utc": datetime.now(UTC).isoformat(),
        "scan": {
            "id": str(scan.id),
            "status": scan.status.value,
            "configuration": scan.configuration.value,
            "error": scan.error,
            "created_at": scan.created_at.isoformat() if scan.created_at else None,
            "started_at": scan.started_at.isoformat() if scan.started_at else None,
            "finished_at": scan.finished_at.isoformat() if scan.finished_at else None,
            "llm_token_usage": scan.llm_token_usage,
            "reproducibility": summary.get("reproducibility"),
            "warnings": summary.get("warnings", []),
        },
        "repository": {
            "name": repo.name,
            "source_type": repo.source_type.value,
            "source_url": repo.source_url,
            "default_branch": repo.default_branch,
            "languages": repository_meta.get("languages") or repo.primary_languages,
            "files": repository_meta.get("files"),
            "functions": repository_meta.get("functions"),
            "classes": repository_meta.get("classes"),
            "test_files": repository_meta.get("test_files"),
            "dependencies": repository_meta.get("dependencies"),
        },
        "counts": {
            "total": total,
            "by_severity": by_severity,
            "by_status": by_status,
            "by_category": by_category,
        },
        "findings": [_finding_block(f) for f in findings],
    }


def _finding_block(f: Finding) -> dict[str, Any]:
    return {
        "external_id": f.external_id,
        "title": f.title,
        "severity": f.severity.value,
        "status": f.status.value,
        "confidence": f.confidence,
        "category": f.category.value,
        "source": f.source.value,
        "file_path": f.file_path,
        "function_name": f.function_name,
        "line_start": f.line_start,
        "line_end": f.line_end,
        "description": f.description,
        "impact": f.impact,
        "recommendation": f.recommendation,
        "evidence": [_evidence_block(e) for e in f.evidence],
        "patches": [_patch_block(p) for p in f.patches],
    }


def _evidence_block(e: Evidence) -> dict[str, Any]:
    snippet = (e.snippet or "")[:_SNIPPET_LIMIT]
    return {
        "kind": e.kind.value,
        "description": e.description,
        "file_path": e.file_path,
        "line_start": e.line_start,
        "line_end": e.line_end,
        "snippet": snippet or None,
        "metadata": e.extra,
    }


def _patch_block(p: Patch) -> dict[str, Any]:
    return {
        "id": str(p.id),
        "status": p.status.value,
        "generated_by": p.generated_by,
        "explanation": p.explanation,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "diff": p.diff,
        "verification_runs": [_verification_block(r) for r in p.verification_runs],
    }


def _verification_block(r: VerificationRun) -> dict[str, Any]:
    return {
        "id": str(r.id),
        "status": r.status.value,
        "patch_applied": r.patch_applied,
        "deps_installed": r.deps_installed,
        "tests_passed": r.tests_passed,
        "static_passed": r.static_passed,
        "finding_still_detected": r.finding_still_detected,
        "started_at": r.started_at.isoformat() if r.started_at else None,
        "finished_at": r.finished_at.isoformat() if r.finished_at else None,
        # logs are kept in the API/database; full logs can be huge and belong
        # to the verification-run detail view rather than the report
    }


# --------------------------------------------------------------------------- markdown


def render_markdown(report: dict[str, Any]) -> str:
    repo = report["repository"]
    scan = report["scan"]
    counts = report["counts"]
    out: list[str] = [
        f"# RepoVeriX Audit Report — {repo['name']}",
        "",
        f"Configuration: `{scan['configuration']}`  ·  Scan status: **{scan['status']}**",
        f"Generated (UTC): {report['generated_at_utc']}",
        "",
    ]
    if scan["error"]:
        out += ["> Scan error: " + str(scan["error"]), ""]

    out += ["## Repository", ""]
    out.append("- Languages: " + (", ".join(repo["languages"]) if repo["languages"] else "n/a"))
    for key, label in (
        ("files", "Files"),
        ("functions", "Functions"),
        ("classes", "Classes"),
        ("test_files", "Test files"),
        ("dependencies", "Dependencies"),
    ):
        out.append(f"- {label}: {repo.get(key) if repo.get(key) is not None else 'n/a'}")
    out += ["", "## Findings Summary", ""]
    out.append(f"**Total findings: {counts['total']}**")
    out.append("")
    out.append("| Severity | Count |")
    out.append("|---|---|")
    for sev in ("critical", "high", "medium", "low", "info"):
        out.append(f"| {sev} | {counts['by_severity'].get(sev, 0)} |")
    out += ["", "| Status | Count |", "|---|---|"]
    for st in ("verified", "probable", "rejected"):
        out.append(f"| {st} | {counts['by_status'].get(st, 0)} |")

    for f in report["findings"]:
        out += [
            "",
            f"## {f['title']} (`{f['external_id']}`)",
            "",
            "- Severity: **"
            + f["severity"]
            + "**  ·  Status: `"
            + f["status"]
            + "`  ·  Confidence: "
            + f"{f['confidence']:.2f}",
            f"- Source: `{f['source']}`  ·  Category: {f['category']}",
            f"- Location: `{f['file_path']}`"
            + (f" in `{f['function_name']}`" if f["function_name"] else "")
            + (f" (lines {f['line_start']}–{f['line_end'] or f['line_start']})" if f["line_start"] else ""),
            "",
            f["description"],
        ]
        if f["impact"]:
            out += ["", "**Impact:** " + f["impact"]]
        if f["recommendation"]:
            out += ["", "**Recommendation:** " + f["recommendation"]]
        if f["evidence"]:
            out += ["", "**Evidence chain:**", ""]
            for e in f["evidence"]:
                loc = f"`{e['file_path']}`" if e["file_path"] else ""
                if e["line_start"]:
                    loc += f":{e['line_start']}"
                out.append(f"- *{e['kind'].replace('_', ' ')}* {loc} — {e['description']}")
        for p in f["patches"]:
            runs = p["verification_runs"]
            out += ["", f"**Patch ({p['status']}, by {p['generated_by']})**"]
            if runs:
                latest = runs[0]
                out.append(
                    f"- Verification: `{latest['status']}` — patch applied: {latest['patch_applied']}, "
                    f"tests: {latest['tests_passed']}, static: {latest['static_passed']}, "
                    f"finding still detected: {latest['finding_still_detected']}"
                )
            else:
                out.append("- Verification: not run")
            out += ["", "```diff", p["diff"], "```"]

    out += [
        "",
        "---",
        "",
        "*Report generated by RepoVeriX. Findings are evidence-grounded "
        "candidates; verification statuses reflect isolated execution only.*",
        "",
    ]
    return "\n".join(out)
