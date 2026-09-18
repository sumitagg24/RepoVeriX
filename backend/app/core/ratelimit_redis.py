"""Redis-backed rate limiter — same three-function interface as ratelimit.py.

Drop-in replacement for the process-local ``RateLimiter`` when
``REPOVERIX_REDIS_URL`` is set.  Uses a single-key Lua script for atomic
fixed-window counting so there are no race conditions across workers.

The module is **optional**: if the ``redis`` package is not installed or the
Redis connection fails at startup, the caller catches the import/connection
error and falls back to the in-process limiter automatically.

Usage pattern (already wired in ratelimit.py):

    limiter = _build_limiter()   # returns RedisRateLimiter or RateLimiter

The Lua script logic:

    local key   = KEYS[1]
    local limit = tonumber(ARGV[1])
    local ttl   = tonumber(ARGV[2])   -- window in seconds

    local count = redis.call('INCR', key)
    if count == 1 then
        redis.call('EXPIRE', key, ttl)
    end
    return count

A count ≤ limit → allowed.  The key automatically expires after one window,
so the bucket resets without a background sweep.
"""

from __future__ import annotations

import math
import time
from typing import NamedTuple

_LUA_INCR = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[2])
end
return count
"""

_LUA_RESET = "return redis.call('DEL', KEYS[1])"


class RateLimitResult(NamedTuple):
    allowed: bool
    retry_after_seconds: int = 0


class RedisRateLimiter:
    """Fixed-window rate limiter backed by Redis.

    Exponential backoff is implemented as a separate blocked-until key so the
    "are you locked out?" check is one Redis GET, not a round-trip per
    request.
    """

    def __init__(self, client) -> None:  # client: redis.asyncio.Redis
        self._r = client
        self._incr_script = client.register_script(_LUA_INCR)
        self._reset_script = client.register_script(_LUA_RESET)

    # ------------------------------------------------------------------ check

    async def check(
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
        if limit <= 0:
            return RateLimitResult(allowed=False, retry_after_seconds=3600)

        now = now if now is not None else time.monotonic()
        rkey = f"rl:{namespace}:{key}"
        block_key = f"rl:blocked:{namespace}:{key}"

        # Check active lockout first (one GET)
        blocked_ttl = await self._r.pttl(block_key)
        if blocked_ttl > 0:
            # Still locked; escalate
            if backoff_base_seconds > 0:
                await self._r.set(block_key, 1, px=int(blocked_ttl * 2))
            retry = math.ceil(blocked_ttl / 1000)
            return RateLimitResult(allowed=False, retry_after_seconds=max(1, retry))

        count = await self._incr_script(
            keys=[rkey],
            args=[limit, max(1, int(window_seconds))],
        )
        if int(count) > limit:
            # Budget spent — set lockout
            if backoff_base_seconds > 0:
                delay_ms = int(min(
                    backoff_max_seconds if backoff_max_seconds > 0 else 3600,
                    backoff_base_seconds,
                ) * 1000)
                await self._r.set(block_key, 1, px=delay_ms, nx=True)
                retry = math.ceil(delay_ms / 1000)
            else:
                retry = max(1, int(window_seconds))
            return RateLimitResult(allowed=False, retry_after_seconds=retry)

        return RateLimitResult(allowed=True)

    async def reset(self, namespace: str, key: str) -> None:
        """Clear the counter and any lockout for ``namespace:key``."""
        rkey = f"rl:{namespace}:{key}"
        block_key = f"rl:blocked:{namespace}:{key}"
        await self._reset_script(keys=[rkey])
        await self._reset_script(keys=[block_key])

    async def clear(self) -> None:
        """Flush all rate-limit keys (tests / config reload).

        Uses SCAN so it is safe on production clusters (never blocks).
        """
        cursor = 0
        while True:
            cursor, keys = await self._r.scan(cursor, match="rl:*", count=200)
            if keys:
                await self._r.delete(*keys)
            if cursor == 0:
                break


async def build_redis_limiter(url: str) -> RedisRateLimiter:
    """Connect to Redis and return a ``RedisRateLimiter``.

    Raises ``ImportError`` when ``redis[asyncio]`` is not installed, and
    ``redis.exceptions.ConnectionError`` when the server is unreachable so the
    caller can fall back to the process-local limiter.
    """
    import redis.asyncio as aioredis  # noqa: PLC0415 - optional dep

    client = aioredis.from_url(url, decode_responses=False, socket_connect_timeout=2)
    await client.ping()  # fail fast if unreachable
    return RedisRateLimiter(client)
