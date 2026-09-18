"""Pluggable email delivery for authentication mail.

Two backends, chosen by ``REPOVERIX_EMAIL_BACKEND``:

- ``console`` — writes the message to the log. Development only: the body
  contains one-time verification/reset links, so this backend must never run
  in production.
- ``smtp`` — sends via the ``REPOVERIX_SMTP_*`` settings using the standard
  library (no new dependency).

Templates are deliberately plain-text and terse; they never echo passwords or
internal details, and links are built from the configured frontend origin.
"""

from __future__ import annotations

import asyncio
import logging
import smtplib
from email.message import EmailMessage

from app.core.config import get_settings

logger = logging.getLogger("repoverix.mailer")


class MailDeliveryError(RuntimeError):
    """Raised when the configured backend cannot deliver (SMTP failures)."""


def _console_send(to: str, subject: str, body: str) -> None:
    logger.info(
        "mailer.console email=%s subject=%s body=%s",
        to,
        subject,
        body,
    )


def _smtp_send_sync(to: str, subject: str, body: str) -> None:
    settings = get_settings()
    if not settings.smtp_host:
        raise MailDeliveryError("SMTP backend selected but REPOVERIX_SMTP_HOST is not set")
    msg = EmailMessage()
    msg["From"] = settings.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as server:
        if settings.smtp_port == 587:
            server.starttls()
        if settings.smtp_username and settings.smtp_password:
            server.login(settings.smtp_username, settings.smtp_password)
        server.send_message(msg)


async def send_email(to: str, subject: str, body: str) -> None:
    """Deliver one message; SMTP runs in a worker thread (it is blocking)."""
    settings = get_settings()
    if settings.email_backend == "smtp":
        try:
            await asyncio.to_thread(_smtp_send_sync, to, subject, body)
        except MailDeliveryError:
            raise
        except Exception as exc:  # noqa: BLE001 — mapped by callers to a safe error
            logger.exception("mailer.smtp_failed")
            raise MailDeliveryError(str(exc.__class__.__name__)) from exc
        return
    _console_send(to, subject, body)


# ---------------------------------------------------------------------------
# Authentication templates
# ---------------------------------------------------------------------------


async def send_verification_email(to: str, uid: str, token: str) -> None:
    settings = get_settings()
    url = f"{settings.frontend_url.rstrip('/')}/auth/verify-email?uid={uid}&token={token}"
    await send_email(
        to,
        "Verify your RepoVeriX email",
        (
            "Welcome to RepoVeriX.\n\n"
            "Confirm this address to unlock repository connections and scans:\n"
            f"{url}\n\n"
            "The link expires in 24 hours. If you didn't create this account, you can ignore this email."
        ),
    )


async def send_password_reset_email(to: str, uid: str, token: str) -> None:
    settings = get_settings()
    url = f"{settings.frontend_url.rstrip('/')}/auth/reset-password?uid={uid}&token={token}"
    await send_email(
        to,
        "Reset your RepoVeriX password",
        (
            "A password reset was requested for this address.\n\n"
            f"Set a new password: {url}\n\n"
            "The link expires in 60 minutes and can be used once. "
            "If you didn't request this, ignore this email — your password is unchanged."
        ),
    )


# ---------------------------------------------------------------------------
# Notification templates
# ---------------------------------------------------------------------------


async def send_scan_notification(to: str, name: str, *, title: str, body: str, scan_id: str) -> None:
    settings = get_settings()
    url = f"{settings.frontend_url.rstrip('/')}/scans/{scan_id}"
    await send_email(
        to,
        f"RepoVeriX — {title}",
        (
            f"Hi {name or 'there'},\n\n"
            f"{title}\n\n"
            f"{body}\n\n"
            f"View the results: {url}\n\n"
            "— RepoVeriX"
        ),
    )


async def send_notification_digest(
    to: str,
    name: str,
    notifications: list,
    unread_count: int,
) -> None:
    """Send a daily digest email of unread notifications."""
    settings = get_settings()
    base = settings.frontend_url.rstrip("/")
    items = "\n".join(
        f"  • {n.title}" + (f"\n    {n.body}" if n.body else "")
        for n in notifications[:10]
    )
    more = f"\n  … and {unread_count - len(notifications)} more." if unread_count > len(notifications) else ""
    await send_email(
        to,
        f"RepoVeriX — {unread_count} unread notification(s)",
        (
            f"Hi {name or 'there'},\n\n"
            f"You have {unread_count} unread notification(s):\n\n"
            f"{items}{more}\n\n"
            f"View all: {base}/notifications\n\n"
            "— RepoVeriX"
        ),
    )
