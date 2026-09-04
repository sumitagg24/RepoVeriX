"""Scan orchestrator.

Executes the audit pipeline for one ``Scan`` row and persists results:

    ingestion -> parsing -> static_analysis -> knowledge_graph
              -> llm_reasoning -> evidence_validation

Stage selection depends on the scan's experimental ``configuration``:

- static_only: static_analysis only (no LLM)
- llm_only:    parsing + llm_reasoning (repo review) + grounding validation
- static_llm:  static + llm per-candidate reasoning
- repoverix:   static + repository context + llm + evidence validation

Every stage is persisted as an ``AnalysisRun`` row; the scan ends ``completed``
with a summary (including reproducibility metadata) or ``failed`` with a
human-readable error. A failure in one LLM request never crashes the scan.
"""

from __future__ import annotations

import asyncio
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.analysis import ingest, runtime
from app.analysis.context import build_candidate_context
from app.analysis.detectors import run_detectors
from app.analysis.discovery import describe_file, discover_project, walk_repo_files
from app.analysis.evidence import (
    FindingSpec,
    candidates_from_llm_claims,
    candidates_from_static,
    finalize_candidate,
)
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.llm import (
    PROMPT_VERSION,
    build_llm_provider,
    complete_json,
    load_prompt,
    provider_label,
)
from app.analysis.models import (
    AnalysisError,
    Candidate,
    EvidenceDraft,
    LLMUsage,
    ParsedFile,
    StaticFinding,
)
from app.analysis.parsing import is_supported, parse_source
from app.analysis.tools import run_external_tools, tool_versions
from app.core.config import get_settings
from app.core.logging import log_scan
from app.db.models import (
    AnalysisRun,
    AnalysisStage,
    Dependency,
    Ecosystem,
    Evidence,
    EvidenceKind,
    File,
    Finding,
    FindingSource,
    Repository,
    RunStatus,
    Scan,
    ScanConfiguration,
    ScanStatus,
    SourceType,
    Symbol,
    SymbolKind,
)

ANALYZER_VERSION = "repoverix-engine-0.1.0"

# stages whose failure aborts the scan (vs. stages that degrade gracefully)
_ESSENTIAL_STAGES = {AnalysisStage.ingestion, AnalysisStage.parsing}

_RULE_KIND: dict[str, SymbolKind] = {
    "function": SymbolKind.function,
    "class": SymbolKind.class_,
    "method": SymbolKind.method,
    "variable": SymbolKind.variable,
}

LLM_MODES = (ScanConfiguration.llm_only, ScanConfiguration.static_llm, ScanConfiguration.repoverix)
STATIC_MODES = (
    ScanConfiguration.static_only,
    ScanConfiguration.static_llm,
    ScanConfiguration.repoverix,
)


class StageContext:
    """Shared state flowing through one scan."""

    def __init__(self, session_factory: Any, scan: Scan, repository: Repository):
        self.session_factory = session_factory
        self.scan = scan
        self.repository = repository
        self.settings = get_settings()
        self.source_root: Any = None
        self.manifest: Any = None
        self.repo_files: list[Any] = []
        self.parsed_files: dict[str, ParsedFile] = {}
        self.graph: KnowledgeGraph | None = None
        self.llm_usage = LLMUsage()
        self.llm_provider: Any = None
        self.static_findings: list[StaticFinding] = []
        self.candidates: list[Candidate] = []
        self.specs: list[FindingSpec] = []
        self.rejected: list[dict[str, Any]] = []
        self.stage_timing: dict[str, dict[str, str]] = {}
        self.tool_runs: list[dict[str, Any]] = []

    @property
    def configuration(self) -> ScanConfiguration:
        return self.scan.configuration

    def llm_expected(self) -> bool:
        return self.configuration in LLM_MODES

    def cancelled(self) -> bool:
        return runtime.is_cancelled(self.scan.id)


async def run_scan(
    session_factory: async_sessionmaker[AsyncSession],
    scan_id: uuid.UUID,
    *,
    run_callback: Callable[[StageContext], None] | None = None,
) -> None:
    """Execute one scan end-to-end. Safe to call from a background task."""
    async with session_factory() as db:
        result = await db.execute(
            select(Scan).options(selectinload(Scan.repository)).where(Scan.id == scan_id)
        )
        scan = result.scalar_one_or_none()
        if scan is None:
            log_scan(str(scan_id), "orchestrator", "failed", "scan row not found")
            return
        repository = scan.repository

        if scan.status == ScanStatus.running:
            return  # already running
        scan.status = ScanStatus.running
        scan.started_at = datetime.now(UTC)
        scan.error = None
        await db.commit()

        ctx = StageContext(session_factory, scan, repository)
        try:
            await _execute_pipeline(db, ctx)
            scan.status = ScanStatus.completed
            scan.summary = _build_summary(ctx)
            scan.llm_token_usage = ctx.llm_usage.to_dict()
            log_scan(
                str(scan_id),
                "orchestrator",
                "completed",
                findings=len(ctx.specs),
                rejected=len(ctx.rejected),
            )
        except AnalysisError as exc:
            scan.status = ScanStatus.failed
            scan.error = exc.message
            log_scan(str(scan_id), "orchestrator", "failed", message=exc.message, code=exc.code)
        except asyncio.CancelledError:
            scan.status = ScanStatus.failed
            scan.error = "Scan cancelled"
            raise
        except Exception as exc:  # pragma: no cover - safety net
            scan.status = ScanStatus.failed
            scan.error = f"Unexpected internal error: {type(exc).__name__}: {str(exc)[:500]}"
            log_scan(str(scan_id), "orchestrator", "failed", message=scan.error)
        finally:
            scan.finished_at = datetime.now(UTC)
            await db.commit()

        if run_callback is not None:
            run_callback(ctx)


# --------------------------------------------------------------------------- helpers


async def _execute_pipeline(db: AsyncSession, ctx: StageContext) -> None:
    settings = ctx.settings

    # stage 1: ingestion
    await _run_stage(
        db,
        ctx,
        AnalysisStage.ingestion,
        "repository",
        lambda: _ingest_repository(ctx),
        essential=True,
    )
    _check_cancelled(ctx)

    # stage 2: parsing
    await _run_stage(
        db,
        ctx,
        AnalysisStage.parsing,
        "tree-sitter",
        lambda: _parse_repository(db, ctx),
        essential=True,
    )
    _check_cancelled(ctx)

    # stage 3: static analysis (not for llm_only)
    if ctx.configuration in STATIC_MODES:
        await _run_stage(
            db,
            ctx,
            AnalysisStage.static_analysis,
            "ruff+bandit+rvx-builtin",
            lambda: _static_analysis(db, ctx),
        )
        _check_cancelled(ctx)

    # stage 4: knowledge graph
    await _run_stage(
        db,
        ctx,
        AnalysisStage.knowledge_graph,
        "symbol-graph",
        lambda: _knowledge_stage(ctx),
    )
    _check_cancelled(ctx)

    # stage 5: LLM reasoning
    if ctx.llm_expected():
        provider = build_llm_provider(settings)
        ctx.llm_provider = provider
        if provider is None:
            await _run_stage(
                db,
                ctx,
                AnalysisStage.llm_reasoning,
                settings.llm_provider,
                lambda: _llm_unconfigured_stage(ctx),
            )
        else:
            await _run_stage(
                db,
                ctx,
                AnalysisStage.llm_reasoning,
                provider_label(provider),
                lambda: _llm_reasoning_stage(ctx),
            )
        _check_cancelled(ctx)

    # stage 6: evidence validation + persistence
    await _run_stage(
        db,
        ctx,
        AnalysisStage.evidence_validation,
        "evidence-engine",
        lambda: _evidence_validation(db, ctx),
    )


async def _run_stage(
    db: AsyncSession,
    ctx: StageContext,
    stage: AnalysisStage,
    tool_name: str,
    func: Callable,
    *,
    essential: bool = False,
) -> Any:
    """Run a pipeline stage, persisting an AnalysisRun row around it."""
    run = AnalysisRun(
        scan_id=ctx.scan.id,
        stage=stage,
        tool_name=tool_name,
        status=RunStatus.running,
        started_at=datetime.now(UTC),
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)

    log_scan(str(ctx.scan.id), stage.value, "started")
    try:
        result = await func()
    except asyncio.CancelledError:
        run.status = RunStatus.failed
        run.output = {"error": "cancelled"}
        run.finished_at = datetime.now(UTC)
        await db.commit()
        raise
    except AnalysisError as exc:
        run.status = RunStatus.failed
        run.output = {"error": exc.message, "code": exc.code}
        run.finished_at = datetime.now(UTC)
        await db.commit()
        log_scan(str(ctx.scan.id), stage.value, "failed", message=exc.message, code=exc.code)
        if essential or stage in _ESSENTIAL_STAGES:
            raise
        return None
    except Exception as exc:  # pragma: no cover
        run.status = RunStatus.failed
        run.output = {"error": f"{type(exc).__name__}: {str(exc)[:800]}"}
        run.finished_at = datetime.now(UTC)
        await db.commit()
        log_scan(str(ctx.scan.id), stage.value, "failed", message=str(exc)[:400])
        if essential or stage in _ESSENTIAL_STAGES:
            raise AnalysisError(f"Stage {stage.value} failed: {str(exc)[:500]}") from exc
        return None

    run.status = RunStatus.completed
    run.finished_at = datetime.now(UTC)
    if isinstance(result, dict):
        run.output = result
    await db.commit()
    log_scan(str(ctx.scan.id), stage.value, "completed")
    return result


def _check_cancelled(ctx: StageContext) -> None:
    if ctx.cancelled():
        raise AnalysisError("Scan cancelled by user", code="cancelled")


# --------------------------------------------------------------------------- stage 1: ingestion


async def _ingest_repository(ctx: StageContext) -> dict[str, Any]:
    repo = ctx.repository
    repo_id = str(repo.id)
    if repo.source_type == SourceType.github:
        src = await ingest.clone_github_repository(repo_id, repo.source_url or "", repo.default_branch)
    else:
        src = ingest.extract_archive(repo_id)

    files_raw, ignored = walk_repo_files(src)
    ctx.repo_files = [describe_file(src, p) for p in files_raw]
    ctx.source_root = src
    manifest = discover_project(src, repo.source_type.value, prewalked=files_raw)
    ctx.manifest = manifest
    repo.storage_path = str(src.resolve())
    repo.primary_languages = manifest.languages
    repo.status = "ingested"
    return manifest.to_dict()


# --------------------------------------------------------------------------- stage 2: parsing


async def _parse_repository(db: AsyncSession, ctx: StageContext) -> dict[str, Any]:
    """Parse supported files; persist File + Symbol + Dependency rows."""
    settings = ctx.settings
    src = ctx.source_root
    manifest = ctx.manifest
    parsed: list[ParsedFile] = []
    warnings: list[str] = []
    symbol_count = 0

    # File rows first so symbols can reference them
    file_rows: dict[str, File] = {}
    for repo_file in ctx.repo_files:
        f_row = File(
            scan_id=ctx.scan.id,
            path=repo_file.path,
            language=repo_file.language,
            size_bytes=repo_file.size_bytes,
            sha256=repo_file.sha256,
            is_test=repo_file.is_test,
        )
        db.add(f_row)
        file_rows[repo_file.path] = f_row

    for repo_file in ctx.repo_files:
        if repo_file.language not in ("python", "javascript", "typescript"):
            continue
        if not is_supported(repo_file.language):
            continue
        full = src / repo_file.path
        try:
            text = full.read_text(encoding="utf-8", errors="replace")
        except OSError as exc:
            warnings.append(f"unreadable {repo_file.path}: {exc}")
            continue
        try:
            pf = parse_source(text, repo_file.language, repo_file.path)
        except AnalysisError as exc:
            warnings.append(f"parse failed {repo_file.path}: {exc.message}")
            continue
        except Exception as exc:  # pragma: no cover
            warnings.append(f"parse failed {repo_file.path}: {type(exc).__name__}")
            continue
        symbol_count += len(pf.symbols)
        parsed.append(pf)
        if symbol_count > settings.max_symbols:
            warnings.append(f"symbol limit {settings.max_symbols} reached; remaining files were not indexed")
            break

    ctx.parsed_files = {pf.path: pf for pf in parsed}

    # flush to assign file ids, then persist symbols
    await db.flush()
    file_id_by_path: dict[str, uuid.UUID] = {
        path: row.id for path, row in file_rows.items() if row.id is not None
    }
    symbol_rows = 0
    for pf in parsed:
        fid = file_id_by_path.get(pf.path)
        if fid is None:
            continue
        for sym in pf.symbols:
            if symbol_rows >= settings.max_symbols:
                break
            db.add(
                Symbol(
                    file_id=fid,
                    kind=_RULE_KIND.get(sym.kind, SymbolKind.function),
                    name=sym.name,
                    qualified_name=sym.qualified_name,
                    line_start=sym.line_start,
                    line_end=sym.line_end,
                    metadata=sym.extra,
                )
            )
            symbol_rows += 1
    manifest_file_count = len(ctx.repo_files)

    # dependencies
    for dep in manifest.dependencies:
        try:
            ecosystem = Ecosystem(dep["ecosystem"])
        except ValueError:
            continue
        db.add(
            Dependency(
                scan_id=ctx.scan.id,
                ecosystem=ecosystem,
                name=dep["name"],
                version=dep["version"],
                is_dev=dep["is_dev"],
            )
        )
    await db.commit()

    func_count = sum(1 for pf in parsed for s in pf.symbols if s.kind in ("function", "method"))
    class_count = sum(1 for pf in parsed for s in pf.symbols if s.kind == "class")
    return {
        "files_indexed": len(parsed),
        "manifest_files": manifest_file_count,
        "functions": func_count,
        "classes": class_count,
        "symbols": symbol_rows,
        "imports": sum(len(pf.imports) for pf in parsed),
        "calls": sum(len(pf.calls) for pf in parsed),
        "test_files": manifest.test_file_count,
        "warnings": warnings,
    }


# --------------------------------------------------------------------------- stage 3: static analysis


async def _static_analysis(db: AsyncSession, ctx: StageContext) -> dict[str, Any]:
    parsed_list = list(ctx.parsed_files.values())
    builtin_findings = run_detectors(parsed_list)
    ctx.static_findings.extend(builtin_findings)

    tool_result = await run_external_tools(ctx.source_root, ctx.manifest.languages)
    external: list[StaticFinding] = []
    for run in tool_result:
        ctx.tool_runs.append(
            {
                "tool": run.tool,
                "available": run.available,
                "succeeded": run.succeeded,
                "error": run.error,
                "finding_count": len(run.findings),
            }
        )
        if run.available and run.succeeded:
            external.extend(run.findings)
            ctx.static_findings.extend(run.findings)

    by_tool: dict[str, int] = {}
    for f in ctx.static_findings:
        by_tool[f.tool] = by_tool.get(f.tool, 0) + 1
    return {
        "builtin_rules": [
            {
                "rule": f.rule,
                "file": f.file_path,
                "line": f.line_start,
                "severity": f.severity.value,
                "message": f.message[:200],
            }
            for f in builtin_findings
        ],
        "external_tool_runs": ctx.tool_runs,
        "counts_by_tool": by_tool,
        "external_finding_count": len(external),
    }


# --------------------------------------------------------------------------- stage 4: knowledge graph


async def _knowledge_stage(ctx: StageContext) -> dict[str, Any]:
    graph = KnowledgeGraph(list(ctx.parsed_files.values()))
    ctx.graph = graph

    # enrich static candidates with caller context (call_relationship evidence)
    if ctx.configuration in STATIC_MODES:
        enriched = enrich_candidates_with_callers(
            candidates_from_static(ctx.static_findings, graph, ctx.parsed_files), graph
        )
        ctx.candidates = enriched
        return {
            "files": len(ctx.parsed_files),
            "symbols": sum(len(pf.symbols) for pf in ctx.parsed_files.values()),
            "import_edges": sum(len(v) for v in graph._file_imports.values()),
            "candidates": len(ctx.candidates),
        }
    return {
        "files": len(ctx.parsed_files),
        "symbols": sum(len(pf.symbols) for pf in ctx.parsed_files.values()),
    }


def enrich_candidates_with_callers(candidates: list[Candidate], graph: KnowledgeGraph) -> list[Candidate]:
    """Attach caller-function evidence when the enclosing function has callers."""
    for candidate in candidates:
        enclosing = None
        for ref in graph.function_symbols(candidate.file_path):
            if candidate.line_start and ref.line_start <= candidate.line_start <= ref.line_end:
                enclosing = ref
                break
        if enclosing is None:
            continue
        callers = graph.callers_of_ref(enclosing)
        if not callers:
            continue
        for caller_q in sorted(callers)[:5]:
            caller_ref = graph.find_qualified(caller_q)
            if caller_ref is None:
                continue
            pf = graph.files.get(caller_ref.file_path)
            snippet = ""
            if pf:
                lines = pf.source.splitlines()
                lo = max(0, caller_ref.line_start - 1)
                hi = min(len(lines), caller_ref.line_start + 2)
                snippet = "\n".join(lines[lo:hi])
            candidate.evidence.append(
                EvidenceDraft(
                    kind=EvidenceKind.call_relationship,
                    file_path=caller_ref.file_path,
                    line_start=caller_ref.line_start,
                    line_end=caller_ref.line_end,
                    snippet=snippet or None,
                    description=(
                        f"{caller_ref.qualified_name} calls {enclosing.qualified_name}; "
                        "if the caller passes untrusted input it reaches this function"
                    ),
                    extra={"caller": caller_q, "callee": enclosing.qualified_name},
                )
            )
        candidate.evidence.sort(key=lambda e: e.order_index)
    return candidates


# --------------------------------------------------------------------------- stage 5: LLM reasoning


async def _llm_unconfigured_stage(ctx: StageContext) -> dict[str, Any]:
    """LLM-dependent configuration but no provider key configured."""
    ctx.rejected.append({"reason": "llm provider not configured"})
    raise AnalysisError(
        "LLM analysis requested but no provider key is configured "
        "(set REPOVERIX_OPENAI_API_KEY / REPOVERIX_ANTHROPIC_API_KEY / REPOVERIX_GEMINI_API_KEY). "
        "Findings from deterministic static analysis (if enabled) are still available.",
        code="llm_unconfigured",
    )


async def _llm_reasoning_stage(ctx: StageContext) -> dict[str, Any]:
    """Run LLM over candidates (static modes) or a repo review (llm_only)."""
    if ctx.configuration == ScanConfiguration.llm_only:
        return await _llm_repo_review(ctx)
    return await _llm_candidate_review(ctx)


async def _llm_candidate_review(ctx: StageContext) -> dict[str, Any]:
    provider = ctx.llm_provider
    graph = ctx.graph
    assert graph is not None
    system = load_prompt("system_security")
    template = load_prompt("finding_analysis")
    assessments: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    max_candidates = ctx.settings.llm_max_candidates_per_scan

    for _idx, candidate in enumerate(ctx.candidates[:max_candidates]):
        if ctx.cancelled():
            raise AnalysisError("Scan cancelled by user", code="cancelled")
        context_text = build_candidate_context(
            graph,
            ctx.parsed_files,
            candidate.static_findings[0],
            function_name=candidate.function_name,
            config_name=ctx.configuration.value,
            source_label=candidate.source,
        )
        sf = candidate.static_findings[0]
        user = template.format(
            language=ctx.parsed_files[candidate.file_path].language,
            configuration=ctx.configuration.value,
            source=candidate.source,
            title=candidate.title,
            rule=sf.rule,
            file_path=candidate.file_path,
            line_start=candidate.line_start,
            line_end=candidate.line_end,
            function_name=candidate.function_name or "module-level",
            message=sf.message[:500],
            code_snippet=_window(
                ctx.parsed_files[candidate.file_path].source,
                candidate.line_start,
                candidate.line_end,
                8,
            ),
            repo_context=context_text,
            static_evidence="\n".join(f"- {e.kind.value}: {e.description}" for e in candidate.evidence)[
                :4000
            ],
        )
        try:
            data = await complete_json(provider, system, user, ctx.llm_usage)
            data["model"] = getattr(provider, "model", None)
        except AnalysisError as exc:
            failures.append({"key": candidate.key, "error": exc.message, "code": exc.code})
            log_scan(str(ctx.scan.id), "llm_reasoning", "candidate_failed", message=exc.message)
            continue
        candidate.llm_assessment = data
        assessments.append(
            {
                "key": candidate.key,
                "verdict": data.get("verdict"),
                "confidence": data.get("confidence"),
            }
        )

    return {
        "mode": "candidate_review",
        "candidates_assessed": len(assessments),
        "candidate_failures": failures,
        "assessments": assessments,
        "usage": ctx.llm_usage.to_dict(),
    }


async def _llm_repo_review(ctx: StageContext) -> dict[str, Any]:
    """LLM-only configuration: review functions and return raw claims."""
    provider = ctx.llm_provider
    system = load_prompt("system_security")
    template = load_prompt("repo_review")

    units = _build_review_units(ctx)
    claims: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    for unit in units:
        if ctx.cancelled():
            raise AnalysisError("Scan cancelled by user", code="cancelled")
        user = template.format(
            repo_name=ctx.repository.name,
            languages=", ".join(ctx.manifest.languages) or "unknown",
            function_count=unit["function_count"],
            file_chunks=unit["content"],
        )
        try:
            data = await complete_json(provider, system, user, ctx.llm_usage)
        except AnalysisError as exc:
            failures.append({"file": unit.get("file"), "error": exc.message})
            continue
        items = data.get("findings") or []
        if isinstance(items, list):
            claims.extend(items)
    # de-duplicate overlapping claims keep highest confidence
    best: dict[tuple[str, int], dict[str, Any]] = {}
    for claim in claims:
        key = (claim.get("file_path") or "", int(claim.get("line_start") or 0))
        if key in best:
            if float(best[key].get("confidence") or 0) < float(claim.get("confidence") or 0):
                best[key] = claim
        else:
            best[key] = claim
    unique_claims = list(best.values())

    if ctx.graph is not None:
        ctx.candidates = candidates_from_llm_claims(unique_claims, ctx.graph, ctx.parsed_files)
    return {
        "mode": "repo_review",
        "units_reviewed": len(units),
        "raw_claims": len(claims),
        "unique_claims": len(unique_claims),
        "failures": failures,
        "usage": ctx.llm_usage.to_dict(),
    }


def _build_review_units(ctx: StageContext) -> list[dict[str, Any]]:
    """Split parsed files into prompt-sized review chunks of functions."""
    settings = ctx.settings
    budget = settings.llm_max_context_chars
    units: list[dict[str, Any]] = []
    for pf in ctx.parsed_files.values():
        if not pf.symbols:
            continue
        chunks: list[str] = []
        used = 0
        for sym in sorted(pf.symbols, key=lambda s: s.line_start):
            if sym.kind == "class":
                continue
            block = _numbered_window(pf, sym.line_start, sym.line_end)
            header = f"### {pf.path} : {sym.name} (lines {sym.line_start}-{sym.line_end})\n"
            piece = header + block
            if used + len(piece) > budget and chunks:
                units.append({"file": pf.path, "function_count": len(chunks), "content": "\n\n".join(chunks)})
                chunks = []
                used = 0
            chunks.append(piece)
            used += len(piece)
        if chunks:
            units.append({"file": pf.path, "function_count": len(chunks), "content": "\n\n".join(chunks)})
    # only first N units to bound cost
    cap_units = max(1, min(25, ctx.settings.llm_max_candidates_per_scan))
    return units[:cap_units]


def _numbered_window(pf: ParsedFile, start: int, end: int) -> str:
    lines = pf.source.splitlines()
    lo = max(0, start - 1)
    hi = min(len(lines), end)
    return "\n".join(f"{i + 1:>5} | {lines[i]}" for i in range(lo, hi))


def _window(source: str, start: int, end: int, padding: int) -> str:
    lines = source.splitlines()
    if not lines:
        return ""
    lo = max(0, (start or 1) - 1 - padding)
    hi = min(len(lines), (end or start or 1) + padding)
    return "\n".join(f"{i + 1:>5} | {lines[i]}" for i in range(lo, hi))


# --------------------------------------------------------------------------- stage 6: evidence validation


async def _evidence_validation(db: AsyncSession, ctx: StageContext) -> dict[str, Any]:
    """Finalize candidates into persisted findings with evidence rows."""
    llm_used = ctx.configuration in LLM_MODES and ctx.llm_provider is not None
    specs: list[FindingSpec] = []
    rejected: list[dict[str, Any]] = []

    if ctx.configuration == ScanConfiguration.llm_only:
        # LLM-only claims flow through candidates; static path skipped entirely
        for candidate in ctx.candidates:
            spec = finalize_candidate(
                candidate,
                candidate.llm_assessment,
                llm_used=True,
                config_name=ctx.configuration.value,
            )
            if spec:
                specs.append(spec)
            else:
                rejected.append({"key": candidate.key, "reason": "not_grounded_or_low_confidence"})
    else:
        for candidate in ctx.candidates:
            spec = finalize_candidate(
                candidate,
                candidate.llm_assessment,
                llm_used=llm_used,
                config_name=ctx.configuration.value,
            )
            if spec:
                spec.source = _finding_source_for_config(ctx.configuration)
                specs.append(spec)
            else:
                rejected.append(
                    {
                        "key": candidate.key,
                        "title": candidate.title,
                        "reason": "rejected_by_evidence_validation",
                    }
                )
    ctx.rejected = rejected
    ctx.specs = specs

    # persist findings (dedupe on (scan, external_id))
    seen_external: set[str] = set()
    result = await db.execute(select(Finding.external_id).where(Finding.scan_id == ctx.scan.id))
    seen_external.update(row[0] for row in result.all())

    persisted = 0
    for spec in specs:
        if spec.external_id in seen_external:
            continue
        seen_external.add(spec.external_id)
        finding = Finding(
            scan_id=ctx.scan.id,
            external_id=spec.external_id,
            category=spec.category,
            severity=spec.severity,
            status=spec.status,
            confidence=spec.confidence,
            title=spec.title[:300],
            description=spec.description[:10000],
            impact=(spec.impact or "")[:5000] or None,
            recommendation=(spec.recommendation or "")[:3000] or None,
            file_path=spec.file_path,
            function_name=spec.function_name,
            line_start=spec.line_start,
            line_end=spec.line_end,
            source=spec.source,
        )
        db.add(finding)
        await db.flush()
        for node in spec.evidence:
            db.add(
                Evidence(
                    finding_id=finding.id,
                    kind=node.kind,
                    file_path=node.file_path,
                    line_start=node.line_start,
                    line_end=node.line_end,
                    snippet=(node.snippet or "")[:4000] or None,
                    description=node.description[:4000],
                    order_index=node.order_index,
                    metadata=node.extra,
                )
            )
        persisted += 1
    await db.commit()

    sev_counts: dict[str, int] = {}
    status_counts: dict[str, int] = {}
    cat_counts: dict[str, int] = {}
    for spec in specs:
        sev_counts[spec.severity.value] = sev_counts.get(spec.severity.value, 0) + 1
        status_counts[spec.status.value] = status_counts.get(spec.status.value, 0) + 1
        cat_counts[spec.category.value] = cat_counts.get(spec.category.value, 0) + 1
    return {
        "candidates": len(ctx.candidates),
        "persisted": persisted,
        "rejected": rejected,
        "by_severity": sev_counts,
        "by_status": status_counts,
        "by_category": cat_counts,
        "llm_used": llm_used,
    }


def _finding_source_for_config(config: ScanConfiguration) -> FindingSource:
    if config == ScanConfiguration.static_only:
        return FindingSource.static
    if config == ScanConfiguration.llm_only:
        return FindingSource.llm
    return FindingSource.hybrid


def _build_summary(ctx: StageContext) -> dict[str, Any]:
    manifest = ctx.manifest
    sev: dict[str, int] = {}
    status: dict[str, int] = {}
    for spec in ctx.specs:
        sev[spec.severity.value] = sev.get(spec.severity.value, 0) + 1
        status[spec.status.value] = status.get(spec.status.value, 0) + 1

    return {
        "configuration": ctx.configuration.value,
        "repository": {
            "name": ctx.repository.name,
            "source": ctx.repository.source_type.value,
            "files": manifest.file_count if manifest else 0,
            "languages": manifest.languages if manifest else [],
            "functions": sum(
                1 for pf in ctx.parsed_files.values() for s in pf.symbols if s.kind in ("function", "method")
            ),
            "classes": sum(1 for pf in ctx.parsed_files.values() for s in pf.symbols if s.kind == "class"),
            "test_files": manifest.test_file_count if manifest else 0,
            "dependencies": len(manifest.dependencies) if manifest else 0,
        },
        "findings": {
            "total": len(ctx.specs),
            "by_severity": sev,
            "by_status": status,
            "rejected": len(ctx.rejected),
        },
        "llm": {
            "expected": ctx.llm_expected(),
            "provider": provider_label(ctx.llm_provider) if ctx.llm_provider else "unconfigured",
            "usage": ctx.llm_usage.to_dict(),
        },
        "reproducibility": {
            "analyzer_version": ANALYZER_VERSION,
            "prompt_version": PROMPT_VERSION,
            "llm_provider": provider_label(ctx.llm_provider) if ctx.llm_provider else None,
            "tool_versions": tool_versions(),
            "repository_commit": ctx.manifest.git_commit if ctx.manifest else None,
            "timestamp_utc": datetime.now(UTC).isoformat(),
        },
        "warnings": manifest.warnings if manifest else [],
    }
