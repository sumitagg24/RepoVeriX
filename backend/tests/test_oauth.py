"""Tests for OAuth plumbing (Google/GitHub/GitLab) and repository imports.

Network calls are replaced with ``httpx.MockTransport`` handlers; the route
tests exercise the ASGI app through the conftest ``client`` fixture.
"""

import httpx

from app.core.config import Settings
from app.db.models import OAuthAccount, Repository
from app.services import oauth as oauth_service

# --------------------------------------------------------------------------- service


def test_configured_providers_reflect_credentials():
    settings = Settings(google_oauth_client_id="gid", google_oauth_client_secret="gsec")
    providers = oauth_service.configured_providers(settings)
    assert providers["google"]["configured"] is True
    assert providers["github"]["configured"] is False
    assert providers["gitlab"]["supports_repo_import"] is True


def test_build_authorize_url_contains_provider_params():
    settings = Settings(github_oauth_client_id="gh-id", github_oauth_client_secret="gh-sec")
    url = oauth_service.build_authorize_url(
        "github", "st-123", "http://test/api/v1/auth/oauth/github/callback", settings
    )
    assert "https://github.com/login/oauth/authorize" in url
    assert "client_id=gh-id" in url
    assert "redirect_uri=http%3A%2F%2Ftest%2Fapi%2Fv1%2Fauth%2Foauth%2Fgithub%2Fcallback" in url
    assert "state=st-123" in url


def _mock_transport(handler):
    return httpx.MockTransport(handler)


async def test_exchange_code_and_profile_and_repos():
    token_body = {"access_token": "tok123", "scope": "repo", "token_type": "bearer"}
    user_body = {"id": 42, "login": "octocat", "name": "The Octocat", "email": "octo@example.com"}
    repo_body = [
        {
            "id": 7,
            "name": "hello",
            "full_name": "octocat/hello",
            "description": "demo",
            "html_url": "https://github.com/octocat/hello",
            "default_branch": "main",
            "private": True,
        }
    ]

    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/login/oauth/access_token":
            return httpx.Response(200, json=token_body)
        if request.url.path == "/user":
            return httpx.Response(200, json=user_body)
        if request.url.path == "/user/repos":
            return httpx.Response(200, json=repo_body)
        return httpx.Response(404)

    transport = _mock_transport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        token_data = await oauth_service.exchange_code("github", "code-1", "http://test/cb", client=client)
        assert token_data["access_token"] == "tok123"
        profile = await oauth_service.fetch_profile("github", "tok123", client=client)
        assert profile == {"id": "42", "email": "octo@example.com", "name": "The Octocat"}
        repos = await oauth_service.list_repositories("github", "tok123", client=client)
        assert repos[0]["full_name"] == "octocat/hello"
        assert repos[0]["private"] is True


async def test_github_profile_falls_back_to_emails_endpoint():
    async def handler(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/user":
            return httpx.Response(200, json={"id": 1, "login": "ghost"})
        if request.url.path == "/user/emails":
            return httpx.Response(
                200,
                json=[
                    {"email": "noreply@example.com", "primary": False, "verified": True},
                    {"email": "main@example.com", "primary": True, "verified": True},
                ],
            )
        return httpx.Response(404)

    async with httpx.AsyncClient(transport=_mock_transport(handler)) as client:
        profile = await oauth_service.fetch_profile("github", "tok", client=client)
        assert profile["email"] == "main@example.com"
        assert profile["name"] == "ghost"


async def test_gitlab_repos_mapping():
    async def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json=[
                {
                    "id": 9,
                    "name": "proj",
                    "path_with_namespace": "acme/tools/proj",
                    "web_url": "https://gitlab.com/acme/tools/proj",
                    "default_branch": "main",
                    "visibility": "private",
                }
            ],
        )

    async with httpx.AsyncClient(transport=_mock_transport(handler)) as client:
        repos = await oauth_service.list_repositories("gitlab", "tok", client=client)
    assert repos[0]["full_name"] == "acme/tools/proj"
    assert repos[0]["private"] is True


# --------------------------------------------------------------------------- routes


async def test_providers_endpoint(client):
    resp = await client.get("/api/v1/auth/oauth/providers")
    assert resp.status_code == 200
    body = resp.json()
    assert set(body) == {
        "google",
        "github",
        "gitlab",
        "microsoft",
        "bitbucket",
        "auth0",
        "oracle",
    }
    assert all("configured" in info for info in body.values())


async def test_login_unconfigured_provider_returns_503(client):
    resp = await client.get("/api/v1/auth/oauth/google/login")
    assert resp.status_code == 503


async def test_oauth_repos_requires_connection(client, auth_headers):
    resp = await client.get("/api/v1/auth/oauth/github/repos", headers=auth_headers)
    assert resp.status_code == 404


async def test_import_via_oauth_requires_connection(client, auth_headers):
    resp = await client.post(
        "/api/v1/repositories/oauth",
        json={"provider": "github", "repo_path": "octocat/hello"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


async def test_import_via_oauth_creates_repository(client, db_session, test_user, auth_headers):
    account = OAuthAccount(
        user_id=test_user.id,
        provider="github",
        provider_user_id="42",
        provider_email="octo@example.com",
        access_token="secret-token",
    )
    db_session.add(account)
    await db_session.commit()
    await db_session.refresh(account)

    resp = await client.post(
        "/api/v1/repositories/oauth",
        json={"provider": "github", "repo_path": "octocat/hello"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["source_type"] == "github"
    assert body["name"] == "hello"
    assert body["source_url"] == "https://github.com/octocat/hello"
    assert "secret-token" not in str(body)

    from sqlalchemy import select

    result = await db_session.execute(select(Repository).where(Repository.owner_id == test_user.id))
    repo = result.scalars().first()
    assert repo.oauth_account_id == account.id


async def test_import_gitlab_namespaced(client, db_session, test_user, auth_headers):
    account = OAuthAccount(
        user_id=test_user.id,
        provider="gitlab",
        provider_user_id="9",
        access_token="gl-token",
    )
    db_session.add(account)
    await db_session.commit()

    resp = await client.post(
        "/api/v1/repositories/oauth",
        json={"provider": "gitlab", "repo_path": "acme/tools/proj.git"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["source_url"] == "https://gitlab.com/acme/tools/proj"


async def test_import_archive_url(client, auth_headers):
    resp = await client.post(
        "/api/v1/repositories/archive",
        json={
            "url": "https://bucket.s3.amazonaws.com/demo-app.zip",
            "name": "s3-demo",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["source_type"] == "archive"
    assert body["source_url"] == "https://bucket.s3.amazonaws.com/demo-app.zip"


async def test_import_generic_git_url(client, auth_headers):
    resp = await client.post(
        "/api/v1/repositories",
        json={
            "name": "bitbucket-mirror",
            "source_type": "git",
            "source_url": "https://bitbucket.org/acme/widgets",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["source_type"] == "git"


async def test_disconnect_oauth(client, db_session, test_user, auth_headers):
    account = OAuthAccount(
        user_id=test_user.id,
        provider="github",
        provider_user_id="42",
        access_token="t",
    )
    db_session.add(account)
    await db_session.commit()
    resp = await client.delete("/api/v1/auth/oauth/github", headers=auth_headers)
    assert resp.status_code == 200
    resp = await client.get("/api/v1/auth/oauth/github/repos", headers=auth_headers)
    assert resp.status_code == 404


async def test_connections_lists_connected_providers(client, db_session, test_user, auth_headers):
    db_session.add(
        OAuthAccount(
            user_id=test_user.id,
            provider="github",
            provider_user_id="42",
            provider_email="octo@example.com",
            access_token="t",
        )
    )
    await db_session.commit()
    resp = await client.get("/api/v1/auth/oauth/connections", headers=auth_headers)
    assert resp.status_code == 200
    assert [c["provider"] for c in resp.json()] == ["github"]
    assert resp.json()[0]["provider_email"] == "octo@example.com"
