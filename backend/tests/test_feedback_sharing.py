"""Tests for the finding-feedback loop and secure report sharing."""

from sqlalchemy import func, select

from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingFeedback,
    FindingSource,
    FindingStatus,
    Patch,
    PatchStatus,
    ReportShare,
    Severity,
    User,
    VerificationRun,
    VerificationStatus,
)

API = "/api/v1"


# --------------------------------------------------------------------------- helpers


async def _seed_finding(db_session, test_scan) -> Finding:
    finding = Finding(
        scan_id=test_scan.id,
        external_id="RVX-FB-1",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="Feedback finding",
        description="desc",
        file_path="src/app/services/auth.py",
        function_name="login",
        line_start=10,
        line_end=20,
        source=FindingSource.hybrid,
    )
    db_session.add(finding)
    await db_session.commit()
    await db_session.refresh(finding)
    return finding


async def _second_user(db_session) -> User:
    from app.core.security import hash_password

    user = User(
        email="feedback-second@example.com",
        hashed_password=hash_password("password123"),
        full_name="Second User",
        is_active=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


async def _auth_for(user) -> dict:
    from app.core.security import create_access_token

    return {"Authorization": f"Bearer {create_access_token(user.id)}"}


# --------------------------------------------------------------------------- feedback


async def test_submit_feedback_creates_row(client, db_session, test_user, test_scan, auth_headers):
    finding = await _seed_finding(db_session, test_scan)
    resp = await client.post(
        f"{API}/findings/{finding.id}/feedback",
        json={"verdict": "incorrect", "note": "The sanitizer above guards this."},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["verdict"] == "incorrect"
    assert resp.json()["note"].startswith("The sanitizer")


async def test_feedback_verdicts_are_validated(client, db_session, test_scan, auth_headers):
    finding = await _seed_finding(db_session, test_scan)
    resp = await client.post(
        f"{API}/findings/{finding.id}/feedback",
        json={"verdict": "banana"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_resubmit_replaces_not_duplicates(client, db_session, test_user, test_scan, auth_headers):
    finding = await _seed_finding(db_session, test_scan)
    for verdict in ("correct", "incorrect"):
        resp = await client.post(
            f"{API}/findings/{finding.id}/feedback",
            json={"verdict": verdict},
            headers=auth_headers,
        )
        assert resp.status_code == 201
    rows = (
        await db_session.execute(
            select(func.count()).select_from(FindingFeedback).where(FindingFeedback.finding_id == finding.id)
        )
    ).scalar()
    assert rows == 1
    mine = await client.get(f"{API}/findings/{finding.id}/feedback", headers=auth_headers)
    assert mine.json()["verdict"] == "incorrect"


async def test_feedback_is_object_level_scoped(client, db_session, test_scan, test_user, auth_headers):
    """A finding in a scan owned by someone else is 404 — IDOR guard."""
    finding = await _seed_finding(db_session, test_scan)
    other = await _second_user(db_session)
    resp = await client.post(
        f"{API}/findings/{finding.id}/feedback",
        json={"verdict": "correct"},
        headers=await _auth_for(other),
    )
    assert resp.status_code == 404


async def test_feedback_summary_aggregates(client, db_session, test_user, test_scan, auth_headers):
    finding = await _seed_finding(db_session, test_scan)
    await client.post(
        f"{API}/findings/{finding.id}/feedback",
        json={"verdict": "incorrect"},
        headers=auth_headers,
    )
    # A teammate's verdict (team members gain finding access via future
    # org/RBAC work — seeded here to exercise the aggregation itself).
    other = await _second_user(db_session)
    db_session.add(FindingFeedback(finding_id=finding.id, user_id=other.id, verdict="correct"))
    await db_session.commit()
    resp = await client.get(f"{API}/findings/{finding.id}/feedback/summary", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == 2
    assert body["incorrect"] == 1 and body["correct"] == 1
    assert body["false_positive_share"] == 0.5


async def test_delete_withdraws_feedback(client, db_session, test_scan, auth_headers):
    finding = await _seed_finding(db_session, test_scan)
    await client.post(
        f"{API}/findings/{finding.id}/feedback",
        json={"verdict": "not_useful"},
        headers=auth_headers,
    )
    resp = await client.delete(f"{API}/findings/{finding.id}/feedback", headers=auth_headers)
    assert resp.status_code == 204
    count = (
        await db_session.execute(
            select(func.count()).select_from(FindingFeedback).where(FindingFeedback.finding_id == finding.id)
        )
    ).scalar()
    assert count == 0


# --------------------------------------------------------------------------- sharing


async def _seed_reportables(db_session, test_scan):
    finding = Finding(
        scan_id=test_scan.id,
        external_id="RVX-SH-1",
        category=FindingCategory.security,
        severity=Severity.critical,
        status=FindingStatus.verified,
        confidence=0.97,
        title="SQL injection in search",
        description="User input reaches execute() unsanitized.",
        file_path="src/private/internal/search.py",
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.commit()
    await db_session.refresh(finding)
    db_session.add(
        Evidence(
            finding_id=finding.id,
            kind=EvidenceKind.sink,
            file_path="src/private/internal/search.py",
            snippet="cursor.execute(f'SELECT * FROM users WHERE n={n}')",
            description="sink",
        )
    )
    patch = Patch(
        finding_id=finding.id,
        diff="--- a/x.py\n+++ b/x.py\n@@ -1 +1 @@\n-bad\n+good\n",
        generated_by="unit-test",
        status=PatchStatus.verified,
    )
    db_session.add(patch)
    await db_session.commit()
    await db_session.refresh(patch)
    db_session.add(
        VerificationRun(patch_id=patch.id, status=VerificationStatus.verified_repair, tests_passed=True)
    )
    await db_session.commit()
    return finding


async def test_create_share_returns_secret_url(client, db_session, test_user, test_scan, auth_headers):
    await _seed_reportables(db_session, test_scan)
    resp = await client.post(
        f"{API}/scans/{test_scan.id}/share", json={"expiry_days": 7}, headers=auth_headers
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["url"].startswith("http") and "/share/" in body["url"]
    assert len(body["token"]) >= 40  # 256-bit urlsafe token


async def test_public_report_is_sanitised(client, db_session, test_user, test_scan, auth_headers):
    await _seed_reportables(db_session, test_scan)
    share = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=auth_headers)
    token = share.json()["token"]

    # Anonymous fetch — no auth headers at all.
    resp = await client.get(f"{API}/public/reports/{token}")
    assert resp.status_code == 200
    body = resp.text

    assert "SQL injection in search" in body
    # Never exposed: source paths, code snippets, diffs, source URLs, usage.
    assert "src/private/internal" not in body
    assert "SELECT * FROM users" not in body
    assert "--- a/x.py" not in body
    assert test_scan.repository.source_url not in body
    assert "llm_token_usage" not in body
    data = resp.json()
    assert data["repository"]["name"] == "test-repo"
    assert data["summary"]["total_findings"] == 1
    assert data["summary"]["repairs_verified"] == 1
    assert data["findings"][0]["file"] == "search.py"
    assert data["findings"][0]["evidence_kinds"] == ["sink"]


async def test_unknown_or_revoked_token_is_404(client, db_session, test_scan, auth_headers):
    resp = await client.get(f"{API}/public/rereports/{'a' * 43}")
    assert resp.status_code in (404, 405)
    resp = await client.get(f"{API}/public/reports/{'a' * 43}")
    assert resp.status_code == 404

    share = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=auth_headers)
    share_id = share.json()["share_id"]
    token = share.json()["token"]
    revoke = await client.delete(f"{API}/shares/{share_id}", headers=auth_headers)
    assert revoke.status_code == 204
    resp = await client.get(f"{API}/public/reports/{token}")
    assert resp.status_code == 404


async def test_expired_share_is_404(client, db_session, test_scan, auth_headers):
    from datetime import UTC, datetime, timedelta

    share = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=auth_headers)
    token = share.json()["token"]
    # Force-expire directly in the DB.
    row = (await db_session.execute(select(ReportShare).where(ReportShare.token == token))).scalar_one()
    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db_session.commit()
    resp = await client.get(f"{API}/public/reports/{token}")
    assert resp.status_code == 404


async def test_new_share_revokes_previous_links(client, db_session, test_scan, auth_headers):
    first_resp = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=auth_headers)
    second_resp = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=auth_headers)
    first = first_resp.json()
    second = second_resp.json()
    assert first["token"] != second["token"]
    assert (await client.get(f"{API}/public/reports/{first['token']}")).status_code == 404
    assert (await client.get(f"{API}/public/reports/{second['token']}")).status_code == 200


async def test_share_scoped_to_owner(client, db_session, test_scan, test_user):
    other = await _second_user(db_session)
    resp = await client.post(f"{API}/scans/{test_scan.id}/share", json=None, headers=await _auth_for(other))
    assert resp.status_code == 404


async def test_expiry_validation(client, db_session, test_scan, auth_headers):
    resp = await client.post(
        f"{API}/scans/{test_scan.id}/share", json={"expiry_days": 0}, headers=auth_headers
    )
    assert resp.status_code == 422
    resp = await client.post(
        f"{API}/scans/{test_scan.id}/share", json={"expiry_days": 366}, headers=auth_headers
    )
    assert resp.status_code == 422
