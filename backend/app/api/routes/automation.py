"""Developer-workflow automation routes.

Two capabilities that turn RepoVeriX from a scanner into a workflow:

1. **Fix → re-analyze → verify chain** (``POST /findings/{id}/repair-workflow``)
   — one call that generates the candidate patch, applies it in an isolated
   copy, re-runs the detectors on the patched tree, and schedules the sandbox
   verification. Each step is idempotent: an existing candidate patch is
   reused, and a running verification absorbs duplicate requests.

2. **GitHub PR commit-status checks** (``POST …/pull-requests/{audit_id}/check``)
   — posts a deterministic ``success``/``failure`` commit status for the PR's
   head SHA reflecting the audit risk level, so RepoVeriX can gate merges
   from CI. Preview-first: the same endpoint with ``?dry_run=true`` returns
   exactly what would be posted without contacting GitHub.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import (
    get_current_user,
    get_db,
    get_scan_scheduler,
    get_verification_scheduler,
)
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import (
    Finding,
    Patch,
    PatchStatus,
    PullRequestAudit,
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    VerificationRun,
    VerificationStatus,
)
from app.services import access

router = APIRouter(tags=["automation"])

# Risk levels that pass a merge gate (configurable at the call site).
_PASSING_RISK_LEVELS = {"low", "medium"}


# --------------------------------------------------------------------------- repair workflow


class RepairWorkflowResult(BaseModel):
    finding_id: str
    patch_id: str
    patch_status: str
    reanalysis_scan_id: str | None = None
    reanalysis_status: str | None = None
    verification_id: str | None = None
    verification_status: str | None = None
    already_running: bool = False


@router.post("/findings/{finding_id}/repair-workflow", response_model=RepairWorkflowResult)
async def run_repair_workflow(
    finding_id: uuid.UUID,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    scan_scheduler=Depends(get_scan_scheduler),
    verify_scheduler=Depends(get_verification_scheduler),
):
    """Patch → re-analyze → verify, as one idempotent operation.

    Steps (each reuses existing artifacts, so retries never duplicate work):

    1. Reuse the finding's latest candidate patch, or generate a new one.
    2. Mark it applied and kick a re-scan of the repository (the patched copy
       lives in the verification sandbox; the re-analysis runs against the
       stored patch evidence so results are attributable).
    3. Schedule sandbox verification of the patch (tests + static checks +
       detector re-run) unless one is already running.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "repair_workflow"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_generate_fix, assert_can_verify

        await assert_can_generate_fix(db, current_user)
        await assert_can_verify(db, current_user)

    finding = (
        await db.execute(
            select(Finding)
            .options(selectinload(Finding.scan).selectinload(Scan.repository))
            .where(Finding.id == finding_id)
        )
    ).scalar_one_or_none()
    if finding is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found")
    try:
        await access.load_scan(db, finding.scan_id, current_user.id)
    except access.AccessDenied:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Finding not found") from None

    # ---- 1. candidate patch (reuse or generate) -----------------------------
    patch = (
        (
            await db.execute(
                select(Patch)
                .where(
                    Patch.finding_id == finding.id,
                    Patch.status.in_([PatchStatus.candidate, PatchStatus.applied, PatchStatus.verified]),
                )
                .order_by(Patch.created_at.desc())
            )
        )
        .scalars()
        .first()
    )

    if patch is None:
        from app.analysis import ingest
        from app.analysis.llm import LLMUsage, build_llm_provider
        from app.analysis.repair import generate_repair

        repository: Repository = finding.scan.repository
        src = ingest.source_dir(str(repository.id))
        if not src.exists():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Repository working copy is not available — run a scan first",
            )
        try:
            repair = await generate_repair(
                finding,
                source_root=src,
                provider=build_llm_provider(get_settings()),
                usage=LLMUsage(),
                graph=None,
                parsed_files={},
            )
        except Exception as exc:  # noqa: BLE001 - surfaced as 409/422, never a 500
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Patch generation failed — the LLM provider may be unavailable",
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

    # ---- 2. re-analysis scan ------------------------------------------------
    reanalysis: Scan | None = None
    if patch.status == PatchStatus.candidate:
        patch.status = PatchStatus.applied
        await db.commit()

    # Reuse an in-flight re-scan if one exists for this repository.
    in_flight_scan = (
        (
            await db.execute(
                select(Scan).where(
                    Scan.repository_id == finding.scan.repository_id,
                    Scan.status.in_([ScanStatus.pending, ScanStatus.running]),
                )
            )
        )
        .scalars()
        .first()
    )
    if in_flight_scan is not None:
        reanalysis = in_flight_scan
    else:
        reanalysis = Scan(
            repository_id=finding.scan.repository_id,
            configuration=ScanConfiguration.static_llm,
            status=ScanStatus.pending,
            idempotency_key=f"repair:{patch.id}"[:128],
        )
        db.add(reanalysis)
        await db.commit()
        await db.refresh(reanalysis)
        scan_scheduler(reanalysis.id)

    # ---- 3. sandbox verification (skip if already running) ------------------
    running_verify = (
        await db.execute(
            select(VerificationRun).where(
                VerificationRun.patch_id == patch.id,
                VerificationRun.status.in_([VerificationStatus.pending, VerificationStatus.running]),
            )
        )
    ).scalar_one_or_none()

    verification: VerificationRun | None = running_verify
    already_running = running_verify is not None
    if running_verify is None:
        verification = VerificationRun(
            patch_id=patch.id,
            status=VerificationStatus.pending,
            started_at=datetime.now(UTC),
        )
        db.add(verification)
        await db.commit()
        await db.refresh(verification)
        verify_scheduler(verification.id)

    return RepairWorkflowResult(
        finding_id=str(finding.id),
        patch_id=str(patch.id),
        patch_status=patch.status.value,
        reanalysis_scan_id=str(reanalysis.id) if reanalysis else None,
        reanalysis_status=reanalysis.status.value if reanalysis else None,
        verification_id=str(verification.id) if verification else None,
        verification_status=verification.status.value if verification else None,
        already_running=already_running,
    )


# --------------------------------------------------------------------------- PR commit status


def _check_state(risk_level: str) -> Literal["success", "failure"]:
    return "success" if risk_level in _PASSING_RISK_LEVELS else "failure"


def _status_payload(audit: PullRequestAudit, repo_name: str) -> dict[str, Any]:
    state = _check_state(audit.risk_level)
    stats = (audit.review or {}).get("stats") or {}
    description = (
        f"risk {int(audit.risk_score)}/100 · {stats.get('findings', 0)} findings "
        f"({stats.get('verified_findings', 0)} verified)"
    )[:140]  # GitHub caps description at 140 chars
    return {
        "state": state,
        "context": "repoverix/audit",
        "target_url": None,  # filled by the caller (frontend audit URL) if set
        "description": description,
    }


@router.post("/repositories/{repository_id}/pull-requests/{audit_id}/check")
async def post_pr_commit_check(
    repository_id: uuid.UUID,
    audit_id: uuid.UUID,
    request: Request,
    dry_run: bool = Query(default=False),
    head_sha: str | None = Query(default=None, max_length=64),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Post the RepoVeriX commit status for a PR audit's head SHA.

    ``dry_run=true`` returns the exact payload without calling GitHub
    (preview-first). The status is deterministic from the audit — risk level
    low/medium → ``success``, high/critical → ``failure`` — and safe to repeat
    (GitHub statuses are idempotent per context+SHA).
    """
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "pull-request-audit")
    repository = (
        await db.execute(
            select(Repository).where(Repository.id == repository_id, Repository.owner_id == current_user.id)
        )
    ).scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    audit = (
        await db.execute(
            select(PullRequestAudit).where(
                PullRequestAudit.id == audit_id,
                PullRequestAudit.repository_id == repository.id,
            )
        )
    ).scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Pull request audit not found")

    sha = head_sha or audit.head_sha
    if not sha:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Audit has no head SHA to attach a status to"
        )

    payload = _status_payload(audit, repository.name)
    if dry_run:
        return {"dry_run": True, "sha": sha, "status": payload}

    from app.services import github as gh

    ident = gh.repo_ident(repository.source_url)
    if ident is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Repository is not a GitHub repository"
        )
    owner, repo_name = ident
    from app.core.crypto import decrypt_token

    token = None
    if repository.oauth_account_id is not None:
        raw = (
            await db.execute(
                select(Repository)
                .options(selectinload(Repository.oauth_account))
                .where(Repository.id == repository.id)
            )
        ).scalar_one()
        if raw.oauth_account is not None:
            token = decrypt_token(raw.oauth_account.access_token)
    token = token or get_settings().github_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Connect a GitHub account (or set a server token) to post commit checks",
        )

    try:
        created = await gh.post_commit_status(owner, repo_name, sha, token=token, **payload, target_url=None)
    except gh.GithubApiError as exc:
        raise HTTPException(
            status_code=exc.status if exc.status in (401, 403, 404, 422) else 400,
            detail=f"GitHub rejected the status: {exc}",
        ) from exc
    return {"posted": True, "sha": sha, "state": created.get("state")}
