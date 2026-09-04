"""Finding and evidence routes."""

import json
import re
import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analysis import counterexamples, findingchat, impact, ingest, prooffix, testgen, validation
from app.analysis.ingest import source_dir
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.llm import LLMUsage, build_llm_provider, complete_json, load_prompt
from app.analysis.models import AnalysisError
from app.analysis.repair import generate_repair
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    Finding,
    GeneratedTest,
    Patch,
    PatchStatus,
    Repository,
    Scan,
    ScanStatus,
    ValidationRun,
    VerificationRun,
)
from app.schemas.finding import FindingDetail, FindingRead
from app.schemas.verification import PatchRead

_TEST_PATH_RE = re.compile(r"(^|/)(test_|tests?/|.*\.(test|spec)\.)", re.IGNORECASE)


def _find_test_references(src, needle: str) -> list[dict]:
    """Bounded scan of test files for references to the suspected function."""
    if not needle:
        return []
    from app.analysis.discovery import walk_repo_files

    token = needle.split(":")[-1].strip()
    if len(token) < 3:
        return []
    refs: list[dict] = []
    try:
        files_raw, _ = walk_repo_files(src)
    except Exception:
        return []
    count = 0
    for full in files_raw:
        rel = str(full).replace("\\", "/")
        if not _TEST_PATH_RE.search(rel):
            continue
        try:
            lines = full.read_text(encoding="utf-8", errors="replace").splitlines()
        except Exception:
            continue
        for i, line in enumerate(lines, start=1):
            if re.search(rf"\b{re.escape(token)}\b", line):
                refs.append({"file": rel, "line": i})
                count += 1
                if count >= 8:
                    return refs
    return refs


router = APIRouter(prefix="/findings", tags=["findings"])


@router.get("", response_model=list[FindingRead])
async def list_findings(
    scan_id: uuid.UUID | None = None,
    repository_id: uuid.UUID | None = None,
    category: str | None = None,
    severity: str | None = None,
    status: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List findings with optional filters."""
    query = select(Finding).join(Scan).join(Repository).where(Repository.owner_id == current_user.id)

    if scan_id:
        query = query.where(Finding.scan_id == scan_id)
    if repository_id:
        query = query.where(Scan.repository_id == repository_id)
    if category:
        query = query.where(Finding.category == category)
    if severity:
        query = query.where(Finding.severity == severity)
    if status:
        query = query.where(Finding.status == status)

    query = query.order_by(Finding.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(query)
    return list(result.scalars().all())


@router.get("/{finding_id}", response_model=FindingDetail)
async def get_finding(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single finding with its evidence and patches."""
    result = await db.execute(
        select(Finding)
        .options(selectinload(Finding.evidence), selectinload(Finding.patches))
        .join(Scan)
        .join(Repository)
        .where(
            Finding.id == finding_id,
            Repository.owner_id == current_user.id,
        )
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.post("/{finding_id}/generate-fix", response_model=PatchRead)
async def generate_fix(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a candidate patch for a finding (deterministic template or LLM).

    The patch is stored as a candidate; it is never applied to the original
    repository. Verification happens later against an isolated copy. LLM-backed
    generations consume tokens, so this endpoint is rate limited per user."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "generate_fix"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_generate_fix

        await assert_can_generate_fix(db, current_user)

    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.scan),
            selectinload(Finding.scan).selectinload(Scan.repository),
        )
        .join(Scan)
        .join(Repository)
        .where(
            Finding.id == finding_id,
            Repository.owner_id == current_user.id,
        )
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")

    repository = finding.scan.repository
    src = ingest.source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository source is not available; run a scan on this repository first",
        )

    provider = build_llm_provider(get_settings())
    usage = LLMUsage()
    try:
        repair = await generate_repair(
            finding,
            source_root=src,
            provider=provider,
            usage=usage,
            graph=None,
            parsed_files={},
        )
    except AnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.message,
        ) from exc

    patch = Patch(
        finding_id=finding.id,
        diff=repair.diff,
        explanation=repair.description,
        generated_by=repair.generated_by,
        status=PatchStatus.candidate,
    )
    db.add(patch)
    await db.commit()
    await db.refresh(patch)
    return patch


@router.post("/{finding_id}/generate-test")
async def generate_test(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a regression test for a finding (deterministic contract test,
    or an LLM behavioral test when a provider is configured)."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "generate_test"))

    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.scan).selectinload(Scan.repository),
        )
        .join(Scan)
        .join(Repository)
        .where(Finding.id == finding_id, Repository.owner_id == current_user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")

    repository = finding.scan.repository
    src = ingest.source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository source is not available; run a scan first",
        )

    provider = build_llm_provider(get_settings())
    usage = LLMUsage()
    try:
        generated = await testgen.generate_test(
            finding, src, provider=provider, usage=usage
        )
    except AnalysisError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=exc.message,
        ) from exc

    languages = finding.scan.repository.primary_languages
    row = GeneratedTest(
        finding_id=finding.id,
        language=languages[0] if languages else "python",
        test_code=generated["code"],
        generated_by=generated["generated_by"],
        status="generated",
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return {
        "id": str(row.id),
        "finding_id": str(row.finding_id),
        "language": row.language,
        "test_code": row.test_code,
        "generated_by": row.generated_by,
        "status": row.status,
        "result": row.result,
    }


class RunTestRequest(BaseModel):
    patch_id: uuid.UUID | None = Field(default=None)


@router.post("/generated-tests/{test_id}/run")
async def run_generated_test(
    test_id: uuid.UUID,
    payload: RunTestRequest | None = None,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Execute a generated test against an isolated copy of the working copy.

    Pass ``{"patch_id": ...}`` to run the same test against the *patched*
    version; combining that with a prior vulnerable-version run yields the
    Proof-of-Fix verdict (original FAIL -> patched PASS).
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "run_test"))

    result = await db.execute(
        select(GeneratedTest)
        .options(
            selectinload(GeneratedTest.finding)
            .selectinload(Finding.scan)
            .selectinload(Scan.repository)
        )
        .join(Finding)
        .join(Scan)
        .join(Repository)
        .where(GeneratedTest.id == test_id, Repository.owner_id == current_user.id)
    )
    row = result.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test not found")

    repository = row.finding.scan.repository
    src = ingest.source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository source is not available; run a scan first",
        )

    filename = f"test_gen_{repository.id.hex[:8]}.py"
    patch_diff: str | None = None
    patch_meta: dict | None = None
    if payload is not None and payload.patch_id is not None:
        patch_result = await db.execute(
            select(Patch).where(
                Patch.id == payload.patch_id,
                Patch.finding_id == row.finding_id,
            )
        )
        patch_row = patch_result.scalar_one_or_none()
        if patch_row is None:
            raise HTTPException(status_code=404, detail="Patch not found for this finding")
        patch_diff = patch_row.diff
        patch_meta = {
            "patch_id": str(patch_row.id),
            "patch_status": patch_row.status.value
            if isinstance(patch_row.status, PatchStatus)
            else patch_row.status,
        }

    previous = dict(row.result) if isinstance(row.result, dict) else None
    outcome = await testgen.run_generated_test(
        src,
        filename,
        row.test_code,
        timeout_seconds=get_settings().sandbox_timeout_seconds,
        patch_diff=patch_diff,
    )
    row.status = "passed" if outcome["passed"] else "failed"
    row.result = outcome
    await db.commit()

    proof_of_fix: dict | None = None
    if patch_diff and outcome.get("patch_applied"):
        baseline_outcome = (previous or {}).get("outcome") if previous else None
        if baseline_outcome == "TEST_REPRODUCES_BUG" and outcome.get("outcome") == "TEST_DOES_NOT_REPRODUCE":
            proof_of_fix = {
                "verdict": "VERIFIED_FIX_PROOF",
                "baseline_outcome": "TEST_REPRODUCES_BUG",
                "patched_outcome": "TEST_DOES_NOT_REPRODUCE",
                "explanation": (
                    "The reproduction test failed on the vulnerable version and passes "
                    "with the patch applied — original FAIL, patched PASS."
                ),
            }
        elif previous and baseline_outcome is not None:
            proof_of_fix = {
                "verdict": "NO_PROOF",
                "baseline_outcome": baseline_outcome,
                "patched_outcome": outcome.get("outcome"),
                "explanation": "Baseline and patched runs did not both confirm the fix.",
            }
    return {
        "id": str(row.id),
        "status": row.status,
        "result": outcome,
        "patch": patch_meta,
        "proof_of_fix": proof_of_fix,
    }


@router.post("/{finding_id}/validate-counterexample")
async def validate_counterexample(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Proof-of-absence check: is the finding's sink path guarded by a sanitizer?

    Returns the counterexample proof when found (the claim does not hold on
    that path) or ``null`` when no sanitizer guards the sink."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "counterexample"))

    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.scan).selectinload(Scan.repository),
        )
        .join(Scan)
        .join(Repository)
        .where(Finding.id == finding_id, Repository.owner_id == current_user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")

    repository = finding.scan.repository
    src = ingest.source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository source is not available; run a scan first",
        )
    full = src / finding.file_path
    if not full.is_file():
        raise HTTPException(status_code=404, detail="Finding source file not found")

    from app.analysis.parsing import parse_source

    language = "python" if finding.file_path.endswith(".py") else "javascript"
    pf = parse_source(full.read_text(encoding="utf-8", errors="replace"), language, finding.file_path)
    source_lines = [
        e.line_start or 0
        for e in finding.evidence
        if e.kind.value in counterexamples._SOURCE_KINDS
    ]
    sink_lines = [
        e.line_start or 0
        for e in finding.evidence
        if e.kind.value in counterexamples._SINK_KINDS
    ]
    proof = counterexamples.validate_counterexample(pf, source_lines, sink_lines)
    return {"finding_id": str(finding.id), "counterexample": proof}


@router.post("/{finding_id}/validate")
async def validate_finding(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Run the full counterexample-based validation battery on a finding.

    Deterministic checks (claim chain, sanitizer guards, parameterization,
    authorization, exception handling, tests) produce an auditable verdict
    and every run is logged for research metrics.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "counterexample"))

    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.scan).selectinload(Scan.repository),
        )
        .join(Scan)
        .join(Repository)
        .where(Finding.id == finding_id, Repository.owner_id == current_user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    repository = finding.scan.repository
    src = ingest.source_dir(str(repository.id))
    if not src.exists():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Repository source is not available; run a scan first",
        )
    full = src / finding.file_path
    if not full.is_file():
        raise HTTPException(status_code=404, detail="Finding source file not found")

    from app.analysis.parsing import parse_source

    language = "python" if finding.file_path.endswith(".py") else "javascript"
    pf = parse_source(full.read_text(encoding="utf-8", errors="replace"), language, finding.file_path)
    verdict = validation.validate_finding(
        finding,
        pf,
        test_references=_find_test_references(src, finding.function_name or finding.title),
    )

    run = ValidationRun(
        finding_id=finding.id,
        claim=verdict["claim"],
        rule=verdict.get("rule"),
        status_before=verdict["original_status"],
        status_after=verdict["final_status"],
        confidence=verdict["confidence"],
        explanation=verdict["explanation"],
        checks=verdict["checks"],
        result=verdict,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    verdict["validation_run_id"] = str(run.id)
    return verdict


@router.get("/scan/{scan_id}/summary")
async def get_scan_findings_summary(
    scan_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get aggregated finding counts for a scan."""
    # Verify scan ownership
    scan_result = await db.execute(
        select(Scan)
        .join(Repository)
        .where(
            Scan.id == scan_id,
            Repository.owner_id == current_user.id,
        )
    )
    scan = scan_result.scalar_one_or_none()
    if scan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scan not found")

    from app.db.models import FindingCategory, FindingStatus, Severity

    # Total count
    total_result = await db.execute(select(func.count(Finding.id)).where(Finding.scan_id == scan_id))
    total = total_result.scalar() or 0

    # By category
    category_result = await db.execute(
        select(Finding.category, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.category)
    )
    by_category = {cat.value: 0 for cat in FindingCategory}
    for cat, count in category_result.all():
        by_category[cat.value] = count

    # By severity
    severity_result = await db.execute(
        select(Finding.severity, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.severity)
    )
    by_severity = {sev.value: 0 for sev in Severity}
    for sev, count in severity_result.all():
        by_severity[sev.value] = count

    # By status
    status_result = await db.execute(
        select(Finding.status, func.count(Finding.id))
        .where(Finding.scan_id == scan_id)
        .group_by(Finding.status)
    )
    by_status = {st.value: 0 for st in FindingStatus}
    for st, count in status_result.all():
        by_status[st.value] = count

    return {
        "total": total,
        "by_category": by_category,
        "by_severity": by_severity,
        "by_status": by_status,
    }


class FindingQuestionRequest(BaseModel):
    question: str = Field(min_length=3, max_length=500)
    use_llm: bool = False


async def _load_finding_chain(
    finding_id: uuid.UUID, db: AsyncSession, user
) -> Finding:
    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.scan).selectinload(Scan.repository),
            selectinload(Finding.patches).selectinload(Patch.verification_runs),
        )
        .join(Scan)
        .join(Repository)
        .where(Finding.id == finding_id, Repository.owner_id == user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    return finding


@router.get("/{finding_id}/impact")
async def get_finding_impact(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Why does this matter: impact + reachability for one finding."""
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "finding_impact"))
    finding = await _load_finding_chain(finding_id, db, current_user)
    src = source_dir(str(finding.scan.repository.id))
    graph = None
    if src.exists():
        from app.analysis.discovery import walk_repo_files
        from app.analysis.intel import _language_of
        from app.analysis.parsing import is_supported, parse_source

        parsed = {}
        try:
            files_raw, _ = walk_repo_files(src)
            for full in files_raw[: get_settings().intel_max_files]:
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
        except Exception:
            parsed = {}
        graph = KnowledgeGraph(list(parsed.values()))
    return impact.analyze_impact(finding, graph)


@router.post("/{finding_id}/chat")
async def chat_about_finding(
    finding_id: uuid.UUID,
    payload: FindingQuestionRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ask a question about one finding.

    Deterministic intents by default; ``use_llm`` upgrades open-ended questions
    to an LLM grounded in the finding's own evidence when a provider exists.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "finding_chat"))
    finding = await _load_finding_chain(finding_id, db, current_user)

    # similar findings = same signature in other completed scans of the repo
    similar: list[Finding] = []
    scan_result = await db.execute(
        select(Scan)
        .where(
            Scan.repository_id == finding.scan.repository_id,
            Scan.status == ScanStatus.completed,
            Scan.id != finding.scan_id,
        )
        .order_by(Scan.created_at.desc())
    )
    other_scans = list(scan_result.scalars().all())
    if other_scans:
        s_result = await db.execute(
            select(Finding)
            .options(selectinload(Finding.scan))
            .where(
                Finding.external_id == finding.external_id,
                Finding.scan_id.in_([s.id for s in other_scans]),
            )
        )
        similar = list(s_result.scalars().all())

    snippet: str | None = None
    src = source_dir(str(finding.scan.repository.id))
    if src.exists() and finding.file_path:
        try:
            target = (src / finding.file_path).resolve()
            if str(target).startswith(str(src.resolve())) and target.is_file():
                lines = target.read_text(encoding="utf-8", errors="replace").splitlines()
                start = max(0, (finding.line_start or 1) - 3)
                end = min(len(lines), (finding.line_end or finding.line_start or start + 1) + 3)
                snippet = "\n".join(
                    f"{i + 1}: {lines[i]}" for i in range(start, end)
                )
        except Exception:
            snippet = None

    result = findingchat.answer_finding_question(
        payload.question, finding, similar=similar, snippet=snippet
    )

    provider = build_llm_provider(get_settings())
    if payload.use_llm and provider is not None:
        evidence = json.dumps(
            {
                "finding": {
                    "title": finding.title,
                    "severity": finding.severity.value,
                    "status": finding.status.value,
                    "confidence": finding.confidence,
                    "category": finding.category.value,
                    "description": finding.description,
                    "impact": finding.impact,
                    "recommendation": finding.recommendation,
                    "file_path": finding.file_path,
                    "function_name": finding.function_name,
                    "line_start": finding.line_start,
                },
                "evidence": [
                    {
                        "kind": e.kind.value,
                        "description": e.description,
                        "file": e.file_path,
                        "line_start": e.line_start,
                        "line_end": e.line_end,
                        "snippet": (e.snippet or "")[:2000],
                    }
                    for e in sorted(finding.evidence, key=lambda x: x.order_index)
                ],
                "code_snippet": snippet,
            },
            default=str,
        )[:30000]
        system = load_prompt("system_security")
        template = load_prompt("finding_chat")
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


@router.get("/{finding_id}/proof-of-fix")
async def proof_of_fix(
    finding_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Consolidated Proof-of-Fix record for a finding.

    Decision is derived deterministically from recorded verification runs and
    reproduction-test outcomes — never from the LLM's self-assessment.
    """
    result = await db.execute(
        select(Finding)
        .options(
            selectinload(Finding.evidence),
            selectinload(Finding.patches)
            .selectinload(Patch.verification_runs)
            .selectinload(VerificationRun.test_results),
        )
        .join(Scan)
        .join(Repository)
        .where(Finding.id == finding_id, Repository.owner_id == current_user.id)
    )
    finding = result.scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=404, detail="Finding not found")

    test_result = await db.execute(
        select(GeneratedTest)
        .where(GeneratedTest.finding_id == finding.id)
        .order_by(GeneratedTest.created_at.desc())
        .limit(1)
    )
    reproduction = prooffix.reproduction_summary(test_result.scalar_one_or_none())

    patches = [
        prooffix.proof_for_patch(patch, reproduction)
        for patch in sorted(finding.patches, key=lambda p: p.created_at)
    ]

    # aggregate decision: any verified fix wins; else a rejection beats nothing;
    # otherwise report the state honestly (partial / unverifiable / none).
    decisions = [p["decision"] for p in patches]
    if "VERIFIED_FIX" in decisions:
        overall = {
            "decision": "VERIFIED_FIX",
            "reason": "At least one candidate patch passed all validation checks on actual execution.",
        }
        winner = next((p for p in patches if p["decision"] == "VERIFIED_FIX"), None)
        checks = (winner or {}).get("checks", [])
    elif "REJECTED_FIX" in decisions:
        overall = {
            "decision": "REJECTED_FIX",
            "reason": "Every validated patch failed at least one recorded check.",
        }
        checks = []
    elif decisions:
        has_partial = "PARTIALLY_VERIFIED" in decisions
        overall = {
            "decision": "PARTIALLY_VERIFIED" if has_partial else "UNVERIFIABLE",
            "reason": (
                "Validation could not fully complete; recorded evidence shows no counter-evidence."
                if has_partial
                else "No validation run produced usable evidence (environment or runner unavailable)."
            ),
        }
        checks = []
    else:
        overall = {"decision": None, "reason": "No candidate patch has been validated yet."}
        checks = []

    return {
        "finding_id": str(finding.id),
        "external_id": finding.external_id,
        "title": finding.title,
        "severity": finding.severity.value if hasattr(finding.severity, "value") else str(finding.severity),
        "status": finding.status.value if hasattr(finding.status, "value") else str(finding.status),
        "confidence": finding.confidence,
        "file_path": finding.file_path,
        "function_name": finding.function_name,
        "line_start": finding.line_start,
        "base_version": None,  # only meaningful for git sources; recorded when a commit is available
        "evidence_before": prooffix.evidence_before(finding),
        "reproduction": reproduction,
        "decision": overall["decision"],
        "decision_reason": overall["reason"],
        "checks": checks,
        "patches": patches,
        "recorded_at": datetime.now(UTC).isoformat(),
    }