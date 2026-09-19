"""Centralized credential and URL redaction utilities.

Ensures sensitive tokens, passwords, and userinfo in URLs are never exposed in
logs, tracebacks, exception messages, database records, or error responses.
"""

from __future__ import annotations

import re
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

# Query parameter names that commonly carry sensitive credentials
_SENSITIVE_QUERY_PARAMS = frozenset(
    {
        "token",
        "access_token",
        "refresh_token",
        "key",
        "api_key",
        "apikey",
        "secret",
        "client_secret",
        "password",
        "passwd",
        "pwd",
        "auth",
        "authorization",
        "code",
    }
)

# Regex to find and redact userinfo in URLs embedded inside unstructured strings
_USERINFO_URL_RE = re.compile(
    r"(?P<scheme>https?|git|ssh)://(?P<userinfo>[^/@:\s]+:[^/@\s]+)@(?P<host>[^\s/:]+)",
    re.IGNORECASE,
)

# Regex to find inline well-known secret patterns in strings
_SECRET_PATTERNS = [
    re.compile(r"\b(ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})\b"),
    re.compile(r"\b(glpat-[A-Za-z0-9_\-]{20,})\b"),
    re.compile(r"\b(sk-[A-Za-z0-9_\-]{20,})\b"),
    re.compile(r"\b(AKIA[0-9A-Z]{16})\b"),
    re.compile(r"\b(xox[baprs]-[A-Za-z0-9\-]{10,})\b"),
    re.compile(r"\b(Bearer\s+)[A-Za-z0-9_\-\.]{20,}\b", re.IGNORECASE),
]


def redact_url(url: str) -> str:
    """Redact embedded credentials and sensitive query parameters from a URL.

    - ``https://user:secret@example.com/repo.git`` -> ``https://user:[REDACTED]@example.com/repo.git``
    - ``https://token@example.com/repo.git`` -> ``https://[REDACTED]@example.com/repo.git``
    - ``https://api.example.com?access_token=xyz`` -> ``https://api.example.com?access_token=[REDACTED]``
    """
    if not url or not isinstance(url, str):
        return ""

    try:
        parsed = urlparse(url)
    except Exception:
        # If standard parsing fails, apply regex redaction on the raw string
        return _USERINFO_URL_RE.sub(r"\g<scheme>://[REDACTED]@\g<host>", url)

    netloc = parsed.netloc
    if parsed.username or parsed.password:
        if parsed.username and parsed.password:
            userinfo = f"{parsed.username}:[REDACTED]@"
        elif parsed.password:
            userinfo = ":[REDACTED]@"
        else:
            userinfo = "[REDACTED]@"

        # Host may carry port
        host_port = parsed.hostname or ""
        if parsed.port:
            host_port += f":{parsed.port}"
        netloc = f"{userinfo}{host_port}"

    # Redact sensitive query parameters
    query = parsed.query
    if query:
        try:
            pairs = parse_qsl(query, keep_blank_values=True)
            redacted_pairs = []
            for k, v in pairs:
                if k.lower() in _SENSITIVE_QUERY_PARAMS and v:
                    redacted_pairs.append((k, "[REDACTED]"))
                else:
                    redacted_pairs.append((k, v))
            query = urlencode(redacted_pairs)
        except Exception:
            pass

    return urlunparse(
        (
            parsed.scheme,
            netloc,
            parsed.path,
            parsed.params,
            query,
            parsed.fragment,
        )
    )


def redact_string(text: str) -> str:
    """Redact credentials, tokens, and URL userinfo from unstructured strings."""
    if not text:
        return text

    # Redact userinfo URLs in text
    text = _USERINFO_URL_RE.sub(r"\g<scheme>://[REDACTED]@\g<host>", text)

    # Redact known token prefixes
    for pattern in _SECRET_PATTERNS:
        text = pattern.sub(r"[REDACTED]", text)

    return text
