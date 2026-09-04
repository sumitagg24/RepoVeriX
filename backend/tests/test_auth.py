"""Tests for authentication endpoints."""

import pytest
from httpx import AsyncClient


class TestAuth:
    """Test authentication endpoints."""

    @pytest.mark.asyncio
    async def test_signup(self, client: AsyncClient):
        """Test user signup."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": "newuser@example.com",
                "password": "password123",
                "full_name": "New User",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_signup_duplicate_email(self, client: AsyncClient, test_user):
        """Test signup with duplicate email fails."""
        response = await client.post(
            "/api/v1/auth/signup",
            json={
                "email": test_user.email,
                "password": "password123",
                "full_name": "Another User",
            },
        )
        assert response.status_code == 409

    @pytest.mark.asyncio
    async def test_login(self, client: AsyncClient, test_user):
        """Test user login."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "password123",
            },
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    @pytest.mark.asyncio
    async def test_login_invalid_password(self, client: AsyncClient, test_user):
        """Test login with invalid password fails."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": test_user.email,
                "password": "wrongpassword",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_login_nonexistent_user(self, client: AsyncClient):
        """Test login with nonexistent user fails."""
        response = await client.post(
            "/api/v1/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "password123",
            },
        )
        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_current_user(self, client: AsyncClient, auth_headers):
        """Test getting current user."""
        response = await client.get("/api/v1/auth/me", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["email"] == "test@example.com"
        assert data["full_name"] == "Test User"

    @pytest.mark.asyncio
    async def test_get_current_user_unauthorized(self, client: AsyncClient):
        """Test getting current user without auth fails."""
        response = await client.get("/api/v1/auth/me")
        assert response.status_code == 401
