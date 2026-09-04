"""Repository intelligence routes: code health, git analytics, wiki, architecture.

Mirrors the intelligence layer of modern codebase-intelligence tools: a
deterministic index computed on demand from the working copy and cached in
``repository_insights``, plus an optional LLM upgrade for individual wiki
pages (graceful when no provider key is configured).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis import intel
from app.analysis.ingest import source_dir
from app.analysis.llm import build_llm_provider, complete_json, load_prompt, provider_label
from app.analysis.models import AnalysisError, LLMUsage
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import Repository, RepositoryInsight

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
