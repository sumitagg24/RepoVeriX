"""Tests for billing: plan quotas, usage rollover, 402 enforcement, routes."""

import base64
import hashlib
import hmac
import json
import time
import uuid
from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.db.models import PlanName
from app.services import billing as svc
from app.services import dodo


@pytest.fixture(autouse=True)
def _settings_cache():
    yield
    get_settings.cache_clear()


@pytest.fixture
def tiny_free(monkeypatch):
    """Free plan with a 2-scan / 1-fix / 1-verify / 1-repo / 1-audit budget."""
    free = replace(
        svc.get_plan("free"),
        max_repositories=1,
        scans_per_month=2,
        fixes_per_month=1,
        verifications_per_month=1,
        website_audits_per_month=1,
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
    async def test_website_audit_quota_counts_and_blocks(self, db_session, test_user, tiny_free):
        await svc.assert_can_audit_website(db_session, test_user)
        assert test_user.website_audits_used == 1

        from fastapi import HTTPException

        with pytest.raises(HTTPException) as exc:
            await svc.assert_can_audit_website(db_session, test_user)
        assert exc.value.status_code == 402

    @pytest.mark.asyncio
    async def test_rollover_resets_website_audits(self, db_session, test_user, tiny_free):
        test_user.website_audits_used = 1
        test_user.current_period_end = datetime.now(UTC) - timedelta(days=1)
        db_session.add(test_user)
        await svc.assert_can_audit_website(db_session, test_user)  # rolls over, then consumes 1
        assert test_user.website_audits_used == 1

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
        assert "website_audits_per_month" in body["plan"]
        assert "scans_used" in body["usage"]
        assert "website_audits_used" in body["usage"]
        assert "period_ends_at" in body["usage"]
        assert "customer_id" in body["subscription"]
        assert "subscription_id" in body["subscription"]
        assert body["demo_mode"] is True

    @pytest.mark.asyncio
    async def test_website_audit_endpoint_402_when_quota_exhausted(
        self, client: AsyncClient, auth_headers, test_user, tiny_free, monkeypatch
    ):
        _enable_routes(monkeypatch)
        first_site = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://quota-one.example"}
        )
        assert first_site.status_code == 201
        first_audit = await client.post(
            f"/api/v1/websites/{first_site.json()['id']}/audits", headers=auth_headers, json={}
        )
        assert first_audit.status_code == 202

        second_site = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://quota-two.example"}
        )
        assert second_site.status_code == 201
        exhausted = await client.post(
            f"/api/v1/websites/{second_site.json()['id']}/audits", headers=auth_headers, json={}
        )
        assert exhausted.status_code == 402
        assert exhausted.headers.get("X-Upgrade-Reason") == "website-audit-quota"

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


# --------------------------------------------------------------------- Dodo Payments

# A deterministic test signing secret in the Standard Webhooks format.
_DODO_SECRET = "whsec_" + base64.b64encode(b"repoverix-test-webhook-secret").decode()


def _dodo_signature(secret: str, msg_id: str, timestamp: str, body: bytes) -> str:
    key = base64.b64decode(secret.removeprefix("whsec_"))
    signed = f"{msg_id}.{timestamp}.{body.decode('utf-8')}".encode()
    return "v1," + base64.b64encode(hmac.new(key, signed, hashlib.sha256).digest()).decode()


def _enable_dodo(monkeypatch, *, api_key: str | None = None):
    """Flip the routes from demo mode to live Dodo Payments."""
    monkeypatch.setenv("REPOVERIX_BILLING_ENFORCE", "true")
    monkeypatch.setenv("REPOVERIX_BILLING_DEMO_MODE", "false")
    monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
    if api_key is not None:
        monkeypatch.setenv("REPOVERIX_DODO_API_KEY", api_key)
    get_settings.cache_clear()


async def _post_webhook(client: AsyncClient, event: dict, *, secret: str = _DODO_SECRET):
    body = json.dumps(event).encode()
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    timestamp = str(int(time.time()))
    signature = _dodo_signature(secret, msg_id, timestamp, body)
    return await client.post(
        "/api/v1/billing/webhook",
        content=body,
        headers={
            "content-type": "application/json",
            "webhook-id": msg_id,
            "webhook-timestamp": timestamp,
            "webhook-signature": signature,
        },
    )


def _subscription_event(
    event_type: str, user, *, product_id: str = "pdt_pro_test", status: str = "active", **overrides
) -> dict:
    data = {
        "payload_type": "Subscription",
        "subscription_id": "sub_test_1",
        "product_id": product_id,
        "status": status,
        "customer": {"customer_id": "cus_test_1", "email": user.email, "name": "Test user"},
        "metadata": {"user_id": str(user.id)},
        "next_billing_date": "2026-12-01T00:00:00Z",
        "cancel_at_next_billing_date": False,
    }
    data.update(overrides)
    return {"business_id": "bus_test", "type": event_type, "timestamp": "2026-11-01T00:00:00Z", "data": data}


class TestDodoSignatureVerification:
    def test_valid_signature_roundtrip(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
        get_settings.cache_clear()
        body = b'{"type": "payment.succeeded"}'
        timestamp = str(int(time.time()))
        signature = _dodo_signature(_DODO_SECRET, "msg_1", timestamp, body)

        event = dodo.verify_webhook(
            body,
            {"webhook-id": "msg_1", "webhook-timestamp": timestamp, "webhook-signature": signature},
        )
        assert event["type"] == "payment.succeeded"

    def test_tampered_body_is_rejected(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
        get_settings.cache_clear()
        timestamp = str(int(time.time()))
        signature = _dodo_signature(_DODO_SECRET, "msg_1", timestamp, b'{"type": "payment.succeeded"}')

        with pytest.raises(dodo.DodoError):
            dodo.verify_webhook(
                b'{"type": "payment.failed"}',
                {"webhook-id": "msg_1", "webhook-timestamp": timestamp, "webhook-signature": signature},
            )

    def test_wrong_secret_is_rejected(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
        get_settings.cache_clear()
        other = "whsec_" + base64.b64encode(b"some-other-secret").decode()
        body = b'{"type": "payment.succeeded"}'
        timestamp = str(int(time.time()))
        signature = _dodo_signature(other, "msg_1", timestamp, body)

        with pytest.raises(dodo.DodoError):
            dodo.verify_webhook(
                body,
                {"webhook-id": "msg_1", "webhook-timestamp": timestamp, "webhook-signature": signature},
            )

    def test_stale_timestamp_is_rejected(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
        get_settings.cache_clear()
        body = b'{"type": "payment.succeeded"}'
        timestamp = str(int(time.time()) - 3600)
        signature = _dodo_signature(_DODO_SECRET, "msg_1", timestamp, body)

        with pytest.raises(dodo.DodoError):
            dodo.verify_webhook(
                body,
                {"webhook-id": "msg_1", "webhook-timestamp": timestamp, "webhook-signature": signature},
            )

    def test_missing_headers_are_rejected(self, monkeypatch):
        monkeypatch.setenv("REPOVERIX_DODO_WEBHOOK_SECRET", _DODO_SECRET)
        get_settings.cache_clear()
        with pytest.raises(dodo.DodoError):
            dodo.verify_webhook(b"{}", {})


class TestDodoCheckout:
    @pytest.mark.asyncio
    async def test_checkout_503_when_unconfigured(self, client: AsyncClient, auth_headers, monkeypatch):
        _enable_dodo(monkeypatch)  # no API key, no product IDs
        response = await client.post("/api/v1/billing/checkout?plan=pro", headers=auth_headers)
        assert response.status_code == 503

    @pytest.mark.asyncio
    async def test_checkout_returns_dodo_url(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch, api_key="test_dodo_key")
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")

        captured: dict = {}

        async def fake_checkout(**kwargs):
            captured.update(kwargs)
            return {
                "checkout_url": "https://test.checkout.dodopayments.com/session/cks_test",
                "session_id": "cks_test",
            }

        monkeypatch.setattr("app.services.dodo.create_checkout_session", fake_checkout)

        response = await client.post("/api/v1/billing/checkout?plan=pro", headers=auth_headers)
        assert response.status_code == 200
        body = response.json()
        assert body == {"url": "https://test.checkout.dodopayments.com/session/cks_test", "demo": False}
        # The checkout carries the account id so webhooks can resolve it back.
        assert captured["product_id"] == "pdt_pro_test"
        assert captured["customer_email"] == test_user.email
        assert captured["metadata"]["user_id"] == str(test_user.id)

    @pytest.mark.asyncio
    async def test_portal_400_without_linked_customer(self, client: AsyncClient, auth_headers, monkeypatch):
        _enable_dodo(monkeypatch, api_key="test_dodo_key")
        response = await client.post("/api/v1/billing/portal", headers=auth_headers)
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_portal_returns_dodo_link(
        self, client: AsyncClient, auth_headers, test_user, db_session, monkeypatch
    ):
        _enable_dodo(monkeypatch, api_key="test_dodo_key")
        test_user.dodo_customer_id = "cus_portal_1"
        db_session.add(test_user)
        await db_session.flush()

        async def fake_portal(customer_id: str) -> str:
            assert customer_id == "cus_portal_1"
            return "https://customer.dodopayments.com/session/portal_test"

        monkeypatch.setattr("app.services.dodo.create_customer_portal_session", fake_portal)

        response = await client.post("/api/v1/billing/portal", headers=auth_headers)
        assert response.status_code == 200
        assert response.json()["url"] == "https://customer.dodopayments.com/session/portal_test"


class TestDodoWebhooks:
    @pytest.mark.asyncio
    async def test_subscription_active_upgrades_and_links_customer(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")

        response = await _post_webhook(client, _subscription_event("subscription.active", test_user))
        assert response.status_code == 200
        assert response.json() == {"received": True}

        assert test_user.plan == PlanName.pro
        assert test_user.subscription_status.value == "active"
        assert test_user.dodo_customer_id == "cus_test_1"
        assert test_user.dodo_subscription_id == "sub_test_1"
        assert test_user.current_period_end is not None

    @pytest.mark.asyncio
    async def test_subscription_renewed_resets_usage(
        self, client: AsyncClient, auth_headers, test_user, db_session, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")
        test_user.dodo_customer_id = "cus_test_1"  # already linked
        test_user.plan = PlanName.pro
        test_user.scans_used = 42
        db_session.add(test_user)
        await db_session.flush()

        response = await _post_webhook(client, _subscription_event("subscription.renewed", test_user))
        assert response.status_code == 200
        assert test_user.scans_used == 0  # a renewal opens a fresh budget

    @pytest.mark.asyncio
    async def test_scheduled_cancellation_keeps_plan_until_term_end(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")
        await _post_webhook(client, _subscription_event("subscription.active", test_user))

        event = _subscription_event(
            "subscription.cancelled",
            test_user,
            status="cancelled",
            cancel_at_next_billing_date=True,
        )
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.subscription_status.value == "canceled"
        assert test_user.plan == PlanName.pro  # access continues to the term end

    @pytest.mark.asyncio
    async def test_immediate_cancellation_downgrades_to_free(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")
        await _post_webhook(client, _subscription_event("subscription.active", test_user))

        event = _subscription_event(
            "subscription.cancelled",
            test_user,
            status="cancelled",
            cancel_at_next_billing_date=False,
        )
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.plan == PlanName.free
        assert test_user.subscription_status.value == "canceled"
        assert test_user.dodo_subscription_id is None

    @pytest.mark.asyncio
    async def test_subscription_expired_downgrades_to_free(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")
        await _post_webhook(client, _subscription_event("subscription.active", test_user))

        event = _subscription_event("subscription.expired", test_user, status="expired")
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.plan == PlanName.free
        assert test_user.subscription_status.value == "canceled"

    @pytest.mark.asyncio
    async def test_payment_succeeded_links_customer_without_plan_change(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        event = {
            "business_id": "bus_test",
            "type": "payment.succeeded",
            "timestamp": "2026-11-01T00:00:00Z",
            "data": {
                "payload_type": "Payment",
                "payment_id": "pay_test_1",
                "status": "succeeded",
                "subscription_id": "sub_test_1",
                "customer": {"customer_id": "cus_pay_1", "email": test_user.email, "name": "Test"},
                "metadata": {"user_id": str(test_user.id)},
            },
        }
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.dodo_customer_id == "cus_pay_1"
        assert test_user.plan == PlanName.free  # plan changes arrive via subscription events

    @pytest.mark.asyncio
    async def test_webhook_rejects_invalid_signature(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        wrong = "whsec_" + base64.b64encode(b"not-the-signing-secret").decode()
        response = await _post_webhook(
            client, _subscription_event("subscription.active", test_user), secret=wrong
        )
        assert response.status_code == 400
        assert test_user.plan == PlanName.free

    @pytest.mark.asyncio
    async def test_unknown_event_type_is_ignored(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        event = _subscription_event("refund.succeeded", test_user)
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.plan == PlanName.free

    @pytest.mark.asyncio
    async def test_webhook_resolves_account_by_email_when_metadata_missing(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_dodo(monkeypatch)
        monkeypatch.setitem(svc.DODO_PRODUCT_IDS, "pro", "pdt_pro_test")
        event = _subscription_event("subscription.active", test_user)
        event["data"]["metadata"] = {}  # e.g. a subscription created outside the checkout flow
        response = await _post_webhook(client, event)
        assert response.status_code == 200
        assert test_user.plan == PlanName.pro
