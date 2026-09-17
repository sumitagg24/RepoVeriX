"""Encryption at rest for third-party OAuth tokens.

Production deployments set ``REPOVERIX_TOKEN_ENCRYPTION_KEY`` (a Fernet key:
``python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"``).
When it is set, access/refresh tokens are stored encrypted (``fernet:...``)
and decrypted just-in-time at the read sites. When it is unset — local
development only — tokens are stored as before and a warning is logged once,
so a misconfigured production box is obvious in its logs.
"""

from __future__ import annotations

import logging

_logger = logging.getLogger("repoverix.http")

_PREFIX = "fernet:"
_warned = False


def _fernet(key: str):
    from cryptography.fernet import Fernet

    try:
        return Fernet(key.encode() if isinstance(key, str) else key)
    except (ValueError, TypeError) as exc:
        raise RuntimeError(
            "REPOVERIX_TOKEN_ENCRYPTION_KEY is not a valid Fernet key "
            "(generate one with cryptography.fernet.Fernet.generate_key())"
        ) from exc


def encryption_enabled() -> bool:
    """True when a Fernet key is configured (i.e. tokens are encrypted at rest)."""
    from app.core.config import get_settings

    return bool(get_settings().token_encryption_key)


def encrypt_token(value: str | None) -> str | None:
    """Encrypt ``value`` when a key is configured; otherwise store it as-is."""
    global _warned
    if not value:
        return value
    if not encryption_enabled():
        if not _warned:
            _warned = True
            _logger.warning(
                "REPOVERIX_TOKEN_ENCRYPTION_KEY is not set — OAuth tokens are being "
                "stored without at-rest encryption. Set it in production."
            )
        return value
    return _PREFIX + _fernet(_get_settings_key()).encrypt(value.encode()).decode()


def decrypt_token(value: str | None) -> str | None:
    """Decrypt a stored token; legacy plaintext rows pass through unchanged."""
    if not value:
        return value
    if not value.startswith(_PREFIX):
        return value
    if not encryption_enabled():
        # Token was encrypted under a key that is now unset — refuse to return it.
        _logger.error(
            "Encrypted token present but REPOVERIX_TOKEN_ENCRYPTION_KEY is not set; "
            "refusing to decrypt. Re-authenticate the provider."
        )
        return None

    cipher = _fernet(_get_settings_key()).decrypt(value[len(_PREFIX) :].encode())
    return cipher.decode()


def _get_settings_key() -> str:
    from app.core.config import get_settings

    key = get_settings().token_encryption_key
    if not key:
        raise RuntimeError("token encryption key is not configured")
    return key
