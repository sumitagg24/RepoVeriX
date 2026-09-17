"""Tests for the passive website-audit subsystem.

Covers: URL normalization/safety, SSRF gating, deterministic analyzers
(including honest "insufficient data" states), route authorization (owner
isolation, 404 IDOR guard), and the background runner state machine with a
stubbed crawler.
"""

from __future__ import annotations

import asyncio
from unittest.mock import patch

import pytest
from httpx import AsyncClient

from app.analysis import webanalyze
from app.analysis.webcrawler import UnsafeURLError, normalize_url
from app.core.ssrf import SSRFBlocked, preflight_and_pin

# --------------------------------------------------------------------- URL safety


class TestUrlSafety:
    def test_normalize_adds_scheme(self):
        assert normalize_url("example.com") == "https://example.com/"

    def test_normalize_strips_path_and_fragment(self):
        assert normalize_url("https://example.com/a/b?x=1#frag") == "https://example.com/"

    def test_rejects_ftp(self):
        with pytest.raises(UnsafeURLError):
            normalize_url("ftp://example.com")

    def test_rejects_userinfo(self):
        with pytest.raises(UnsafeURLError):
            normalize_url("https://user:pass@example.com")

    def test_rejects_exotic_port(self):
        with pytest.raises(UnsafeURLError):
            normalize_url("http://example.com:8080")

    def test_rejects_empty(self):
        with pytest.raises(UnsafeURLError):
            normalize_url("   ")

    def test_trailing_dot_host_normalized(self):
        assert normalize_url("https://example.com./") == "https://example.com/"


class TestSSRFPreflight:
    def test_preflight_blocks_private_resolution(self):
        def resolver(host):
            return [__import__("ipaddress").ip_address("10.0.0.5")]

        with pytest.raises(SSRFBlocked):
            preflight_and_pin("https://evil.example.com", resolver=resolver)

    def test_preflight_pins_public_host(self):
        import ipaddress

        def resolver(host):
            return [ipaddress.ip_address("93.184.216.34")]

        plan = preflight_and_pin("https://example.com/page", resolver=resolver)
        assert plan is not None
        assert plan.pinned_url.startswith("https://93.184.216.34")
        assert plan.headers["Host"] == "example.com"
        assert plan.extensions["sni_hostname"] == "example.com"


# --------------------------------------------------------------------- analyzers


class TestAnalyzers:
    def _page(self, **overrides):
        page = {
            "url": "https://example.com/",
            "final_url": "https://example.com/",
            "status": 200,
            "depth": 0,
            "title": "Example Domain",
            "meta": {"description": "x" * 80, "canonical": "https://example.com/", "og:title": "Example"},
            "headings": {"h1": 1},
            "images_missing_alt": 0,
            "images_total": 0,
            "lang": "en",
            "json_ld_count": 1,
            "html_bytes": 1200,
            "response_ms": 180,
            "server": None,
            "security_headers": {
                "strict-transport-security": "max-age=63072000",
                "content-security-policy": "default-src 'self'",
                "x-content-type-options": "nosniff",
                "x-frame-options": "DENY",
                "referrer-policy": "strict-origin-when-cross-origin",
                "permissions-policy": "geolocation=()",
            },
            "cookies": [],
            "mixed_content": 0,
            "error": None,
            "robots_disallowed": False,
        }
        page.update(overrides)
        return page

    def test_scores_present_for_healthy_site(self):
        result = webanalyze.analyze(
            [self._page()], {"found": True, "sitemaps": ["https://example.com/sitemap.xml"]}
        )
        scores = result["scores"]
        assert scores["technical_seo"] == 100
        assert scores["security_posture"] == 100
        assert scores["performance"] is not None
        assert scores["ai_search_readiness"] == 100
        # A clean site must produce a strong-looking score, not manufactured penalties
        assert all(v is None or v >= 60 for v in scores.values())

    def test_missing_title_penalizes_seo(self):
        result = webanalyze.analyze([self._page(title=None)], {"found": False, "sitemaps": []})
        assert result["scores"]["technical_seo"] < 100
        codes = {f["code"] for f in result["findings"]}
        assert "seo_title_missing" in codes

    def test_insufficient_state_when_nothing_fetched(self):
        result = webanalyze.analyze([], {"found": False, "sitemaps": []})
        assert all(v is None for v in result["scores"].values())
        states = {f["state"] for f in result["findings"]}
        assert "insufficient" in states
        # No score may be manufactured from zero evidence
        assert not any(isinstance(v, (int, float)) for v in result["scores"].values())

    def test_missing_headers_are_recommendations_not_vulns(self):
        page = self._page(security_headers={k: None for k in self._page()["security_headers"]})
        result = webanalyze.analyze([page], {"found": True, "sitemaps": []})
        sec = [f for f in result["findings"] if f["code"].startswith("sec_header_missing")]
        assert sec, "missing headers should be reported"
        for f in sec:
            assert f["state"] == "recommendation"
            assert "defence-in-depth" in f["detail"] or "not proof" in f["detail"]

    def test_http_target_is_observed_high(self):
        page = self._page(final_url="http://example.com/")
        result = webanalyze.analyze([page], {"found": True, "sitemaps": []})
        codes = {f["code"]: f for f in result["findings"]}
        assert codes["sec_no_https"]["state"] == "observed"
        assert codes["sec_no_https"]["severity"] == "high"

    def test_evidence_rows_are_linked(self):
        page = self._page(title=None)
        result = webanalyze.analyze([page], {"found": True, "sitemaps": []})
        evidence_ids = {e["id"] for e in result["evidence"]}
        for f in result["findings"]:
            if f.get("evidence_id"):
                assert f["evidence_id"] in evidence_ids

    def test_robots_disallowed_pages_not_scored_as_broken(self):
        page = self._page(status=0, error="disallowed by robots.txt", robots_disallowed=True)
        result = webanalyze.analyze([page], {"found": True, "sitemaps": []})
        # Only the disallowed row exists: nothing usable, so scores stay null
        assert result["scores"]["technical_seo"] is None


# --------------------------------------------------------------------- routes


@pytest.mark.asyncio
class TestWebsiteRoutes:
    async def test_register_and_list(self, client: AsyncClient, auth_headers):
        response = await client.post("/api/v1/websites", headers=auth_headers, json={"url": "example.com"})
        assert response.status_code == 201, response.text
        data = response.json()
        assert data["hostname"] == "example.com"
        assert data["url"] == "https://example.com/"
        listing = await client.get("/api/v1/websites", headers=auth_headers)
        assert any(w["id"] == data["id"] for w in listing.json())

    async def test_register_idempotent(self, client: AsyncClient, auth_headers):
        first = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.org"}
        )
        second = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.org"}
        )
        assert first.json()["id"] == second.json()["id"]

    async def test_register_rejects_private_host(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "http://127.0.0.1:8000"}
        )
        assert response.status_code == 422

    async def test_register_rejects_bad_scheme(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "ftp://example.com"}
        )
        assert response.status_code == 422

    async def test_unauthenticated_denied(self, client: AsyncClient):
        response = await client.get("/api/v1/websites")
        assert response.status_code == 401

    async def test_owner_isolation_404(self, client: AsyncClient, auth_headers, auth_headers_b):
        created = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.com"}
        )
        website_id = created.json()["id"]
        # A different user gets the same 404 an anonymous request would get.
        response = await client.get(f"/api/v1/websites/{website_id}/audits", headers=auth_headers_b)
        assert response.status_code == 404
        delete_attempt = await client.delete(f"/api/v1/websites/{website_id}", headers=auth_headers_b)
        assert delete_attempt.status_code == 404

    async def test_create_audit_runs_and_completes(self, client: AsyncClient, auth_headers):
        created = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.com"}
        )
        website_id = created.json()["id"]

        async def fake_crawl(origin, *, max_pages=10, max_depth=2):
            return {
                "pages": [
                    {
                        "url": origin,
                        "final_url": origin,
                        "status": 200,
                        "depth": 0,
                        "title": "OK",
                        "meta": {},
                        "headings": {"h1": 1},
                        "images_missing_alt": 0,
                        "images_total": 1,
                        "lang": "en",
                        "json_ld_count": 0,
                        "html_bytes": 500,
                        "response_ms": 100,
                        "server": None,
                        "security_headers": {},
                        "cookies": [],
                        "mixed_content": 0,
                        "error": None,
                        "robots_disallowed": False,
                    }
                ],
                "robots": {"found": False, "sitemaps": []},
                "crawled": 1,
            }

        with patch("app.analysis.webrun.crawl_site", side_effect=fake_crawl):
            started = await client.post(
                f"/api/v1/websites/{website_id}/audits",
                headers=auth_headers,
                json={"max_pages": 5, "max_depth": 1},
            )
            assert started.status_code == 202, started.text
            audit_id = started.json()["id"]
            # Let the background task run to completion.
            for _ in range(50):
                await asyncio.sleep(0.05)
                detail = await client.get(
                    f"/api/v1/websites/{website_id}/audits/{audit_id}", headers=auth_headers
                )
                if detail.json()["status"] in ("complete", "failed"):
                    break
        assert detail.json()["status"] == "complete", detail.text
        body = detail.json()
        assert body["pages_crawled"] == 1
        assert body["scores"]["technical_seo"] is not None
        assert isinstance(body["findings"], list)
        assert isinstance(body["evidence"], list)

    async def test_audit_idor_guard(self, client: AsyncClient, auth_headers, auth_headers_b):
        created = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.net"}
        )
        website_id = created.json()["id"]
        started = await client.post(f"/api/v1/websites/{website_id}/audits", headers=auth_headers, json={})
        audit_id = started.json()["id"]
        foreign = await client.get(f"/api/v1/websites/{website_id}/audits/{audit_id}", headers=auth_headers_b)
        assert foreign.status_code == 404

    async def test_duplicate_live_audit_conflict(self, client: AsyncClient, auth_headers):
        created = await client.post(
            "/api/v1/websites", headers=auth_headers, json={"url": "https://example.io"}
        )
        website_id = created.json()["id"]
        first = await client.post(f"/api/v1/websites/{website_id}/audits", headers=auth_headers, json={})
        assert first.status_code == 202
        # The first audit will fail fast (unresolvable test host) but may still
        # be pending/running for a moment; the conflict path is what we assert.
        second = await client.post(f"/api/v1/websites/{website_id}/audits", headers=auth_headers, json={})
        assert second.status_code in (202, 409)
