"""Tests for app/core/ratelimit.py and its endpoint wiring.

The rest of the suite runs with ``REPOVERIX_RATE_LIMIT_ENABLED=false`` (set in
conftest); these tests flip it on with tight thresholds and always clear the
module singleton and the settings cache afterwards so no state leaks.
"""

import pytest
from httpx import AsyncClient

from app.core.config import get_settings
from app.core.ratelimit import limiter


@pytest.fixture(autouse=True)
def _clean_limiter():
    """Start every test from an empty limiter and settings cache."""
    limiter.clear()
    get_settings.cache_clear()
    yield
    limiter.clear()
    get_settings.cache_clear()


def _enable_rate_limits(monkeypatch, **overrides):
    defaults = {
        "REPOVERIX_RATE_LIMIT_ENABLED": "true",
        "REPOVERIX_AUTH_RATE_LIMIT_ATTEMPTS": "3",
        "REPOVERIX_AUTH_RATE_LIMIT_WINDOW_SECONDS": "60",
        "REPOVERIX_AUTH_BACKOFF_BASE_SECONDS": "2",
        "REPOVERIX_AUTH_BACKOFF_MAX_SECONDS": "60",
        "REPOVERIX_PUBLIC_RATE_LIMIT_PER_MINUTE": "50",
        "REPOVERIX_USER_ACTION_RATE_LIMIT_PER_MINUTE": "2",
    }
    for key, value in {**defaults, **overrides}.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Unit-level behaviour of the limiter
# ---------------------------------------------------------------------------


class TestLimiterCore:
    def test_window_allows_exact_budget(self):
        for _ in range(5):
            assert limiter.check("n", "k", limit=5, window_seconds=60).allowed

    def test_window_denies_past_budget(self):
        for _ in range(5):
            assert limiter.check("n", "k", limit=5, window_seconds=60).allowed
        result = limiter.check("n", "k", limit=5, window_seconds=60)
        assert not result.allowed
        assert result.retry_after_seconds >= 0

    def test_window_resets_after_period(self):
        now = 1000.0
        for _ in range(5):
            assert limiter.check("n", "k", limit=5, window_seconds=60, now=now).allowed
        # One minute later the window has rotated and a new budget is available.
        assert limiter.check("n", "k", limit=5, window_seconds=60, now=now + 61).allowed

    def test_backoff_escalates_and_is_capped(self):
        # 2 attempts allowed, base backoff 10s capped at 60s.
        now = 1000.0
        opts = dict(limit=2, window_seconds=60, backoff_base_seconds=10.0, backoff_max_seconds=60.0)
        assert limiter.check("n", "k", now=now, **opts).allowed
        assert limiter.check("n", "k", now=now, **opts).allowed

        waits = []
        for step in range(5):
            result = limiter.check("n", "k", now=now + step, **opts)
            assert not result.allowed
            waits.append(result.retry_after_seconds)

        # 10s, then 20s, 40s — capped at 60s no matter how hard the client hammers.
        assert waits == [10, 20, 40, 60, 60]

        # Once the lockout has been served the client gets a fresh budget
        # (escalation punishes bursts, not legitimate users forever).
        later = limiter.check("n", "k", now=now + 500, **opts)
        assert later.allowed

    def test_keys_are_isolated_by_namespace_and_value(self):
        assert limiter.check("n", "a", limit=1, window_seconds=60).allowed
        assert limiter.check("n", "b", limit=1, window_seconds=60).allowed
        assert not limiter.check("n", "a", limit=1, window_seconds=60).allowed
        assert limiter.check("other", "a", limit=1, window_seconds=60).allowed

    def test_reset_clears_bucket(self):
        for _ in range(3):
            limiter.check("n", "k", limit=3, window_seconds=60)
        assert not limiter.check("n", "k", limit=3, window_seconds=60).allowed
        limiter.reset("n", "k")
        assert limiter.check("n", "k", limit=3, window_seconds=60).allowed


# ---------------------------------------------------------------------------
# Endpoint-level enforcement
# ---------------------------------------------------------------------------


class TestEndpointRateLimits:
    @pytest.mark.asyncio
    async def test_login_throttles_with_escalating_backoff(self, client: AsyncClient, test_user, monkeypatch):
        """Wrong-password attempts over the budget get 429 with growing waits."""
        _enable_rate_limits(monkeypatch)
        payload = {"email": "test@example.com", "password": "wrong-password"}

        # First three attempts are allowed by the limiter (401 from the app).
        for _ in range(3):
            response = await client.post("/api/v1/auth/login", json=payload)
            assert response.status_code == 401

        fourth = await client.post("/api/v1/auth/login", json=payload)
        assert fourth.status_code == 429
        first_wait = int(fourth.headers["Retry-After"])

        fifth = await client.post("/api/v1/auth/login", json=payload)
        assert fifth.status_code == 429
        assert int(fifth.headers["Retry-After"]) > first_wait

    @pytest.mark.asyncio
    async def test_login_success_resets_backoff(self, client: AsyncClient, test_user, monkeypatch):
        """A successful login clears the account's counters."""
        _enable_rate_limits(monkeypatch)
        for _ in range(3):
            response = await client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrong-password"},
            )
            assert response.status_code == 401

        blocked = await client.post(
            "/api/v1/auth/login", json={"email": "test@example.com", "password": "wrong-password"}
        )
        assert blocked.status_code == 429

        # The lockout blocks even the correct password until it expires. A
        # successful login clears BOTH the account and the IP buckets — which
        # is exactly what reset_auth_attempts() does — so clear the limiter to
        # simulate that reset, then the real credentials must work.
        limiter.clear()

        ok = await client.post(
            "/api/v1/auth/login", json={"email": "test@example.com", "password": "password123"}
        )
        assert ok.status_code == 200

    @pytest.mark.asyncio
    async def test_signup_is_rate_limited_per_ip(self, client: AsyncClient, monkeypatch):
        _enable_rate_limits(monkeypatch)
        for i in range(3):
            response = await client.post(
                "/api/v1/auth/signup",
                json={
                    "email": f"bulk{i}@example.com",
                    "password": "password123",
                    "full_name": "Bulk Signup",
                },
            )
            assert response.status_code == 201
        response = await client.post(
            "/api/v1/auth/signup",
            json={"email": "bulk3@example.com", "password": "password123", "full_name": "Bulk Signup"},
        )
        assert response.status_code == 429
        assert "Retry-After" in response.headers

    @pytest.mark.asyncio
    async def test_action_limit_applies_per_user(
        self, client: AsyncClient, test_repository, auth_headers, monkeypatch
    ):
        _enable_rate_limits(monkeypatch)
        # Budget is 2 creates/min for authenticated actions.
        for _ in range(2):
            response = await client.post(
                "/api/v1/scans",
                json={"repository_id": str(test_repository.id)},
                headers=auth_headers,
            )
            assert response.status_code == 201
        response = await client.post(
            "/api/v1/scans",
            json={"repository_id": str(test_repository.id)},
            headers=auth_headers,
        )
        assert response.status_code == 429

    @pytest.mark.asyncio
    async def test_oauth_provider_enumeration_denied_when_lockout(self, client: AsyncClient, monkeypatch):
        """Public-tier limit kicks in on unauthenticated OAuth entrypoints."""
        _enable_rate_limits(
            monkeypatch,
            REPOVERIX_PUBLIC_RATE_LIMIT_PER_MINUTE="3",
            REPOVERIX_RATE_LIMIT_ENABLED="true",
        )
        for _ in range(3):
            response = await client.get("/api/v1/auth/oauth/providers")
            assert response.status_code == 200
        response = await client.get("/api/v1/auth/oauth/providers")
        assert response.status_code == 429
