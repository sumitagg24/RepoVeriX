"""Counterexample validation (proof-of-absence).

A finding claims ``source -> ... -> sink``. If the value flowing into the sink
passes through a *sanitizer* (parameterization, escaping, type coercion,
validation), the claim may not hold — the deterministic counterexample check
below inspects the function body for sanitizer calls applied to the sink's
arguments and, when found, returns a concrete proof (sanitizer, line, snippet)
that the issue cannot manifest on that path.

This is the "negative evidence" side of the evidence engine: positive chains
verify a finding, counterexamples refute it.
"""

from __future__ import annotations

import re

from app.analysis.models import ParsedFile

_SANITIZER_RE = re.compile(
    r"^(escape|html\.escape|html_escape|cgi\.escape|quote|quote_plus|quote_from_bytes|urlencode"
    r"|parameterize|sanitize|sanitise|validate|bleach\.clean|bleach_clean|clean|int|float|uuid4"
    r"|uuid\.uuid4|hashlib\.\w+|secrets\.\w+|mako\.escape|jinja2\.escape|markupsafe\.escape|html$)",
    re.IGNORECASE,
)

# Evidence kinds we walk as "the chain" for source/sink roles.
_SOURCE_KINDS = {"source_input", "transformation", "call_relationship"}
_SINK_KINDS = {"sink", "static_analysis"}


def validate_counterexample(
    pf: ParsedFile,
    source_lines: list[int],
    sink_lines: list[int],
    *,
    extra_terms: list[str] | None = None,
) -> dict | None:
    """Return a counterexample proof if the sink's data passes a sanitizer.

    ``source_lines`` / ``sink_lines`` are line numbers (1-based) from the
    finding's evidence nodes. Walks the function body between the first source
    line and the sink line, collects identifiers produced by sanitizer calls,
    and checks whether the sink's argument expression references any of them.

    Returns ``None`` when no sanitizer guards the path (i.e. the claim stands).
    """
    if not sink_lines:
        return None
    sink_line = min(sink_lines)
    start = min(source_lines or [max(1, sink_line - 10)])
    lines = pf.source.splitlines()
    if not lines:
        return None
    lo = max(0, start - 1)
    hi = min(len(lines), sink_line)

    sanitized: dict[str, int] = {}  # identifier -> line where it was sanitized
    sanitizer_calls: list[dict] = []
    _ASSIGN_RE = re.compile(r"^\s*([A-Za-z_]\w*)\s*=\s*(.+)$")
    for i in range(lo, hi):
        line = lines[i]
        call = _first_call(line)
        if call is not None:
            callee, args = call
            if _SANITIZER_RE.match(callee) and args:
                target = args[0]
                if re.fullmatch(r"[A-Za-z_]\w*", target):
                    sanitized[target] = i + 1
                    sanitizer_calls.append({"function": callee, "line": i + 1, "snippet": line.strip()[:160]})
        # propagate: x = ...uses a sanitized identifier...  =>  x is sanitized
        assign = _ASSIGN_RE.match(line)
        if assign is not None and sanitized:
            lhs, rhs = assign.group(1), assign.group(2)
            for identifier, sanitize_line in sanitized.items():
                if re.search(rf"\b{re.escape(identifier)}\b", rhs):
                    sanitized[lhs] = sanitize_line
                    break

    if not sanitized:
        return None

    sink_text = "\n".join(lines[min(sink_line, len(lines)) - 1 : min(sink_line + 3, len(lines))])
    for identifier, sanitize_line in sanitized.items():
        if re.search(rf"\b{re.escape(identifier)}\b", sink_text):
            # the sanitized value reaches the sink
            call = _first_call(lines[sink_line - 1]) if sink_line - 1 < len(lines) else None
            return {
                "found": True,
                "sanitizer": sanitizer_calls[-1]["function"],
                "sanitizer_line": sanitize_line,
                "sanitizer_snippet": sanitizer_calls[-1]["snippet"],
                "sink_line": sink_line,
                "sink_snippet": sink_text[:400],
                "flow": [
                    {"identifier": ident, "sanitized_at": ln}
                    for ident, ln in sorted(sanitized.items(), key=lambda kv: kv[1])
                ],
                "explanation": (
                    f"Input is passed through {sanitizer_calls[-1]['function']}() at line "
                    f"{sanitize_line} before reaching the sink at line {sink_line} — "
                    "the vulnerable transformation cannot manifest on this path."
                ),
            }
    return None


_CALL_RE = re.compile(r"([A-Za-z_][\w.]*)\s*\(([^)]*)\)")


def _first_call(line: str) -> tuple[str, list[str]] | None:
    match = _CALL_RE.search(line)
    if match is None:
        return None
    args = [a.strip() for a in match.group(2).split(",") if a.strip()]
    return match.group(1), args