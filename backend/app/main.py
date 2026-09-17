"""RepoVeriX FastAPI application entry point."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes import (
    account_security_router,
    audit_router,
    auth_router,
    automation_router,
    billing_router,
    dashboard_router,
    feedback_router,
    findings_router,
    intelligence_router,
    learning_router,
    oauth_router,
    onboarding_router,
    organizations_router,
    patches_router,
    pr_list_router,
    pullrequests_router,
    repositories_router,
    research_router,
    scans_router,
    sharing_public_router,
    sharing_router,
    tokens_router,
    webhooks_router,
)
from app.core import metrics as metrics_registry
from app.core.config import get_settings
from app.core.ratelimit import check_public_rate, check_user_rate
from app.core.security import decode_access_token
from app.db.database import init_db
from app.middleware.observability import ObservabilityMiddleware
from app.middleware.security import SecurityHeadersMiddleware, reject_untrusted_host

_logger = logging.getLogger("repoverix.http")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    settings = get_settings()
    from app.core.logging import setup_logging

    setup_logging(settings.debug)
    if settings.auto_create_tables:
        await init_db()
    # Never leave jobs stuck in pending/running after a crash or restart.
    from app.analysis.recovery import recover_stale_jobs
    from app.db.database import SessionLocal

    try:
        await recover_stale_jobs(SessionLocal)
    except Exception:  # pragma: no cover - recovery must never block startup
        _logger.exception("startup job recovery failed; continuing")
    yield


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    # Interactive API docs expose the full internal route/schema surface.
    # Serve them only in debug mode or when explicitly enabled by the operator.
    expose_docs = settings.debug or settings.expose_api_docs

    app = FastAPI(
        title=settings.app_name,
        description="RepoVeriX: Evidence-grounded repository auditing and verified automated repair.",
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs" if expose_docs else None,
        redoc_url="/redoc" if expose_docs else None,
        openapi_url="/openapi.json" if expose_docs else None,
    )

    app.add_middleware(SecurityHeadersMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ---------------------------------------------------------------- errors
    from app.services.access import AccessDenied

    @app.exception_handler(AccessDenied)
    async def access_denied_handler(request: Request, exc: AccessDenied) -> JSONResponse:
        """Map authorization denials to safe responses.

        Role shortfalls are 403; resource non-existence/no-access is 404 so a
        denied caller cannot confirm the resource exists (IDOR guard).
        """
        if "insufficient_role" in str(exc):
            return JSONResponse(status_code=403, content={"detail": "Insufficient role for this action"})
        return JSONResponse(status_code=404, content={"detail": "Not found"})

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

    # --------------------------------------- host validation + rate limiting
    @app.middleware("http")
    async def security_middleware(request: Request, call_next):
        """Host validation + broad per-user / per-IP rate limiting.

        Runs before any route handling. Settings are re-read per request so
        configuration changes apply without a restart. Host validation is
        only meaningful on a real socket listener, but it is harmless for
        ASGI test transports and covered by tests.

        Auth routes additionally enforce their strict per-IP + per-account
        budgets (with exponential backoff) inside the route handlers — see
        app/core/ratelimit.py. We return a plain response here because
        HTTPException raised inside middleware would bypass FastAPI's
        exception handlers and surface as a 500.
        """
        untrusted = await reject_untrusted_host(request)
        if untrusted is not None:
            return untrusted

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
    app.include_router(account_security_router, prefix=settings.api_prefix)
    app.include_router(oauth_router, prefix=settings.api_prefix)
    app.include_router(onboarding_router, prefix=settings.api_prefix)
    app.include_router(repositories_router, prefix=settings.api_prefix)
    app.include_router(audit_router, prefix=settings.api_prefix)
    app.include_router(scans_router, prefix=settings.api_prefix)
    app.include_router(findings_router, prefix=settings.api_prefix)
    app.include_router(patches_router, prefix=settings.api_prefix)
    app.include_router(pullrequests_router, prefix=settings.api_prefix)
    app.include_router(pr_list_router, prefix=settings.api_prefix)
    app.include_router(billing_router, prefix=settings.api_prefix)
    app.include_router(feedback_router, prefix=settings.api_prefix)
    app.include_router(sharing_router, prefix=settings.api_prefix)
    app.include_router(sharing_public_router, prefix=settings.api_prefix)
    app.include_router(organizations_router, prefix=settings.api_prefix)
    app.include_router(tokens_router, prefix=settings.api_prefix)
    app.include_router(webhooks_router, prefix=settings.api_prefix)
    app.include_router(automation_router, prefix=settings.api_prefix)
    app.include_router(intelligence_router, prefix=settings.api_prefix)
    app.include_router(research_router, prefix=settings.api_prefix)
    app.include_router(learning_router, prefix=settings.api_prefix)
    app.include_router(dashboard_router, prefix=settings.api_prefix)

    @app.get("/health", tags=["health"])
    async def health_check():
        """Health check endpoint."""
        return {"status": "ok", "service": settings.app_name}

    @app.get("/metrics", tags=["observability"])
    async def metrics_endpoint():
        """Prometheus-format metrics for scraping (request rates, durations,
        in-flight requests, job-scheduling counters). No sensitive data is
        ever exported — labels are method/status/route-class only."""
        from fastapi.responses import PlainTextResponse

        return PlainTextResponse(
            content=metrics_registry.render_metrics(),
            media_type="text/plain; version=0.0.4; charset=utf-8",
            headers={"Cache-Control": "no-store"},
        )

    # Outermost middleware: runs for every request/response the stack produces,
    # so request IDs, the access log and metrics capture rate-limit 429s, host
    # rejections and unhandled errors as well as successful responses.
    app.add_middleware(ObservabilityMiddleware)

    return app


app = create_app()
