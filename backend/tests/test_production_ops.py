"""Tests for the production-operations layer.

Covers: request IDs + access logs + the /metrics endpoint (observability),
duplicate-scan idempotency, and the privacy surface (account data export and
full account deletion with storage cleanup).
"""

import logging
from pathlib import Path

from sqlalchemy import func, select

from app.core.config import get_settings
from app.db.models import (
    Evidence,
    EvidenceKind,
    Finding,
    FindingCategory,
    FindingSource,
    FindingStatus,
    Repository,
    Scan,
    Severity,
    User,
    ValidationRun,
)

API = "/api/v1"


# --------------------------------------------------------------------------- observability


async def test_request_id_is_generated_and_echoed(client):
    resp = await client.get("/health")
    assert resp.status_code == 200
    rid = resp.headers.get("x-request-id")
    assert rid and len(rid) >= 16


async def test_request_id_honours_inbound_value(client):
    resp = await client.get("/health", headers={"X-Request-ID": "trace-abc-123"})
    assert resp.headers.get("x-request-id") == "trace-abc-123"


async def test_invalid_inbound_request_id_is_replaced(client):
    resp = await client.get("/health", headers={"X-Request-ID": "bad value\ninjection"})
    rid = resp.headers.get("x-request-id")
    assert rid and rid != "bad value\ninjection"


async def test_access_log_emits_structured_record(client, caplog):
    with caplog.at_level(logging.INFO, logger="repoverix.http"):
        resp = await client.get("/health", headers={"X-Request-ID": "log-me-1"})
    assert resp.status_code == 200
    hits = [
        r
        for r in caplog.records
        if r.name == "repoverix.http" and '"request_id": "log-me-1"' in r.getMessage()
    ]
    assert hits, "expected a structured access-log record carrying the request id"
    assert '"method": "GET"' in hits[0].getMessage()
    assert '"status": 200' in hits[0].getMessage()


async def test_metrics_endpoint_renders_prometheus_format(client):
    # Make a couple of requests so counters/histograms exist.
    await client.get("/health")
    await client.get("/health")
    resp = await client.get("/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    body = resp.text
    assert "repoverix_http_requests_total" in body
    assert "repoverix_http_request_duration_seconds_bucket" in body
    assert "repoverix_http_request_duration_seconds_sum" in body
    assert "repoverix_http_request_duration_seconds_count" in body
    assert (
        "repoverix_process_start_time_seconds" in body
    )  # --------------------------------------------------------------------------- scan idempotency


async def test_idempotency_key_returns_original_scan(client, db_session, test_repository, auth_headers):
    payload = {"repository_id": str(test_repository.id), "configuration": "static_only"}
    headers = {**auth_headers, "Idempotency-Key": "scan-retry-001"}

    first = await client.post(f"{API}/scans", json=payload, headers=headers)
    assert first.status_code == 201
    first_id = first.json()["id"]

    # A retried request carrying the same key must resolve to the original
    # scan — never queue a duplicate.
    second = await client.post(f"{API}/scans", json=payload, headers=headers)
    assert second.status_code == 201
    assert second.json()["id"] == first_id

    count = await db_session.scalar(
        select(func.count()).select_from(Scan).where(Scan.repository_id == test_repository.id)
    )
    assert count == 1, "idempotent retry must not create a second scan row"


async def test_no_key_means_distinct_scans(client, db_session, test_repository, auth_headers):
    payload = {"repository_id": str(test_repository.id), "configuration": "static_only"}
    first = await client.post(f"{API}/scans", json=payload, headers=auth_headers)
    second = await client.post(f"{API}/scans", json=payload, headers=auth_headers)
    assert first.status_code == 201 and second.status_code == 201
    assert first.json()["id"] != second.json()["id"]


async def test_idempotency_key_scoped_per_user(client, db_session, test_user, auth_headers):
    """The same key used by another user creates its own scan (no cross-account
    collision) — scoped through repository ownership."""
    repo_a = Repository(owner_id=test_user.id, name="repo-a", source_type="github", status="registered")
    db_session.add(repo_a)
    await db_session.commit()
    await db_session.refresh(repo_a)

    headers = {**auth_headers, "Idempotency-Key": "shared-key-1"}
    resp = await client.post(
        f"{API}/scans",
        json={"repository_id": str(repo_a.id), "configuration": "static_only"},
        headers=headers,
    )
    assert resp.status_code == 201


# --------------------------------------------------------------------------- privacy


async def test_export_returns_full_account_data(
    client, db_session, test_user, test_repository, test_scan, auth_headers
):
    finding = Finding(
        scan_id=test_scan.id,
        external_id="RVX-EXPORT-1",
        category=FindingCategory.security,
        severity=Severity.high,
        status=FindingStatus.verified,
        confidence=0.9,
        title="Exported finding",
        description="Finding description",
        file_path="app/main.py",
        source=FindingSource.static,
    )
    db_session.add(finding)
    await db_session.commit()

    resp = await client.get(f"{API}/auth/me/export", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["email"] == test_user.email
    assert data["profile"]["full_name"] == test_user.full_name
    assert any(r["id"] == str(test_repository.id) for r in data["repositories"])
    scan_payload = next(s for s in data["scans"] if s["repository_id"] == str(test_repository.id))
    assert scan_payload["configuration"] == test_scan.configuration.value
    assert any(f["external_id"] == "RVX-EXPORT-1" for f in scan_payload["findings"])


async def test_export_scoped_to_own_account(client, db_session, test_repository, auth_headers, test_user):
    resp = await client.get(f"{API}/auth/me/export", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["profile"]["id"] == str(test_user.id)
    repo_ids = [r["id"] for r in data["repositories"]]
    assert set(repo_ids) == {str(test_repository.id)}


async def test_delete_account_removes_everything(
    client, db_session, test_user, test_repository, test_scan, auth_headers
):
    # Wire the deeper graph + a row that is NOT in the ORM cascade chain.
    finding = Finding(
        scan_id=test_scan.id,
        external_id="RVX-DEL-1",
        category=FindingCategory.security,
        severity=Severity.critical,
        status=FindingStatus.verified,
        confidence=0.95,
        title="Doomed finding",
        description="desc",
        file_path="app/x.py",
        source=FindingSource.hybrid,
    )
    db_session.add(finding)
    await db_session.commit()
    await db_session.refresh(finding)
    db_session.add(Evidence(finding_id=finding.id, kind=EvidenceKind.sink, description="sink node"))
    db_session.add(
        ValidationRun(
            finding_id=finding.id,
            claim="claim",
            status_before="verified",
            status_after="rejected",
            confidence=0.1,
        )
    )
    await db_session.commit()

    # Simulate on-disk storage for the repository.
    storage_root = Path(get_settings().repository_storage_dir)
    repo_dir = storage_root / str(test_repository.id)
    (repo_dir / "source").mkdir(parents=True, exist_ok=True)
    (repo_dir / "source" / "app.py").write_text("print('user code')")
    assert repo_dir.exists()

    resp = await client.delete(f"{API}/auth/me", headers=auth_headers)
    assert resp.status_code == 200

    # Database: user, repos, scans, findings, evidence and unwired rows are gone.
    for model in (User, Repository, Scan, Finding, Evidence, ValidationRun):
        count = await db_session.scalar(select(func.count()).select_from(model))
        assert count == 0, f"{model.__tablename__} still has {count} rows after account deletion"

    # Disk: the repository working copy is removed.
    assert not repo_dir.exists(), "on-disk repository storage should be removed"

    # The deleted account's token no longer authenticates.
    after = await client.get(f"{API}/auth/me", headers=auth_headers)
    assert after.status_code in (401, 404)
