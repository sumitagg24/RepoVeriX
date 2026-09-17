"""Security hardening middleware.

Two layers, both plain ASGI/Starlette so they run for every response path
(including the generic error handler, middleware-thrown 403/429s and static
docs):

1. :class:`SecurityHeadersMiddleware` — injects browser-facing security headers
   on every response the application produces:

   - ``X-Content-Type-Options: nosniff`` — stops MIME sniffing of API
     responses / uploaded content.
   - ``X-Frame-Options: DENY`` — the app is not designed to be embedded; deny
     framing outright (clickjacking).
   - ``Referrer-Policy: no-referrer`` — never leak the API origin or tokens in
     the ``Referer`` of outbound requests (avatar fetches, GitHub calls).
   - ``Permissions-Policy`` — disable camera/mic/geolocation/interest-cohort
     that no RepoVeriX feature uses.
   - ``X-Permitted-Cross-Domain-Policies: none`` — Adobe/PDF cross-domain
     policy; nothing here is meant to be read cross-origin.

2. Host validation — reject requests whose ``Host`` header is not in the
   configured allowlist. This prevents DNS-rebinding and host-header
   poisoning (password-reset links, cache poisoning, ``X-Forwarded-For``
   trust games) against deployments reached through a hostname.

All behavior is driven by ``app.core.config.Settings`` (``REPOVERIX_*`` env
vars). The settings object is re-read per request so a configuration change
takes effect on the next request without a restart — the same pattern the rate
limiter uses.
"""

from __future__ import annotations

import logging

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.core.config import get_settings

_logger = logging.getLogger("repoverix.http")

# Headers applied to *every* response the app returns.
_DEFAULT_SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    # Camera / microphone / geolocation / payment / interest-cohort are unused
    # by RepoVeriX; the header prevents a future XSS from abusing them and
    # stops cross-site interest-cohort tracking of the app origin.
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()",
    "X-Permitted-Cross-Domain-Policies": "none",
}


def _host_allowed(host: str, allowed: list[str]) -> bool:
    """Return whether ``host`` (which may carry a ``:port``) is allowed.

    An empty allowlist accepts every host (used when a deployment does not
    know its public hostname yet); otherwise each entry may be a bare hostname
    (optionally with a port) and matching ignores the port of the request.
    """
    if not allowed:
        return True
    host_no_port = host.split(":", 1)[0].strip("[]")  # drop IPv6 brackets too
    for entry in allowed:
        entry_no_port = entry.split(":", 1)[0].strip("[]")
        if entry_no_port == host_no_port:
            return True
    return False


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add browser-facing security headers to every response."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)
        for name, value in _DEFAULT_SECURITY_HEADERS.items():
            response.headers.setdefault(name, value)
        return response


async def reject_untrusted_host(request: Request) -> JSONResponse | None:
    """Return a 403 response when the request Host is not allowed.

    Meant to be called from the existing per-request HTTP middleware so the
    check runs before any route handling and shares the settings-refresh
    behaviour with rate limiting. A ``None`` return means the host is fine.
    """
    settings = get_settings()
    host = request.headers.get("host", "")
    if not _host_allowed(host, settings.allowed_hosts):
        _logger.warning("rejecting request from untrusted host %r", host)
        return JSONResponse(
            status_code=403,
            content={"detail": "Request host is not allowed."},
            headers={"X-Content-Type-Options": "nosniff"},
        )
    return None
