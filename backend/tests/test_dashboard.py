"""Tests for dashboard endpoints."""

import pytest
from httpx import AsyncClient


class TestDashboard:
    """Test dashboard and summary endpoints."""

    @pytest.mark.asyncio
    async def test_get_dashboard_summary(self, client: AsyncClient, auth_headers, test_user, test_repository, test_scan, db_session):
        """Test getting dashboard summary."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        # Add some findings
        findings = [
            Finding(
                scan_id=test_scan.id,
                external_id=f"dash-{i}",
                category=FindingCategory.security if i % 2 == 0 else FindingCategory.logic,
                severity=Severity.high if i < 2 else Severity.medium,
                status=FindingStatus.verified if i < 2 else FindingStatus.probable,
                confidence=0.8 + i * 0.05,
                title=f"Finding {i}",
                description=f"Description {i}",
                file_path=f"src/file{i}.py",
                source=FindingSource.static,
            )
            for i in range(4)
        ]
        db_session.add_all(findings)
        await db_session.commit()

        response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 1
        assert data["total_scans"] == 1
        assert data["findings"]["total"] == 4
        assert data["findings"]["by_category"]["security"] == 2
        assert data["findings"]["by_category"]["logic"] == 2
        assert data["findings"]["by_severity"]["high"] == 2
        assert data["findings"]["by_severity"]["medium"] == 2
        assert data["findings"]["by_status"]["verified"] == 2
        assert data["findings"]["by_status"]["probable"] == 2

    @pytest.mark.asyncio
    async def test_dashboard_empty(self, client: AsyncClient, auth_headers):
        """Test dashboard summary with no data."""
        response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 0
        assert data["total_scans"] == 0
        assert data["findings"]["total"] == 0

    @pytest.mark.asyncio
    async def test_dashboard_isolation(self, client: AsyncClient, auth_headers, test_user, test_repository, test_scan, db_session):
        """Test dashboard only shows current user's data."""
        from app.core.security import hash_password
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Repository,
            Scan,
            ScanConfiguration,
            ScanStatus,
            Severity,
            User,
        )

        # Create another user
        other_user = User(
            email="other@example.com",
            hashed_password=hash_password("password123"),
            full_name="Other User",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()
        await db_session.refresh(other_user)

        # Create repo for other user
        other_repo = Repository(
            owner_id=other_user.id,
            name="other-repo",
            source_type="github",
            source_url="https://github.com/other/repo",
            default_branch="main",
            status="registered",
        )
        db_session.add(other_repo)
        await db_session.commit()
        await db_session.refresh(other_repo)

        # Create scan for other user
        other_scan = Scan(
            repository_id=other_repo.id,
            configuration=ScanConfiguration.repoverix,
            status=ScanStatus.completed,
        )
        db_session.add(other_scan)
        await db_session.commit()
        await db_session.refresh(other_scan)

        # Add finding for other user
        other_finding = Finding(
            scan_id=other_scan.id,
            external_id="other-001",
            category=FindingCategory.security,
            severity=Severity.critical,
            status=FindingStatus.verified,
            confidence=0.99,
            title="Other User's Critical Finding",
            description="Should not appear in current user's dashboard",
            file_path="src/other.py",
            source=FindingSource.static,
        )
        db_session.add(other_finding)
        await db_session.commit()

        # Current user's dashboard should not include other user's data
        response = await client.get("/api/v1/dashboard/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total_repositories"] == 1  # Only test_repository from fixture
        assert data["total_scans"] == 1  # Only test_scan from fixture
        assert data["findings"]["total"] == 0  # No findings for current user