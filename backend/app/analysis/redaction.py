"""Redact obvious secrets before repository content is sent to an LLM.

Repository content is treated as untrusted data; embedded credentials must not
leave the system. Redaction is applied to every code snippet used for prompt
construction. Values that look like secrets are replaced with ``[REDACTED]``.
"""

from __future__ import annotations

import re
from collections.abc import Callable

_PATTERNS: list[tuple[re.Pattern[str], Callable[[re.Match[str]], str]]] = [
    # name = "value"  /  name: "value"
    (
        re.compile(
            r"(?i)\b(api[_-]?key|apikey|secret|token|password|passwd|pwd|auth[_-]?token|"
            r"credential|access[_-]?key|private[_-]?key)\s*[:=]\s*(?P<quote>[\"'])(?P<val>[^\"']{4,})(?P=quote)"
        ),
        lambda m: (
            f"{m.group(0)[: m.start('val') - m.start()]}[REDACTED]{m.group(0)[m.end('val') - m.start() :]}"
        ),
    ),
    # name = unquotedvalue
    (
        re.compile(
            r"(?i)\b(api[_-]?key|secret|token|password|passwd|pwd)\s*[:=]\s*(?P<val>[A-Za-z0-9_./+=\-]{8,})"
        ),
        lambda m: f"{m.group(0)[: m.start('val') - m.start()]}[REDACTED]",
    ),
    # bare well-known prefixes
    (
        re.compile(
            r"\b(sk-[A-Za-z0-9_\-]{8,}|ghp_[A-Za-z0-9]{20,}|gho_[A-Za-z0-9]{20,}|"
            r"xox[baprs]-[A-Za-z0-9\-]{10,}|AKIA[0-9A-Z]{16}|eyJ[A-Za-z0-9_\-]{20,})"
        ),
        lambda m: "[REDACTED]",
    ),
    # private key blocks
    (
        re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----.*?-----END [A-Z ]*PRIVATE KEY-----", re.DOTALL),
        lambda m: "[REDACTED PRIVATE KEY BLOCK]",
    ),
]


def redact_text(text: str) -> tuple[str, int]:
    """Replace secret-like values with [REDACTED]; returns (text, redaction_count)."""
    count = 0
    for pattern, repl in _PATTERNS:

        def _counted(match: re.Match[str], _repl: Callable[[re.Match[str]], str] = repl) -> str:
            nonlocal count
            count += 1
            return _repl(match)

        text = pattern.sub(_counted, text)
    return text, count


def redact_line(line: str) -> tuple[str, int]:
    """Redact a single source line (used for evidence snippets going to prompts)."""
    return redact_text(line)
