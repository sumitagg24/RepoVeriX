"""Security-behaviour tests: error leakage, upload validation, normalization."""

import logging

import pytest
from httpx import AsyncClient

from app.main import app


class TestErrorHandling:
    @pytest.mark.asyncio
    async def test_unhandled_error_is_generic_and_logged(self, client: AsyncClient, auth_headers, caplog):
        """A crash inside a handler never reaches the client verbatim.

        The user receives a fixed generic body; the full detail (including any
        internal path in the exception message) is only written to the log.
        """
        from httpx import ASGITransport, AsyncClient

        from app.api.dependencies import get_db

        async def _boom():
            raise RuntimeError("boom: C:\\internal\\secret\\config.py")

        app.dependency_overrides[get_db] = _boom
        # raise_app_exceptions=False lets us observe the actual response;
        # starlette still re-raises after sending so servers can log.
        quiet = AsyncClient(
            transport=ASGITransport(app=app, raise_app_exceptions=False), base_url="http://test"
        )
        try:
            with caplog.at_level(logging.ERROR, logger="repoverix.http"):
                async with quiet:
                    response = await quiet.get("/api/v1/repositories", headers=auth_headers)
        finally:
            app.dependency_overrides.clear()

        assert response.status_code == 500
        body = response.text
        assert body == '{"detail":"Internal server error"}'
        assert "config.py" not in body
        # Full detail is captured server-side for debugging.
        assert any("boom" in record.getMessage() or record.exc_info for record in caplog.records)

    @pytest.mark.asyncio
    async def test_not_found_is_structured_and_short(self, client: AsyncClient, auth_headers):
        """Ownership-scoped lookups return clean 404s, not stack traces."""
        response = await client.get(
            "/api/v1/repositories/00000000-0000-0000-0000-000000000000", headers=auth_headers
        )
        assert response.status_code == 404
        assert response.json() == {"detail": "Repository not found"}


class TestUploadValidation:
    @pytest.mark.asyncio
    async def test_zip_upload_rejects_non_zip_content(self, client: AsyncClient, auth_headers):
        """A file named .zip whose content is not a ZIP is refused (magic bytes)."""
        response = await client.post(
            "/api/v1/repositories/zip",
            data={"name": "fake"},
            files={"file": ("fake.zip", b"#!/bin/sh\necho pwned > /tmp/x", "application/zip")},
            headers=auth_headers,
        )
        assert response.status_code == 400
        assert "not a valid ZIP" in response.json()["detail"]

    @pytest.mark.asyncio
    async def test_zip_upload_rejects_wrong_extension(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/v1/repositories/zip",
            data={"name": "fake"},
            files={"file": ("evil.txt", b"PK\x03\x04not really", "text/plain")},
            headers=auth_headers,
        )
        assert response.status_code == 400

    @pytest.mark.asyncio
    async def test_zip_upload_accepts_real_zip(self, client: AsyncClient, auth_headers):
        import io
        import zipfile

        buf = io.BytesIO()
        with zipfile.ZipFile(buf, "w") as zf:
            zf.writestr("hello.py", "print('hi')\n")
        response = await client.post(
            "/api/v1/repositories/zip",
            data={"name": "legit"},
            files={"file": ("legit.zip", buf.getvalue(), "application/zip")},
            headers=auth_headers,
        )
        assert response.status_code == 201
        assert response.json()["name"] == "legit"


class TestInputNormalization:
    @pytest.mark.asyncio
    async def test_signup_email_is_case_insensitive(self, client: AsyncClient):
        """Emails are stored lower-case, so case variants collide (no duplicates)."""
        first = await client.post(
            "/api/v1/auth/signup",
            json={"email": "Case.User@Example.com", "password": "password123", "full_name": "Case User"},
        )
        assert first.status_code == 201

        duplicate = await client.post(
            "/api/v1/auth/signup",
            json={"email": "case.user@example.com", "password": "password123", "full_name": "Case User"},
        )
        assert duplicate.status_code == 409

        # Login with the other case still succeeds.
        login = await client.post(
            "/api/v1/auth/login",
            json={"email": "CASE.USER@EXAMPLE.COM", "password": "password123"},
        )
        assert login.status_code == 200

    @pytest.mark.asyncio
    async def test_whitespace_only_name_rejected(self, client: AsyncClient, auth_headers):
        response = await client.post(
            "/api/v1/repositories",
            json={
                "name": "   ",
                "source_type": "github",
                "source_url": "https://github.com/octocat/hello-world",
            },
            headers=auth_headers,
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_malformed_repo_path_rejected(self, client: AsyncClient, auth_headers):
        for bad in ["..", "octocat/../../etc", "a//b", "spaces in/path", "no-slash-here"]:
            response = await client.post(
                "/api/v1/repositories/oauth",
                json={"provider": "github", "repo_path": bad},
                headers=auth_headers,
            )
            assert response.status_code == 422, bad
