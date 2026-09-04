"""RepoVeriX FastAPI application entry point."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import (
    auth_router,
    dashboard_router,
    findings_router,
    patches_router,
    repositories_router,
    scans_router,
)
from app.core.config import get_settings
from app.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    if settings.auto_create_tables:
        await init_db()
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="RepoVeriX: Evidence-grounded repository auditing and verified automated repair.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # API routes
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(repositories_router, prefix=settings.api_prefix)
    app.include_router(scans_router, prefix=settings.api_prefix)
    app.include_router(findings_router, prefix=settings.api_prefix)
    app.include_router(patches_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()