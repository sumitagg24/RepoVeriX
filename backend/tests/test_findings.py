"""Tests for finding endpoints."""

import pytest
from httpx import AsyncClient


class TestFindings:
    """Test finding and evidence endpoints."""

    @pytest.mark.asyncio
    async def test_list_findings(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing findings."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        finding = Finding(
            scan_id=test_scan.id,
            external_id="test-001",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="SQL Injection",
            description="Potential SQL injection in user input",
            file_path="src/main.py",
            function_name="get_user",
            line_start=10,
            line_end=20,
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()

        response = await client.get("/api/v1/findings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(f["title"] == "SQL Injection" for f in data)

    @pytest.mark.asyncio
    async def test_list_findings_filter_by_scan(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing findings filtered by scan."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        finding = Finding(
            scan_id=test_scan.id,
            external_id="test-002",
            category=FindingCategory.logic,
            severity=Severity.medium,
            status=FindingStatus.probable,
            confidence=0.7,
            title="Logic Error",
            description="Potential logic error",
            file_path="src/utils.py",
            source=FindingSource.llm,
        )
        db_session.add(finding)
        await db_session.commit()

        response = await client.get(f"/api/v1/findings?scan_id={test_scan.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert all(f["scan_id"] == str(test_scan.id) for f in data)

    @pytest.mark.asyncio
    async def test_list_findings_filter_by_category(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing findings filtered by category."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        finding = Finding(
            scan_id=test_scan.id,
            external_id="test-003",
            category=FindingCategory.dependency,
            severity=Severity.critical,
            status=FindingStatus.verified,
            confidence=0.95,
            title="Vulnerable Dependency",
            description="Outdated package with known vulnerability",
            file_path="requirements.txt",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()

        response = await client.get("/api/v1/findings?category=dependency", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert all(f["category"] == "dependency" for f in data)

    @pytest.mark.asyncio
    async def test_get_finding(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test getting a single finding."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        finding = Finding(
            scan_id=test_scan.id,
            external_id="test-004",
            category=FindingCategory.security,
            severity=Severity.critical,
            status=FindingStatus.verified,
            confidence=0.99,
            title="Critical Finding",
            description="Critical security issue",
            file_path="src/auth.py",
            source=FindingSource.hybrid,
        )
        db_session.add(finding)
        await db_session.commit()
        await db_session.refresh(finding)

        response = await client.get(f"/api/v1/findings/{finding.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(finding.id)
        assert data["title"] == "Critical Finding"

    @pytest.mark.asyncio
    async def test_get_finding_not_found(self, client: AsyncClient, auth_headers):
        """Test getting nonexistent finding returns 404."""
        import uuid
        response = await client.get(f"/api/v1/findings/{uuid.uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_get_scan_findings_summary(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test getting findings summary for a scan."""
        from app.db.models import Finding, FindingCategory, FindingSource, FindingStatus, Severity

        # Add multiple findings
        findings = [
            Finding(
                scan_id=test_scan.id,
                external_id=f"test-{i}",
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

        response = await client.get(f"/api/v1/findings/scan/{test_scan.id}/summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 4
        assert data["by_category"]["security"] == 2
        assert data["by_category"]["logic"] == 2
        assert data["by_severity"]["high"] == 2
        assert data["by_severity"]["medium"] == 2
        assert data["by_status"]["verified"] == 2
        assert data["by_status"]["probable"] == 2