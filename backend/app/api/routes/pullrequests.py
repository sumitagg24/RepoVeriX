"""GitHub pull-request auditor routes.

- ``POST /repositories/{id}/pull-requests/analyze``  analyze PR #N (fetch refs,
  diff, impact, findings, regression risks) and store the review
- ``GET  /repositories/{id}/pull-requests``          audits for one repository
- ``GET  /pull-requests``                            audits across user repos
- ``GET  /pull-requests/{audit_id}``                 one stored review
- ``POST /repositories/{id}/pull-requests/{audit_id}/post``
    explicitly post the review to GitHub as inline comments — never automatic

GitHub tokens are read from the user's connected OAuth account or the server
``REPOVERIX_GITHUB_TOKEN``; they are only used in the Authorization header.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.analysis import changes, pr_audit
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import Finding, PullRequestAudit, Repository, Scan, ScanStatus
from app.services import github as gh

router = APIRouter(prefix="/repositories", tags=["pull-requests"])
list_router = APIRouter(prefix="/pull-requests", tags=["pull-requests"])


class PullRequestAnalyzeRequest(BaseModel):
    pr_number: int = Field(ge=1, le=1_000_000)


def _review_meta(audit: PullRequestAudit, repository_name: str | None = None) -> dict:
    return {
        "id": str(audit.id),
        "repository_id": str(audit.repository_id),
        "repository_name": repository_name,
        "pr_number": audit.pr_number,
        "pr_title": audit.pr_title,
        "pr_url": audit.pr_url,
        "author": audit.author,
        "base_ref": audit.base_ref,
        "base_sha": audit.base_sha,
        "head_ref": audit.head_ref,
        "head_sha": audit.head_sha,
        "risk_score": audit.risk_score,
        "risk_level": audit.risk_level,
        "changed_files": audit.changed_files or [],
        "finding_count": len(audit.findings or []),
        "comment_count": len((audit.review or {}).get("comments", [])),
        "posted": audit.posted,
        "posted_at": audit.posted_at.isoformat() if audit.posted_at else None,
        "created_at": audit.created_at.isoformat(),
    }


async def _load_repository(repository_id: uuid.UUID, db: AsyncSession, user) -> Repository:
    result = await db.execute(
        select(Repository)
        .options(selectinload(Repository.oauth_account), selectinload(Repository.insight))
        .where(Repository.id == repository_id, Repository.owner_id == user.id)
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=404, detail="Repository not found")
    return repository


def _clone_or_409(repository: Repository):
    try:
        return pr_audit.ensure_git_backed(repository)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc


def _github_token(repository: Repository) -> str | None:
    settings = get_settings()
    from app.core.crypto import decrypt_token

    oauth = repository.oauth_account
    stored = oauth.access_token if oauth is not None and oauth.provider == "github" else None
    return gh.resolve_token(settings, oauth_access_token=decrypt_token(stored))


def _github_ident_or_409(repository: Repository, need_token: bool = False) -> tuple[str, str, str | None]:
    ident = gh.repo_ident(repository.source_url)
    if ident is None:
        raise HTTPException(
            status_code=409,
            detail="Repository is not linked to a GitHub URL — PR auditing requires a GitHub source",
        )
    owner, repo = ident
    token = _github_token(repository)
    if need_token and not token:
        raise HTTPException(
            status_code=409,
            detail=(
                "Posting a review needs a GitHub token with write access. "
                "Connect your GitHub account or set REPOVERIX_GITHUB_TOKEN."
            ),
        )
    return owner, repo, token


# --------------------------------------------------------------------------- analyze


@router.post("/{repository_id}/pull-requests/analyze")
async def analyze_pull_request(
    repository_id: uuid.UUID,
    payload: PullRequestAnalyzeRequest,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Fetch a GitHub PR, diff base...head, and produce a stored review."""
    settings = get_settings()
    if settings.rate_limit_enabled:
        enforce(check_action(str(current_user.id), "change_audit"))
    if settings.billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "pull-request-audit")
    repository = await _load_repository(repository_id, db, current_user)
    owner, repo, token = _github_ident_or_409(repository)
    src = _clone_or_409(repository)

    try:
        pr = await gh.fetch_pr(owner, repo, payload.pr_number, token=token)
    except gh.GithubApiError as exc:
        status_code = exc.status if exc.status in (401, 403, 404) else 400
        raise HTTPException(status_code=status_code, detail=str(exc)) from exc

    base_ref, base_sha, head_ref, head_sha = pr.base_ref, pr.base_sha, pr.head_ref, pr.head_sha
    tag = f"{repository.id.hex[:6]}-pr{pr.number}"
    wt: object | None = None
    try:
        await pr_audit.prepare_commits(src, pr, owner=owner, repo=repo, token=token)
        hunks, _raw = await changes.git_diff(src, base_sha, head_sha)
        if not hunks:
            raise HTTPException(status_code=422, detail="The pull request has no file changes to audit")
        wt = await pr_audit.open_worktree(src, head_sha, tag)

        # previous repository findings, used for regression-risk flags
        latest_result = await db.execute(
            select(Scan)
            .where(Scan.repository_id == repository.id, Scan.status == ScanStatus.completed)
            .order_by(Scan.created_at.desc())
            .limit(1)
        )
        latest_scan = latest_result.scalar_one_or_none()
        previous_findings: list[Finding] = []
        if latest_scan is not None:
            prev_result = await db.execute(
                select(Finding).where(Finding.scan_id == latest_scan.id).limit(600)
            )
            previous_findings = list(prev_result.scalars().all())

        review = await pr_audit.analyze_pull_request(
            repository=repository,
            src=src,
            pr=pr,
            hunks=hunks,
            wt=wt,
            previous_findings=previous_findings,
        )
    except HTTPException:
        raise
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    finally:
        if wt is not None:
            await pr_audit.close_worktree(src, wt)

    # replace any previous audit of the same PR (re-analysis), preserving posted state
    existing_result = await db.execute(
        select(PullRequestAudit).where(
            PullRequestAudit.repository_id == repository.id,
            PullRequestAudit.pr_number == payload.pr_number,
        )
    )
    existing = existing_result.scalar_one_or_none()
    posted_before = existing.posted if existing is not None else False
    posted_at_before = existing.posted_at if existing is not None else None
    if existing is not None:
        await db.execute(
            delete(PullRequestAudit).where(
                PullRequestAudit.repository_id == repository.id,
                PullRequestAudit.pr_number == payload.pr_number,
            )
        )

    row = PullRequestAudit(
        repository_id=repository.id,
        pr_number=pr.number,
        pr_title=pr.title[:500],
        pr_url=pr.html_url,
        author=pr.author,
        base_ref=base_ref,
        base_sha=base_sha,
        head_ref=head_ref,
        head_sha=head_sha,
        risk_score=float(review["risk_score"]),
        risk_level=review["risk_level"],
        changed_files=review["changed_files"],
        findings=review["findings"],
        review=review,
        posted=posted_before,
        posted_at=posted_at_before,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    review["audit_id"] = str(row.id)
    review["posted"] = row.posted
    return review


# --------------------------------------------------------------------------- history


@router.get("/{repository_id}/pull-requests")
async def pull_requests_for_repository(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _load_repository(repository_id, db, current_user)
    result = await db.execute(
        select(PullRequestAudit)
        .where(PullRequestAudit.repository_id == repository_id)
        .order_by(PullRequestAudit.created_at.desc())
        .limit(100)
    )
    return [_review_meta(a) for a in result.scalars().all()]


@list_router.get("")
async def pull_requests_all(
    repository_id: uuid.UUID | None = Query(default=None),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """PR audits across the user's repositories (optionally filtered by repo)."""
    query = (
        select(PullRequestAudit, Repository.name)
        .join(Repository, Repository.id == PullRequestAudit.repository_id)
        .where(Repository.owner_id == current_user.id)
        .order_by(PullRequestAudit.created_at.desc())
        .limit(100)
    )
    if repository_id is not None:
        query = query.where(PullRequestAudit.repository_id == repository_id)
    result = await db.execute(query)
    out = []
    for audit, repo_name in result.all():
        out.append(_review_meta(audit, repository_name=repo_name))
    return out


@list_router.get("/{audit_id}")
async def pull_request_audit_detail(
    audit_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PullRequestAudit, Repository.name)
        .join(Repository, Repository.id == PullRequestAudit.repository_id)
        .where(
            PullRequestAudit.id == audit_id,
            Repository.owner_id == current_user.id,
        )
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Pull request audit not found")
    audit, repo_name = row
    payload = audit.review or {}
    payload["audit_id"] = str(audit.id)
    payload["repository_id"] = str(audit.repository_id)
    payload["repository_name"] = repo_name
    payload["posted"] = audit.posted
    payload["posted_at"] = audit.posted_at.isoformat() if audit.posted_at else None
    return payload


# --------------------------------------------------------------------------- post review


@router.post("/{repository_id}/pull-requests/{audit_id}/post")
async def post_pull_request_review(
    repository_id: uuid.UUID,
    audit_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Explicitly post the stored review to GitHub as an inline COMMENT review.

    This never happens automatically — the UI shows a preview and the user
    clicks "Post review". Requires a GitHub token with write access.
    """
    if get_settings().billing_enforce:
        from app.services.billing import require_premium

        await require_premium(db, current_user, "pull-request-audit")
    repository = await _load_repository(repository_id, db, current_user)
    result = await db.execute(
        select(PullRequestAudit).where(
            PullRequestAudit.id == audit_id,
            PullRequestAudit.repository_id == repository.id,
        )
    )
    audit = result.scalar_one_or_none()
    if audit is None:
        raise HTTPException(status_code=404, detail="Pull request audit not found")
    if audit.posted:
        return {"status": "already_posted", "audit_id": str(audit.id), "posted": True}

    owner, repo, token = _github_ident_or_409(repository, need_token=True)
    review = audit.review or {}
    summary = review.get("summary") or ""
    stats = review.get("stats") or {}
    body = (
        f"### RepoVeriX PR audit — risk {audit.risk_score}/100 ({audit.risk_level.upper()})\n\n"
        f"{summary[:1200]}\n\n"
        f"- Findings: {stats.get('findings', 0)} "
        f"({stats.get('verified_findings', 0)} verified, {stats.get('probable_findings', 0)} probable)\n"
        f"- Regression risks: {stats.get('regression_risks', 0)} · "
        f"Tests to run: {len(review.get('tests_to_run', []) or [])}\n\n"
        f"_Posted manually from RepoVeriX — every inline comment is grounded in "
        f"deterministic evidence from the change audit._"
    )
    comments = [c for c in (review.get("comments") or []) if c.get("path") and c.get("line")]
    try:
        created = await gh.post_pr_review(
            owner,
            repo,
            audit.pr_number,
            body=body,
            comments=comments,
            token=token,
        )
    except gh.GithubApiError as exc:
        status_code = exc.status if exc.status in (401, 403, 404, 422) else 400
        raise HTTPException(status_code=status_code, detail=f"GitHub rejected the review: {exc}") from exc

    audit.posted = True
    audit.posted_at = datetime.now(UTC)
    await db.commit()
    return {
        "status": "posted",
        "audit_id": str(audit.id),
        "review_id": created.get("id"),
        "html_url": created.get("html_url"),
        "comment_count": len(comments),
    }
