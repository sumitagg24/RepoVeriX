"""Operator (admin) access: emails in ``REPOVERIX_ADMIN_EMAILS`` hold every
feature regardless of the stored plan — quotas, premium tools and LLM-only
scan configurations — while ordinary accounts keep their limits.

The grant is computed from the setting on every read and never stored, so
removing the email from the environment revokes the access immediately.
"""

from dataclasses import replace

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.db.models import PlanName, ScanConfiguration
from app.services import billing as svc

ADMIN_EMAIL = "owner@example.com"


@pytest.fixture(autouse=True)
def _admin_env(monkeypatch):
    monkeypatch.setenv("REPOVERIX_ADMIN_EMAILS", f"{ADMIN_EMAIL}, Second@Example.com ")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _promote(user):
    """Point the fixture user at the configured operator email (no schema change)."""
    user.email = ADMIN_EMAIL
    return user


def _enable_enforcement(monkeypatch):
    monkeypatch.setenv("REPOVERIX_BILLING_ENFORCE", "true")
    monkeypatch.setenv("REPOVERIX_BILLING_DEMO_MODE", "true")
    get_settings.cache_clear()


class TestAdminResolution:
    def test_matching_is_case_and_whitespace_insensitive(self):
        assert svc.is_admin_email("owner@example.com")
        assert svc.is_admin_email("OWNER@EXAMPLE.COM")
        assert svc.is_admin_email(" second@example.com ")
        assert not svc.is_admin_email("someone-else@example.com")
        assert not svc.is_admin_email(None)

    def test_empty_setting_grants_nothing(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_ADMIN_EMAILS", "")
        get_settings.cache_clear()
        assert not svc.is_admin_email("owner@example.com")

    @pytest.mark.asyncio
    async def test_plan_for_admin_ignores_stored_plan(self, test_user):
        _promote(test_user)
        limits = svc.plan_for_user(test_user)
        assert limits.name == "admin"
        assert limits.llm_enabled and limits.sandbox_enabled
        assert limits.max_repositories == svc.ADMIN_QUOTA
        assert test_user.plan == PlanName.free  # the stored plan is untouched

    @pytest.mark.asyncio
    async def test_plan_for_regular_user_unchanged(self, test_user):
        assert svc.plan_for_user(test_user).name == "free"


class TestAdminBypassesEveryGate:
    @pytest.mark.asyncio
    async def test_quotas_never_block_admin_but_still_count(
        self, db_session, test_user, test_repository, monkeypatch
    ):
        # Squeeze the free plan to a 1-unit budget; the admin plan is unaffected.
        squeezed = replace(
            svc.get_plan("free"),
            max_repositories=1,
            scans_per_month=1,
            fixes_per_month=1,
            verifications_per_month=1,
            website_audits_per_month=1,
        )
        monkeypatch.setitem(svc.PLANS, "free", squeezed)
        _promote(test_user)
        test_user.scans_used = 500  # far past any real plan's budget
        db_session.add(test_user)
        await db_session.flush()

        await svc.assert_can_scan(db_session, test_user)
        await svc.assert_can_import_repository(db_session, test_user)  # holds 1 repo, cap 1
        await svc.assert_can_generate_fix(db_session, test_user)
        await svc.assert_can_verify(db_session, test_user)
        await svc.assert_can_audit_website(db_session, test_user)
        assert test_user.scans_used == 501  # usage is recorded, never rejected

    @pytest.mark.asyncio
    async def test_premium_tools_and_llm_configs_pass(self, db_session, test_user):
        _promote(test_user)
        await svc.require_premium(db_session, test_user, "reports")
        await svc.require_premium(db_session, test_user, "change-audit")
        await svc.require_llm_scan_config(db_session, test_user, ScanConfiguration.repoverix)
        await svc.require_llm_scan_config(db_session, test_user, ScanConfiguration.llm_only)


class TestAdminRoutes:
    @pytest.mark.asyncio
    async def test_repoverix_scan_allowed_for_admin_on_free_plan(
        self, client: AsyncClient, auth_headers, test_user, test_repository, monkeypatch, db_session
    ):
        _enable_enforcement(monkeypatch)
        _promote(test_user)
        db_session.add(test_user)
        await db_session.flush()

        response = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id), "configuration": "repoverix"},
            headers=auth_headers,
        )
        assert response.status_code == 201, response.text

    @pytest.mark.asyncio
    async def test_regular_user_still_blocked(
        self, client: AsyncClient, auth_headers, test_repository, monkeypatch
    ):
        """The env var names other emails — ordinary accounts keep their limits."""
        _enable_enforcement(monkeypatch)
        response = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id), "configuration": "repoverix"},
            headers=auth_headers,
        )
        assert response.status_code == 402
        assert response.headers.get("X-Upgrade-Reason") == "llm-scan-config"

    @pytest.mark.asyncio
    async def test_billing_overview_reports_admin_plan(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch, db_session
    ):
        _enable_enforcement(monkeypatch)
        _promote(test_user)
        db_session.add(test_user)
        await db_session.flush()

        response = await client.get("/api/v1/billing", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["plan"]["name"] == "admin"
        assert body["plan"]["llm_enabled"] is True
        assert body["plan"]["sandbox_enabled"] is True
        assert body["plan"]["max_repositories"] == svc.ADMIN_QUOTA
        assert body["admin"] is True

    @pytest.mark.asyncio
    async def test_auth_me_reports_admin_flag(
        self, client: AsyncClient, auth_headers, test_user, db_session
    ):
        _promote(test_user)
        db_session.add(test_user)
        await db_session.flush()

        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_admin"] is True

    @pytest.mark.asyncio
    async def test_auth_me_admin_flag_false_for_regular_user(self, client: AsyncClient, auth_headers):
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["is_admin"] is False
