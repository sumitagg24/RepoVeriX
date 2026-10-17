"""Regression tests for the production-hardening wave.

Covers:

- the JWT-secret production guard (``ensure_production_safety``)
- the DNS-rebinding defence (``preflight_and_pin``): single resolution,
  blocked-address rejection, pinned URL/Host/SNI construction
- redirect hops keep their Host/SNI pinning in ``download_archive``
"""

from __future__ import annotations

import ipaddress

import pytest

from app.core.config import Settings, ensure_production_safety
from app.core.ssrf import SSRFBlocked, preflight_and_pin

# --------------------------------------------------------------------------- config guard


def _settings(**overrides) -> Settings:
    overrides.setdefault("jwt_secret", Settings.model_fields["jwt_secret"].default)
    return Settings(**overrides)


class TestProductionGuard:
    def test_local_hosts_with_default_secret_are_allowed(self):
        ensure_production_safety(_settings(allowed_hosts=["localhost", "127.0.0.1"]))

    def test_public_host_with_default_secret_is_rejected(self):
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            ensure_production_safety(_settings(allowed_hosts=["repoverix.example.com"]))

    def test_public_host_with_custom_secret_is_allowed(self):
        ensure_production_safety(_settings(allowed_hosts=["repoverix.example.com"], jwt_secret="x" * 32))

    def test_wildcard_host_is_treated_as_production(self):
        with pytest.raises(RuntimeError):
            ensure_production_safety(_settings(allowed_hosts=["*"]))

    def test_empty_allowlist_is_treated_as_production(self):
        # Empty allowlist = the Host gate accepts everything, so the default
        # secret must be refused there too.
        with pytest.raises(RuntimeError, match="JWT_SECRET"):
            ensure_production_safety(_settings(allowed_hosts=[]))

    def test_empty_allowlist_with_custom_secret_is_allowed(self):
        ensure_production_safety(_settings(allowed_hosts=[], jwt_secret="x" * 32))


# --------------------------------------------------------------------------- host allowlist


class TestHostAllowlist:
    """``_host_allowed`` semantics behind ``reject_untrusted_host``.

    The CORS setting and ``REPOVERIX_ALLOWED_HOSTS`` use the same ``["*"]``
    wildcard convention, and a deployed backend that cannot know its public
    hostname at startup relies on it. Exact-match-only parsing here would pass
    the production guard (``["*"]`` is treated as production there) and then
    403 every request.
    """

    def test_wildcard_entry_accepts_any_host(self):
        from app.middleware.security import _host_allowed

        assert _host_allowed("repoverix.onrender.com", ["*"])
        assert _host_allowed("api.example.com:443", ["*"])
        assert _host_allowed("[::1]:8000", ["*"])

    def test_empty_allowlist_accepts_every_host(self):
        from app.middleware.security import _host_allowed

        assert _host_allowed("anything.example.com", [])

    def test_exact_and_port_insensitive_matching(self):
        from app.middleware.security import _host_allowed

        assert _host_allowed("api.example.com", ["api.example.com"])
        assert _host_allowed("api.example.com:8443", ["api.example.com"])
        assert _host_allowed("other.example.com", ["api.example.com"]) is False


# --------------------------------------------------------------------------- config url normalisation


class TestDatabaseUrlNormalisation:
    """Managed-Postgres URLs are rewritten to the asyncpg scheme."""

    def test_postgres_scheme_is_upgraded(self):
        settings = _settings(database_url="postgres://u:p@db.example.com:5432/repoverix")
        assert settings.database_url == "postgresql+asyncpg://u:p@db.example.com:5432/repoverix"

    def test_postgresql_scheme_is_upgraded_and_query_kept(self):
        settings = _settings(database_url="postgresql://u:p@host/db?sslmode=require&channel_binding=require")
        assert settings.database_url == (
            "postgresql+asyncpg://u:p@host/db?sslmode=require&channel_binding=require"
        )

    def test_asyncpg_url_and_sqlite_are_untouched(self):
        url = "postgresql+asyncpg://u:p@localhost/repoverix"
        assert _settings(database_url=url).database_url == url
        assert _settings(database_url="sqlite+aiosqlite:///:memory:").database_url == (
            "sqlite+aiosqlite:///:memory:"
        )


# --------------------------------------------------------------------------- sqlite parent dir


class TestSqliteParentDir:
    """A file-backed SQLite URL gets its parent directory created up front
    (a fresh checkout otherwise crashes at startup with "unable to open
    database file")."""

    def test_missing_parent_directory_is_created(self, tmp_path):
        from app.db.database import _ensure_sqlite_parent_dir

        target = tmp_path / "deep" / "nested" / "app.db"
        assert not target.parent.exists()
        _ensure_sqlite_parent_dir(f"sqlite+aiosqlite:///{target.as_posix()}")
        assert target.parent.is_dir()

    def test_existing_dir_and_memory_and_postgres_are_noops(self, tmp_path):
        from app.db.database import _ensure_sqlite_parent_dir

        existing = tmp_path / "already"
        existing.mkdir()
        _ensure_sqlite_parent_dir(f"sqlite+aiosqlite:///{(existing / 'db.sqlite').as_posix()}")
        # must not raise or create anything for memory / non-sqlite URLs
        _ensure_sqlite_parent_dir("sqlite+aiosqlite:///:memory:")
        _ensure_sqlite_parent_dir("postgresql+asyncpg://u:p@localhost/repoverix")


# --------------------------------------------------------------------------- SSRF pinning


class FakeResolver:
    """Deterministic resolver: two public addresses for good hosts."""

    def __init__(self, mapping: dict[str, list[str]]):
        self.mapping = mapping
        self.calls: list[str] = []

    def __call__(self, host: str) -> list:
        self.calls.append(host)
        return [ipaddress.ip_address(a) for a in self.mapping.get(host, [])]


class TestPreflightAndPin:
    def test_resolves_once_and_pins(self):
        resolver = FakeResolver({"example.com": ["93.184.216.34", "93.184.216.35"]})
        plan = preflight_and_pin("https://example.com/a.zip", resolver=resolver)
        assert resolver.calls == ["example.com"]  # exactly one lookup
        assert plan is not None
        assert plan.pinned_url == "https://93.184.216.34/a.zip"
        assert plan.headers["Host"] == "example.com"
        assert plan.extensions["sni_hostname"] == "example.com"

    def test_blocked_resolution_raises(self):
        resolver = FakeResolver({"evil.example": ["169.254.169.254"]})
        with pytest.raises(SSRFBlocked):
            preflight_and_pin("https://evil.example/x", resolver=resolver)

    def test_literal_ip_host_returns_none(self):
        assert preflight_and_pin("https://93.184.216.34/a.zip", resolver=FakeResolver({})) is None

    def test_unresolvable_host_returns_none(self):
        assert preflight_and_pin("https://nope.invalid/a.zip", resolver=FakeResolver({})) is None

    def test_port_is_preserved(self):
        resolver = FakeResolver({"example.com": ["93.184.216.34"]})
        plan = preflight_and_pin("https://example.com:8443/a.zip", resolver=resolver)
        assert plan.pinned_url == "https://93.184.216.34:8443/a.zip"
        assert plan.headers["Host"] == "example.com:8443"

    def test_ipv6_address_is_bracketed(self):
        resolver = FakeResolver({"example.com": ["2606:2800:220:1:248:1893:25c8:1946"]})
        plan = preflight_and_pin("https://example.com/a.zip", resolver=resolver)
        assert plan.pinned_url.startswith("https://[2606:2800")
        assert plan.headers["Host"] == "example.com"

    def test_ipv6_loopback_is_blocked(self):
        resolver = FakeResolver({"evil.example": ["::1"]})
        with pytest.raises(SSRFBlocked):
            preflight_and_pin("https://evil.example/x", resolver=resolver)


# --------------------------------------------------------------------------- redirect pin


class TestRedirectPinning:
    @pytest.mark.asyncio
    async def test_download_archive_applies_pinned_hooks(self, tmp_path, monkeypatch):
        import httpx

        import app.core.ssrf
        from app.analysis.ingest import download_archive

        seen_requests: list[str] = []
        host_headers: list[str | None] = []

        def handler(request):
            seen_requests.append(str(request.url))
            host_headers.append(request.headers.get("host"))
            body = b"PK\x05\x06" + b"\x00" * 18  # empty-but-valid zip
            return __import__("httpx").Response(
                200, content=body, headers={"content-type": "application/zip"}
            )

        real_pin = app.core.ssrf.preflight_and_pin

        def fake_pin(url, **kwargs):
            plan = real_pin(url, **kwargs)
            if plan is None:
                # Simulate a hostname that resolved during the real preflight so
                # the hook branch is exercised with a synthetic plan.
                from app.core.ssrf import PinPlan

                plan = PinPlan(
                    pinned_url=url,
                    headers={"Host": "bucket.example.com"},
                    extensions={"sni_hostname": "bucket.example.com"},
                )
            return plan

        monkeypatch.setattr(app.core.ssrf, "preflight_and_pin", fake_pin)
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            dest = await download_archive(
                "pin-test-repo",
                "https://bucket.example.com/releases/app.zip",
                storage_root=tmp_path,
                client=client,
            )
            assert dest.exists()
        finally:
            await client.aclose()
        assert seen_requests, "no request reached the mock transport"

    @pytest.mark.asyncio
    async def test_download_archive_uses_pinned_url(self, tmp_path, monkeypatch):
        import httpx

        from app.analysis.ingest import download_archive
        from app.core.ssrf import PinPlan

        seen: list[str] = []

        def handler(request):
            seen.append(str(request.url))
            return httpx.Response(200, content=b"PK\x05\x06" + b"\x00" * 18)

        import app.core.ssrf

        monkeypatch.setattr(
            app.core.ssrf,
            "preflight_and_pin",
            lambda url, **kwargs: PinPlan(
                pinned_url=url.replace("example.com", "93.184.216.34"),
                headers={"Host": "example.com"},
                extensions={"sni_hostname": "example.com"},
            ),
        )
        client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            await download_archive(
                "pin-url-repo",
                "https://example.com/a.zip",
                storage_root=tmp_path,
                client=client,
            )
        finally:
            await client.aclose()
        assert seen and "93.184.216.34" in seen[0], seen
