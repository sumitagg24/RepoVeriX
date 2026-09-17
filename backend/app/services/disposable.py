"""Disposable / temporary email policy (server-side).

Signup rejects disposable addresses BEFORE an account is created. The
decision is never delegated to the frontend.

Design
------
- Dataset: ``app/data/disposable_domains.json`` — a maintained list, not
  hardcoded logic. Administrators can extend it at runtime via
  ``REPOVERIX_AUTH_EXTRA_BLOCKED_EMAIL_DOMAINS`` (comma-separated) without a
  code change; a future admin UI can persist to the same loader.
- Matching is exact on the full domain AND on the registrable domain
  (``mail.mailinator.com`` → ``mailinator.com``), case-insensitive, and
  IDN-aware: unicode domains are converted to punycode before comparison so
  homograph variants of blocked domains match.
- The list can never be complete — it is a policy input, not a guarantee.
  Legitimate-but-unfamiliar providers are NOT blocked (no allowlist policy;
  gmail.com, outlook.com, proton.me etc. all pass).
"""

from __future__ import annotations

import json
import logging
from functools import lru_cache
from pathlib import Path

from app.core.config import get_settings

logger = logging.getLogger("repoverix.disposable")

_DATASET = Path(__file__).resolve().parent.parent / "data" / "disposable_domains.json"

# Second-level labels where the registrable domain is three labels deep.
_MULTI_PART_SUFFIXES = ("co.uk", "org.uk", "ac.uk", "gov.uk", "com.au", "co.jp", "com.br")


@lru_cache(maxsize=1)
def _dataset_domains() -> frozenset[str]:
    try:
        data = json.loads(_DATASET.read_text(encoding="utf-8"))
        return frozenset(str(d).strip().lower() for d in data.get("domains", []))
    except FileNotFoundError:
        logger.error("disposable.dataset_missing path=%s", _DATASET)
        return frozenset()


def _registrable_domain(domain: str) -> str:
    labels = domain.split(".")
    if len(labels) >= 3 and ".".join(labels[-2:]) in _MULTI_PART_SUFFIXES:
        return ".".join(labels[-3:])
    if len(labels) >= 2:
        return ".".join(labels[-2:])
    return domain


def normalize_domain(domain: str) -> str:
    """Lowercase + IDN→punycode a domain; invalid encodings pass through."""
    domain = domain.strip().rstrip(".").lower()
    try:
        return domain.encode("idna").decode("ascii").lower()
    except UnicodeError:
        return domain


def extract_domain(email: str) -> str:
    """The punycode-normalized domain of an email address, or ``''``."""
    _, _, domain = email.strip().rpartition("@")
    return normalize_domain(domain)


def blocked_domains() -> frozenset[str]:
    """Dataset + runtime administrator additions, all normalized."""
    settings = get_settings()
    extra = {normalize_domain(d) for d in settings.auth_extra_blocked_email_domains}
    return _dataset_domains() | frozenset(extra)


def is_disposable(email: str) -> bool:
    """True when the address's domain is a known disposable provider."""
    if not email or "@" not in email:
        return False
    domain = extract_domain(email)
    if not domain:
        return False
    blocked = blocked_domains()
    if domain in blocked:
        return True
    return _registrable_domain(domain) in blocked
