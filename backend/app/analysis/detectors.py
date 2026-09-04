"""Built-in deterministic detectors (RVX-* rules).

These run always, independent of external tools. They operate on parsed source
files and emit ``StaticFinding`` objects whose evidence chains distinguish:

- **direct repository evidence** — the sink line, the string-building
  transformation, the parameter/receiver it flows from (exact lines + snippets)
- **inference** — anything the detector could not fully establish is flagged
  with ``extra["inferred"] = True`` and lower confidence.

The detectors never claim more than the code shows; downstream evidence
validation decides the final status.
"""

from __future__ import annotations

import math
import re
from collections.abc import Iterable

from app.analysis.models import EvidenceDraft, ParsedFile, StaticFinding
from app.db.models import EvidenceKind, FindingCategory, Severity

TOOL = "repoverix-builtin"

_SECRET_NAME_RE = re.compile(
    r"(password|passwd|pwd|api[_-]?key|apikey|access[_-]?key|secret|token|"
    r"auth[_-]?token|credential|private[_-]?key|client[_-]?secret)",
    re.IGNORECASE,
)
_SECRET_VALUE_PREFIXES = (
    "sk-",
    "sk_",
    "pk-",
    "ghp_",
    "gho_",
    "ghs_",
    "xoxb-",
    "xoxp-",
    "AKIA",
    "ASIA",
    "eyJ",  # JWTs
    "-----BEGIN",
)
_PLACEHOLDER_HINTS = (
    "xxx",
    "changeme",
    "your-",
    "your_",
    "example",
    "placeholder",
    "<",
    ">",
    "lorem",
    "replace",
    "put-your",
)
_WEAK_HASH_FN = ("md5", "sha1")
_SQL_KEYWORDS = (
    "select",
    "insert",
    "update",
    "delete",
    "drop",
    "create",
    "alter",
    "where",
    "from",
    "join",
)

_PY_SINK_RE = re.compile(
    r"\.\s*(execute|executemany|executescript|query)\s*\(",
    re.IGNORECASE,
)
_PY_DB_RECEIVER_RE = re.compile(
    r"\b(cursor|cur|conn|connection|db|database|client|pool|engine|session)\b", re.IGNORECASE
)
_PY_FUNC_CALL = re.compile(
    r"\.\s*(execute|executemany|executescript|query)\s*\(|\b(execute_query|query)\s*\(",
    re.IGNORECASE,
)
_JS_SINK_RE = re.compile(
    r"(\.\s*(query|execute|executemany|raw|run)\s*\()|(\bquery\(|sql\s*=\s*)|(\bexecute\()",
    re.IGNORECASE,
)


def _entropy(value: str) -> float:
    if not value:
        return 0.0
    counts: dict[str, int] = {}
    for ch in value:
        counts[ch] = counts.get(ch, 0) + 1
    length = len(value)
    return -sum((c / length) * math.log2(c / length) for c in counts.values())


def _is_placeholder(value: str) -> bool:
    lowered = value.lower()
    return any(hint in lowered for hint in _PLACEHOLDER_HINTS)


def _snippet(lines: list[str], line_start: int, line_end: int | None = None) -> str:
    end = line_end or line_start
    out = []
    for idx in range(line_start - 1, min(end, len(lines))):
        out.append(lines[idx].rstrip())
    return "\n".join(out)


_SQL_WORDS = (
    "SELECT",
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "WHERE",
    "FROM",
    "JOIN",
    "UNION",
)


def _looks_secretish(name: str, value: str, prefix: str = "") -> bool:
    """Heuristic classification of a literal as a hardcoded credential."""
    value = value.strip()
    if len(value) < 8:
        return False
    if _is_placeholder(value):
        return False
    if prefix.lower().startswith("f"):
        return False  # f-strings interpolate values; not a static literal secret
    if "{" in value or "}" in value:
        return False
    if value.startswith("-----BEGIN"):
        return _SECRET_NAME_RE.search(name) is not None
    if any(word in value.upper() for word in _SQL_WORDS):
        return False
    if value.startswith(_SECRET_VALUE_PREFIXES):
        return True
    if _SECRET_NAME_RE.search(name):
        return _entropy(value) >= 2.0 and not any(c.isspace() for c in value)
    # generic high-entropy literal (no secret-ish name): require it to look like
    # a token — compact, printable, no spaces or natural-language markers
    if prefix or not value[0].isalnum():
        return False
    return _entropy(value) >= 3.6 and len(value) >= 16


def _extract_call_arg(
    lines: list[str], open_line: int, open_col: int, arg_index: int = 0
) -> tuple[str, int, int, int]:
    """Return (text, end_line, open_line, arg_count) for a call's arguments.

    Walks from the opening parenthesis, balancing nested parens while ignoring
    quoted strings. Best effort; on any failure returns a best-guess slice.
    """
    depth = 1  # the opening parenthesis itself
    args: list[str] = []
    current: list[str] = []
    end_line = open_line
    quote: str | None = None
    for lineno in range(open_line, len(lines)):
        line = lines[lineno]
        col = open_col if lineno == open_line else 0
        i = col
        while i < len(line):
            ch = line[i]
            if quote:
                if ch == quote:
                    quote = None
                elif ch == "\\":
                    i += 1
                i += 1
                continue
            if ch in "\"'`":
                quote = ch
                current.append(ch)
                i += 1
                continue
            if ch == "(":
                depth += 1
                current.append(ch)
            elif ch == ")":
                depth -= 1
                if depth == 0:
                    if current and any(c.strip() for c in current):
                        args.append("".join(current))
                    end_line = lineno
                    break
                current.append(ch)
            elif ch == "," and depth == 1:
                args.append("".join(current))
                current = []
            else:
                current.append(ch)
            i += 1
        if depth == 0:
            break
        if current and any(c.strip() for c in current):
            current.append("\n")
    if arg_index < len(args):
        text = args[arg_index].strip()
        return text, end_line, open_line, len(args)
    return "", end_line, open_line, len(args)


def _find_string_build(
    lines: list[str], function_range: range, sink_line: int, var_name: str
) -> tuple[int, str] | None:
    """Look backwards for `var = <f-string / % / concat>` inside the function."""
    for lineno in reversed(function_range):
        if lineno >= sink_line:
            continue
        # multi-line values: f-strings / concatenations can span lines; grab windows
        window = "\n".join(lines[max(0, lineno - 1) : min(len(lines), lineno + 6)])
        pattern = re.compile(
            rf"\b{re.escape(var_name)}\s*=\s*(.*?)(?=\n\s*(?:return|if|elif|else|for|while|def|class)\b|$)",
            re.DOTALL,
        )
        match = pattern.search(window)
        if not match:
            continue
        value = match.group(1).strip()
        if _is_interpolated(value):
            return lineno + 1, value[:300]
    return None


def _is_interpolated(value: str) -> bool:
    """True if ``value`` looks like an interpolated / concatenated string build."""
    if re.search(r"f[\"']", value) and "{" in value:
        return True
    if re.search(r"%\s*(?:\(|[\"']?[a-zA-Z_])", value):
        return True
    if " + " in value or '" + ' in value or "' + " in value:
        # string concatenation involving a non-literal part
        if re.search(r"\+[^\"'\n]*[a-zA-Z_][a-zA-Z0-9_]*", value):
            return True
    return False


def _string_is_dynamic(arg: str) -> bool:
    """Is the SQL string built dynamically (f-string, %, concat, or bare var)?"""
    arg = arg.strip()
    if not arg:
        return False
    if arg.startswith(("f'", 'f"', "f'''", 'f"""')):
        return True
    if re.search(r"\{\s*[a-zA-Z_]", arg):
        return True  # template interpolation inside f-string without f prefix
    if re.search(r"%\s*(?:\(|s|d|r)", arg):
        return True
    if re.search(r"\+\s*[a-zA-Z_][a-zA-Z0-9_]*", arg):
        return True
    if re.match(r"^[a-zA-Z_][a-zA-Z0-9_]*\.?\w*$", arg):
        return True  # a variable holding a query
    return False


# =========================================================================== python


def _py_function_bodies(pf: ParsedFile) -> list[dict]:
    out = []
    for sym in pf.symbols:
        if sym.kind not in ("function", "method"):
            continue
        out.append(
            {
                "name": sym.name,
                "qualified": sym.qualified_name,
                "line_start": sym.line_start,
                "line_end": sym.line_end,
                "params": sym.extra.get("params", ""),
                "decorators": sym.extra.get("decorators", []),
                "module": sym.extra.get("module", ""),
            }
        )
    return out


def _detect_python_sql(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for fn in _py_function_bodies(pf):
        body_range = range(fn["line_start"] - 1, min(fn["line_end"], len(lines)))
        body_lines = [(i + 1, lines[i]) for i in body_range]
        is_route = any("route" in d or "app." in d for d in fn["decorators"])
        has_request_param = "request" in fn["params"]

        # find direct sinks
        sink_spans: list[tuple[int, int, str]] = []
        for idx, (lineno, text) in enumerate(body_lines):
            for match in _PY_SINK_RE.finditer(text):
                if not _PY_DB_RECEIVER_RE.search(text[max(0, match.start() - 60) : match.start()]):
                    continue
                arg_text, _end, _start, arg_count = _extract_call_arg(lines, lineno - 1, match.end())
                if arg_count > 1:
                    continue  # parameterized execution (cursor.execute(sql, params)) is safe
                sink_spans.append((lineno, idx, arg_text))
        if not sink_spans:
            # fallback: bare execute_query/query(helper calls with interpolated content
            for idx, (lineno, text) in enumerate(body_lines):
                for match in _PY_FUNC_CALL.finditer(text):
                    arg_text, _end, _start, arg_count = _extract_call_arg(lines, lineno - 1, match.end())
                    if arg_count > 1:
                        continue
                    if _string_is_dynamic(arg_text) and _SQL_KEYWORDS_RE.search(arg_text.lower()):
                        sink_spans.append((lineno, idx, arg_text))

        for lineno, _idx, arg_text in sink_spans:
            if not _string_is_dynamic(arg_text):
                continue
            finding = _sql_finding(pf, lines, fn, lineno, arg_text, is_route, has_request_param)
            if finding is not None:
                findings.append(finding)
    return findings


_SQL_KEYWORDS_RE = re.compile(r"|".join(_SQL_KEYWORDS), re.IGNORECASE)


def _sql_finding(
    pf: ParsedFile,
    lines: list[str],
    fn: dict,
    sink_lineno: int,
    arg_text: str,
    is_route: bool,
    has_request_param: bool,
) -> StaticFinding | None:
    """Build an SQLi finding or return None when no dynamic construction is provable."""
    evidence: list[EvidenceDraft] = []
    dynamic = _string_is_dynamic(arg_text)
    if not dynamic:
        return None
    var_match = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*)\s*$", arg_text.strip())

    body_range = range(fn["line_start"] - 1, min(fn["line_end"], len(lines)))
    build_text: str | None = None
    build_lineno: int | None = None
    inline = False

    if var_match:
        found = _find_string_build(lines, body_range, sink_lineno, var_match.group(1))
        if found is None:
            # a bare variable with no provable interpolation inside this function
            return None
        build_lineno, build_text = found
    elif _is_interpolated(arg_text):
        # the argument is itself an f-string / concatenation
        build_text = arg_text[:400]
        build_lineno = sink_lineno
        inline = True
    else:
        return None

    # sink node
    evidence.append(
        EvidenceDraft(
            kind=EvidenceKind.sink,
            file_path=pf.path,
            line_start=sink_lineno,
            line_end=sink_lineno,
            snippet=_snippet(lines, sink_lineno, min(sink_lineno + 2, len(lines))),
            description=f"Database execution call on line {sink_lineno} receives a dynamically built query",
        )
    )

    if not inline and build_lineno:
        evidence.append(
            EvidenceDraft(
                kind=EvidenceKind.transformation,
                file_path=pf.path,
                line_start=build_lineno,
                line_end=build_lineno,
                snippet=_snippet(lines, build_lineno, min(build_lineno + 3, len(lines))),
                description=f"Query string is assembled on line {build_lineno} (f-string / concatenation)",
            )
        )

    tainted_from_param = False
    # are function parameters interpolated into the built string?
    param_names = re.findall(r"[a-zA-Z_][a-zA-Z0-9_]*", fn["params"])
    for p in param_names:
        if p in {"self", "cls", "request", "args", "kwargs"}:
            continue
        pattern = rf"\{{?\s*{re.escape(p)}\s*}}?|%\s*[\(\{{]?\s*{re.escape(p)}|\+\s*{re.escape(p)}\b"
        if re.search(pattern, build_text or ""):
            tainted_from_param = True
            evidence.append(
                EvidenceDraft(
                    kind=EvidenceKind.source_input,
                    file_path=pf.path,
                    line_start=fn["line_start"],
                    line_end=min(fn["line_start"] + 2, fn["line_end"]),
                    snippet=_snippet(lines, fn["line_start"], min(fn["line_start"] + 3, len(lines))),
                    description=(
                        f"Function parameter `{p}` is interpolated into the query string ({fn['qualified']})"
                    ),
                )
            )
            break

    severity = Severity.critical if (tainted_from_param and is_route) else Severity.high
    confidence = 0.92 if tainted_from_param else 0.75
    msg = (
        f"Potential SQL injection in {fn['name']}(): a query is built from an f-string/"
        f"concatenation and executed against the database (line {sink_lineno})."
    )
    if not tainted_from_param:
        msg += " The injected value could not be traced to a function parameter (lower confidence)."

    return StaticFinding(
        tool=TOOL,
        rule="RVX-SQLI-001",
        file_path=pf.path,
        line_start=sink_lineno,
        line_end=sink_lineno,
        severity=severity,
        category=FindingCategory.security,
        message=msg,
        confidence=confidence,
        evidence=evidence,
        extra={
            "function": fn["name"],
            "qualified_function": fn["qualified"],
            "is_route_handler": is_route,
            "tainted_from_parameter": tainted_from_param,
            "rule_description": "SQL query built with string interpolation and executed against a database",
        },
    )


_SECRET_ASSIGN_RE = re.compile(
    r"(?:^|[;\s])([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([rubf]*)([\"'])(.*?)(\3)",
    re.DOTALL,
)
_SECRET_KWARG_RE = re.compile(
    r"([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([rubf]*)([\"'])(.*?)(\4)",
    re.DOTALL,
)


def _detect_python_secrets(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    joined = "\n".join(lines)
    for match in _SECRET_ASSIGN_RE.finditer(joined):
        name = match.group(1)
        prefix = match.group(2).lower()
        value = match.group(4)
        line = joined[: match.start()].count("\n") + 1
        if not _looks_secretish(name, value, prefix=prefix):
            continue
        if name.lower().startswith("__") or name in {"self"}:
            continue
        evidence = [
            EvidenceDraft(
                kind=EvidenceKind.source_input,
                file_path=pf.path,
                line_start=line,
                line_end=line,
                snippet=_snippet(lines, line),
                description=f"Literal assigned to secret-like name `{name}` on line {line}",
            )
        ]
        findings.append(
            StaticFinding(
                tool=TOOL,
                rule="RVX-SECRET-001",
                file_path=pf.path,
                line_start=line,
                line_end=line,
                severity=Severity.high,
                category=FindingCategory.security,
                message=f"Hardcoded secret-like value assigned to `{name}` on line {line}",
                confidence=0.92,
                evidence=evidence,
                extra={"name": name, "rule_description": "Hardcoded credential/API key"},
            )
        )
    # function keyword arguments: create_app(password="...")
    for match in _SECRET_KWARG_RE.finditer(joined):
        name = match.group(1)
        if not _SECRET_NAME_RE.search(name):
            continue
        prefix = match.group(2).lower()
        value = match.group(4)
        if not _looks_secretish(name, value, prefix=prefix):
            continue
        # avoid duplicate with assignment scan
        if any(f.extra.get("name") == name for f in findings):
            continue
        line = joined[: match.start()].count("\n") + 1
        findings.append(
            StaticFinding(
                tool=TOOL,
                rule="RVX-SECRET-002",
                file_path=pf.path,
                line_start=line,
                line_end=line,
                severity=Severity.high,
                category=FindingCategory.security,
                message=f"Hardcoded secret-like value passed as `{name}=...` on line {line}",
                confidence=0.88,
                evidence=[
                    EvidenceDraft(
                        kind=EvidenceKind.source_input,
                        file_path=pf.path,
                        line_start=line,
                        line_end=line,
                        snippet=_snippet(lines, line),
                        description=f"Secret-like keyword argument `{name}` on line {line}",
                    )
                ],
                extra={
                    "name": name,
                    "rule_description": "Hardcoded credential/API key (keyword argument)",
                },
            )
        )
    return findings


def _detect_python_command_injection(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    dangerous = re.compile(r"(os\.system|os\.popen|subprocess\.(call|run|Popen|check_output))")
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        window = "\n".join(lines[max(0, lineno - 1) : min(len(lines), lineno + 4)])
        for match in dangerous.finditer(text):
            if "shell=True" in window or match.group(1).startswith("os."):
                # dynamic command?
                dynamic = re.search(r"(f[\"']|\{\s*[a-zA-Z_]|\+\s*[a-zA-Z_]|%s|%\(|shell\s*=\s*True)", window)
                if dynamic:
                    findings.append(
                        StaticFinding(
                            tool=TOOL,
                            rule="RVX-CMDI-001",
                            file_path=pf.path,
                            line_start=lineno,
                            line_end=lineno,
                            severity=Severity.high,
                            category=FindingCategory.security,
                            message=f"Command built dynamically and executed via {match.group(1)} on line {lineno}",
                            confidence=0.8,
                            evidence=[
                                EvidenceDraft(
                                    kind=EvidenceKind.sink,
                                    file_path=pf.path,
                                    line_start=lineno,
                                    line_end=lineno,
                                    snippet=_snippet(lines, lineno, min(lineno + 3, len(lines))),
                                    description=f"Shell execution via {match.group(1)} with dynamic content",
                                )
                            ],
                            extra={"rule_description": "Command injection via shell execution"},
                        )
                    )
    return findings


def _detect_python_eval(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        match = re.search(r"\b(eval|exec|compile)\s*\(([^)]{0,400})", text)
        if not match:
            continue
        arg = match.group(2)
        if not re.match(r"^[\s]*[\"']", arg) or re.search(r"[\"']\s*\+|\{\s*[a-zA-Z_]", arg):
            findings.append(
                StaticFinding(
                    tool=TOOL,
                    rule="RVX-EVAL-001",
                    file_path=pf.path,
                    line_start=lineno,
                    line_end=lineno,
                    severity=Severity.medium,
                    category=FindingCategory.security,
                    message=f"Dangerous dynamic code execution via `{match.group(1)}` on line {lineno}",
                    confidence=0.7,
                    evidence=[
                        EvidenceDraft(
                            kind=EvidenceKind.sink,
                            file_path=pf.path,
                            line_start=lineno,
                            line_end=lineno,
                            snippet=_snippet(lines, lineno),
                            description=f"`{match.group(1)}` called with non-constant argument",
                        )
                    ],
                    extra={"rule_description": "eval/exec with dynamic input"},
                )
            )
    return findings


def _detect_python_weak_crypto(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        for fn_name in _WEAK_HASH_FN:
            if re.search(rf"\bhashlib\.{fn_name}\s*\(", text) or re.search(rf"\b{fn_name}\s*\(", text):
                findings.append(
                    StaticFinding(
                        tool=TOOL,
                        rule="RVX-CRYPTO-001",
                        file_path=pf.path,
                        line_start=lineno,
                        line_end=lineno,
                        severity=Severity.low,
                        category=FindingCategory.security,
                        message=f"Weak cryptographic hash `{fn_name}` used on line {lineno}",
                        confidence=0.7,
                        evidence=[
                            EvidenceDraft(
                                kind=EvidenceKind.sink,
                                file_path=pf.path,
                                line_start=lineno,
                                line_end=lineno,
                                snippet=_snippet(lines, lineno),
                                description=f"`{fn_name}` is cryptographically broken for security purposes",
                            )
                        ],
                        extra={"rule_description": "Use of weak cryptographic hash"},
                    )
                )
    return findings


def _detect_python_bare_except(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        if re.match(r"^\s*except\s*(Exception)?\s*:\s*(pass|\.\.\.)?\s*$", text) or re.match(
            r"^\s*except\s*:\s*$", text
        ):
            findings.append(
                StaticFinding(
                    tool=TOOL,
                    rule="RVX-EXCEPT-001",
                    file_path=pf.path,
                    line_start=lineno,
                    line_end=lineno,
                    severity=Severity.low,
                    category=FindingCategory.reliability,
                    message=f"Broad `except` clause on line {lineno} silently swallows errors",
                    confidence=0.6,
                    evidence=[
                        EvidenceDraft(
                            kind=EvidenceKind.sink,
                            file_path=pf.path,
                            line_start=lineno,
                            line_end=lineno,
                            snippet=_snippet(lines, lineno, min(lineno + 2, len(lines))),
                            description="Broad exception handler without meaningful handling",
                        )
                    ],
                    extra={"rule_description": "Bare/broad exception silently ignored"},
                )
            )
    return findings


# =========================================================================== javascript / typescript


def _detect_js_sql(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    dbish = re.compile(r"\b(db|pool|client|conn|connection|cursor|sequelize|knex|prisma|mongoose)\b")
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        for match in _JS_SINK_RE.finditer(text):
            context = text[max(0, match.start() - 80) : match.end() + 80]
            is_assign = "sql =" in context or bool(match.group(2))
            if not (dbish.search(context[: match.start()]) or is_assign):
                continue
            # look back a few lines for the template/concat build feeding this sink
            lookback = lines[max(0, lineno - 9) : lineno]
            window = "\n".join(lookback + [context])
            build_lines = [
                i + max(0, lineno - 9) + 1
                for i, candidate in enumerate(lookback)
                if re.search(r"=`[^`]*\$\{|`[^`]*\$\{|=.*[\"']\s*\+", candidate)
            ]
            dynamic = bool(re.search(r"`[^`]*\$\{", window)) or bool(re.search(r"[\"']\s*\+", window))
            if not dynamic:
                continue
            evidence: list[EvidenceDraft] = [
                EvidenceDraft(
                    kind=EvidenceKind.sink,
                    file_path=pf.path,
                    line_start=lineno,
                    line_end=lineno,
                    snippet=_snippet(lines, lineno, min(lineno + 2, len(lines))),
                    description=f"Dynamic SQL executed on line {lineno} against a database client",
                )
            ]
            for bl in build_lines[:3]:
                evidence.append(
                    EvidenceDraft(
                        kind=EvidenceKind.transformation,
                        file_path=pf.path,
                        line_start=bl,
                        line_end=bl,
                        snippet=_snippet(lines, bl),
                        description=f"Query string assembled on line {bl} with a template literal / concatenation",
                    )
                )
            findings.append(
                StaticFinding(
                    tool=TOOL,
                    rule="RVX-SQLI-JS-001",
                    file_path=pf.path,
                    line_start=lineno,
                    line_end=lineno,
                    severity=Severity.high,
                    category=FindingCategory.security,
                    message=f"Potential SQL injection: template/concat-built query executed on line {lineno}",
                    confidence=0.82,
                    evidence=evidence,
                    extra={"rule_description": "SQL query built with template literals or concatenation"},
                )
            )
    return findings


def _detect_js_command_injection(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    patterns = re.compile(r"\b(exec|execSync)\s*\(")
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        if not patterns.search(text):
            continue
        window = "\n".join(lines[max(0, lineno - 3) : min(len(lines), lineno + 4)])
        if not re.search(r"`[^`]*\$\{|[\"']\s*\+", window):
            continue
        findings.append(
            StaticFinding(
                tool=TOOL,
                rule="RVX-CMDI-JS-001",
                file_path=pf.path,
                line_start=lineno,
                line_end=lineno,
                severity=Severity.high,
                category=FindingCategory.security,
                message=f"Dynamic command passed to exec() on line {lineno}",
                confidence=0.8,
                evidence=[
                    EvidenceDraft(
                        kind=EvidenceKind.sink,
                        file_path=pf.path,
                        line_start=lineno,
                        line_end=lineno,
                        snippet=_snippet(lines, lineno, min(lineno + 3, len(lines))),
                        description=f"child_process exec with interpolated command on line {lineno}",
                    )
                ],
                extra={"rule_description": "Command injection via child_process.exec"},
            )
        )
    return findings


def _detect_js_secrets(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        match = re.search(r"(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*[\"']([^\"']{6,})[\"']", text)
        if not match:
            continue
        name, value = match.group(1), match.group(2)
        if not _looks_secretish(name, value):
            continue
        findings.append(
            StaticFinding(
                tool=TOOL,
                rule="RVX-SECRET-JS-001",
                file_path=pf.path,
                line_start=lineno,
                line_end=lineno,
                severity=Severity.high,
                category=FindingCategory.security,
                message=f"Hardcoded secret-like value assigned to `{name}` on line {lineno}",
                confidence=0.92,
                evidence=[
                    EvidenceDraft(
                        kind=EvidenceKind.source_input,
                        file_path=pf.path,
                        line_start=lineno,
                        line_end=lineno,
                        snippet=_snippet(lines, lineno),
                        description=f"Literal assigned to secret-like name `{name}` on line {lineno}",
                    )
                ],
                extra={"name": name, "rule_description": "Hardcoded credential/API key"},
            )
        )
    return findings


def _detect_js_eval(pf: ParsedFile, lines: list[str]) -> list[StaticFinding]:
    findings: list[StaticFinding] = []
    for lineno in range(1, len(lines) + 1):
        text = lines[lineno - 1]
        if re.search(r"\beval\s*\([^\"')]", text) or re.search(r"new\s+Function\s*\([^)]*[a-zA-Z_]", text):
            findings.append(
                StaticFinding(
                    tool=TOOL,
                    rule="RVX-EVAL-JS-001",
                    file_path=pf.path,
                    line_start=lineno,
                    line_end=lineno,
                    severity=Severity.medium,
                    category=FindingCategory.security,
                    message=f"Dynamic code execution via eval/new Function on line {lineno}",
                    confidence=0.68,
                    evidence=[
                        EvidenceDraft(
                            kind=EvidenceKind.sink,
                            file_path=pf.path,
                            line_start=lineno,
                            line_end=lineno,
                            snippet=_snippet(lines, lineno),
                            description="eval/Function called with a non-literal argument",
                        )
                    ],
                    extra={"rule_description": "eval / new Function with dynamic input"},
                )
            )
    return findings


# =========================================================================== dispatch


def detect_all(pf: ParsedFile) -> list[StaticFinding]:
    """Run all built-in detectors against one parsed file."""
    lines = pf.source.splitlines()
    findings: list[StaticFinding] = []
    if pf.language == "python":
        findings += _detect_python_sql(pf, lines)
        findings += _detect_python_secrets(pf, lines)
        findings += _detect_python_command_injection(pf, lines)
        findings += _detect_python_eval(pf, lines)
        findings += _detect_python_weak_crypto(pf, lines)
        findings += _detect_python_bare_except(pf, lines)
    elif pf.language in ("javascript", "typescript"):
        findings += _detect_js_sql(pf, lines)
        findings += _detect_js_command_injection(pf, lines)
        findings += _detect_js_secrets(pf, lines)
        findings += _detect_js_eval(pf, lines)
    return findings


def run_detectors(parsed_files: Iterable[ParsedFile]) -> list[StaticFinding]:
    """Run all detectors over the given parsed files."""
    out: list[StaticFinding] = []
    for pf in parsed_files:
        out.extend(detect_all(pf))
    return out
