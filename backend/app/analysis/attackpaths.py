"""Attack-path analysis: entry point -> untrusted input -> ... -> sensitive sink.

Deterministic BFS over the knowledge graph's resolved call edges. A *source*
function is one that takes or reads untrusted data (request params, argv,
env, user input); a *sink* function calls a dangerous operation (SQL execute,
shell, eval, file writes, HTML rendering, deserialization...). Every reported
path is a concrete route an attacker-controlled value can travel, with
file/line evidence per step.

Per-path risk (0-100) is computed from deterministic factors only:

    sink weight (what the chain ends in)
    x entry reachability (how exposed the source is)
    x completeness (full chain = VERIFIED, truncated = PROBABLE)
    x hop penalty (shorter chains are more directly exploitable)

Paths that terminate in a resolved, line-evidenced sink are VERIFIED. When the
chain cannot be completed (calls leave the parsed graph before a sink is
reached) the open end is reported separately as PROBABLE — never claimed as a
verified exploit.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.analysis.knowledge import KnowledgeGraph, SymbolRef
from app.analysis.models import ParsedFile

# Function body / name / param signals that the data is attacker-influenced.
_SOURCE_RE = re.compile(
    r"\b(request|requests?\.(get|post|put|delete|patch|json|data|form|args|params|cookies|headers|files|values|query_string)"
    r"|argv|environ|getenv|input\(|searchParams|location\.(search|hash)|req\.(query|body|params|headers|cookies|files)"
    r"|ctx\.(args|body|query|form)|kwargs|user_input|payload|query_param|form_data|raw_input|prompt)"
    r"|\b(name|username|search|query|hostname|expression|token|price|discount_code|id)\b\s*[,)]",
    re.IGNORECASE,
)

_HTTP_RE = re.compile(
    r"\b(request\.|requests?\.(get|post|put|delete|patch)|req\.(query|body|params|headers|cookies|files)"
    r"|ctx\.(args|body|query|form)|app\.(route|get|post|put|delete|patch)|router\.(get|post|put|delete|patch)"
    r"|@app\.|@router\.|request\.get_json|request\.form|request\.files|Request\.body|query_string|searchParams)",
    re.IGNORECASE,
)
_CLI_RE = re.compile(
    r"\b(argv|sys\.stdin|optparse|argparse|click\.|typer\.|input\(|command_line|sys\.argv)", re.IGNORECASE
)
_ENV_RE = re.compile(r"\b(environ|getenv|os\.environ|process\.env)", re.IGNORECASE)

# Handler-shaped names that appear in web frameworks.
_HANDLER_NAME_RE = re.compile(
    r"^(get|post|put|patch|delete|upload|create|update|edit|delete|handle|handler|view|action|endpoint|process_"
    r"|parse_|import_|export_|signup|login|logout|register|index|search)(_|$)|_handler$|_view$|_endpoint$|_action$",
    re.IGNORECASE,
)

_SINK_RE = re.compile(
    r"^(execute|executescript|executemany|eval|exec|compile|system|popen|spawn|spawnl|run|check_output|check_call|call"
    r"|open|write|render|render_template|render_to_string|innerHTML|outerHTML|insertAdjacentHTML|document\.write"
    r"|query|execute_query|raw_query|shell|send|sendmail|os\.system|os\.popen|subprocess\.\w+"
    r"|child_process\.\w+|sqlite3\.\w+|psycopg2\.\w+|mysql\.\w+|pg\.\w+|pickle\.\w+|yaml\.\w+"
    r"|jwt\.\w+|bcrypt\.\w+)\b",
    re.IGNORECASE,
)


# name-regex -> (category, sink severity weight 0-100, impact label)
_SINK_CATEGORIES: list[tuple[re.Pattern, str, int, str]] = [
    (
        re.compile(
            r"^(execute|executescript|executemany|execute_query|raw_query)$|(^|\.)query\(", re.IGNORECASE
        ),
        "sql",
        95,
        "SQL injection / query manipulation",
    ),
    (
        re.compile(
            r"^(loads|load|unsafe_load|yaml\.load|pickle\.load|pickle\.loads|jsonpickle|unmarshal|deserialize|numpy\.load)\b",
            re.IGNORECASE,
        ),
        "deserialization",
        90,
        "Unsafe deserialization",
    ),
    (
        re.compile(
            r"^(system|popen|spawn|spawnl|check_output|check_call|subprocess|child_process|exec_command|shell)\b",
            re.IGNORECASE,
        ),
        "shell",
        90,
        "OS command execution",
    ),
    (
        re.compile(
            r"^(authenticate|authorize|authorization|login|verify_password|check_permission|is_admin|has_role|jwt\.(decode|verify|sign)|sign_token|create_session|set_cookie)\b",
            re.IGNORECASE,
        ),
        "auth",
        90,
        "Authentication / authorization decision",
    ),
    (
        re.compile(r"^(eval|exec|compile|new\s+Function)\b", re.IGNORECASE),
        "eval",
        85,
        "Dynamic code execution",
    ),
    (
        re.compile(
            r"^(open|write|write_text|writefile|writeFile|appendfile|appendFile|unlink|remove|rename|mkdir|mkdirs?|save|upload|store|put_object|copy_file)\b",
            re.IGNORECASE,
        ),
        "filesystem",
        80,
        "Filesystem read/write",
    ),
    (
        re.compile(
            r"^(render|render_template|render_to_string|send|send_message|mail|sendmail)\b", re.IGNORECASE
        ),
        "render",
        75,
        "Unsafe rendering / injection into output",
    ),
    (
        re.compile(
            r"^(request|requests?\.|urllib|urlopen|http\.|https\.|fetch|axios|client\.(get|post|put|delete|patch)|sendmail|smtp)\b",
            re.IGNORECASE,
        ),
        "network",
        70,
        "Outbound network request (SSRF/exfiltration)",
    ),
    (re.compile(r"^(md5|sha1|hashlib\.md5|createHash)\b", re.IGNORECASE), "crypto", 55, "Weak cryptography"),
]

_MAX_DEPTH = 8
_MAX_PATHS = 25
_MAX_PROBABLE = 8

# Sink-free names that look like the data keeps flowing elsewhere (used only to
# surface PROBABLE open ends — never to claim a completed exploit).
_UNRESOLVED_DANGER_RE = re.compile(
    r"(query|execute|executemany|fetch|save|store|write|send|run|render|open|connect|request|upload|download|invoke|"
    r"create|update|delete|call|process|apply|commit|flush)$",
    re.IGNORECASE,
)


@dataclass
class PathStep:
    function: str
    file_path: str
    line: int


def _classify_entry(ref: SymbolRef, pf: ParsedFile | None) -> dict:
    """Return entry-point metadata for a source, or None when it is internal."""
    if pf is None:
        return {"type": "library", "label": "Library function reading untrusted data"}
    body = "\n".join(pf.source.splitlines()[ref.line_start - 1 : ref.line_end])
    header = body[:800]
    path = ref.file_path.lower()
    if (
        _HTTP_RE.search(header)
        or _HANDLER_NAME_RE.search(ref.name)
        or "/routes" in path
        or "/api" in path
        or "/controllers" in path
        or "/views" in path
        or "/handlers" in path
    ):
        entry_type, label = "http", "HTTP request handler (externally reachable)"
    elif _CLI_RE.search(header):
        entry_type, label = "cli", "CLI / command-line entry point"
    elif _ENV_RE.search(header):
        entry_type, label = "env", "Environment-driven input"
    else:
        entry_type, label = "library", "Library function reading untrusted data"
    return {"type": entry_type, "label": label}


def _sink_category(name: str) -> tuple[str, int, str]:
    for pattern, category, weight, impact in _SINK_CATEGORIES:
        if pattern.search(name):
            return category, weight, impact
    return "unknown", 50, "Dangerous operation"


def _reach_factor(entry_type: str) -> float:
    return {
        "http": 1.0,
        "cli": 0.65,
        "env": 0.6,
        "library": 0.45,
    }.get(entry_type, 0.5)


def _risk_level(score: int) -> str:
    if score >= 85:
        return "CRITICAL"
    if score >= 65:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _hop_penalty(length: int) -> float:
    if length <= 3:
        return 1.0
    if length <= 5:
        return 0.9
    return 0.8


def _score_path(entry_type: str, sink_weight: int, status: str, length: int) -> tuple[int, str, dict]:
    reach = _reach_factor(entry_type)
    completeness = 1.0 if status == "VERIFIED" else 0.5
    score = round(sink_weight * reach * completeness * _hop_penalty(length))
    score = max(0, min(100, score))
    return (
        score,
        _risk_level(score),
        {
            "sink_weight": sink_weight,
            "entry_reachability": reach,
            "completeness_factor": completeness,
            "hop_penalty": _hop_penalty(length),
        },
    )


def find_attack_paths(
    graph: KnowledgeGraph,
    parsed_files: dict[str, ParsedFile],
    *,
    max_paths: int = _MAX_PATHS,
) -> dict:
    """Return attack paths from untrusted sources to dangerous sinks.

    Each path carries ``status`` (VERIFIED when the chain reaches a resolved
    sink with per-hop line evidence; PROBABLE for open ends) and a
    deterministic 0-100 ``risk_score`` with factor breakdown.
    """
    sources = [
        ref
        for path, pf in parsed_files.items()
        for ref in graph.function_symbols(path)
        if _looks_like_source(ref, pf)
    ]
    paths: list[dict] = []
    probable_entries: list[dict] = []

    def add_path(source: SymbolRef, entry: dict, steps: list[dict], status: str) -> None:
        if len(paths) + len(probable_entries) >= max_paths:
            return
        terminal = steps[-1]
        category, weight, impact = _sink_category(
            str(terminal.get("sink_call") or terminal.get("function") or "")
        )
        score, level, factors = _score_path(entry["type"], weight, status, len(steps))
        record = {
            "source": source.qualified_name,
            "source_file": source.file_path,
            "entry_point": entry,
            "sink": terminal["function"],
            "sink_category": category,
            "impact": impact,
            "length": len(steps),
            "status": status,
            "risk_score": score,
            "risk_level": level,
            "risk_factors": factors,
            "steps": [{"function": s["function"], "file": s["file"], "line": s["line"]} for s in steps],
        }
        record["sink_call"] = terminal.get("sink_call") or terminal.get("function")
        if status == "VERIFIED":
            paths.append(record)
        else:
            record["note"] = (
                "Chain could not be completed: the flow leaves the parsed call graph at a call "
                "not resolved to in-repository code. PROBABLE only — not a verified exploit."
            )
            probable_entries.append(record)

    def first_dangerous_unresolved(ref: SymbolRef, pf: ParsedFile | None, depth: int) -> dict | None:
        """Walk the resolved chain up to ``depth`` looking for a call that
        leaves the parsed graph and looks like the flow continues. Returns the
        open-end step or None."""
        seen: set[tuple[str, str]] = {(ref.file_path, ref.qualified_name)}
        queue: list[tuple[SymbolRef, list[dict], int]] = [(ref, [], 0)]
        while queue:
            current, chain, d = queue.pop(0)
            if d >= depth:
                continue
            cpf = parsed_files.get(current.file_path)
            if cpf is None:
                continue
            for call in sorted(
                [c for c in cpf.calls if current.line_start <= c.line <= current.line_end],
                key=lambda c: c.line,
            ):
                if graph.resolve_callee(current.file_path, call.callee) is None:
                    if _UNRESOLVED_DANGER_RE.search(call.callee):
                        step = {
                            "function": call.callee,
                            "file": current.file_path,
                            "line": call.line,
                        }
                        if step in chain:
                            continue
                        return step
                    continue
                callee = graph.resolve_callee(current.file_path, call.callee)
                if callee is None or (callee.file_path, callee.qualified_name) in seen:
                    continue
                seen.add((callee.file_path, callee.qualified_name))
                queue.append(
                    (
                        callee,
                        chain
                        + [
                            {
                                "function": current.qualified_name,
                                "file": current.file_path,
                                "line": current.line_start,
                            }
                        ],
                        d + 1,
                    )
                )
        return None

    for source in sources:
        if len(paths) + len(probable_entries) >= max_paths:
            break
        pf = parsed_files.get(source.file_path)
        entry = _classify_entry(source, pf)
        source_step = {
            "function": source.qualified_name,
            "file": source.file_path,
            "line": source.line_start,
            "sink_name": None,
        }
        reached_sink = False
        # 1-step path: the source function itself calls a dangerous operation
        if _looks_like_sink(source, pf):
            calls = sorted(
                {
                    (c.callee, c.line)
                    for c in pf.calls
                    if source.line_start <= c.line <= source.line_end and _SINK_RE.match(c.callee)
                }
            )
            for callee, line in calls[:3]:
                add_path(
                    source,
                    entry,
                    [
                        {
                            "function": source.qualified_name,
                            "file": source.file_path,
                            "line": source.line_start,
                        },
                        {
                            "function": source.qualified_name,
                            "file": source.file_path,
                            "line": line,
                            "sink_call": callee,
                        },
                    ],
                    "VERIFIED",
                )
                reached_sink = True
                if len(paths) + len(probable_entries) >= max_paths:
                    break
            if len(paths) + len(probable_entries) >= max_paths:
                break
        # BFS over resolved callee edges
        queue: list[tuple[SymbolRef, list[dict]]] = [(source, [dict(source_step)])]
        seen: set[tuple[str, str]] = {(source.file_path, source.qualified_name)}
        while queue:
            current, steps = queue.pop(0)
            if len(steps) > _MAX_DEPTH:
                continue
            for callee in graph.callees_of_ref(current):
                key = (callee.file_path, callee.qualified_name)
                if key in seen:
                    continue
                seen.add(key)
                cpf = parsed_files.get(callee.file_path)
                if _looks_like_sink(callee, cpf):
                    reached_sink = True
                    sink_call, sink_line = _first_sink_call(callee, cpf)
                    add_path(
                        source,
                        entry,
                        [dict(s) for s in steps]
                        + [
                            {
                                "function": callee.qualified_name,
                                "file": callee.file_path,
                                "line": sink_line or callee.line_start,
                                "sink_call": sink_call or callee.qualified_name,
                            }
                        ],
                        "VERIFIED",
                    )
                    if len(paths) + len(probable_entries) >= max_paths:
                        break
                    continue
                queue.append(
                    (
                        callee,
                        [dict(s) for s in steps]
                        + [
                            {
                                "function": callee.qualified_name,
                                "file": callee.file_path,
                                "line": callee.line_start,
                            }
                        ],
                    )
                )
            if len(paths) + len(probable_entries) >= max_paths:
                break
        # No verified chain for an externally reachable entry point -> record a
        # PROBABLE open end when the flow demonstrably leaves the parsed graph.
        if not reached_sink and len(probable_entries) < _MAX_PROBABLE:
            if len(paths) + len(probable_entries) >= max_paths:
                continue
            open_end = first_dangerous_unresolved(source, pf, _MAX_DEPTH)
            if open_end is not None:
                open_end["sink_name"] = open_end["function"]
                add_path(source, entry, [dict(source_step), dict(open_end)], "PROBABLE")

    # deterministic ordering: verified first, then by score desc
    all_paths = sorted(
        paths + probable_entries,
        key=lambda p: (p["status"] != "VERIFIED", -p["risk_score"], p["source"]),
    )
    verified = [p for p in all_paths if p["status"] == "VERIFIED"]
    by_level: dict[str, int] = {}
    for p in all_paths:
        by_level[p["risk_level"]] = by_level.get(p["risk_level"], 0) + 1
    return {
        "source_count": len(sources),
        "path_count": len(all_paths),
        "verified_count": len(verified),
        "probable_count": len(all_paths) - len(verified),
        "by_risk_level": by_level,
        "paths": all_paths,
    }


def _looks_like_source(ref: SymbolRef, pf: ParsedFile | None) -> bool:
    if pf is None:
        return False
    body = "\n".join(pf.source.splitlines()[ref.line_start - 1 : ref.line_end])
    header = body[:600]
    return bool(_SOURCE_RE.search(header)) or bool(_SOURCE_RE.search(ref.name))


def _first_sink_call(ref: SymbolRef, pf: ParsedFile | None) -> tuple[str | None, int | None]:
    """First dangerous call (name, line) inside a sink function's body."""
    if pf is None:
        return None, None
    for call in sorted(
        [c for c in pf.calls if ref.line_start <= c.line <= ref.line_end],
        key=lambda c: (c.line, c.callee),
    ):
        if _SINK_RE.match(call.callee):
            return call.callee, call.line
    return None, None


def _looks_like_sink(ref: SymbolRef, pf: ParsedFile | None) -> bool:
    if pf is None:
        return False
    # a sink is a function that calls a dangerous operation
    calls = {c.callee for c in pf.calls if ref.line_start <= c.line <= ref.line_end}
    return any(_SINK_RE.match(name) for name in calls)
