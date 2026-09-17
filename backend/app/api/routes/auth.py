"""Authentication routes: signup, login, token refresh, account data export
and full account deletion (privacy / GDPR data-portability surface).

Login and signup are rate limited on BOTH the client IP and the account (email)
with an escalating backoff — thresholds live in Settings (see ratelimit.py).
"""

import shutil
from datetime import UTC, datetime
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.core import auth_errors
from app.core.config import get_settings
from app.core.errors import auth_error
from app.core.ratelimit import check_auth_attempt, enforce, reset_auth_attempts
from app.core.security import create_access_token, hash_password, verify_password
from app.db.models import (
    ChangeAudit,
    Finding,
    GeneratedTest,
    HealthSnapshot,
    OAuthAccount,
    PullRequestAudit,
    Repository,
    Scan,
    User,
    ValidationRun,
)
from app.schemas.auth import LoginRequest, SignupRequest, TokenResponse, UserRead
from app.services import account_security as acct
from app.services import authaudit, disposable, mailer
from app.services import passwords as pw

router = APIRouter(prefix="/auth", tags=["auth"])


def _normalize_email(email: str) -> str:
    """Store and compare emails case-insensitively."""
    return email.strip().lower()


@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def signup(payload: SignupRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Register a new account and return an access token.

    Server-side policy applied before any account exists: disposable-email
    blocking (maintained dataset + config extras) and the password-strength
    screen (length + breached-password list, no arbitrary complexity rules).
    The account starts unverified; a one-time verification link is emailed and
    expensive features stay gated until it is clicked (see the verification
    gate in ``app.services.account_security``).
    """
    settings = get_settings()
    if settings.rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = _normalize_email(payload.email)

    # Disposable / temporary email blocking — server-side, before creation.
    if settings.auth_block_disposable_email and disposable.is_disposable(email):
        raise auth_error(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            auth_errors.DISPOSABLE_EMAIL,
            "DISPOSABLE_EMAIL",
        )

    # Password policy: length + breached-password resistance.
    verdict = pw.check_password(payload.password)
    if not verdict.ok:
        raise auth_error(status.HTTP_422_UNPROCESSABLE_CONTENT, auth_errors.WEAK_PASSWORD, "WEAK_PASSWORD")

    result = await db.execute(select(User).where(User.email == email))
    if result.scalar_one_or_none():
        # Signup may reveal existence (the user is trying to create one) but
        # nothing more.
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user = User(
        email=email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    # Verification email (console backend in dev; SMTP when configured).
    # When the mail backend is the console logger there is no real delivery to
    # intercept, so the link is surfaced in the response (dev_verification_url)
    # to keep the signup loop completable by a human. SMTP mode never includes
    # it — the link travels by email only.
    dev_verification_url: str | None = None
    try:
        token = await acct.issue_verification_token(db, user)
        await mailer.send_verification_email(user.email, str(user.id), token)
        from app.api.routes.account_security import dev_verification_url

        dev_verification_url = dev_verification_url(user, token)
    except Exception:  # noqa: BLE001 — signup must not fail on mail delivery
        pass
    await authaudit.record(
        db,
        user_id=user.id,
        email=user.email,
        event=authaudit.AUTH_SIGNUP,
        ip=request.client.host if request.client else None,
    )

    if settings.rate_limit_enabled:
        reset_auth_attempts(email)
    access_token = create_access_token(user.id, token_version=user.token_version or 0)
    return TokenResponse(
        access_token=access_token, email_verified=False, dev_verification_url=dev_verification_url
    )


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    """Authenticate a user and return an access token."""
    if get_settings().rate_limit_enabled:
        enforce(check_auth_attempt(request, payload.email))

    email = _normalize_email(payload.email)
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    client_ip = request.client.host if request.client else None

    if not user or not verify_password(payload.password, user.hashed_password):
        # Persistent progressive lockout on the real account only — probing a
        # non-existent email must not be distinguishable from a wrong password.
        if user is not None:
            locked_for = await acct.record_failed_login(db, user)
            if locked_for > 0:
                await authaudit.record(
                    db,
                    user_id=user.id,
                    email=user.email,
                    event=authaudit.AUTH_ACCOUNT_LOCKED,
                    ip=client_ip,
                    detail={"locked_for_seconds": locked_for},
                )
                raise auth_error(
                    status.HTTP_423_LOCKED,
                    auth_errors.TEMPORARILY_LOCKED,
                    "TEMPORARILY_LOCKED",
                )
        if user is not None:
            await authaudit.record(
                db,
                user_id=user.id,
                email=user.email,
                event=authaudit.AUTH_LOGIN_FAILURE,
                ip=client_ip,
                detail={"reason": "bad_credentials"},
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=auth_errors.INVALID_CREDENTIALS,
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise auth_error(status.HTTP_403_FORBIDDEN, auth_errors.SUSPENDED, "SUSPENDED")

    # Still cooling down? (bad credentials above may not have been enough to
    # trigger it, but a lock from an earlier burst must hold).
    if acct.lockout_seconds_remaining(user) > 0:
        raise auth_error(status.HTTP_423_LOCKED, auth_errors.TEMPORARILY_LOCKED, "TEMPORARILY_LOCKED")

    # The verification policy is configurable: deployments without an email
    # backend can disable the gate (documented operator decision). The flag
    # must be honored here on the login path too, not only by
    # ensure_email_verified on the expensive-feature paths.
    if get_settings().auth_require_email_verification and not acct.is_verified(user):
        await authaudit.record(
            db,
            user_id=user.id,
            email=user.email,
            event=authaudit.AUTH_LOGIN_FAILURE,
            ip=client_ip,
            detail={"reason": "email_unverified"},
        )
        raise auth_error(status.HTTP_403_FORBIDDEN, auth_errors.EMAIL_NOT_VERIFIED, "EMAIL_NOT_VERIFIED")

    await acct.record_successful_login(db, user)
    if get_settings().rate_limit_enabled:
        reset_auth_attempts(email)
    await authaudit.record(
        db,
        user_id=user.id,
        email=user.email,
        event=authaudit.AUTH_LOGIN_SUCCESS,
        ip=client_ip,
    )
    access_token = create_access_token(user.id, token_version=user.token_version or 0)
    return TokenResponse(access_token=access_token, email_verified=True)


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: User = Depends(get_current_user),
):
    """Return the current authenticated user."""
    return current_user


@router.get("/me/export")
async def export_current_user_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a machine-readable export of everything the account owns.

    Privacy / data-portability endpoint: profile, connected OAuth accounts,
    repositories and every scan/finding recorded for them. Evidence code
    snippets and patch diffs are intentionally excluded from the export shape
    (they are derived analysis state), but every row's metadata is included so
    the export is a faithful record of the account's stored data.
    """
    repo_rows = (
        (
            await db.execute(
                select(Repository)
                .where(Repository.owner_id == current_user.id)
                .order_by(Repository.created_at)
            )
        )
        .scalars()
        .all()
    )
    repo_ids = [r.id for r in repo_rows]

    scans = []
    if repo_ids:
        scan_rows = (
            (await db.execute(select(Scan).where(Scan.repository_id.in_(repo_ids)).order_by(Scan.created_at)))
            .scalars()
            .all()
        )
        scan_ids = [s.id for s in scan_rows]
        findings_by_scan: dict[str, list[dict]] = {str(s.id): [] for s in scan_rows}
        if scan_ids:
            finding_rows = (
                (
                    await db.execute(
                        select(Finding).where(Finding.scan_id.in_(scan_ids)).order_by(Finding.created_at)
                    )
                )
                .scalars()
                .all()
            )
            for f in finding_rows:
                findings_by_scan.setdefault(str(f.scan_id), []).append(
                    {
                        "id": str(f.id),
                        "external_id": f.external_id,
                        "title": f.title,
                        "category": f.category.value if f.category else None,
                        "severity": f.severity.value if f.severity else None,
                        "status": f.status.value if f.status else None,
                        "source": f.source.value if f.source else None,
                        "file_path": f.file_path,
                        "function_name": f.function_name,
                        "line_start": f.line_start,
                        "line_end": f.line_end,
                        "created_at": f.created_at.isoformat() if f.created_at else None,
                    }
                )
        for s in scan_rows:
            scans.append(
                {
                    "id": str(s.id),
                    "repository_id": str(s.repository_id),
                    "configuration": s.configuration.value,
                    "status": s.status.value,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                    "started_at": s.started_at.isoformat() if s.started_at else None,
                    "finished_at": s.finished_at.isoformat() if s.finished_at else None,
                    "summary": s.summary,
                    "findings": findings_by_scan.get(str(s.id), []),
                }
            )

    repositories = [
        {
            "id": str(r.id),
            "name": r.name,
            "source_type": r.source_type.value,
            "source_url": r.source_url,
            "status": r.status,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in repo_rows
    ]

    oauth_account_rows = (
        (await db.execute(select(OAuthAccount).where(OAuthAccount.user_id == current_user.id)))
        .scalars()
        .all()
    )
    oauth_accounts = []
    for account in oauth_account_rows:
        oauth_accounts.append(
            {
                "provider": account.provider,
                "provider_user_id": account.provider_user_id,
                "provider_email": account.provider_email,
            }
        )

    return {
        "exported_at": datetime.now(UTC).isoformat(),
        "profile": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "plan": current_user.plan.value,
            "subscription_status": (
                current_user.subscription_status.value if current_user.subscription_status else None
            ),
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "oauth_accounts": oauth_accounts,
        "repositories": repositories,
        "scans": scans,
    }


@router.delete("/me")
async def delete_current_user(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Permanently delete the account and every byte it owns.

    Removes database rows (via the ORM relationship cascade for the wired
    graph, plus explicit deletes for rows not wired into it), the on-disk
    repository working copies/archives under ``REPOVERIX_REPOSITORY_STORAGE_DIR``
    and the user row itself. There is no undo — callers must confirm first.
    Active Stripe subscriptions are *not* cancelled here because doing so
    requires the payment provider; operators should cancel via the billing
    dashboard (the webhook will then observe the account is gone).
    """
    repo_rows = (
        (await db.execute(select(Repository).where(Repository.owner_id == current_user.id))).scalars().all()
    )
    repo_ids = [r.id for r in repo_rows]

    # Children whose FK points at repositories but are not wired into the ORM
    # cascade graph must be removed explicitly (PostgreSQL would cascade via
    # ondelete, SQLite with FKs off would leave orphans).
    if repo_ids:
        scan_ids = (await db.execute(select(Scan.id).where(Scan.repository_id.in_(repo_ids)))).scalars().all()
        finding_ids = []
        if scan_ids:
            finding_ids = (
                (await db.execute(select(Finding.id).where(Finding.scan_id.in_(scan_ids)))).scalars().all()
            )
        if finding_ids:
            await db.execute(delete(ValidationRun).where(ValidationRun.finding_id.in_(finding_ids)))
            await db.execute(delete(GeneratedTest).where(GeneratedTest.finding_id.in_(finding_ids)))
        await db.execute(delete(HealthSnapshot).where(HealthSnapshot.repository_id.in_(repo_ids)))
        await db.execute(delete(ChangeAudit).where(ChangeAudit.repository_id.in_(repo_ids)))
        await db.execute(delete(PullRequestAudit).where(PullRequestAudit.repository_id.in_(repo_ids)))

    # On-disk working copies and uploaded archives live under the storage root
    # keyed by repository id; remove each directory (never follow symlinks).
    storage_root = Path(get_settings().repository_storage_dir)
    for repo_id in repo_ids:
        target = storage_root / str(repo_id)
        if target.exists():
            shutil.rmtree(target, ignore_errors=True)

    # Durable artifact copies (object storage in production) must go too.
    try:
        from app.core.artifacts import get_artifact_storage

        artifacts = get_artifact_storage()
        for repo_id in repo_ids:
            artifacts.delete(f"archives/{repo_id}/archive.zip")
    except Exception:  # noqa: BLE001 - deletion best-effort, never blocks the flow
        pass

    await db.delete(current_user)  # cascades repositories -> scans -> findings/etc.
    await db.commit()
    return {"detail": "Account and all associated data have been deleted."}
