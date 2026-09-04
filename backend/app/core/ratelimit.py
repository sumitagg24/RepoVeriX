"""Configurable, in-process rate limiting.

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

State is intentionally process-local. A deployment running more than one API
worker must either pin auth traffic to a single worker or swap this module for a
shared store (Redis) behind the same three-function interface — see
``SECURITY.md``.

All thresholds come from ``app.core.config.Settings``; nothing is hardcoded in
the enforcement path.
"""

from __future__ import annotations

import math
import threading
import time
from typing import NamedTuple

from fastapi import HTTPException, Request, status

from app.core.config import get_settings


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
        """Consume one unit from ``namespace:key`` and report if it fits.

        ``backoff_base_seconds > 0`` turns refusals into escalating lockouts:
        each refusal doubles the delay (capped at ``backoff_max_seconds``) and
        subsequent requests stay refused until the lockout expires.
        """
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

            # A refusal is still in effect: escalate and keep refusing.
            if entry.blocked_until and now < entry.blocked_until:
                strikes = entry.strikes + 1
                delay = self._backoff(strikes, backoff_base_seconds, backoff_max_seconds)
                blocked_until = now + delay
                self._windows[cache_key] = _Window(entry.window_start, entry.count, blocked_until, strikes)
                return RateLimitResult(allowed=False, retry_after_seconds=math.ceil(blocked_until - now))

            if entry.blocked_until:
                # The lockout has been served: grant a fresh budget instead of
                # punishing the client forever.
                entry = _Window(now, 0, 0.0, 0)
                self._windows[cache_key] = entry

            if entry.count >= limit:
                # Budget spent: start / escalate the lockout.
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
        """Clear all state for ``namespace:key`` (called after a successful login)."""
        with self._lock:
            self._windows.pop((namespace, str(key)), None)

    def clear(self) -> None:
        """Drop every bucket (tests / config reload)."""
        with self._lock:
            self._windows.clear()


# Module-level singleton; import ``limiter`` where enforcement is needed.
limiter = RateLimiter()


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
    """Enforce a per-IP limit inside a fixed window."""
    return limiter.check(
        namespace,
        f"ip:{client_ip(request)}",
        limit=limit,
        window_seconds=window_seconds,
    )


def check_auth_attempt(request: Request, email: str) -> RateLimitResult:
    """Auth-tier check against BOTH the client IP and the account.

    Returns the *least* permissive result of the two so a shared NAT cannot
    exhaust one account's budget and a single attacker hammering many accounts
    from one IP is still throttled.
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
    """Clear the account's auth bucket after a successful sign-in/signup.

    Only the *account* bucket is reset: a shared IP must keep its budget so one
    host cannot create accounts or brute-force many accounts by alternating
    successes, and an innocent user behind a NAT is never hard-locked.
    """
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
