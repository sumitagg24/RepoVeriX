"""Tests for repository endpoints."""

import pytest
from httpx import AsyncClient


class TestRepositories:
    """Test repository CRUD endpoints."""

    @pytest.mark.asyncio
    async def test_create_repository(self, client: AsyncClient, auth_headers):
        """Test creating a repository."""
        response = await client.post(
            "/api/v1/repositories",
            headers=auth_headers,
            json={
                "name": "my-repo",
                "source_type": "github",
                "source_url": "https://github.com/user/my-repo",
                "default_branch": "main",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "my-repo"
        assert data["source_type"] == "github"
        assert data["source_url"] == "https://github.com/user/my-repo"
        assert data["owner_id"] is not None

    @pytest.mark.asyncio
    async def test_create_repository_zip(self, client: AsyncClient, auth_headers):
        """Test creating a ZIP repository (no URL required)."""
        response = await client.post(
            "/api/v1/repositories",
            headers=auth_headers,
            json={
                "name": "zip-repo",
                "source_type": "zip",
                "default_branch": "main",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "zip-repo"
        assert data["source_type"] == "zip"
        assert data["source_url"] is None

    @pytest.mark.asyncio
    async def test_create_repository_github_requires_url(self, client: AsyncClient, auth_headers):
        """Test GitHub repository requires source_url."""
        response = await client.post(
            "/api/v1/repositories",
            headers=auth_headers,
            json={
                "name": "github-repo",
                "source_type": "github",
                "default_branch": "main",
            },
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_list_repositories(self, client: AsyncClient, auth_headers, test_repository):
        """Test listing repositories."""
        response = await client.get("/api/v1/repositories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert any(r["id"] == str(test_repository.id) for r in data)

    @pytest.mark.asyncio
    async def test_get_repository(self, client: AsyncClient, auth_headers, test_repository):
        """Test getting a single repository."""
        response = await client.get(f"/api/v1/repositories/{test_repository.id}", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["id"] == str(test_repository.id)
        assert data["name"] == test_repository.name

    @pytest.mark.asyncio
    async def test_get_repository_not_found(self, client: AsyncClient, auth_headers):
        """Test getting nonexistent repository returns 404."""
        import uuid

        response = await client.get(f"/api/v1/repositories/{uuid.uuid4()}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_delete_repository(self, client: AsyncClient, auth_headers, test_repository):
        """Test deleting a repository."""
        response = await client.delete(f"/api/v1/repositories/{test_repository.id}", headers=auth_headers)
        assert response.status_code == 204

        # Verify it's gone
        response = await client.get(f"/api/v1/repositories/{test_repository.id}", headers=auth_headers)
        assert response.status_code == 404

    @pytest.mark.asyncio
    async def test_repository_isolation(self, client: AsyncClient, auth_headers, test_user, db_session):
        """Test users can only see their own repositories."""
        from app.core.security import hash_password
        from app.db.models import Repository, SourceType, User

        # Create another user
        other_user = User(
            email="other@example.com",
            hashed_password=hash_password("password123"),
            full_name="Other User",
            is_active=True,
        )
        db_session.add(other_user)
        await db_session.commit()
        await db_session.refresh(other_user)

        # Create repo for other user
        other_repo = Repository(
            owner_id=other_user.id,
            name="other-repo",
            source_type=SourceType.github,
            source_url="https://github.com/other/repo",
            default_branch="main",
            status="registered",
        )
        db_session.add(other_repo)
        await db_session.commit()

        # Current user should not see other user's repo
        response = await client.get("/api/v1/repositories", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert not any(r["name"] == "other-repo" for r in data)
