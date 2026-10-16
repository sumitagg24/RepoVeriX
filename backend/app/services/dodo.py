"""Dodo Payments client: checkout sessions, customer portal and webhooks.

Dodo Payments is the merchant of record for RepoVeriX subscriptions: hosted
checkout collects the payment (and handles tax), the customer portal manages
and cancels subscriptions, and webhooks drive plan state on the account.

This module is a thin ``httpx`` wrapper over the REST API plus Standard
Webhooks signature verification, so the backend needs no extra SDK
dependency. Every call is optional: without credentials the product runs in
``REPOVERIX_BILLING_DEMO_MODE`` and nothing here is invoked.
"""

from __future__ import annotations

import base64
import binascii
import hashlib
import hmac
import json
import time
from collections.abc import Mapping
from typing import Any

import httpx

from app.core.config import get_settings

_API_BASES: dict[str, str] = {
    "test_mode": "https://test.dodopayments.com",
    "live_mode": "https://live.dodopayments.com",
}

# Standard Webhooks recommends rejecting deliveries older than 5 minutes so a
# captured request cannot be replayed later.
_TIMESTAMP_TOLERANCE_SECONDS = 300


class DodoError(RuntimeError):
    """A Dodo Payments call failed (missing config, transport or API error)."""


def _api_base() -> str:
    settings = get_settings()
    return _API_BASES.get(settings.dodo_environment, _API_BASES["test_mode"])


async def _request(method: str, path: str, json_body: dict[str, Any] | None = None) -> dict[str, Any]:
    """Authenticated JSON call against the Dodo Payments API."""
    settings = get_settings()
    if not settings.dodo_api_key:
        raise DodoError("Dodo Payments API key is not configured")
    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.request(
                method,
                f"{_api_base()}{path}",
                headers={
                    "Authorization": f"Bearer {settings.dodo_api_key}",
                    "Content-Type": "application/json",
                },
                json=json_body,
            )
    except httpx.HTTPError as exc:
        raise DodoError("Dodo Payments is unreachable") from exc
    if response.status_code >= 400:
        raise DodoError(f"Dodo Payments API error (HTTP {response.status_code})")
    try:
        return response.json()
    except ValueError as exc:
        raise DodoError("Dodo Payments returned a non-JSON response") from exc


async def create_checkout_session(
    *,
    product_id: str,
    customer_email: str,
    customer_name: str | None,
    return_url: str,
    metadata: dict[str, str],
) -> dict[str, Any]:
    """Create a hosted checkout session for a subscription product.

    Returns the API object (``checkout_url`` + ``session_id``). ``metadata``
    travels with the payment and subscription events, which is how the
    webhook resolves the checkout back to the account that started it.
    """
    return await _request(
        "POST",
        "/checkouts",
        {
            "product_cart": [{"product_id": product_id, "quantity": 1}],
            "customer": {"email": customer_email, "name": customer_name or customer_email},
            "return_url": return_url,
            "metadata": metadata,
        },
    )


async def create_customer_portal_session(customer_id: str) -> str:
    """Create a time-bound hosted customer-portal session; returns its link."""
    data = await _request("POST", f"/customers/{customer_id}/customer-portal/session")
    link = data.get("link")
    if not link:
        raise DodoError("Dodo Payments returned no portal link")
    return str(link)


def _decode_secret(secret: str) -> bytes:
    """Decode a ``whsec_…`` secret (base64 body) to raw HMAC key bytes."""
    raw = secret[len("whsec_") :] if secret.startswith("whsec_") else secret
    try:
        return base64.b64decode(raw, validate=True)
    except (binascii.Error, ValueError):
        # Tolerate secrets pasted without the base64 wrapper (dev setups).
        return raw.encode()


def verify_webhook(payload: bytes, headers: Mapping[str, str]) -> dict[str, Any]:
    """Verify a Standard Webhooks signature and return the parsed event.

    Dodo signs webhooks per the Standard Webhooks spec: the signed content is
    ``{webhook-id}.{webhook-timestamp}.{raw-body}``, HMAC-SHA256 with the
    base64-decoded ``whsec_…`` secret, carried in ``webhook-signature`` as one
    or more space-separated ``v1,<base64>`` entries. Raises ``DodoError`` when
    the signature, headers or timestamp do not check out.
    """
    settings = get_settings()
    secret = settings.dodo_webhook_secret or ""
    if not secret:
        raise DodoError("Webhook secret is not configured")

    msg_id = headers.get("webhook-id", "")
    timestamp = headers.get("webhook-timestamp", "")
    signature_header = headers.get("webhook-signature", "")
    if not msg_id or not timestamp or not signature_header:
        raise DodoError("Missing webhook signature headers")

    try:
        age = abs(time.time() - int(timestamp))
    except ValueError:
        raise DodoError("Invalid webhook timestamp") from None
    if age > _TIMESTAMP_TOLERANCE_SECONDS:
        raise DodoError("Webhook timestamp outside the tolerance window")

    signed = f"{msg_id}.{timestamp}.{payload.decode('utf-8')}".encode()
    expected = hmac.new(_decode_secret(secret), signed, hashlib.sha256).digest()

    for entry in signature_header.split():
        version, _, value = entry.partition(",")
        if version != "v1":
            continue
        try:
            candidate = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError):
            continue
        if hmac.compare_digest(expected, candidate):
            try:
                return json.loads(payload)
            except ValueError as exc:
                raise DodoError("Webhook payload is not valid JSON") from exc
    raise DodoError("Invalid webhook signature")
