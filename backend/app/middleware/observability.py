"""Observability middleware: request IDs, structured access logs and metrics.

Three responsibilities, all in one pass over every request:

1. **Request ID** — honours an inbound ``X-Request-ID`` (validated, so a client
   can correlate its own trace), otherwise generates one. The ID is always
   echoed back on ``X-Request-ID`` and attached to the access log so a single
   request can be followed through the logs regardless of which side started
   the trace.

2. **Access log** — one structured JSON line per request with method, path,
   status, duration, client IP and the authenticated user id (when a bearer
   token is present).

3. **Metrics** — request counters by status, a duration histogram and an
   in-flight gauge, rendered by ``GET /metrics`` (see ``app/core/metrics.py``).

Registered *outermost* in ``create_app`` so it sees every response the stack
produces, including host-rejection 403s, rate-limit 429s and unhandled errors.
"""

from __future__ import annotations

import json
import logging
import re
import threading
import time
import uuid

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

from app.core import metrics
from app.core.security import decode_access_token

_logger = logging.getLogger("repoverix.http")

# Header-injection safe charset; anything else is ignored and regenerated.
_REQUEST_ID_RE = re.compile(r"^[A-Za-z0-9._:-]{1,128}$")

_IN_FLIGHT_LOCK = threading.Lock()
_IN_FLIGHT = 0


class ObservabilityMiddleware(BaseHTTPMiddleware):
    """Assign/echo request IDs and record an access log + metrics per request."""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        request_id = _pick_request_id(request)
        request.state.request_id = request_id

        user_id = _user_id_from_auth(request)
        started = time.perf_counter()
        _bump_in_flight(1)
        metrics.set_gauge("repoverix_http_requests_in_flight", _in_flight_value())
        try:
            try:
                response = await call_next(request)
            except Exception:
                duration_ms = (time.perf_counter() - started) * 1000
                metrics.inc("repoverix_http_requests_total", {"method": request.method, "status": "500"})
                metrics.observe_duration("repoverix_http_request_duration_seconds", duration_ms / 1000)
                _log_access(request, request_id, user_id, 500, duration_ms, error=True)
                raise
        finally:
            _bump_in_flight(-1)
            metrics.set_gauge("repoverix_http_requests_in_flight", _in_flight_value())

        duration_ms = (time.perf_counter() - started) * 1000
        status = response.status_code
        metrics.inc("repoverix_http_requests_total", {"method": request.method, "status": str(status)})
        metrics.observe_duration("repoverix_http_request_duration_seconds", duration_ms / 1000)
        _log_access(request, request_id, user_id, status, duration_ms, error=False)
        response.headers.setdefault("X-Request-ID", request_id)
        return response


def _pick_request_id(request: Request) -> str:
    incoming = request.headers.get("x-request-id", "")
    if incoming and _REQUEST_ID_RE.match(incoming):
        return incoming
    return uuid.uuid4().hex


def _user_id_from_auth(request: Request) -> str | None:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        return decode_access_token(auth[7:])
    except Exception:  # noqa: BLE001 - token inspection must never break the request
        return None


def _log_access(
    request: Request,
    request_id: str,
    user_id: str | None,
    status: int,
    duration_ms: float,
    *,
    error: bool,
) -> None:
    fields = {
        "event": "request",
        "request_id": request_id,
        "method": request.method,
        "path": request.url.path,
        "status": status,
        "duration_ms": round(duration_ms, 1),
        "ip": request.client.host if request.client else None,
    }
    if user_id is not None:
        fields["user_id"] = user_id
    line = json.dumps(fields, default=str)
    if error or status >= 500:
        _logger.error("%s", line)
    elif status >= 400:
        _logger.warning("%s", line)
    else:
        _logger.info("%s", line)


def _bump_in_flight(delta: int) -> None:
    global _IN_FLIGHT
    with _IN_FLIGHT_LOCK:
        _IN_FLIGHT = max(0, _IN_FLIGHT + delta)


def _in_flight_value() -> int:
    with _IN_FLIGHT_LOCK:
        return _IN_FLIGHT
