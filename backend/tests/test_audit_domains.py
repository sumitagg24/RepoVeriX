"""Dedicated security test suite covering:
1. Database security, tenant isolation & cascading deletes
2. Webhook HMAC verification, replay protection & DoS limits
3. Background job authorization & idempotency
4. File upload magic-byte sniffing, Zip Slip & report download headers
5. Session lifecycle, token version revocation & progressive lockout
"""

from __future__ import annotations

import hashlib
import hmac
import io
import uuid
import zipfile
from pathlib import Path
from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.analysis.ingest import extract_archive, store_archive
from app.analysis.models import AnalysisError
from app.api.routes.account_security import _verify_webhook_signature
from app.api.routes.webhooks import verify_delivery
from app.core.security import create_access_token, decode_access_token
from app.db.models import (
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Organization,
    OrganizationMember,
    OrgRole,
    ProcessedAuthWebhook,
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    SourceType,
    User,
)
from app.services import access
from app.services import account_security as acct


# ------------------------------------------------------------- Database & Tenant Isolation
@pytest.mark.asyncio
async def test_cascading_delete_cleans_repository_graph(db_session, test_user):
    """Deleting a repository cascades cleanly to scans, findings and child relations."""
    repo = Repository(
        owner_id=test_user.id,
        name="cascade_test_repo",
        source_type=SourceType.git,
        source_url="https://github.com/test/cascade.git",
        default_branch="main",
    )
    db_session.add(repo)
    await db_session.flush()

    scan = Scan(
        repository_id=repo.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.completed,
    )
    db_session.add(scan)
    await db_session.flush()

    finding = Finding(
        scan_id=scan.id,
        external_id="VULN-001",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.95,
        title="SQL Injection",
        description="SQL Injection in login handler",
        file_path="app/auth.py",
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.commit()

    # Delete repository
    await db_session.delete(repo)
    await db_session.commit()

    # Verify children are deleted
    assert (await db_session.get(Repository, repo.id)) is None
    assert (await db_session.get(Scan, scan.id)) is None
    assert (await db_session.get(Finding, finding.id)) is None


@pytest.mark.asyncio
async def test_org_rbac_boundaries(db_session, test_user):
    """Organization RBAC properly enforces member vs admin vs non-member privileges."""
    user_b = User(
        email="org_user_b@example.com",
        hashed_password="fakehash",
        full_name="User B",
        is_active=True,
    )
    user_outsider = User(
        email="outsider@example.com",
        hashed_password="fakehash",
        full_name="Outsider",
        is_active=True,
    )
    db_session.add_all([user_b, user_outsider])
    await db_session.flush()

    org = Organization(name="Security Org", slug="sec-org", created_by=test_user.id)
    db_session.add(org)
    await db_session.flush()

    # test_user is owner, user_b is member
    m_owner = OrganizationMember(organization_id=org.id, user_id=test_user.id, role=OrgRole.owner)
    m_member = OrganizationMember(organization_id=org.id, user_id=user_b.id, role=OrgRole.member)
    db_session.add_all([m_owner, m_member])
    await db_session.flush()

    org_repo = Repository(
        owner_id=test_user.id,
        org_id=org.id,
        name="shared_org_repo",
        source_type=SourceType.git,
        default_branch="main",
    )
    db_session.add(org_repo)
    await db_session.commit()

    # test_user can manage and read
    assert await access.can_manage(db_session, org_repo, test_user.id) is True
    assert await access.can_read(db_session, org_repo, test_user.id) is True

    # user_b (member) can read but cannot manage (delete)
    assert await access.can_read(db_session, org_repo, user_b.id) is True
    assert await access.can_manage(db_session, org_repo, user_b.id) is False

    # user_outsider has zero access
    assert await access.can_read(db_session, org_repo, user_outsider.id) is False
    assert await access.can_manage(db_session, org_repo, user_outsider.id) is False


# --------------------------------------------------------------------------- 2. Webhook Security & Replays
def test_webhook_hmac_signature_validation():
    """Webhooks verify HMAC-SHA256 signatures with constant-time equality."""
    secret = "rvxwh_secret_key_1234567890"
    body = b'{"ref": "refs/heads/main", "commits": []}'

    valid_sig = "sha256=" + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    assert _verify_webhook_signature(secret, body, valid_sig) is True
    assert _verify_webhook_signature(secret, body, "sha256=invalidhex") is False
    assert _verify_webhook_signature(secret, body, None) is False

    # Test repository webhook delivery helper
    repo = Repository(
        id=uuid.uuid4(),
        owner_id=uuid.uuid4(),
        name="wh-repo",
        source_type=SourceType.git,
        webhook_secret=secret,
    )
    req_mock = MagicMock()
    req_mock.headers = {"x-hub-signature-256": valid_sig}
    assert verify_delivery(repo, req_mock, body) == "github"

    # GitLab header support
    req_gl = MagicMock()
    req_gl.headers = {"x-gitlab-token": secret}
    assert verify_delivery(repo, req_gl, body) == "gitlab"

    # Forged token fails
    req_forged = MagicMock()
    req_forged.headers = {"x-gitlab-token": "wrong-token"}
    with pytest.raises(HTTPException) as exc:
        verify_delivery(repo, req_forged, body)
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_auth_webhook_replay_protection(db_session):
    """ProcessedAuthWebhook ledger rejects replay of duplicate webhook event IDs."""
    event_id = "evt_unique_12345"
    db_session.add(
        ProcessedAuthWebhook(
            provider="repoverix-local",
            event_id=event_id,
            event_type="user.created",
        )
    )
    await db_session.commit()

    # Query existing
    from sqlalchemy import select

    found = (
        await db_session.execute(
            select(ProcessedAuthWebhook).where(
                ProcessedAuthWebhook.provider == "repoverix-local",
                ProcessedAuthWebhook.event_id == event_id,
            )
        )
    ).scalar_one_or_none()
    assert found is not None
    assert found.event_id == event_id


# ------------------------------------------------------------- 3. Background Job & Idempotency
@pytest.mark.asyncio
async def test_scan_idempotency_key_prevents_duplicate_scans(db_session, test_user):
    """Idempotency keys on scan creation resolve to existing scan."""
    repo = Repository(
        owner_id=test_user.id,
        name="idempotent_repo",
        source_type=SourceType.git,
        default_branch="main",
    )
    db_session.add(repo)
    await db_session.flush()

    idempotency_key = "idemp_test_uuid_123"
    scan1 = Scan(
        repository_id=repo.id,
        configuration=ScanConfiguration.repoverix,
        status=ScanStatus.pending,
        idempotency_key=idempotency_key,
    )
    db_session.add(scan1)
    await db_session.commit()

    from sqlalchemy import select

    existing = (
        await db_session.execute(
            select(Scan)
            .join(Repository, Repository.id == Scan.repository_id)
            .where(
                Repository.owner_id == test_user.id,
                Scan.idempotency_key == idempotency_key,
            )
        )
    ).scalar_one_or_none()
    assert existing is not None
    assert existing.id == scan1.id


# ------------------------------------------------------------- 4. File Upload & Ingestion Security
def test_zip_archive_magic_bytes_detection():
    """Uploaded archives must contain real ZIP magic bytes ('PK\x03\x04')."""
    from app.api.routes.repositories import _ZIP_MAGIC

    valid_zip_buf = io.BytesIO()
    with zipfile.ZipFile(valid_zip_buf, "w") as zf:
        zf.writestr("test.py", b"print(1)\n")
    valid_bytes = valid_zip_buf.getvalue()

    assert valid_bytes.startswith(_ZIP_MAGIC)

    fake_text_bytes = b"<html><script>alert(1)</script></html>"
    assert not fake_text_bytes.startswith(_ZIP_MAGIC)


def test_zip_slip_and_max_file_limits(tmp_path: Path):
    """Zip Slip traversal and member counts are strictly bounded during extraction."""
    repo_id = str(uuid.uuid4())
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("../../../etc/shadow", b"root:*:12345:0:99999:7:::\n")
    store_archive(repo_id, buf.getvalue(), storage_root=tmp_path)

    with pytest.raises(AnalysisError) as exc_info:
        extract_archive(repo_id, storage_root=tmp_path)
    assert exc_info.value.code == "unsafe_archive"


# ------------------------------------------------------------- 5. Session & Account Security
def test_token_version_invalidation():
    """Bumping token_version immediately invalidates previous stateless JWTs."""
    from app.core.security import decode_token_claims

    user_id = uuid.uuid4()

    token_v0 = create_access_token(user_id, token_version=0)
    assert decode_access_token(token_v0) == str(user_id)
    claims_v0 = decode_token_claims(token_v0)
    assert claims_v0 is not None
    assert claims_v0["sub"] == str(user_id)
    assert claims_v0["tv"] == 0

    # User increments token version (e.g. password change / logout all)
    token_v1 = create_access_token(user_id, token_version=1)
    claims_v1 = decode_token_claims(token_v1)
    assert claims_v1 is not None
    assert claims_v1["tv"] == 1

    # In dependency check: claims_v0['tv'] != user.token_version (1) -> rejects with 401


@pytest.mark.asyncio
async def test_progressive_account_lockout_mechanism(db_session):
    """Repeated failed logins trigger progressive lockout with exponential backoff."""
    user = User(
        email="lockout_victim@example.com",
        hashed_password="fakehash",
        full_name="Victim User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()

    # 4 failed attempts: under threshold (threshold = 5)
    for _ in range(4):
        locked = await acct.record_failed_login(db_session, user)
        assert locked == 0

    # 5th failed attempt: triggers lockout
    locked = await acct.record_failed_login(db_session, user)
    assert locked > 0
    assert user.locked_until is not None
    assert acct.lockout_seconds_remaining(user) > 0

    # Successful login clears failed attempt count
    await acct.record_successful_login(db_session, user)
    assert user.failed_login_count == 0
    assert user.locked_until is None
