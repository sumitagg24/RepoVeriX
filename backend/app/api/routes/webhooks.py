"""Repository webhooks: automatic re-analysis on push (GitHub + GitLab).

Providers POST push events to ``POST /api/v1/webhooks/{repository_id}``.
Security model:

- Each repository has a **shared secret** (``webhook_secret`` column, generated
  at import / rotateable). The sender signs the raw body with HMAC-SHA256 —
  GitHub in ``X-Hub-Signature-256``, GitLab in ``X-Gitlab-Token`` (token
  equality) — and this endpoint verifies against the *raw* bytes before any
  parsing, then compares in constant time.
- Event filtering: only push events for the repository's default branch
  trigger a re-scan; everything else is acknowledged with ``ignored``.
- Idempotent: an in-flight (pending/running) scan for the repository swallows
  duplicate deliveries instead of queueing a second run; the delivery id is
  also used as the scan's ``idempotency_key``.
- The webhook secret is returned once at creation and rotateable; it is never
  logged. Payload bodies are never persisted or logged (they may contain
  commit messages from private repos).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import Repository, Scan, ScanConfiguration, ScanStatus
from app.services import access

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

MAX_WEBHOOK_BODY_BYTES = 256 * 1024


def _github_signature(secret: str, body: bytes) -> str:
    return "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()


def verify_delivery(repository: Repository, request: Request, body: bytes) -> str:
    """Verify the provider signature; return the provider name.

    Constant-time comparisons on the raw body — never on parsed JSON.
    """
    secret = repository.webhook_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="No webhook secret configured for this repository — generate one first",
        )
    gh_sig = request.headers.get("x-hub-signature-256", "")
    gl_token = request.headers.get("x-gitlab-token", "")
    if gh_sig:
        if not hmac.compare_digest(gh_sig, _github_signature(secret, body)):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")
        return "github"
    if gl_token:
        if not hmac.compare_digest(gl_token, secret):
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Invalid signature")
        return "gitlab"
    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Missing signature header (X-Hub-Signature-256 or X-Gitlab-Token)",
    )


def extract_default_branch(provider: str, payload: dict) -> str | None:
    if provider == "github":
        ref = str(payload.get("ref") or "")
        return ref.removeprefix("refs/heads/") or None
    if provider == "gitlab":
        return str(payload.get("ref") or "").removeprefix("refs/heads/") or None
    return None


@router.post("/{repository_id}")
async def receive_webhook(
    repository_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """Receive a push webhook and trigger a re-scan of the default branch.

    Returns one of: ``scanned`` (a new scan was queued), ``in_flight`` (a scan
    is already running — duplicate delivery absorbed), ``ignored`` (event not
    relevant), or an HTTP error for signature/authorization problems.
    """
    body = await request.body()
    if len(body) > MAX_WEBHOOK_BODY_BYTES:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail="Payload too large")
    repository = (
        await db.execute(select(Repository).where(Repository.id == repository_id))
    ).scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    provider = verify_delivery(repository, request, body)

    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid JSON") from None
    if not isinstance(payload, dict):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")

    branch = extract_default_branch(provider, payload)
    if not branch or branch != repository.default_branch:
        return {"status": "ignored", "reason": f"branch '{branch}' is not the default branch"}

    # Idempotency: one in-flight scan per repository absorbs duplicate
    # deliveries (GitHub retries; GitLab may redeliver on timeout).
    in_flight = (
        await db.execute(
            select(Scan.id).where(
                Scan.repository_id == repository.id,
                Scan.status.in_([ScanStatus.pending, ScanStatus.running]),
            )
        )
    ).first()
    if in_flight is not None:
        return {"status": "in_flight", "scan_id": str(in_flight[0])}

    delivery_id = request.headers.get("x-github-delivery") or request.headers.get("x-gitlab-event-uuid") or ""

    scan = Scan(
        repository_id=repository.id,
        configuration=ScanConfiguration.static_llm,
        status=ScanStatus.pending,
        idempotency_key=f"webhook:{delivery_id}"[:128] if delivery_id else None,
    )
    db.add(scan)
    await db.commit()
    await db.refresh(scan)

    from app.analysis import runtime as scan_runtime
    from app.analysis.orchestrate import run_scan
    from app.db.database import SessionLocal

    scan_runtime.schedule_scan(scan.id, lambda sid: run_scan(SessionLocal, sid))
    return {"status": "scanned", "scan_id": str(scan.id)}


# --------------------------------------------------------------------------- management


@router.post("/{repository_id}/secret")
async def rotate_webhook_secret(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate/rotate the webhook secret (repository manager).

    The plaintext secret is returned exactly once — set it as the GitHub
    webhook's secret or the GitLab webhook's token.
    """
    import secrets

    try:
        repository = await access.load_repository(db, repository_id, current_user.id)
    except access.AccessDenied:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found") from None
    if not await access.can_manage(db, repository, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    secret = "rvxwh_" + secrets.token_urlsafe(24)
    repository.webhook_secret = secret
    await db.commit()
    return {
        "repository_id": str(repository.id),
        # Provider-specific setup instructions keep the integration honest.
        "secret": secret,
        "github": {
            "payload_url": "/api/v1/webhooks/" + str(repository.id),
            "content_type": "application/json",
            "events": ["push"],
        },
        "gitlab": {"url": "/api/v1/webhooks/" + str(repository.id), "trigger": ["push_events"]},
    }


@router.delete("/{repository_id}/secret", status_code=status.HTTP_204_NO_CONTENT)
async def clear_webhook_secret(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Disable webhook re-analysis for the repository (manager)."""
    try:
        repository = await access.load_repository(db, repository_id, current_user.id)
    except access.AccessDenied:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found") from None
    if not await access.can_manage(db, repository, current_user.id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    repository.webhook_secret = None
    await db.commit()
