"""Tests for patch and verification endpoints."""

import pytest
from httpx import AsyncClient


class TestPatches:
    """Test patch and verification endpoints."""

    @pytest.mark.asyncio
    async def test_list_patches(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing patches."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Patch,
            PatchStatus,
            Severity,
        )

        finding = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-001",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Test Finding",
            description="Test finding for patch",
            file_path="src/test.py",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()
        await db_session.refresh(finding)

        patch = Patch(
            finding_id=finding.id,
            diff="@@ -1,3 +1,3 @@\n-def vulnerable():\n+def fixed():\n     pass",
            explanation="Fix the vulnerability",
            generated_by="llm",
            status=PatchStatus.candidate,
        )
        db_session.add(patch)
        await db_session.commit()

        response = await client.get("/api/v1/patches", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(p["generated_by"] == "llm" for p in data)

    @pytest.mark.asyncio
    async def test_list_patches_filter_by_finding(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing patches filtered by finding."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Patch,
            PatchStatus,
            Severity,
        )

        finding1 = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-002",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Finding 1",
            description="Description",
            file_path="src/test1.py",
            source=FindingSource.static,
        )
        finding2 = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-003",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Finding 2",
            description="Description",
            file_path="src/test2.py",
            source=FindingSource.static,
        )
        db_session.add_all([finding1, finding2])
        await db_session.commit()
        await db_session.refresh(finding1)
        await db_session.refresh(finding2)

        patch = Patch(
            finding_id=finding1.id,
            diff="@@ -1 +1 @@\n-fixed()",
            explanation="Fix finding 1",
            generated_by="static",
            status=PatchStatus.candidate,
        )
        db_session.add(patch)
        await db_session.commit()

        response = await client.get(f"/api/v1/patches?finding_id={finding1.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert all(p["finding_id"] == str(finding1.id) for p in data)

    @pytest.mark.asyncio
    async def test_get_patch(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test getting a single patch."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Patch,
            PatchStatus,
            Severity,
        )

        finding = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-004",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Test Finding",
            description="Test finding for patch",
            file_path="src/test.py",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()
        await db_session.refresh(finding)

        patch = Patch(
            finding_id=finding.id,
            diff="@@ -1,3 +1,3 @@\n-def vulnerable():\n+def fixed():\n     pass",
            explanation="Fix the vulnerability",
            generated_by="llm",
            status=PatchStatus.verified,
        )
        db_session.add(patch)
        await db_session.commit()
        await db_session.refresh(patch)

        response = await client.get(f"/api/v1/patches/{patch.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(patch.id)
        assert data["status"] == "verified"

    @pytest.mark.asyncio
    async def test_get_patch_not_found(self, client: AsyncClient, auth_headers):
        """Test getting nonexistent patch returns 404."""
        import uuid
        response = await client.get(f"/api/v1/patches/{uuid.uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_list_verification_runs(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test listing verification runs for a patch."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Patch,
            PatchStatus,
            Severity,
            VerificationRun,
            VerificationStatus,
        )

        finding = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-005",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Test Finding",
            description="Test finding for patch",
            file_path="src/test.py",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()
        await db_session.refresh(finding)

        patch = Patch(
            finding_id=finding.id,
            diff="@@ -1 +1 @@\n-fixed()",
            explanation="Fix",
            generated_by="llm",
            status=PatchStatus.applied,
        )
        db_session.add(patch)
        await db_session.commit()
        await db_session.refresh(patch)

        verification = VerificationRun(
            patch_id=patch.id,
            status=VerificationStatus.verified_repair,
            patch_applied=True,
            deps_installed=True,
            tests_passed=True,
            static_passed=True,
            finding_still_detected=False,
        )
        db_session.add(verification)
        await db_session.commit()

        response = await client.get(f"/api/v1/patches/{patch.id}/verifications", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["status"] == "verified_repair"

    @pytest.mark.asyncio
    async def test_get_verification_run(self, client: AsyncClient, auth_headers, test_scan, db_session):
        """Test getting a single verification run."""
        from app.db.models import (
            Finding,
            FindingCategory,
            FindingSource,
            FindingStatus,
            Patch,
            PatchStatus,
            Severity,
            VerificationRun,
            VerificationStatus,
        )

        finding = Finding(
            scan_id=test_scan.id,
            external_id="patch-test-006",
            category=FindingCategory.security,
            severity=Severity.high,
            status=FindingStatus.verified,
            confidence=0.9,
            title="Test Finding",
            description="Test finding for patch",
            file_path="src/test.py",
            source=FindingSource.static,
        )
        db_session.add(finding)
        await db_session.commit()
        await db_session.refresh(finding)

        patch = Patch(
            finding_id=finding.id,
            diff="@@ -1 +1 @@\n-fixed()",
            explanation="Fix",
            generated_by="llm",
            status=PatchStatus.applied,
        )
        db_session.add(patch)
        await db_session.commit()
        await db_session.refresh(patch)

        verification = VerificationRun(
            patch_id=patch.id,
            status=VerificationStatus.repair_failed,
            patch_applied=True,
            deps_installed=True,
            tests_passed=False,
            static_passed=True,
            finding_still_detected=True,
            logs="Test failed: assertion error",
        )
        db_session.add(verification)
        await db_session.commit()
        await db_session.refresh(verification)

        response = await client.get(f"/api/v1/patches/verification/{verification.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(verification.id)
        assert data["status"] == "repair_failed"
        assert data["tests_passed"] is False