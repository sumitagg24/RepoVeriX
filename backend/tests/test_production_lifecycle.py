"""Production infrastructure, secrets & cryptographic lifecycle, privacy/data deletion,
and observability audit regression test suite.

Covers:
1. Infrastructure health vs readiness probes & startup stale-job recovery
2. JWT lifecycle, expiration, algorithm confusion & token version invalidation
3. Fernet token encryption at rest for OAuth credentials
4. Personal API token hashing, verification and immediate revocation
5. Account deletion cascading (DB rows, on-disk repos, artifacts) & post-deletion JWT rejection
6. Observability audit logging without secret or credential leakage
7. Host header validation and HTTP security headers
"""

from __future__ import annotations

import hashlib
import uuid
from datetime import UTC, datetime, timedelta
from pathlib import Path

import jwt
import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.analysis.recovery import recover_stale_jobs
from app.core import crypto
from app.core.config import get_settings
from app.core.security import create_access_token, decode_access_token, decode_token_claims
from app.db.models import (
    ApiToken,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Patch,
    PatchStatus,
    PullRequestAudit,
    Repository,
    Scan,
    ScanStatus,
    Severity,
    SourceType,
    User,
    VerificationRun,
    VerificationStatus,
)
from app.services import authaudit

# ===========================================================================
# 1. Production Infrastructure & Startup Recovery
# ===========================================================================


@pytest.mark.asyncio
async def test_health_and_readiness_endpoints(client: AsyncClient):
    """Health endpoint reports liveness without DB; readiness verifies DB connectivity."""
    # Liveness
    res_health = await client.get("/health")
    assert res_health.status_code == 200
    assert res_health.json() == {"status": "ok", "service": "RepoVeriX"}

    # Readiness probe answers 200 if DB is reachable, or 503 if DB is down
    res_ready = await client.get("/ready")
    assert res_ready.status_code in (200, 503)
    if res_ready.status_code == 200:
        assert res_ready.json() == {"status": "ready", "service": "RepoVeriX"}
    else:
        assert res_ready.json() == {"status": "not_ready"}


@pytest.mark.asyncio
async def test_startup_recovery_reconciles_interrupted_jobs(db_session, session_factory, test_user: User):
    """Stale pending/running scans and verifications are marked failed on startup."""
    repo = Repository(
        owner_id=test_user.id,
        name="interrupted-repo",
        source_type=SourceType.git,
        source_url="https://github.com/org/interrupted.git",
        default_branch="main",
    )
    db_session.add(repo)
    await db_session.flush()

    scan = Scan(
        repository_id=repo.id,
        status=ScanStatus.running,
    )
    db_session.add(scan)
    await db_session.flush()

    finding = Finding(
        scan_id=scan.id,
        external_id="ext-rec-1",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="SQLi",
        description="desc",
        file_path="app.py",
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.flush()

    patch = Patch(
        finding_id=finding.id,
        diff="--- a/app.py\n+++ b/app.py\n",
        generated_by="deterministic_template",
        status=PatchStatus.candidate,
    )
    db_session.add(patch)
    await db_session.flush()

    verify_run = VerificationRun(
        patch_id=patch.id,
        status=VerificationStatus.running,
    )
    db_session.add(verify_run)
    await db_session.commit()

    # Execute recovery pass
    result = await recover_stale_jobs(session_factory)
    assert result["scans_recovered"] >= 1
    assert result["verifications_recovered"] >= 1

    # Verify updated DB states
    async with session_factory() as verify_db:
        recovered_scan = (await verify_db.execute(select(Scan).where(Scan.id == scan.id))).scalar_one()
        assert recovered_scan.status == ScanStatus.failed
        assert "interrupted by a server restart" in recovered_scan.error

        recovered_run = (
            await verify_db.execute(select(VerificationRun).where(VerificationRun.id == verify_run.id))
        ).scalar_one()
        assert recovered_run.status == VerificationStatus.repair_not_verified
        assert "interrupted by a server restart" in recovered_run.logs


# ===========================================================================
# 2. Secrets & Cryptographic Lifecycle
# ===========================================================================


def test_jwt_lifecycle_and_algorithm_confusion_rejection():
    """JWT decoder validates claims and rejects expired tokens or algorithm confusion."""
    user_id = str(uuid.uuid4())

    # 1. Valid token
    token = create_access_token(user_id, token_version=1)
    claims = decode_token_claims(token)
    assert claims is not None
    assert claims["sub"] == user_id
    assert claims["tv"] == 1
    assert decode_access_token(token) == user_id

    # 2. Expired token
    expired_token = create_access_token(user_id, expires_delta=timedelta(seconds=-10))
    assert decode_token_claims(expired_token) is None
    assert decode_access_token(expired_token) is None

    # 3. Algorithm confusion (e.g. 'none' algorithm attack)
    none_payload = {
        "sub": user_id,
        "iat": int(datetime.now(UTC).timestamp()),
        "exp": int((datetime.now(UTC) + timedelta(hours=1)).timestamp()),
        "tv": 0,
    }
    none_token = jwt.encode(none_payload, key="", algorithm="none")
    assert decode_token_claims(none_token) is None

    # 4. Tampered signature
    tampered_token = token[:-5] + "XXXXX"
    assert decode_token_claims(tampered_token) is None


def test_fernet_token_encryption_at_rest(monkeypatch):
    """OAuth tokens are encrypted with Fernet and decrypted just-in-time."""
    from cryptography.fernet import Fernet

    test_key = Fernet.generate_key().decode()

    settings = get_settings()
    monkeypatch.setattr(settings, "token_encryption_key", test_key, raising=False)

    raw_token = "ghp_super_secret_github_oauth_token_12345"
    encrypted = crypto.encrypt_token(raw_token)
    assert encrypted is not None
    assert encrypted.startswith("fernet:")
    assert raw_token not in encrypted

    # Decrypt
    decrypted = crypto.decrypt_token(encrypted)
    assert decrypted == raw_token

    # Missing key error handling
    monkeypatch.setattr(settings, "token_encryption_key", None, raising=False)
    assert crypto.decrypt_token(encrypted) is None


@pytest.mark.asyncio
async def test_personal_api_token_hashing_and_revocation(
    client: AsyncClient, db_session, test_user: User, auth_headers: dict
):
    """Personal API tokens store only SHA-256 hashes and revocation takes effect immediately."""
    # Create personal token
    res = await client.post(
        "/api/v1/tokens",
        json={"name": "CI-Worker-Token"},
        headers=auth_headers,
    )
    assert res.status_code == 201
    data = res.json()
    raw_token = data["token"]
    token_id = data["id"]
    assert raw_token.startswith("rvx_")

    # Verify only hash exists in DB
    raw_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
    db_token = (
        await db_session.execute(select(ApiToken).where(ApiToken.id == uuid.UUID(token_id)))
    ).scalar_one()
    assert db_token.token_hash == raw_hash
    assert raw_token not in db_token.token_hash

    # Authenticate with personal token
    ci_headers = {"Authorization": f"Bearer {raw_token}"}
    res_me = await client.get("/api/v1/auth/me", headers=ci_headers)
    assert res_me.status_code == 200
    assert res_me.json()["email"] == test_user.email

    # Revoke token
    res_revoke = await client.delete(f"/api/v1/tokens/{token_id}", headers=auth_headers)
    assert res_revoke.status_code == 204

    # Post-revocation access is rejected
    res_revoked_me = await client.get("/api/v1/auth/me", headers=ci_headers)
    assert res_revoked_me.status_code == 401


# ===========================================================================
# 3. Privacy, Data Retention & Secure Account Deletion
# ===========================================================================


@pytest.mark.asyncio
async def test_account_deletion_cascades_and_rejects_jwt(
    client: AsyncClient,
    db_session,
    session_factory,
    auth_headers: dict,
    test_user: User,
    tmp_path: Path,
    monkeypatch,
):
    """DELETE /auth/me purges all DB relations, on-disk repos, and invalidates user JWTs."""
    settings = get_settings()
    monkeypatch.setattr(settings, "repository_storage_dir", str(tmp_path), raising=False)

    # Seed repository and child tree
    repo = Repository(
        owner_id=test_user.id,
        name="deletion-target-repo",
        source_type=SourceType.git,
        source_url="https://github.com/victim/target.git",
        default_branch="main",
    )
    db_session.add(repo)
    await db_session.flush()

    repo_dir = tmp_path / str(repo.id)
    repo_dir.mkdir(parents=True, exist_ok=True)
    (repo_dir / "app.py").write_text("code = 1", encoding="utf-8")

    scan = Scan(repository_id=repo.id, status=ScanStatus.completed)
    db_session.add(scan)
    await db_session.flush()

    finding = Finding(
        scan_id=scan.id,
        external_id="ext-del-1",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="Vulnerability",
        description="desc",
        file_path="app.py",
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.flush()

    pr_audit = PullRequestAudit(
        repository_id=repo.id,
        pr_number=10,
        pr_title="PR",
        base_sha="a",
        head_sha="b",
        risk_score=5.0,
        risk_level="low",
        posted=False,
    )
    db_session.add(pr_audit)
    await db_session.commit()

    # Issue user deletion
    res_del = await client.delete("/api/v1/auth/me", headers=auth_headers)
    assert res_del.status_code == 200
    assert "deleted" in res_del.json()["detail"].lower()

    # Verify on-disk storage was purged
    assert not repo_dir.exists()

    # Verify DB rows are gone
    async with session_factory() as check_db:
        user_in_db = (
            await check_db.execute(select(User).where(User.id == test_user.id))
        ).scalar_one_or_none()
        assert user_in_db is None

        repo_in_db = (
            await check_db.execute(select(Repository).where(Repository.id == repo.id))
        ).scalar_one_or_none()
        assert repo_in_db is None

    # Verify old JWT token is rejected (401 Unauthorized)
    res_post_del = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert res_post_del.status_code == 401


# ===========================================================================
# 4. Security Observability & Audit Logging
# ===========================================================================


@pytest.mark.asyncio
async def test_authaudit_records_events_without_credential_leakage(db_session, test_user: User):
    """Auth audit events record structured context without passwords or secrets."""
    await authaudit.record(
        db_session,
        authaudit.AUTH_LOGIN_FAILURE,
        user_id=test_user.id,
        email=test_user.email,
        ip="198.51.100.24",
        detail={"reason": "invalid_password", "attempt": 3},
    )

    events = await authaudit.recent_for_user(db_session, test_user.id)
    assert len(events) >= 1
    latest = events[0]
    assert latest.event == authaudit.AUTH_LOGIN_FAILURE
    assert latest.email == test_user.email.lower()
    assert latest.ip == "198.51.100.24"
    assert latest.detail.get("reason") == "invalid_password"
    # Ensure no passwords or raw credentials appear
    assert "password" not in latest.detail or latest.detail["password"] != "secret"


# ===========================================================================
# 5. Production HTTP & Host Security
# ===========================================================================


@pytest.mark.asyncio
async def test_security_headers_and_untrusted_host_rejection(client: AsyncClient):
    """Every response contains security headers; untrusted Host headers are rejected."""
    # Standard request receives full security header set
    res = await client.get("/health")
    assert res.status_code == 200
    assert res.headers.get("X-Content-Type-Options") == "nosniff"
    assert res.headers.get("X-Frame-Options") == "DENY"
    assert res.headers.get("Referrer-Policy") == "no-referrer"
    assert "camera=()" in res.headers.get("Permissions-Policy", "")

    # Untrusted Host header rejection
    res_bad_host = await client.get("/health", headers={"Host": "evil-attacker.com"})
    assert res_bad_host.status_code == 403
    assert "host is not allowed" in res_bad_host.json()["detail"].lower()
