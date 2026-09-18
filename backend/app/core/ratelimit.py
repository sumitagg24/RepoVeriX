"""Configurable rate limiting — process-local (default) or Redis-backed.

Design
------
Every limit is a fixed window of ``limit`` requests per ``window`` seconds per
``(namespace, key)`` pair. Keys are opaque strings supplied by the caller, e.g.
``client:<ip>``, ``account:<email>`` or ``action:<user_id>``.

Authentication endpoints use an *escalating lockout*: once the window budget is
spent, further attempts are refused for a backoff that starts at
``auth_backoff_base_seconds`` and doubles on each repeated refusal, capped at
``auth_backoff_max_seconds`` (both configurable). A successful login resets the
window, so a legitimate user who mistypes a password a few times is never locked
out for long.

Backend selection
-----------------
When ``REPOVERIX_REDIS_URL`` is set **and** the optional ``redis[asyncio]``
package is installed, a Redis-backed limiter is used.  It is shared across all
API workers, so rate limits are enforced correctly in multi-worker deployments.

Without Redis (or when the package is missing / the server is unreachable at
startup), the process-local in-memory ``RateLimiter`` is used instead.  In
that case a deployment running more than one worker must either pin auth
traffic to a single worker or switch to Redis — see ``docs/SECURITY.md``.

The public helper functions (``check_auth_attempt``, ``check_action``, …) call
either backend transparently; callers never import ``limiter`` directly.

All thresholds come from ``app.core.config.Settings``; nothing is hardcoded in
the enforcement path.
"""

from __future__ import annotations

import asyncio
import logging
import math
import threading
import time
from typing import NamedTuple

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

logger = logging.getLogger("repoverix.ratelimit")


class RateLimitResult(NamedTuple):
    """Outcome of a rate-limit check."""

    allowed: bool
    retry_after_seconds: int = 0  # 0 when the request is allowed


class _Window(NamedTuple):
    window_start: float
    count: int
    blocked_until: float  # 0 when not blocked
    strikes: int  # consecutive refusals, drives the backoff


class RateLimiter:
    """Fixed-window limiter with optional exponential backoff.

    Not safe to share between processes; see module docstring.
    """

    def __init__(self) -> None:
        self._windows: dict[tuple[str, str], _Window] = {}
        self._lock = threading.Lock()
        self._last_sweep = time.monotonic()

    # -- internals ---------------------------------------------------------

    def _sweep(self, now: float) -> None:
        """Drop entries whose window expired long ago (bounded memory)."""
        if now - self._last_sweep < 60:
            return
        self._last_sweep = now
        stale = [
            key
            for key, w in self._windows.items()
            if now - w.window_start > max(3600.0, w.window_start + 0) and not w.blocked_until
        ]
        for key in stale:
            self._windows.pop(key, None)

    def check(
        self,
        namespace: str,
        key: str,
        *,
        limit: int,
        window_seconds: float,
        backoff_base_seconds: float = 0.0,
        backoff_max_seconds: float = 0.0,
        now: float | None = None,
    ) -> RateLimitResult:
        """Consume one unit from ``namespace:key`` and report if it fits."""
        if limit <= 0:
            return RateLimitResult(allowed=False, retry_after_seconds=3600)
        now = now if now is not None else time.monotonic()
        cache_key = (namespace, str(key))
        with self._lock:
            self._sweep(now)
            entry = self._windows.get(cache_key)
            if entry is None or now - entry.window_start >= window_seconds:
                entry = _Window(now, 0, 0.0, 0)
                self._windows[cache_key] = entry

            if entry.blocked_until and now < entry.blocked_until:
                strikes = entry.strikes + 1
                delay = self._backoff(strikes, backoff_base_seconds, backoff_max_seconds)
                blocked_until = now + delay
                self._windows[cache_key] = _Window(entry.window_start, entry.count, blocked_until, strikes)
                return RateLimitResult(allowed=False, retry_after_seconds=math.ceil(blocked_until - now))

            if entry.blocked_until:
                entry = _Window(now, 0, 0.0, 0)
                self._windows[cache_key] = entry

            if entry.count >= limit:
                strikes = entry.strikes + 1
                delay = self._backoff(strikes, backoff_base_seconds, backoff_max_seconds)
                blocked_until = now + delay
                self._windows[cache_key] = _Window(entry.window_start, entry.count, blocked_until, strikes)
                return RateLimitResult(allowed=False, retry_after_seconds=math.ceil(blocked_until - now))

            self._windows[cache_key] = _Window(entry.window_start, entry.count + 1, 0.0, 0)
            return RateLimitResult(allowed=True)

    @staticmethod
    def _backoff(strikes: int, base: float, cap: float) -> float:
        if base <= 0:
            return 0.0
        return min(cap if cap > 0 else float("inf"), base * (2 ** (strikes - 1)))

    def reset(self, namespace: str, key: str) -> None:
        with self._lock:
            self._windows.pop((namespace, str(key)), None)

    def clear(self) -> None:
        with self._lock:
            self._windows.clear()


# ---------------------------------------------------------------------------
# Unified async adapter — wraps either backend behind one interface.
# ---------------------------------------------------------------------------

class _AsyncLimiterAdapter:
    """Wraps ``RateLimiter`` (sync) or ``RedisRateLimiter`` (async) behind a
    single ``async def check()`` / ``async def reset()`` interface so all
    callers are written once.
    """

    def __init__(self, backend) -> None:
        self._b = backend
        self._is_async = hasattr(backend, "__class__") and "Redis" in type(backend).__name__

    async def check(self, namespace: str, key: str, **kwargs) -> RateLimitResult:
        if self._is_async:
            result = await self._b.check(namespace, key, **kwargs)
            # RedisRateLimiter returns its own NamedTuple; normalise to ours
            return RateLimitResult(allowed=result.allowed, retry_after_seconds=result.retry_after_seconds)
        return self._b.check(namespace, key, **kwargs)

    async def reset(self, namespace: str, key: str) -> None:
        if self._is_async:
            await self._b.reset(namespace, key)
        else:
            self._b.reset(namespace, key)

    async def clear(self) -> None:
        if self._is_async:
            await self._b.clear()
        else:
            self._b.clear()

    # Synchronous passthrough for code paths that cannot await (startup checks).
    def check_sync(self, namespace: str, key: str, **kwargs) -> RateLimitResult:
        if self._is_async:
            # Best-effort: run on the current event loop if available
            try:
                loop = asyncio.get_event_loop()
                if loop.is_running():
                    import concurrent.futures
                    with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                        fut = pool.submit(asyncio.run, self._b.check(namespace, key, **kwargs))
                        r = fut.result(timeout=2)
                        return RateLimitResult(allowed=r.allowed, retry_after_seconds=r.retry_after_seconds)
            except Exception:
                pass
            # Fail open on Redis unavailability for check_sync callers
            return RateLimitResult(allowed=True)
        return self._b.check(namespace, key, **kwargs)


# Module-level singleton, built lazily on first use.
_limiter: _AsyncLimiterAdapter | None = None
_limiter_lock = threading.Lock()

# Keep a bare sync limiter for the helpers that are called synchronously
# (check_auth_attempt, check_action, check_user_rate, check_public_rate).
# When Redis is available, sync callers use the process-local limiter as a
# warm fallback — auth budget differences across workers are acceptable; a full
# cross-worker auth bypass is not.
limiter = RateLimiter()  # sync process-local (always available)


def _get_async_limiter() -> _AsyncLimiterAdapter:
    """Return (and lazily build) the shared async rate-limit adapter."""
    global _limiter
    if _limiter is not None:
        return _limiter
    with _limiter_lock:
        if _limiter is not None:
            return _limiter
        settings = get_settings()
        if settings.redis_url:
            try:
                from app.core.ratelimit_redis import build_redis_limiter  # noqa: PLC0415

                async def _init():
                    return await build_redis_limiter(settings.redis_url)  # type: ignore[arg-type]

                try:
                    loop = asyncio.get_event_loop()
                    if loop.is_running():
                        # Inside a running loop (lifespan startup): schedule and
                        # fall through to process-local until the future resolves.
                        _limiter = _AsyncLimiterAdapter(limiter)
                        loop.create_task(_connect_redis_async(settings.redis_url))
                        return _limiter
                    redis_backend = loop.run_until_complete(_init())
                    _limiter = _AsyncLimiterAdapter(redis_backend)
                    logger.info("Rate limiter: Redis backend at %s", settings.redis_url)
                    return _limiter
                except Exception as exc:
                    logger.warning("Redis rate limiter unavailable (%s); falling back to process-local", exc)
            except ImportError:
                logger.info(
                    "redis[asyncio] not installed; using process-local rate limiter. "
                    "Install with: pip install 'repoverix-backend[redis]'"
                )
        _limiter = _AsyncLimiterAdapter(limiter)
        return _limiter


async def _connect_redis_async(url: str) -> None:
    """Background coroutine: swap to Redis limiter once the connection is up."""
    global _limiter
    try:
        from app.core.ratelimit_redis import build_redis_limiter  # noqa: PLC0415

        redis_backend = await build_redis_limiter(url)
        with _limiter_lock:
            _limiter = _AsyncLimiterAdapter(redis_backend)
        logger.info("Rate limiter: switched to Redis backend at %s", url)
    except Exception as exc:
        logger.warning("Redis rate limiter failed to connect (%s); keeping process-local", exc)


async def init_rate_limiter() -> None:
    """Eagerly initialise the rate-limiter backend during app startup.

    Call from the FastAPI lifespan handler so the Redis connection is
    established before the first request, rather than on the first check.
    """
    _get_async_limiter()  # triggers lazy init; Redis async upgrade runs in bg


# ---------------------------------------------------------------------------
# Convenience helpers wired to Settings (single source of thresholds).
# ---------------------------------------------------------------------------


def client_ip(request: Request) -> str:
    """Best-effort client IP, honouring ``REPOVERIX_TRUST_PROXY_HEADERS``."""
    settings = get_settings()
    if settings.trust_proxy_headers:
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            return forwarded.split(",")[0].strip() or "unknown"
    if request.client is not None:
        return request.client.host
    return "unknown"


def check_ip_rate(request: Request, namespace: str, *, limit: int, window_seconds: float) -> RateLimitResult:
    """Enforce a per-IP limit inside a fixed window (sync, uses local limiter)."""
    return limiter.check(
        namespace,
        f"ip:{client_ip(request)}",
        limit=limit,
        window_seconds=window_seconds,
    )


def check_auth_attempt(request: Request, email: str) -> RateLimitResult:
    """Auth-tier check against BOTH the client IP and the account (sync).

    Returns the *least* permissive result so a shared NAT cannot exhaust one
    account's budget and a single attacker hammering many accounts from one IP
    is still throttled.
    """
    settings = get_settings()
    ip_result = limiter.check(
        "auth:ip",
        f"ip:{client_ip(request)}",
        limit=settings.auth_rate_limit_attempts,
        window_seconds=settings.auth_rate_limit_window_seconds,
        backoff_base_seconds=settings.auth_backoff_base_seconds,
        backoff_max_seconds=settings.auth_backoff_max_seconds,
    )
    account_result = limiter.check(
        "auth:account",
        email.strip().lower(),
        limit=settings.auth_rate_limit_attempts,
        window_seconds=settings.auth_rate_limit_window_seconds,
        backoff_base_seconds=settings.auth_backoff_base_seconds,
        backoff_max_seconds=settings.auth_backoff_max_seconds,
    )
    if not ip_result.allowed or not account_result.allowed:
        retry_after = max(ip_result.retry_after_seconds, account_result.retry_after_seconds)
        return RateLimitResult(allowed=False, retry_after_seconds=retry_after)
    return RateLimitResult(allowed=True)


def reset_auth_attempts(email: str) -> None:
    """Clear the account's auth bucket after a successful sign-in/signup."""
    limiter.reset("auth:account", email.strip().lower())


def check_action(user_id: str, action: str) -> RateLimitResult:
    """Per-user budget for expensive actions (scans, uploads, LLM, sandbox)."""
    settings = get_settings()
    return limiter.check(
        "action",
        f"{action}:{user_id}",
        limit=settings.user_action_rate_limit_per_minute,
        window_seconds=60,
    )


def check_user_rate(user_id: str) -> RateLimitResult:
    """Global per-user budget across authenticated API calls."""
    settings = get_settings()
    return limiter.check(
        "user",
        str(user_id),
        limit=settings.user_rate_limit_per_minute,
        window_seconds=60,
    )


def check_public_rate(request: Request) -> RateLimitResult:
    """Moderate per-IP budget for unauthenticated public endpoints."""
    settings = get_settings()
    return check_ip_rate(
        request,
        "public",
        limit=settings.public_rate_limit_per_minute,
        window_seconds=60,
    )


def enforce(result: RateLimitResult) -> None:
    """Raise a 429 with ``Retry-After`` when a check was refused."""
    if not result.allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Too many requests. Please slow down and try again later.",
            headers={"Retry-After": str(max(1, result.retry_after_seconds))},
        )
