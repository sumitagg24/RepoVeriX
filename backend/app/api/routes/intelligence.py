"""Repository intelligence routes: code health, git analytics, wiki, architecture.

Mirrors the intelligence layer of modern codebase-intelligence tools: a
deterministic index computed on demand from the working copy and cached in
``repository_insights``, plus an optional LLM upgrade for individual wiki
pages (graceful when no provider key is configured).
"""

from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis import archsmells, intel, query
from app.analysis.ingest import source_dir
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.llm import build_llm_provider, complete_json, load_prompt, provider_label
from app.analysis.models import AnalysisError, LLMUsage, ParsedFile
from app.analysis.parsing import is_supported, parse_source
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    Finding,
    HealthSnapshot,
    Repository,
    RepositoryInsight,
    Scan,
    ScanStatus,
)

router = APIRouter(prefix="/repositories", tags=["intelligence"])

_CACHE_TTL = timedelta(hours=6)


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

@router.get("/{repository_id}/intelligence")
async def get_intelligence(
    repository_id: uuid.UUID,
    refresh: bool = False,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return the cached intelligence bundle, computing it on first request.

    ``?refresh=1`` forces a recompute. The bundle is stored per repository so
    repeat views are instant; staleness is refreshed after ``_CACHE_TTL``.
    """
    repository = await _load_repository(repository_id, db, current_user)

    result = await db.execute(
        select(RepositoryInsight).where(RepositoryInsight.repository_id == repository.id)
    )
    insight = result.scalar_one_or_none()

    now = datetime.now(UTC)
    if (
        insight is not None
        and insight.status == "ready"
        and insight.generated_at is not None
        and not refresh
        and (now - _as_utc(insight.generated_at)) < _CACHE_TTL
    ):
        return _bundle(insight)

    src = _working_copy(repository)
    if insight is None:
        insight = RepositoryInsight(repository_id=repository.id)
        db.add(insight)

    insight.status = "running"
    await db.commit()
    try:
        bundle = await intel.compute_intelligence(src)
    except Exception as exc:  # compute failures are reported, not leaked
        insight.status = "error"
        insight.error = f"{type(exc).__name__}: {str(exc)[:400]}"
        insight.generated_at = now
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Intelligence computation failed: {insight.error}",
        ) from exc

    insight.status = "ready"
    insight.error = None
    insight.generated_at = now
    insight.health = bundle["health"]
    insight.git = bundle["git"]
    insight.wiki = bundle["wiki"]
    insight.architecture = bundle["architecture"]
    await _record_health_snapshot(db, repository, bundle["health"])
    await db.commit()
    return _bundle(insight)


@router.post("/{repository_id}/intelligence/wiki/{path:path}/prose")
async def generate_wiki_prose(
    repository_id: uuid.UUID,
    path: str,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Upgrade one file's wiki page from structural docs to LLM-written prose.

    Requires an LLM provider key; without one the endpoint answers 503 with a
    pointer to the configuration, mirroring the scan pipeline's behaviour.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "wiki_prose"))
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)

    safe_path = Path(path)
    full = (src / safe_path).resolve()
    if not str(full).startswith(str(src.resolve())) or not full.is_file():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found in repository")

    provider = build_llm_provider(get_settings())
    if provider is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "LLM is not configured — set REPOVERIX_OPENAI_API_KEY / "
                "REPOVERIX_ANTHROPIC_API_KEY / REPOVERIX_GEMINI_API_KEY"
            ),
        )

    source = full.read_text(encoding="utf-8", errors="replace")[:24000]
    language = _language_of(full)
    inventory = _structural_inventory(source, full, src)

    system = load_prompt("system_security")
    template = load_prompt("wiki_prose")
    user = template.format(
        repo_name=repository.name,
        file_path=str(safe_path),
        language=language or "unknown",
        inventory=inventory,
        source=source,
    )
    usage = LLMUsage()
    try:
        data = await complete_json(provider, system, user, usage)
    except AnalysisError as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc

    return {
        "file_path": str(safe_path),
        "content": data.get("content") or "",
        "model": getattr(provider, "model", None),
        "provider": provider_label(provider),
        "usage": usage.to_dict(),
    }


# --------------------------------------------------------------------------- natural-language query


class RepositoryQueryRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    use_llm: bool = False


@router.post("/{repository_id}/query")
async def repository_query(
    repository_id: uuid.UUID,
    payload: RepositoryQueryRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Answer a natural-language question about the repository.

    Deterministic by default (answers computed from the index with sources).
    ``use_llm`` upgrades open-ended questions to an LLM answer grounded in the
    same deterministic evidence when a provider is configured.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "repo_query"))
    repository = await _load_repository(repository_id, db, current_user)

    insight_result = await db.execute(
        select(RepositoryInsight).where(RepositoryInsight.repository_id == repository.id)
    )
    insight = insight_result.scalar_one_or_none()
    if insight is None or insight.status != "ready" or not insight.health:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Intelligence index is not ready — open the Intelligence page once first",
        )

    src = _working_copy(repository)
    parsed = _parse_working_copy(src)
    graph = KnowledgeGraph(list(parsed.values()))

    findings: list[dict] = []
    scan_result = await db.execute(
        select(Scan)
        .where(Scan.repository_id == repository.id, Scan.status == ScanStatus.completed)
        .order_by(Scan.created_at.desc())
        .limit(1)
    )
    latest_scan = scan_result.scalar_one_or_none()
    if latest_scan is not None:
        f_result = await db.execute(
            select(Finding)
            .where(Finding.scan_id == latest_scan.id)
            .order_by(Finding.severity.desc(), Finding.confidence.desc())
            .limit(15)
        )
        findings = [
            {
                "title": f.title,
                "severity": f.severity.value,
                "status": f.status.value,
                "confidence": f.confidence,
                "file_path": f.file_path,
                "line_start": f.line_start,
            }
            for f in f_result.scalars().all()
        ]

    result = query.answer_question(
        payload.question,
        graph=graph,
        health=insight.health or {},
        git=insight.git or {},
        wiki=insight.wiki or {},
        architecture=insight.architecture or {},
        findings=findings,
    )

    # optional LLM upgrade for open-ended questions
    provider = build_llm_provider(get_settings())
    if payload.use_llm and provider is not None and result["intent"] in ("unknown", "wiki", "callers"):
        evidence = json.dumps(
            {
                "health": insight.health,
                "git": insight.git,
                "wiki_files": len((insight.wiki or {}).get("pages", [])),
                "architecture": insight.architecture,
                "findings": findings,
            },
            default=str,
        )[:24000]
        system = load_prompt("system_security")
        template = load_prompt("repository_query")
        usage = LLMUsage()
        try:
            data = await complete_json(
                provider,
                system,
                template.format(evidence=evidence, question=payload.question),
                usage,
            )
        except AnalysisError as exc:
            raise HTTPException(status_code=502, detail=exc.message) from exc
        result = {
            **result,
            "answer": data.get("answer") or result["answer"],
            "mode": "llm",
            "model": getattr(provider, "model", None),
            "usage": usage.to_dict(),
        }
    return result


# --------------------------------------------------------------------------- architecture smells


@router.get("/{repository_id}/architecture-smells")
async def architecture_smells(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Deterministic architecture smell report over the module import graph."""
    repository = await _load_repository(repository_id, db, current_user)
    src = _working_copy(repository)
    parsed = _parse_working_copy(src)
    return archsmells.detect_smells(parsed)


# --------------------------------------------------------------------------- health timeline


@router.get("/{repository_id}/health-timeline")
async def health_timeline(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Health score history, one point per computed intelligence snapshot."""
    repository = await _load_repository(repository_id, db, current_user)
    result = await db.execute(
        select(HealthSnapshot)
        .where(HealthSnapshot.repository_id == repository.id)
        .order_by(HealthSnapshot.created_at.asc())
    )
    rows = result.scalars().all()
    return {
        "repository_id": str(repository.id),
        "count": len(rows),
        "points": [
            {
                "commit_sha": r.commit_sha,
                "average_score": r.average_score,
                "files_scored": r.files_scored,
                "distribution": r.distribution,
                "worst_files": r.worst_files,
                "recorded_at": r.created_at.isoformat(),
            }
            for r in rows
        ],
    }


# --------------------------------------------------------------------------- helpers


def _working_copy(repository: Repository) -> Path:
    if repository.storage_path and Path(repository.storage_path).exists():
        return Path(repository.storage_path)
    src = source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository has not been ingested yet — run a scan first so its working copy exists",
        )
    return src


def _parse_working_copy(src: Path) -> dict[str, ParsedFile]:
    """Parse source files of the working copy (bounded, independent of scans)."""
    from app.analysis.discovery import walk_repo_files

    settings = get_settings()
    parsed: dict[str, ParsedFile] = {}
    files_raw, _ = walk_repo_files(src)
    for full in files_raw[: settings.intel_max_files]:
        lang = _language_of(full)
        if lang is None or not is_supported(lang):
            continue
        rel = full.relative_to(src).as_posix()
        try:
            parsed[rel] = parse_source(
                full.read_text(encoding="utf-8", errors="replace"), lang, rel
            )
        except Exception:
            continue
    return parsed


async def _record_health_snapshot(
    db: AsyncSession, repository: Repository, health: dict
) -> None:
    """Upsert one timeline point for the current working-copy commit."""
    commit_sha: str | None = None
    src = _working_copy(repository)
    if (src / ".git").exists():
        try:
            from app.analysis.process import run_command

            result = await run_command(
                ["git", "rev-parse", "--short", "HEAD"], cwd=src, timeout_seconds=15
            )
            if result.ok:
                commit_sha = (result.stdout or "").strip()[:64] or None
        except Exception:
            commit_sha = None

    if commit_sha is None:
        # no git history (archive import): every index event is its own point
        row = HealthSnapshot(repository_id=repository.id, commit_sha=None)
        db.add(row)
    else:
        existing_result = await db.execute(
            select(HealthSnapshot).where(
                HealthSnapshot.repository_id == repository.id,
                HealthSnapshot.commit_sha == commit_sha,
            )
        )
        row = existing_result.scalar_one_or_none()
        if row is None:
            row = HealthSnapshot(repository_id=repository.id, commit_sha=commit_sha)
            db.add(row)
    row.average_score = health.get("average_score")
    row.files_scored = health.get("files_scored") or 0
    row.distribution = health.get("distribution")
    row.worst_files = health.get("worst_files")


# --------------------------------------------------------------------------- helpers


def _bundle(insight: RepositoryInsight) -> dict:
    return {
        "status": insight.status,
        "generated_at": insight.generated_at.isoformat() if insight.generated_at else None,
        "error": insight.error,
        "health": insight.health or {},
        "git": insight.git or {},
        "wiki": insight.wiki or {},
        "architecture": insight.architecture or {},
    }


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo is not None else dt.replace(tzinfo=UTC)


def _language_of(full: Path) -> str | None:
    from app.analysis.discovery import LANGUAGE_BY_EXT

    return LANGUAGE_BY_EXT.get(full.suffix.lower())


def _structural_inventory(source: str, full: Path, src: Path) -> str:
    """Compact symbol/import inventory for the wiki-prose prompt."""
    from app.analysis.parsing import is_supported, parse_source

    lang = _language_of(full)
    if lang is None or not is_supported(lang):
        lines = len(source.splitlines())
        return f"(unparsed {lang or 'unknown'} file, {lines} lines)"
    rel = full.relative_to(src).as_posix()
    try:
        pf = parse_source(source, lang, rel)
    except Exception:
        return "(parse failed)"
    parts: list[str] = []
    for sym in pf.symbols[:60]:
        parts.append(
            f"- {sym.kind} {sym.qualified_name} (lines {sym.line_start}-{sym.line_end})"
            + (f" params {sym.extra.get('params')}" if sym.extra.get("params") else "")
        )
    imports = ", ".join(i.module for i in pf.imports[:20]) or "none"
    calls = ", ".join(sorted({c.callee for c in pf.calls})[:20]) or "none"
    return f"SYMBOLS:\n{chr(10).join(parts) or '(none)'}\nIMPORTS: {imports}\nCALLS: {calls}"
