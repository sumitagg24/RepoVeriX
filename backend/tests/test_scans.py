"""Tests for scan endpoints."""

import pytest
from httpx import AsyncClient


class TestScans:
    """Test scan management endpoints."""

    @pytest.mark.asyncio
    async def test_create_scan(self, client: AsyncClient, auth_headers, test_repository):
        """Test creating a scan."""
        response = await client.post(
            "/api/v1/scans",
            headers=auth_headers,
            json={
                "repository_id": str(test_repository.id),
                "configuration": "repoverix",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["repository_id"] == str(test_repository.id)
        assert data["configuration"] == "repoverix"
        assert data["status"] == "pending"

    @pytest.mark.asyncio
    async def test_create_scan_invalid_repo(self, client: AsyncClient, auth_headers):
        """Test creating scan with invalid repository fails."""
        import uuid

        response = await client.post(
            "/api/v1/scans",
            headers=auth_headers,
            json={
                "repository_id": str(uuid.uuid4()),
                "configuration": "repoverix",
            },
        )
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_scans(self, client: AsyncClient, auth_headers, test_scan):
        """Test listing scans."""
        response = await client.get("/api/v1/scans", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(s["id"] == str(test_scan.id) for s in data)

    @pytest.mark.asyncio
    async def test_list_scans_filter_by_repo(
        self, client: AsyncClient, auth_headers, test_repository, test_scan
    ):
        """Test listing scans filtered by repository."""
        response = await client.get(f"/api/v1/scans?repository_id={test_repository.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert all(s["repository_id"] == str(test_repository.id) for s in data)

    @pytest.mark.asyncio
    async def test_get_scan(self, client: AsyncClient, auth_headers, test_scan):
        """Test getting a single scan."""
        response = await client.get(f"/api/v1/scans/{test_scan.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_scan.id)

    @pytest.mark.asyncio
    async def test_get_scan_not_found(self, client: AsyncClient, auth_headers):
        """Test getting nonexistent scan returns 404."""
        import uuid

        response = await client.get(f"/api/v1/scans/{uuid.uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_cancel_scan(self, client: AsyncClient, auth_headers, test_repository, db_session):
        """Test cancelling a scan."""
        from app.db.models import Scan, ScanStatus

        scan = Scan(
            repository_id=test_repository.id,
            configuration="repoverix",
            status=ScanStatus.running,
        )
        db_session.add(scan)
        await db_session.commit()
        await db_session.refresh(scan)

        response = await client.post(f"/api/v1/scans/{scan.id}/cancel", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "failed"
        assert data["error"] == "Cancelled by user"

    @pytest.mark.asyncio
    async def test_cancel_completed_scan_fails(self, client: AsyncClient, auth_headers, test_scan):
        """Test cancelling a completed scan fails."""
        response = await client.post(f"/api/v1/scans/{test_scan.id}/cancel", headers=auth_headers)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_get_scan_findings(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """List findings produced by one scan."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Severity,
        )

        finding = Finding(
            scan_id=test_scan.id,
            external_id="RVX-TEST-0001",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.8,
            title="Test finding",
            description="desc",
            file_path="app.py",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()

        response = await client.get(f"/api/v1/scans/{test_scan.id}/findings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 1
        assert data[0]["title"] == "Test finding"

        filtered = await client.get(
            f"/api/v1/scans/{test_scan.id}/findings?severity=critical", headers=auth_headers
        )
        assert filtered.status_code == 200
        assert filtered.json() == []
