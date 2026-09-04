"""Audit & intelligence-graph routes (Tier-1 research features).

- ``POST /repositories/{id}/change-audit``   change impact + risk (diff, refs, commit)
- ``GET  /repositories/{id}/change-audits``  stored change-impact results
- ``GET  /repositories/{id}/change-audits/{audit_id}``  one stored result
- ``GET  /repositories/{id}/evidence-graph`` aggregate findings + evidence chains
- ``GET  /repositories/{id}/attack-paths``   untrusted source -> sink paths
- ``GET  /repositories/{id}/dependency-reachability``  which deps the code actually imports
- ``GET  /repositories/{id}/regression``     scan-to-scan new/resolved/reintroduced
- ``GET  /scans/{id}/dedup``                 duplicate-finding clusters
"""

from __future__ import annotations

import json
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analysis import attackpaths, changeexplain, changes, depreach, regression
from app.analysis.ingest import source_dir
from app.analysis.intel import _language_of
from app.analysis.llm import build_llm_provider, complete_json, load_prompt
from app.analysis.models import AnalysisError, LLMUsage
from app.analysis.parsing import is_supported, parse_source
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    ChangeAudit,
    Finding,
    Repository,
    RepositoryInsight,
    Scan,
    ScanStatus,
)

router = APIRouter(prefix="/repositories", tags=["audit"])


class ChangeAuditRequest(BaseModel):
    base: str | None = Field(default=None, max_length=200)
    head: str | None = Field(default=None, max_length=200)
    diff: str | None = Field(default=None, max_length=2_000_000)
    # Analyze a single commit: base is derived as ``commit~1``.
    commit: str | None = Field(default=None, max_length=200)


async def _load_repository(repository_id: uuid.UUID, db: AsyncSession, user) -> Repository:
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.owner_id == user.id,
        )
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repository


def _working_copy(repository: Repository) -> Path:
    if repository.storage_path and Path(repository.storage_path).exists():
        return Path(repository.storage_path)
    src = source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository has not been ingested yet — run a scan first",
        )
    return src


def _parse_working_copy(src: Path) -> dict:
    """Parse source files of the working copy (bounded, independent of scans)."""
    from app.analysis.discovery import walk_repo_files

    settings = get_settings()
    parsed: dict = {}
    files_raw, _ = walk_repo_files(src)
    for full in files_raw[: settings.intel_max_files]:
        lang = _language_of(full)
        if lang is None or not is_supported(lang):
            continue
        rel = full.relative_to(src).as_posix()
        try:
            parsed[rel] = parse_source(full.read_text(encoding="utf-8", errors="replace"), lang, rel)
        except Exception:
            continue
    return parsed


# --------------------------------------------------------------------------- change audit


@router.post("/{repository_id}/change-audit")
async def change_audit(
    repository_id: uuid.UUID,
    payload: ChangeAuditRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Audit a change: PR-style review over refs or a raw unified diff."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "change_audit"))
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)

    if payload.diff:
        mode = "diff"
        base = head = None
        try:
            hunks = changes.parse_unified_diff(payload.diff)
        except Exception as exc:  # pragma: no cover
            raise HTTPException(status_code=422, detail=f"Could not parse diff: {exc}") from exc
        if not hunks:
            raise HTTPException(status_code=422, detail="Diff contains no file changes")
    else:
        if payload.commit:
            mode = "commit"
            base, head = f"{payload.commit}~1", payload.commit
        elif payload.base and payload.head:
            mode = "refs"
            base, head = payload.base, payload.head
        else:
            raise HTTPException(
                status_code=422,
                detail="Provide base+head refs, a single commit, or a raw unified diff",
            )
        try:
            hunks, _raw = await changes.git_diff(src, base, head)
        except ValueError as exc:
            raise HTTPException(
                status_code=422,
                detail=f"git diff failed: {exc}",
            ) from exc
        if not hunks:
            raise HTTPException(status_code=422, detail="No differences between the refs")

    parsed = _parse_working_copy(src)

    # risk scoring uses the cached health index when available
    health_by_file: dict[str, float] | None = None
    insight_result = await db.execute(
        select(RepositoryInsight).where(
            RepositoryInsight.repository_id == repository.id,
            RepositoryInsight.status == "ready",
        )
    )
    insight = insight_result.scalar_one_or_none()
    if insight is not None and insight.health:
        health_by_file = {
            f["path"]: float(f["score"]) for f in (insight.health.get("files") or [])
        }

    audit = await changes.analyze_change(
        src,
        parsed,
        hunks,
        health_by_file=health_by_file,
    )
    audit["mode"] = mode
    audit["base"] = base
    audit["head"] = head

    row = ChangeAudit(
        repository_id=repository.id,
        mode=mode,
        base=base,
        head=head,
        risk_score=float(audit["risk_score"]),
        payload=audit,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    audit["audit_id"] = str(row.id)
    return audit


@router.get("/{repository_id}/change-audits")
async def change_audits_list(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Stored change-impact results for a repository (most recent first)."""
    repository = await _load_repository(repository_id, db, current_user)
    result = await db.execute(
        select(ChangeAudit)
        .where(ChangeAudit.repository_id == repository.id)
        .order_by(ChangeAudit.created_at.desc())
        .limit(100)
    )
    return [
        {
            "id": str(a.id),
            "mode": a.mode,
            "base": a.base,
            "head": a.head,
            "risk_score": a.risk_score,
            "risk_level": (a.payload or {}).get("risk_level"),
            "changed_file_count": len((a.payload or {}).get("changed_files", [])),
            "created_at": a.created_at.isoformat(),
        }
        for a in result.scalars().all()
    ]


@router.get("/{repository_id}/change-audits/{audit_id}")
async def change_audit_detail(
    repository_id: uuid.UUID,
    audit_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retrieve one stored change-impact result (full payload)."""
    repository = await _load_repository(repository_id, db, current_user)
    result = await db.execute(
        select(ChangeAudit).where(
            ChangeAudit.id == audit_id,
            ChangeAudit.repository_id == repository.id,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Change audit not found")
    payload = row.payload or {}
    payload["audit_id"] = str(row.id)
    return payload


# --------------------------------------------------------------------------- change explanation


@router.post("/{repository_id}/explain-change")
async def explain_change(
    repository_id: uuid.UUID,
    payload: ChangeAuditRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Human-readable explanation of a change (diff or refs).

    Deterministic narrative from the change audit; an LLM prose paragraph is
    appended when a provider is configured.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "change_audit"))
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)

    if payload.diff:
        hunks = changes.parse_unified_diff(payload.diff)
        if not hunks:
            raise HTTPException(status_code=422, detail="Diff contains no file changes")
        mode, base, head = "diff", None, None
    else:
        if payload.commit:
            mode, base, head = "commit", f"{payload.commit}~1", payload.commit
        elif payload.base and payload.head:
            mode, base, head = "refs", payload.base, payload.head
        else:
            raise HTTPException(
                status_code=422,
                detail="Provide base+head refs, a single commit, or a raw unified diff",
            )
        try:
            hunks, _raw = await changes.git_diff(src, base, head)
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=f"git diff failed: {exc}") from exc
        if not hunks:
            raise HTTPException(status_code=422, detail="No differences between the refs")

    parsed = _parse_working_copy(src)
    audit = await changes.analyze_change(src, parsed, hunks)
    audit["mode"] = mode
    explanation = changeexplain.build_explanation(audit)

    provider = build_llm_provider(get_settings())
    if provider is not None:
        try:
            system = load_prompt("system_security")
            template = load_prompt("change_explanation")
            usage = LLMUsage()
            data = await complete_json(
                provider,
                system,
                template.format(
                    audit=json.dumps(audit, default=str)[:20000],
                    question="Explain this change",
                ),
                usage,
            )
        except AnalysisError:
            data = {}
        if data.get("explanation"):
            explanation["llm_narrative"] = data["explanation"]
            explanation["model"] = getattr(provider, "model", None)

    return explanation


# --------------------------------------------------------------------------- evidence graph


@router.get("/{repository_id}/evidence-graph")
async def evidence_graph(
    repository_id: uuid.UUID,
    scan_id: uuid.UUID | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Aggregate the latest scan's findings + evidence chains as a graph."""
    repository = await _load_repository(repository_id, db, current_user)

    if scan_id is not None:
        scan_result = await db.execute(
            select(Scan).where(Scan.id == scan_id, Scan.repository_id == repository.id)
        )
        scan = scan_result.scalar_one_or_none()
        if scan is None:
            raise HTTPException(status_code=404, detail="Scan not found")
    else:
        scan_result = await db.execute(
            select(Scan)
            .where(
                Scan.repository_id == repository.id,
                Scan.status == ScanStatus.completed,
            )
            .order_by(Scan.created_at.desc())
            .limit(1)
        )
        scan = scan_result.scalar_one_or_none()
        if scan is None:
            raise HTTPException(
                status_code=409,
                detail="No completed scan yet — run a scan first",
            )

    findings_result = await db.execute(
        select(Finding)
        .options(selectinload(Finding.evidence))
        .where(Finding.scan_id == scan.id)
        .order_by(Finding.created_at.asc())
    )
    findings = list(findings_result.scalars().all())

    nodes: list[dict] = []
    edges: list[dict] = []
    node_ids: set[str] = set()

    def node(nid: str, kind: str, label: str, **extra) -> None:
        if nid in node_ids:
            return
        node_ids.add(nid)
        nodes.append({"id": nid, "kind": kind, "label": label[:120], **extra})

    def edge(src: str, dst: str, kind: str = "relates") -> None:
        if src in node_ids and dst in node_ids:
            edges.append({"from": src, "to": dst, "kind": kind})

    for finding in findings[:120]:
        fnode = f"finding:{finding.id}"
        node(
            fnode,
            "finding",
            finding.title,
            file=finding.file_path,
            line=finding.line_start,
            severity=finding.severity.value,
            status=finding.status.value,
        )
        previous = None
        for ev in finding.evidence:
            enode = f"evidence:{ev.id}"
            node(
                enode,
                "evidence",
                ev.description[:100] or ev.kind.value,
                subkind=ev.kind.value,
                file=ev.file_path,
                line=ev.line_start,
            )
            edge(fnode, enode, "has_evidence")
            if ev.file_path:
                ffile = f"file:{ev.file_path}"
                node(ffile, "file", ev.file_path)
                edge(enode, ffile, "in_file")
            if previous:
                edge(previous, enode, "flows")
            previous = enode

    return {
        "scan_id": str(scan.id),
        "configuration": scan.configuration.value,
        "finding_count": len(findings),
        "nodes": nodes[:400],
        "edges": edges[:800],
    }


# --------------------------------------------------------------------------- attack paths


@router.get("/{repository_id}/attack-paths")
async def attack_paths(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Find untrusted-input -> sink paths through the call graph."""
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)
    parsed = _parse_working_copy(src)
    from app.analysis.knowledge import KnowledgeGraph

    graph = KnowledgeGraph(list(parsed.values()))
    return attackpaths.find_attack_paths(graph, parsed)


# --------------------------------------------------------------------------- dependency reachability


@router.get("/{repository_id}/dependency-reachability")
async def dependency_reachability(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Which declared dependencies the code actually imports (triage dead weight)."""
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)
    parsed = _parse_working_copy(src)

    # vulnerability info from the latest completed scan's Dependency rows
    vuln_counts: dict[str, int] = {}
    vuln_details: dict[str, list[dict]] = {}
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repository.id, Scan.status == ScanStatus.completed)
        .order_by(Scan.created_at.desc())
        .limit(1)
    )
    scan = scan_result.scalar_one_or_none()
    if scan is not None:
        from app.db.models import Dependency

        dep_result = await db.execute(select(Dependency).where(Dependency.scan_id == scan.id))
        for dep in dep_result.scalars().all():
            info = dep.vulnerability_info or {}
            if not isinstance(info, dict):
                continue
            key = dep.name.lower().replace("_", "-").replace(".", "-")
            count = info.get("count") if isinstance(info.get("count"), int) else None
            raw_details = info.get("details") or info.get("vulnerabilities")
            details = [d for d in (raw_details or []) if isinstance(d, dict)]
            if isinstance(count, int) and count > 0:
                vuln_counts[key] = count
            if details:
                vuln_details.setdefault(key, []).extend(
                    {
                        "id": d.get("id"),
                        "cvss": d.get("cvss"),
                        "summary": d.get("summary") or d.get("description"),
                        "affected": d.get("affected") or d.get("vulnerable_version"),
                    }
                    for d in details
                )

    return depreach.analyze_reachability(
        src,
        parsed,
        vulnerability_counts=vuln_counts,
        vulnerability_details=vuln_details,
    )


# --------------------------------------------------------------------------- regression


@router.get("/{repository_id}/regression")
async def regression_report(
    repository_id: uuid.UUID,
    from_scan: uuid.UUID | None = Query(default=None, alias="from"),
    to_scan: uuid.UUID | None = Query(default=None, alias="to"),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Compare two scans of the same repository (default: the latest two)."""
    repository = await _load_repository(repository_id, db, current_user)

    scans_result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repository.id, Scan.status == ScanStatus.completed)
        .order_by(Scan.created_at.desc())
    )
    scans = list(scans_result.scalars().all())
    if len(scans) < 2:
        raise HTTPException(
            status_code=409,
            detail="Need at least two completed scans to compare",
        )

    def pick(scan_id: uuid.UUID | None) -> Scan | None:
        if scan_id is None:
            return None
        return next((s for s in scans if s.id == scan_id), None)

    before = pick(from_scan) or scans[1]
    after = pick(to_scan) or scans[0]
    earlier = scans[2] if len(scans) > 2 else None

    async def findings_of(scan: Scan) -> list[Finding]:
        result = await db.execute(
            select(Finding).options(selectinload(Finding.evidence)).where(Finding.scan_id == scan.id)
        )
        return list(result.scalars().all())

    before_f, after_f = await findings_of(before), await findings_of(after)
    earlier_f = await findings_of(earlier) if earlier else None

    report = regression.compare_scans(before_f, after_f, earlier=earlier_f)
    report["from_scan"] = str(before.id)
    report["to_scan"] = str(after.id)
    report["from_scan_created"] = before.created_at.isoformat()
    report["to_scan_created"] = after.created_at.isoformat()
    report["previous_scan"] = str(earlier.id) if earlier else None

    # new + reintroduced findings resolved to full objects for the UI
    all_findings = after_f
    by_id = {f.external_id: f for f in all_findings}
    report["new_findings"] = [
        {
            "external_id": key,
            "title": by_id[key].title,
            "file_path": by_id[key].file_path,
            "severity": by_id[key].severity.value,
            "status": by_id[key].status.value,
            "confidence": by_id[key].confidence,
        }
        for key in report["new"]
        if key in by_id
    ]
    report["reintroduced_findings"] = [
        {
            "external_id": key,
            "title": by_id[key].title,
            "file_path": by_id[key].file_path,
            "severity": by_id[key].severity.value,
        }
        for key in report["reintroduced"]
        if key in by_id
    ]
    return report