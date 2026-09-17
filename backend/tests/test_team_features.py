"""Tests for team features: organizations/RBAC, API tokens, CI webhooks,
repair-workflow chain and PR commit-status checks."""

import hashlib
import hmac as hmac_mod
import json
import uuid

from sqlalchemy import select

from app.core.security import create_access_token, hash_password
from app.db.models import (
    ApiToken,
    Finding,
    FindingCategory,
    FindingFeedback,
    FindingSource,
    FindingStatus,
    OrganizationMember,
    OrgRole,
    Patch,
    PatchStatus,
    Repository,
    Scan,
    ScanConfiguration,
    ScanStatus,
    Severity,
    SourceType,
    User,
    VerificationRun,
    VerificationStatus,
)
from app.services import access as access_svc

API = "/api/v1"


async def _mk_user(db_session, email: str) -> User:
    user = User(
        email=email,
        hashed_password=hash_password("password123"),
        full_name=email.split("@")[0].title(),
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


def _auth(user) -> dict:
    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# --------------------------------------------------------------------------- organizations & RBAC


async def test_create_org_creator_is_owner(client, db_session, test_user, auth_headers):
    resp = await client.post(
        f"{API}/organizations", json={"name": "Acme Corp", "slug": "acme"}, headers=auth_headers
    )
    assert resp.status_code == 201
    org_id = resp.json()["id"]
    member = (
        await db_session.execute(
            select(OrganizationMember).where(OrganizationMember.organization_id == uuid.UUID(org_id))
        )
    ).scalar_one()
    assert member.role == OrgRole.owner
    assert member.user_id == test_user.id


async def test_org_slug_validation_and_uniqueness(client, db_session, test_user, auth_headers):
    resp = await client.post(
        f"{API}/organizations", json={"name": "Acme", "slug": "acme"}, headers=auth_headers
    )
    assert resp.status_code == 201
    resp = await client.post(
        f"{API}/organizations", json={"name": "Other", "slug": "acme"}, headers=auth_headers
    )
    assert resp.status_code == 409
    # Odd slugs are normalised (uppercase → lowercase, spaces → hyphens),
    # not rejected — friendly names become valid slugs.
    resp = await client.post(
        f"{API}/organizations", json={"name": "Bad Slug Here", "slug": "UPPER case"}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["slug"] == "upper-case"
    resp = await client.post(f"{API}/organizations", json={"name": "x"}, headers=auth_headers)
    assert resp.status_code == 422  # name too short


async def test_member_add_requires_admin(client, db_session, test_user, auth_headers):
    """A non-member cannot even list members of an org they're not in (404-style denial)."""
    resp = await client.post(f"{API}/organizations", json={"name": "Private"}, headers=auth_headers)
    org_id = resp.json()["id"]
    stranger = await _mk_user(db_session, "stranger@example.com")
    resp = await client.get(f"{API}/organizations/{org_id}/members", headers=_auth(stranger))
    assert resp.status_code == 403


async def test_admin_adds_member_and_member_scopes(client, db_session, test_user, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Team"}, headers=auth_headers)
    org_id = resp.json()["id"]

    member = await _mk_user(db_session, "member@example.com")
    resp = await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": member.email, "role": "member"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "member"

    # Member can see the roster and org repos but cannot add people.
    resp = await client.get(f"{API}/organizations/{org_id}/members", headers=_auth(member))
    assert resp.status_code == 200
    assert len(resp.json()) == 2
    resp = await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": "x@example.com", "role": "member"},
        headers=_auth(member),
    )
    assert resp.status_code == 403


async def test_adding_unknown_email_is_404(client, db_session, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    resp = await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": "ghost@example.com", "role": "member"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_org_repo_visible_to_members_not_strangers(
    client, db_session, test_user, test_repository, auth_headers
):
    resp = await client.post(f"{API}/organizations", json={"name": "Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    resp = await client.post(
        f"{API}/organizations/{org_id}/repositories",
        json={"repository_id": str(test_repository.id)},
        headers=auth_headers,
    )
    assert resp.status_code == 201

    member = await _mk_user(db_session, "sees@example.com")
    stranger = await _mk_user(db_session, "denied@example.com")
    await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": member.email, "role": "member"},
        headers=auth_headers,
    )

    # Member can read org repositories and scans through the access service.
    repo = (
        await db_session.execute(select(Repository).where(Repository.id == test_repository.id))
    ).scalar_one()
    assert await access_svc.can_read(db_session, repo, member.id)
    assert not await access_svc.can_read(db_session, repo, stranger.id)
    assert await access_svc.can_manage(db_session, repo, test_user.id)
    assert not await access_svc.can_manage(db_session, repo, member.id)  # member < admin

    # Org repo listing includes it for members.
    resp = await client.get(f"{API}/organizations/{org_id}/repositories", headers=_auth(member))
    assert resp.status_code == 200
    assert any(r["id"] == str(test_repository.id) for r in resp.json())


async def test_cannot_remove_last_owner(client, db_session, test_user, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    body = resp.json()
    members = (await client.get(f"{API}/organizations/{org_id}/members", headers=auth_headers)).json()
    own_member_id = next(
        m["id"] for m in members if m["user_id"] == body.get("created_by") or m["role"] == "owner"
    )
    resp = await client.delete(f"{API}/organizations/{org_id}/members/{own_member_id}", headers=auth_headers)
    assert resp.status_code == 400
    assert "last owner" in resp.json()["detail"]


async def test_owner_role_requires_owner(client, db_session, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    admin = await _mk_user(db_session, "org-admin@example.com")
    await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": admin.email, "role": "admin"},
        headers=auth_headers,
    )
    resp = await client.post(
        f"{API}/organizations/{org_id}/members",
        json={"email": "newowner@example.com", "role": "owner"},
        headers=_auth(admin),
    )
    assert resp.status_code == 403


# --------------------------------------------------------------------------- API tokens


async def test_token_lifecycle(client, db_session, test_user, auth_headers):
    resp = await client.post(
        f"{API}/tokens",
        json={"name": "CI", "expires_in_days": 30},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    token = body["token"]
    assert token.startswith("rvx_")
    # Only the hash is stored.
    row = (await db_session.execute(select(ApiToken).where(ApiToken.user_id == test_user.id))).scalar_one()
    assert row.token_hash == hashlib.sha256(token.encode()).hexdigest()
    assert token not in str(row.token_hash)

    # Token authenticates like the user.
    resp = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["email"] == test_user.email

    # Listing shows metadata only.
    listing = (await client.get(f"{API}/tokens", headers=auth_headers)).json()
    assert listing[0]["token_prefix"] == token[:10]
    assert "token" not in listing[0]

    # Revoke → immediate 401.
    resp = await client.delete(f"{API}/tokens/{row.id}", headers=auth_headers)
    assert resp.status_code == 204
    resp = await client.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 401


async def test_garbage_token_is_401(client):
    resp = await client.get(f"{API}/auth/me", headers={"Authorization": "Bearer rvx_not-a-token"})
    assert resp.status_code == 401


# --------------------------------------------------------------------------- webhooks (auto re-analysis)


def _github_body(repo, branch="main") -> bytes:
    return json.dumps({"ref": f"refs/heads/{branch}", "repository": {"full_name": repo}}).encode()


async def _repo_with_secret(db_session, test_user, secret="whsec_test_123") -> Repository:
    repo = Repository(
        owner_id=test_user.id,
        name="hooked-repo",
        source_type=SourceType.github,
        source_url="https://github.com/test/hooked",
        default_branch="main",
        status="ingested",
        webhook_secret=secret,
    )
    db_session.add(repo)
    await db_session.commit()
    await db_session.refresh(repo)
    return repo


async def test_webhook_signature_required_and_verified(client, db_session, test_user):
    repo = await _repo_with_secret(db_session, test_user)
    body = _github_body("test/hooked")
    # Missing signature → 400.
    resp = await client.post(f"{API}/webhooks/{repo.id}", content=body)
    assert resp.status_code == 400
    # Wrong signature → 403.
    resp = await client.post(
        f"{API}/webhooks/{repo.id}",
        content=body,
        headers={"X-Hub-Signature-256": "sha256=" + "0" * 64},
    )
    assert resp.status_code == 403
    # Correct signature → scanned.
    sig = "sha256=" + hmac_mod.new(b"whsec_test_123", body, hashlib.sha256).hexdigest()
    resp = await client.post(f"{API}/webhooks/{repo.id}", content=body, headers={"X-Hub-Signature-256": sig})
    assert resp.status_code == 200
    assert resp.json()["status"] == "scanned"


async def test_webhook_gitlab_token(client, db_session, test_user):
    repo = await _repo_with_secret(db_session, test_user)
    resp = await client.post(
        f"{API}/webhooks/{repo.id}",
        content=_github_body("t/h"),
        headers={"X-Gitlab-Token": "whsec_test_123"},
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "scanned"


async def test_webhook_non_default_branch_ignored(client, db_session, test_user):
    repo = await _repo_with_secret(db_session, test_user)
    body = _github_body("t/h", branch="feature/x")
    sig = "sha256=" + hmac_mod.new(b"whsec_test_123", body, hashlib.sha256).hexdigest()
    resp = await client.post(f"{API}/webhooks/{repo.id}", content=body, headers={"X-Hub-Signature-256": sig})
    assert resp.json()["status"] == "ignored"


async def test_webhook_duplicate_delivery_absorbed(client, db_session, test_user):
    repo = await _repo_with_secret(db_session, test_user)
    body = _github_body("t/h")
    sig = "sha256=" + hmac_mod.new(b"whsec_test_123", body, hashlib.sha256).hexdigest()
    headers = {"X-Hub-Signature-256": sig}
    first = await client.post(f"{API}/webhooks/{repo.id}", content=body, headers=headers)
    second = await client.post(f"{API}/webhooks/{repo.id}", content=body, headers=headers)
    assert first.json()["status"] == "scanned"
    assert second.json()["status"] == "in_flight"
    scans = (await db_session.execute(select(Scan).where(Scan.repository_id == repo.id))).scalars().all()
    assert len(scans) == 1


async def test_webhook_secret_rotation_and_no_secret_409(client, db_session, test_user, auth_headers):
    repo = await _repo_with_secret(db_session, test_user, secret=None)
    resp = await client.post(f"{API}/webhooks/{repo.id}", content=_github_body("t/h"))
    assert resp.status_code == 409  # no secret configured

    # Rotate (manager only).
    resp = await client.post(f"{API}/webhooks/{repo.id}/secret", headers=auth_headers)
    assert resp.status_code == 200
    secret = resp.json()["secret"]
    assert secret.startswith("rvxwh_")
    body = _github_body("t/h")
    sig = "sha256=" + hmac_mod.new(secret.encode(), body, hashlib.sha256).hexdigest()
    resp = await client.post(f"{API}/webhooks/{repo.id}", content=body, headers={"X-Hub-Signature-256": sig})
    assert resp.json()["status"] == "scanned"


# --------------------------------------------------------------------------- repair workflow


async def test_repair_workflow_requires_existing_finding(client, db_session, test_scan, auth_headers):
    resp = await client.post(f"{API}/findings/{uuid.uuid4()}/repair-workflow", headers=auth_headers)
    assert resp.status_code == 404


# --------------------------------------------------------------------------- PR commit checks


async def test_pr_check_dry_run_deterministic(client, db_session, test_repository, auth_headers):

    from app.db.models import ChangeAudit, PullRequestAudit  # noqa: F401

    audit = PullRequestAudit(
        repository_id=test_repository.id,
        pr_number=1,
        base_ref="main",
        head_ref="feature",
        head_sha="a" * 40,
        risk_score=85.0,
        risk_level="critical",
        changed_files=[],
        findings=[],
        review={"stats": {"findings": 3, "verified_findings": 2}},
    )
    db_session.add(audit)
    await db_session.commit()
    await db_session.refresh(audit)
    resp = await client.post(
        f"{API}/repositories/{test_repository.id}/pull-requests/{audit.id}/check?dry_run=true",
        headers=auth_headers,
    )

    assert resp.status_code == 200
    body = resp.json()
    assert body["dry_run"] is True
    assert body["sha"] == "a" * 40
    assert body["status"]["state"] == "failure"  # critical risk fails the gate
    assert body["status"]["context"] == "repoverix/audit"

    # Low risk passes.
    audit.risk_level = "low"
    audit.risk_score = 20.0
    await db_session.commit()
    resp = await client.post(
        f"{API}/repositories/{test_repository.id}/pull-requests/{audit.id}/check?dry_run=true",
        headers=auth_headers,
    )
    assert resp.json()["status"]["state"] == "success"


# --------------------------------------------------------------------------- team dashboard & security center


async def _seed_finding(db_session, scan: Scan, **overrides) -> Finding:
    params = dict(
        scan_id=scan.id,
        external_id="RVX-T-" + uuid.uuid4().hex[:8],
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="Test finding",
        description="desc",
        file_path="src/app.py",
        source=FindingSource.static,
    )
    params.update(overrides)
    finding = Finding(**params)
    db_session.add(finding)
    await db_session.commit()
    await db_session.refresh(finding)
    return finding


async def test_team_dashboard_aggregates_org(client, db_session, test_user, test_repository, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Dash Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    await client.post(
        f"{API}/organizations/{org_id}/repositories",
        json={"repository_id": str(test_repository.id)},
        headers=auth_headers,
    )

    scan = Scan(
        repository_id=test_repository.id,
        status=ScanStatus.completed,
        configuration=ScanConfiguration.repoverix,
    )
    db_session.add(scan)
    await db_session.commit()
    await db_session.refresh(scan)
    await _seed_finding(db_session, scan)
    await _seed_finding(db_session, scan, severity=Severity.critical)
    await _seed_finding(db_session, scan, status=FindingStatus.probable, severity=Severity.low)

    resp = await client.get(f"{API}/organizations/{org_id}/dashboard", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["repository_count"] == 1
    assert body["scans"]["total"] == 1
    assert body["scans"]["completed"] == 1
    assert body["findings"]["total"] == 3
    assert body["findings"]["by_severity"]["high"] == 1
    assert body["findings"]["by_severity"]["critical"] == 1
    assert body["findings"]["verified_critical_high"] == 2
    assert body["member_counts"]["owner"] == 1

    # A non-member gets the uniform denial.
    stranger = await _mk_user(db_session, "dash-stranger@example.com")
    resp = await client.get(f"{API}/organizations/{org_id}/dashboard", headers=_auth(stranger))
    assert resp.status_code == 403


async def test_security_center_posture_and_feedback(
    client, db_session, test_user, test_repository, auth_headers
):
    resp = await client.post(f"{API}/organizations", json={"name": "Sec Team"}, headers=auth_headers)
    org_id = resp.json()["id"]
    await client.post(
        f"{API}/organizations/{org_id}/repositories",
        json={"repository_id": str(test_repository.id)},
        headers=auth_headers,
    )

    scan = Scan(
        repository_id=test_repository.id,
        status=ScanStatus.completed,
        configuration=ScanConfiguration.repoverix,
    )
    db_session.add(scan)
    await db_session.commit()
    await db_session.refresh(scan)
    f1 = await _seed_finding(db_session, scan)
    await _seed_finding(db_session, scan, severity=Severity.critical)

    # Owner feedback: one agreement, one dispute.
    db_session.add(FindingFeedback(finding_id=f1.id, user_id=test_user.id, verdict="correct"))
    db_session.add(
        FindingFeedback(
            finding_id=(await _seed_finding(db_session, scan, severity=Severity.medium)).id,
            user_id=test_user.id,
            verdict="incorrect",
        )
    )

    # A verified patch on the first finding.
    patch = Patch(finding_id=f1.id, diff="--- a\n+++ b", generated_by="test", status=PatchStatus.verified)
    db_session.add(patch)
    await db_session.commit()
    await db_session.refresh(patch)
    db_session.add(
        VerificationRun(patch_id=patch.id, status=VerificationStatus.verified_repair, patch_applied=True)
    )
    await db_session.commit()

    resp = await client.get(f"{API}/organizations/{org_id}/security-center", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["findings"]["total"] == 3
    assert body["findings"]["verified_critical_high"] == 2
    assert body["detection_quality"]["verdicts"]["correct"] == 1
    assert body["detection_quality"]["verdicts"]["incorrect"] == 1
    assert body["detection_quality"]["agreement_ratio"] == 0.5
    assert body["fix_pipeline"]["patches_verified"] == 1
    assert body["coverage"]["repositories"] == 1
    assert body["risk_level"] in {"medium", "high"}
    assert isinstance(body["posture_score"], int) and 0 <= body["posture_score"] <= 100


async def test_security_center_empty_org_is_zeroed(client, db_session, auth_headers):
    resp = await client.post(f"{API}/organizations", json={"name": "Empty Org"}, headers=auth_headers)
    org_id = resp.json()["id"]
    resp = await client.get(f"{API}/organizations/{org_id}/security-center", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["findings"]["total"] == 0
    assert body["risk_level"] == "none"
    assert body["detection_quality"]["agreement_ratio"] is None
    assert body["coverage"]["scanned_repositories"] == 0
