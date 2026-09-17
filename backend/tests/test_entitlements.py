"""Entitlement enforcement: paid/premium tools must reject Free accounts with
``402`` before any work happens, and paid accounts must pass the same gates.

Enforcement is server-side and checked before repository loads, GitHub calls or
scan scheduling — so calling the API directly (or via a scraper) can never
reach a premium tool on a Free account.
"""

import uuid

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.db.models import PlanName


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    yield
    get_settings.cache_clear()


def _enable_enforcement(monkeypatch):
    monkeypatch.setenv("REPOVERIX_BILLING_ENFORCE", "true")
    monkeypatch.setenv("REPOVERIX_BILLING_DEMO_MODE", "true")
    get_settings.cache_clear()


JUNK = str(uuid.uuid4())

# (method, path, body, expected X-Upgrade-Reason)
PREMIUM_ENDPOINTS = [
    ("post", f"/api/v1/repositories/{JUNK}/change-audit", {"base": "main", "head": "dev"}, "change-audit"),
    (
        "post",
        f"/api/v1/repositories/{JUNK}/explain-change",
        {"diff": "--- a/x\n+++ b/x\n@@ -1 +1 @@\n-old\n+new\n"},
        "change-audit",
    ),
    ("post", f"/api/v1/repositories/{JUNK}/pull-requests/analyze", {"pr_number": 1}, "pull-request-audit"),
    ("post", f"/api/v1/repositories/{JUNK}/pull-requests/{JUNK}/post", None, "pull-request-audit"),
    ("get", f"/api/v1/scans/{JUNK}/sarif", None, "sarif-export"),
    ("get", f"/api/v1/scans/{JUNK}/report", None, "reports"),
    (
        "post",
        f"/api/v1/repositories/{JUNK}/query",
        {"question": "Where is authentication implemented?"},
        "ai-assistant",
    ),
    ("post", f"/api/v1/findings/{JUNK}/chat", {"question": "Explain this finding"}, "ai-assistant"),
    ("get", f"/api/v1/repositories/{JUNK}/multi-agent", None, "research-llm"),
    ("get", f"/api/v1/repositories/{JUNK}/self-improvement", None, "research-llm"),
    ("get", f"/api/v1/repositories/{JUNK}/vuln-mining", None, "research-llm"),
]


class TestFreeCannotReachPremiumTools:
    @pytest.mark.asyncio
    @pytest.mark.parametrize("method,path,body,reason", PREMIUM_ENDPOINTS)
    async def test_free_user_blocked_with_upgrade_reason(
        self, client: AsyncClient, auth_headers, monkeypatch, method, path, body, reason
    ):
        _enable_enforcement(monkeypatch)
        response = await client.request(
            method.upper(), path, json=body, headers=auth_headers, follow_redirects=False
        )
        assert response.status_code == 402, (
            f"{method} {path} should be 402, got {response.status_code}: {response.text}"
        )
        assert response.headers.get("X-Upgrade-Reason") == reason
        assert "Pro" in response.json()["detail"]


class TestPaidPlanUnlocksTools:
    @pytest.mark.asyncio
    async def test_premium_gate_passes_after_upgrade(
        self, client: AsyncClient, auth_headers, test_user, monkeypatch
    ):
        _enable_enforcement(monkeypatch)
        # Upgrade via the demo checkout path (same mechanism production webhooks use).
        checkout = await client.post(
            "/api/v1/billing/checkout?plan=pro", headers=auth_headers, follow_redirects=False
        )
        assert checkout.status_code == 200
        assert test_user.plan == PlanName.pro

        # The same gated call is no longer 402 — it proceeds (and 404s on the junk id).
        response = await client.post(
            f"/api/v1/repositories/{JUNK}/change-audit",
            json={"base": "main", "head": "dev"},
            headers=auth_headers,
            follow_redirects=False,
        )
        assert response.status_code != 402

        sarif = await client.get(f"/api/v1/scans/{JUNK}/sarif", headers=auth_headers)
        assert sarif.status_code != 402

    @pytest.mark.asyncio
    async def test_llm_scan_config_blocked_on_free_allowed_on_pro(
        self, client: AsyncClient, auth_headers, test_repository, monkeypatch
    ):
        _enable_enforcement(monkeypatch)
        free_scan = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id), "configuration": "repoverix"},
            headers=auth_headers,
        )
        assert free_scan.status_code == 402
        assert free_scan.headers.get("X-Upgrade-Reason") == "llm-scan-config"

        checkout = await client.post(
            "/api/v1/billing/checkout?plan=pro", headers=auth_headers, follow_redirects=False
        )
        assert checkout.status_code == 200

        pro_scan = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id), "configuration": "repoverix"},
            headers=auth_headers,
        )
        assert pro_scan.status_code == 201, pro_scan.text

    @pytest.mark.asyncio
    async def test_hybrid_scan_config_stays_free(
        self, client: AsyncClient, auth_headers, test_repository, monkeypatch
    ):
        """Static + hybrid configurations remain available on the Free plan."""
        _enable_enforcement(monkeypatch)
        for config in ("static_only", "static_llm"):
            response = await client.post(
                "/api/v1/scans",
                json={"repository_id": str(test_repository.id), "configuration": config},
                headers=auth_headers,
            )
            assert response.status_code == 201, (config, response.text)
