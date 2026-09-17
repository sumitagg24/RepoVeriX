"""Centralized authentication error policy.

Every user-facing authentication message lives here so the API surface never
leaks whether an account exists, why a sign-in failed internally, or how the
abuse controls are tuned. Detailed diagnostics go to the structured request
log (with request id), never into HTTP responses.

Usage: use the helpers below; do not inline authentication copy in route
handlers. Adding a new failure mode means adding a code here first.
"""

from __future__ import annotations

INVALID_CREDENTIALS = "We couldn't sign you in with that email and password."
EMAIL_NOT_VERIFIED = "Please verify your email before continuing."
TEMPORARILY_LOCKED = "Too many unsuccessful attempts. Please wait before trying again."
RATE_LIMITED = "Too many attempts. Please wait and try again."
SUSPENDED = "This account is suspended. Contact support if you believe this is a mistake."
OAUTH_FAILED = "We couldn't complete sign-in with that provider. Please try again."
SYSTEM_ERROR = "Something went wrong. Please try again later."
DISPOSABLE_EMAIL = (
    "This email provider can't be used to create an account. Please use a permanent email address."
)
WEAK_PASSWORD = "That password is too weak or commonly used. Please choose a longer, unique password."
INVALID_TOKEN = "This link is invalid or has expired. Request a new one."
GENERIC_SIGNUP = "We couldn't create your account. Please try again."

# The password-reset / resend-verification responses are identical whether or
# not the account exists — the only enumeration-safe answer.
MAYBE_SENT = "If an account exists for this email, you'll receive a message with the next steps shortly."
