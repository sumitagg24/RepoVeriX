"""Password policy: prefer length and breached-password resistance over
arbitrary complexity rules.

Checks applied at signup and password change/reset (server-side, always):

1. Minimum length (pydantic enforces >= 8; we require the same here so
   non-pydantic callers cannot bypass it).
2. A bundled blocklist of the most common leaked passwords — instant rejects,
   no network call.
3. Optional Have-I-Been-Pwned k-anonymity screening (``REPOVERIX_
   PASSWORD_BREACH_CHECK=true``): only the **5-character SHA-1 prefix** of the
   password is ever sent, never the password itself; the rest is matched
   locally against the returned range. Failure of the third-party service is
   fail-open (availability must not brick signups) and logged.

No plaintext password is ever stored or logged by this module.
"""

from __future__ import annotations

import hashlib
import logging
from dataclasses import dataclass

import httpx

logger = logging.getLogger("repoverix.passwords")

MIN_LENGTH = 8
_HIBP_RANGE_URL = "https://api.pwnedpasswords.com/range/{prefix}"
_HIBP_TIMEOUT = 5.0

# Small, high-signal excerpt of the most common leaked passwords (top of the
# HaveIBeenPwned corpus). Kept deliberately short: the real breadth comes from
# the optional HIBP check, not from bundling millions of entries.
_COMMON = frozenset(
    """
    password password1 password123 123456 12345678 123456789 1234567890
    qwerty qwerty123 abc123 abc123456 letmein welcome welcome1 admin
    admin123 login passw0rd password! iloveyou monkey dragon football
    baseball master sunshine princess superman batman trustno1 hello123
    freedom whatever qazwsx 654321 555555 111111 000000 121212 123123
    123321 1234 12345 1234567 654321a google facebook github gitlab
    repoverix password12 password1234 changeme secret summer winter
    iloveu1 zaq12wsx 1q2w3e4r 1qaz2wsx qwertyuiop asdfghjkl zxcvbnm
    """.split()
)


@dataclass(frozen=True)
class PasswordVerdict:
    ok: bool
    reason: str | None = None  # internal code, never shown verbatim


def check_password(password: str, *, hibp_enabled: bool | None = None) -> PasswordVerdict:
    """Full policy check. Reasons are internal codes, mapped to safe copy by
    ``app.core.auth_errors``."""
    if not password or len(password) < MIN_LENGTH:
        return PasswordVerdict(False, "too_short")
    if password.lower() in _COMMON or password in _COMMON:
        return PasswordVerdict(False, "common")
    if hibp_enabled is None:
        from app.core.config import get_settings

        hibp_enabled = get_settings().password_breach_check
    if hibp_enabled and _is_breached(password):
        return PasswordVerdict(False, "breached")
    return PasswordVerdict(True)


def _is_breached(password: str) -> bool:
    """HIBP k-anonymity range check — sends only the SHA-1 prefix."""
    try:
        sha1 = hashlib.sha1(password.encode("utf-8")).hexdigest().upper()  # noqa: S324 — HIBP API contract
        prefix, suffix = sha1[:5], sha1[5:]
        response = httpx.get(_HIBP_RANGE_URL.format(prefix=prefix), timeout=_HIBP_TIMEOUT)
        response.raise_for_status()
        for line in response.text.splitlines():
            parts = line.strip().split(":", 1)
            if len(parts) == 2 and parts[0] == suffix:
                return True
        return False
    except Exception:  # noqa: BLE001 — fail open, availability over strictness
        logger.warning("passwords.hibp_unavailable — skipping breach check")
        return False
