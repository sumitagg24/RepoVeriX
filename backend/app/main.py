"""RepoVeriX FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    auth_router,
    billing_router,
    dashboard_router,
    findings_router,
    intelligence_router,
    oauth_router,
    patches_router,
    repositories_router,
    scans_router,
)
from app.core.config import get_settings
from app.core.ratelimit import check_public_rate, check_user_rate
from app.core.security import decode_access_token
from app.db.database import init_db

_logger = logging.getLogger("repoverix.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    from app.core.logging import setup_logging

    setup_logging(settings.debug)
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

    # ---------------------------------------------------------------- errors
    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        """Never leak internals to clients.

        Full details (traceback, request path) are logged server-side; the
        client only ever receives a generic message. HTTPException and
        validation errors keep their structured FastAPI responses — this
        handler catches everything else.
        """
        _logger.exception(
            "Unhandled error on %s %s",
            request.method,
            request.url.path,
            exc_info=(type(exc), exc, exc.__traceback__),
        )
        return JSONResponse(status_code=500, content={"detail": "Internal server error"})

    # --------------------------------------------------------- rate limiting
    @app.middleware("http")
    async def rate_limit_middleware(request: Request, call_next):
        """Enforce the broad per-user / per-IP tiers.

        Auth routes additionally enforce their strict per-IP + per-account
        budgets (with exponential backoff) inside the route handlers — see
        app/core/ratelimit.py. We return a plain response here because
        HTTPException raised inside middleware would bypass FastAPI's
        exception handlers and surface as a 500.
        """
        # Re-read settings per request: the app may start with limits disabled
        # (e.g. tests) and be re-enabled later via env + cache refresh.
        current = get_settings()
        if not current.rate_limit_enabled or not request.url.path.startswith(current.api_prefix):
            return await call_next(request)

        auth = request.headers.get("authorization", "")
        user_id = None
        if auth.lower().startswith("bearer "):
            user_id = decode_access_token(auth[7:])

        if user_id is not None:
            result = check_user_rate(user_id)
        else:
            # Unauthenticated API traffic: OAuth entrypoints / auth routes.
            result = check_public_rate(request)

        if not result.allowed:
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Please slow down and try again later."},
                headers={"Retry-After": str(max(1, result.retry_after_seconds))},
            )
        return await call_next(request)

    # API routes
    app.include_router(auth_router, prefix=settings.api_prefix)
    app.include_router(oauth_router, prefix=settings.api_prefix)
    app.include_router(repositories_router, prefix=settings.api_prefix)
    app.include_router(scans_router, prefix=settings.api_prefix)
    app.include_router(findings_router, prefix=settings.api_prefix)
    app.include_router(patches_router, prefix=settings.api_prefix)
    app.include_router(billing_router, prefix=settings.api_prefix)
    app.include_router(intelligence_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok", "service": settings.app_name}

    return app


app = create_app()
