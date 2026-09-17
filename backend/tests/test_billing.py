"""Tests for billing: plan quotas, usage rollover, 402 enforcement, routes."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.db.models import PlanName
from app.services import billing as svc


@pytest.fixture(autouse=True)
def _settings_cache():
    yield
    get_settings.cache_clear()


@pytest.fixture
def tiny_free(monkeypatch):
    """Free plan with a 2-scan / 1-fix / 1-verify / 1-repo budget."""
    free = replace(
        svc.get_plan("free"),
        max_repositories=1,
        scans_per_month=2,
        fixes_per_month=1,
        verifications_per_month=1,
    )
    monkeypatch.setitem(svc.PLANS, "free", free)
    return free


def _enable_routes(monkeypatch):
    monkeypatch.setenv("REPOVERIX_BILLING_ENFORCE", "true")
    monkeypatch.setenv("REPOVERIX_BILLING_DEMO_MODE", "true")
    get_settings.cache_clear()


class TestPlansCatalog:
    def test_free_defaults(self):
        limits = svc.get_plan("free")
        assert limits.price_monthly == 0
        assert limits.llm_enabled is False

    def test_pro_has_llm_and_sandbox(self):
        limits = svc.get_plan("pro")
        assert limits.llm_enabled and limits.sandbox_enabled
        assert limits.price_monthly == 2900

    def test_unknown_plan_falls_back_to_free(self):
        assert svc.get_plan("enterprise-plan").name == "free"


class TestQuotas:
    @pytest.mark.asyncio
    async def test_scan_quota_counts_and_blocks(self, db_session, test_user, tiny_free):
        await svc.assert_can_scan(db_session, test_user)
        await svc.assert_can_scan(db_session, test_user)
        assert test_user.scans_used == 2

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await svc.assert_can_scan(db_session, test_user)
        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_fix_and_verify_quotas(self, db_session, test_user, tiny_free):
        await svc.assert_can_generate_fix(db_session, test_user)
        with pytest.raises(Exception) as exc:
            await svc.assert_can_generate_fix(db_session, test_user)
        assert exc.value.status_code == 402

        await svc.assert_can_verify(db_session, test_user)
        with pytest.raises(Exception) as exc:
            await svc.assert_can_verify(db_session, test_user)
        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_rollover_resets_usage_when_period_lapses(self, db_session, test_user, tiny_free):
        test_user.scans_used = 2
        test_user.current_period_end = datetime.now(UTC) - timedelta(days=1)
        db_session.add(test_user)
        await svc.assert_can_scan(db_session, test_user)  # rolls over, then consumes 1
        assert test_user.scans_used == 1
        assert test_user.current_period_end > datetime.now(UTC)

    @pytest.mark.asyncio
    async def test_repository_cap_blocks_import(self, db_session, test_user, test_repository, tiny_free):
        with pytest.raises(Exception) as exc:
            await svc.assert_can_import_repository(db_session, test_user)
        assert exc.value.status_code == 402


class TestBillingRoutes:
    @pytest.mark.asyncio
    async def test_checkout_demo_activates_pro(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_routes(monkeypatch)
        response = await client.post(
            "/api/v1/billing/checkout?plan=pro", headers=auth_headers, follow_redirects=False
        )
        assert response.status_code == 200
        body = response.json()
        assert body["demo"] is True
        assert "checkout=success" in body["url"]
        assert test_user.plan == PlanName.pro
        assert test_user.subscription_status.value == "active"
        assert test_user.scans_used == 0

    @pytest.mark.asyncio
    async def test_billing_overview_after_demo_checkout_survives_sqlite_roundtrip(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        """Regression: SQLite stores period_end without tzinfo; the overview
        must not crash comparing it against aware datetimes (and must report
        the upgraded plan)."""
        _enable_routes(monkeypatch)
        checkout = await client.post(
            "/api/v1/billing/checkout?plan=pro", headers=auth_headers, follow_redirects=False
        )
        assert checkout.status_code == 200

        response = await client.get("/api/v1/billing", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["plan"]["name"] == "pro"
        assert body["plan"]["price_monthly"] == 29  # cents -> dollars
        assert body["subscription"]["status"] == "active"
        assert body["subscription"]["period_end"] is not None

    @pytest.mark.asyncio
    async def test_rollover_with_naive_period_end(self, db_session, test_user, tiny_free, monkeypatch):
        """Regression: values read back from SQLite are naive; rollover must
        treat them as UTC rather than raising a comparison TypeError."""
        test_user.scans_used = 2
        test_user.current_period_end = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=1)
        db_session.add(test_user)
        await svc.assert_can_scan(db_session, test_user)
        assert test_user.scans_used == 1

    @pytest.mark.asyncio
    async def test_billing_overview_shape(self, client: AsyncClient, auth_headers, test_user, monkeypatch):
        _enable_routes(monkeypatch)
        response = await client.get("/api/v1/billing", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body["plan"]["name"] == "free"
        assert "scans_per_month" in body["plan"]
        assert "scans_used" in body["usage"]
        assert "period_ends_at" in body["usage"]
        assert body["demo_mode"] is True

    @pytest.mark.asyncio
    async def test_checkout_rejects_free(self, client: AsyncClient, auth_headers, monkeypatch):
        _enable_routes(monkeypatch)
        response = await client.post(
            "/api/v1/billing/checkout?plan=free", headers=auth_headers, follow_redirects=False
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_scan_endpoint_402_when_quota_exhausted(
        self,
        client: AsyncClient,
        auth_headers,
        test_user,
        test_repository,
        monkeypatch,
        db_session,
    ):
        _enable_routes(monkeypatch)
        await svc.rollover_if_needed(db_session, test_user)
        # Exhaust the free plan's monthly scan budget.
        test_user.scans_used = svc.get_plan("free").scans_per_month
        db_session.add(test_user)
        await db_session.flush()

        response = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id)},
            headers=auth_headers,
        )
        assert response.status_code == 402
        assert response.headers.get("X-Upgrade-Reason") == "scan-quota"
