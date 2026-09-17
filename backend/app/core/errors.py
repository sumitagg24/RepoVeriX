"""Error-response helpers.

``auth_error`` raises an ``HTTPException`` whose detail is the *safe*
user-facing message and whose ``X-Error-Code`` header carries a stable
machine-readable code (e.g. ``EMAIL_NOT_VERIFIED``) so clients can map to
copy/behavior without the API ever exposing internals.
"""

from __future__ import annotations

from fastapi import HTTPException


def auth_error(status_code: int, message: str, code: str) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail=message,
        headers={"X-Error-Code": code},
    )


# Frequently used codes (kept beside the safe copy in app.core.auth_errors).
INVALID_CREDENTIALS = "INVALID_CREDENTIALS"
EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED"
TEMPORARILY_LOCKED = "TEMPORARILY_LOCKED"
RATE_LIMITED = "RATE_LIMITED"
SUSPENDED = "SUSPENDED"
DISPOSABLE_EMAIL = "DISPOSABLE_EMAIL"
WEAK_PASSWORD = "WEAK_PASSWORD"
INVALID_TOKEN = "INVALID_TOKEN"
OAUTH_FAILED = "OAUTH_FAILED"
