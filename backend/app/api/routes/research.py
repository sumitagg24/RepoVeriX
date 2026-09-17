"""Tier-3 research routes: multi-agent analysis, self-improving selection,
cross-repository learning, historical vulnerability mining, predictive risk.

All five features run deterministically over evidence that already exists in
the index, git history and scan database — no LLM required — matching the
project's research identity: computed evidence, not vibes.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analysis import agents, archsmells, crosslearn, depreach, intel, riskmodel, ruleselection, vulnmining
from app.analysis.ingest import source_dir
from app.analysis.intel import _language_of
from app.analysis.parsing import is_supported, parse_source
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    Finding,
    FindingFeedback,
    FindingStatus,
    Patch,
    Repository,
    RepositoryInsight,
    Scan,
    ScanStatus,
    VerificationStatus,
)

router = APIRouter(prefix="/repositories", tags=["research"])
learning_router = APIRouter(prefix="/learning", tags=["research"])

_CACHE_TTL = timedelta(hours=6)


# --------------------------------------------------------------------------- shared


async def _load_repository(repository_id: uuid.UUID, db: AsyncSession, user) -> Repository:
    result = await db.execute(
        select(Repository).where(Repository.id == repository_id, Repository.owner_id == user.id)
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
    settings = get_settings()
    parsed: dict = {}
    files_raw, _ = __import__("app.analysis.discovery", fromlist=["walk_repo_files"]).walk_repo_files(src)
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


async def _latest_completed_scan(db: AsyncSession, repository_id: uuid.UUID) -> Scan | None:
    result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repository_id, Scan.status == ScanStatus.completed)
        .order_by(Scan.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


def _rule_of(finding: Any) -> str:
    for ev in finding.evidence:
        rule = (ev.extra or {}).get("rule")
        if rule:
            return str(rule)
    return finding.external_id


async def _findings_for_scan(db: AsyncSession, scan_id: uuid.UUID, limit: int = 300) -> list[Finding]:
    result = await db.execute(
        select(Finding)
        .options(selectinload(Finding.evidence))
        .where(Finding.scan_id == scan_id)
        .order_by(Finding.severity.desc(), Finding.confidence.desc())
        .limit(limit)
    )
    return list(result.scalars().all())


def _finding_dict(f: Finding) -> dict[str, Any]:
    return {
        "external_id": f.external_id,
        "rule": _rule_of(f),
        "category": f.category.value if f.category else "unknown",
        "severity": f.severity.value if f.severity else "unknown",
        "status": f.status.value if f.status else "unknown",
        "confidence": f.confidence,
        "title": f.title,
        "file_path": f.file_path,
        "function_name": f.function_name,
        "line_start": f.line_start,
        "line_end": f.line_end,
    }


async def _insight_bundle(db: AsyncSession, repository: Repository) -> dict[str, Any]:
    result = await db.execute(
        select(RepositoryInsight).where(RepositoryInsight.repository_id == repository.id)
    )
    insight = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if insight is not None and insight.status == "ready" and insight.health:
        return {
            "health": insight.health or {},
            "git": insight.git or {},
            "wiki": insight.wiki or {},
            "architecture": insight.architecture or {},
        }
    src = _working_copy(repository)
    bundle = await intel.compute_intelligence(src)
    if insight is None:
        insight = RepositoryInsight(repository_id=repository.id)
        db.add(insight)
    insight.status = "ready"
    insight.generated_at = now
    insight.health = bundle["health"]
    insight.git = bundle["git"]
    insight.wiki = bundle["wiki"]
    insight.architecture = bundle["architecture"]
    await db.commit()
    return bundle


# --------------------------------------------------------------------------- 18. multi-agent


@router.get("/{repository_id}/multi-agent")
async def multi_agent_analysis(
    repository_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "multi_agent"))
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "research-llm")
    repository = await _load_repository(repository_id, db, current_user)
    bundle = await _insight_bundle(db, repository)

    scan = await _latest_completed_scan(db, repository.id)
    findings = await _findings_for_scan(db, scan.id) if scan else []
    finding_dicts = [_finding_dict(f) for f in findings]

    parsed = _parse_working_copy(_working_copy(repository))
    smells = archsmells.detect_smells(parsed)
    deps = depreach.analyze_reachability(_working_copy(repository), parsed)

    health = bundle["health"]
    git = bundle["git"]
    flagged_by_quality = [w for w in (health.get("worst_files") or [])]
    flagged_by_churn = [
        f["path"]
        for f in (git.get("files") or [])
        if f.get("hotspot_score", 0) >= 4 or f.get("bus_factor", 2) <= 1.2
    ][:10]

    result = agents.run_multi_agent(
        findings=finding_dicts,
        health=health,
        git=git,
        smells=smells,
        deps=deps,
        flagged_by_quality=flagged_by_quality,
        flagged_by_churn=flagged_by_churn,
    )
    result["repository_id"] = str(repository.id)
    return result


# --------------------------------------------------------------------------- 19. self-improvement


@router.get("/{repository_id}/self-improvement")
async def self_improvement(
    repository_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "self_improvement"))
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "research-llm")
    repository = await _load_repository(repository_id, db, current_user)

    scans_result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repository.id, Scan.status == ScanStatus.completed)
        .order_by(Scan.created_at.asc())
    )
    scans = list(scans_result.scalars().all())

    scan_results: list[dict[str, Any]] = []
    patch_results: list[dict[str, Any]] = []
    for scan in scans:
        findings = await _findings_for_scan(db, scan.id)
        for f in findings:
            scan_results.append(
                {
                    "rule": _rule_of(f),
                    "status": f.status.value if f.status else "unknown",
                    "severity": f.severity.value if f.severity else "unknown",
                }
            )
        patch_q = await db.execute(
            select(Patch, Finding)
            .join(Finding)
            .where(Finding.scan_id == scan.id)
            .options(selectinload(Patch.verification_runs))
        )
        for patch, finding in patch_q.all():
            repairs = sum(
                1 for r in patch.verification_runs if r.status == VerificationStatus.verified_repair
            )
            patch_results.append({"rule": _rule_of(finding), "patch_count": 1, "verified_repairs": repairs})

    # Human false-positive feedback per rule (the user-grounded signal).
    # Rule attribution happens in Python (evidence JSON), grouping in SQL.
    feedback_findings = (
        await db.execute(
            select(Finding, FindingFeedback.verdict)
            .join(FindingFeedback, FindingFeedback.finding_id == Finding.id)
            .join(Scan, Scan.id == Finding.scan_id)
            .where(Scan.repository_id == repository.id)
        )
    ).all()
    fb_counter: dict[tuple[str, str], int] = {}
    for finding_row, verdict in feedback_findings:
        key = (_rule_of(finding_row), verdict)
        fb_counter[key] = fb_counter.get(key, 0) + 1
    feedback_results = [
        {"rule": rule, "verdict": verdict, "count": count} for (rule, verdict), count in fb_counter.items()
    ]

    stats = ruleselection.compute_rule_stats(scan_results, patch_results, feedback_results)
    recommendation = ruleselection.recommend_strategy(stats["rules"])
    return {
        "repository_id": str(repository.id),
        "scans_analyzed": len(scans),
        "finding_samples": len(scan_results),
        "feedback_samples": sum(r["feedback_total"] for r in stats["rules"]),
        "stats": stats,
        "recommendation": recommendation,
    }


# --------------------------------------------------------------------------- 21. vuln mining


@router.get("/{repository_id}/vuln-mining")
async def vuln_mining(
    repository_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "vuln_mining"))
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "research-llm")
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)
    scan = await _latest_completed_scan(db, repository.id)
    findings = await _findings_for_scan(db, scan.id) if scan else []
    rows = [_finding_dict(f) for f in findings]
    return await vulnmining.mine_vulnerability_history(src, rows)


# --------------------------------------------------------------------------- 22. risk model


@router.get("/{repository_id}/risk-model")
async def risk_model(
    repository_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "risk_model"))
    repository = await _load_repository(repository_id, db, current_user)
    bundle = await _insight_bundle(db, repository)

    scan = await _latest_completed_scan(db, repository.id)
    flagged: set[str] = set()
    if scan:
        for f in await _findings_for_scan(db, scan.id):
            if f.status == FindingStatus.verified:
                flagged.add(f.file_path)

    health_files = bundle["health"].get("files") or []
    git_files = bundle["git"].get("files") or []
    rows, labels, paths = riskmodel.extract_features(health_files, git_files, flagged)
    if not rows:
        return {
            "repository_id": str(repository.id),
            "available": False,
            "reason": "no health features to model",
        }
    model = riskmodel.train_and_evaluate(rows, labels, paths)
    model["repository_id"] = str(repository.id)
    model["available"] = True
    return model


# --------------------------------------------------------------------------- 20. cross-repository learning


@learning_router.get("/patterns")
async def learning_patterns(
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "learning_patterns"))

    repos_result = await db.execute(
        select(Repository)
        .where(Repository.owner_id == current_user.id)
        .order_by(Repository.created_at.desc())
    )
    repositories = list(repos_result.scalars().all())
    if not repositories:
        return {
            "repositories_analyzed": 0,
            "recurring_patterns": [],
            "category_distribution": [],
            "risky_file_roles": [],
            "rule_co_occurrence": [],
            "transfer_suggestions": [],
            "message": "Import and scan repositories first — patterns are learned from your own evidence.",
        }

    # latest completed scan per repository
    per_repo: list[dict[str, Any]] = []
    for repo in repositories:
        scan = await _latest_completed_scan(db, repo.id)
        if scan is None:
            continue
        findings = await _findings_for_scan(db, scan.id, limit=150)
        if not findings:
            continue
        verified = sum(1 for f in findings if f.status == FindingStatus.verified)
        per_repo.append(
            {
                "name": repo.name,
                "languages": repo.primary_languages or [],
                "verified_rate": round(verified / len(findings), 3) if findings else 0.0,
                "findings": [_finding_dict(f) for f in findings],
            }
        )
    return crosslearn.learn_patterns(per_repo)


# --------------------------------------------------------------------------- validation research log


@learning_router.get("/validation-stats")
async def validation_stats(
    repository_id: uuid.UUID | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Research metrics from counterexample-based validation runs.

    Reports how many candidate findings each validation pass examined, how
    verdicts moved (before -> after), and the false-positive reduction — runs
    whose claim was refuted (flipped to REJECTED) are confirmed false
    positives of the original pipeline.
    """
    from app.db.models import Finding, Repository, Scan, ValidationRun

    query = (
        select(ValidationRun)
        .join(Finding, Finding.id == ValidationRun.finding_id)
        .join(Scan, Scan.id == Finding.scan_id)
        .join(Repository, Repository.id == Scan.repository_id)
        .where(Repository.owner_id == current_user.id)
    )
    if repository_id is not None:
        query = query.where(Scan.repository_id == repository_id)
    result = await db.execute(query.order_by(ValidationRun.created_at.desc()).limit(2000))
    runs = list(result.scalars().all())

    before_counts: dict[str, int] = {}
    after_counts: dict[str, int] = {}
    transitions: dict[str, int] = {}
    by_rule: dict[str, dict[str, int]] = {}
    for run in runs:
        before_counts[run.status_before] = before_counts.get(run.status_before, 0) + 1
        after_counts[run.status_after] = after_counts.get(run.status_after, 0) + 1
        transition = f"{run.status_before} -> {run.status_after}"
        transitions[transition] = transitions.get(transition, 0) + 1
        rule = run.rule or "unknown"
        bucket = by_rule.setdefault(rule, {})
        bucket[run.status_after] = bucket.get(run.status_after, 0) + 1

    # A candidate refuted by the validator is a confirmed false positive.
    refuted = sum(1 for r in runs if r.status_before != "rejected" and r.status_after == "rejected")
    candidates = len(runs)
    return {
        "candidates": candidates,
        "before": before_counts,
        "after": after_counts,
        "transitions": dict(sorted(transitions.items(), key=lambda kv: -kv[1])),
        "false_positive_reduction": refuted,
        "fp_reduction_rate": round(refuted / candidates, 3) if candidates else 0.0,
        "by_rule": by_rule,
        "method": "deterministic counterexample battery (sanitizer / parameterization / authz / exceptions / tests)",
        "note": (
            "status_after is the validator verdict; before -> after REJECTED transitions are "
            "confirmed false positives of the producing pipeline."
        ),
    }
