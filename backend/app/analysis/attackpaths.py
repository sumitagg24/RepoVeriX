"""Attack-path analysis: untrusted input -> ... -> dangerous sink.

Deterministic BFS over the knowledge graph's resolved call edges. A *source*
function is one that takes or reads untrusted data (request params, argv,
env, user input); a *sink* function calls a dangerous operation (SQL execute,
shell, eval, file writes, HTML rendering). Every reported path is a concrete
route an attacker-controlled value can travel, with file/line evidence per
step.
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

_SINK_RE = re.compile(
    r"^(execute|executescript|executemany|eval|exec|compile|system|popen|spawn|spawnl|run|check_output|check_call|call"
    r"|open|write|render|render_template|render_to_string|innerHTML|outerHTML|insertAdjacentHTML|document\.write"
    r"|query|execute_query|raw_query|shell|send|sendmail|os\.system|os\.popen|subprocess\.\w+"
    r"|child_process\.\w+|sqlite3\.\w+|psycopg2\.\w+|mysql\.\w+|pg\.\w+)\b",
    re.IGNORECASE,
)

_MAX_DEPTH = 8
_MAX_PATHS = 25


@dataclass
class PathStep:
    function: str
    file_path: str
    line: int


def _looks_like_source(ref: SymbolRef, pf: ParsedFile | None) -> bool:
    if pf is None:
        return False
    body = "\n".join(pf.source.splitlines()[ref.line_start - 1 : ref.line_end])
    header = body[:600]
    return bool(_SOURCE_RE.search(header)) or bool(_SOURCE_RE.search(ref.name))


def _looks_like_sink(ref: SymbolRef, pf: ParsedFile | None) -> bool:
    if pf is None:
        return False
    # a sink is a function that calls a dangerous operation
    calls = {c.callee for c in pf.calls if ref.line_start <= c.line <= ref.line_end}
    return any(_SINK_RE.match(name) for name in calls)


def find_attack_paths(
    graph: KnowledgeGraph,
    parsed_files: dict[str, ParsedFile],
    *,
    max_paths: int = _MAX_PATHS,
) -> dict:
    """Return attack paths from untrusted sources to dangerous sinks."""
    sources = [
        ref
        for path, pf in parsed_files.items()
        for ref in graph.function_symbols(path)
        if _looks_like_source(ref, pf)
    ]
    paths: list[dict] = []

    def add_path(source: SymbolRef, steps: list[dict]) -> None:
        if len(paths) >= max_paths:
            return
        paths.append(
            {
                "source": source.qualified_name,
                "sink": steps[-1]["function"],
                "length": len(steps),
                "steps": steps,
            }
        )

    for source in sources:
        if len(paths) >= max_paths:
            break
        pf = parsed_files.get(source.file_path)
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
                    [
                        {
                            "function": source.qualified_name,
                            "file": source.file_path,
                            "line": source.line_start,
                        },
                        {"function": callee, "file": source.file_path, "line": line},
                    ],
                )
                if len(paths) >= max_paths:
                    break
            if len(paths) >= max_paths:
                break
        # BFS over resolved callee edges
        queue: list[tuple[SymbolRef, list[PathStep]]] = [
            (source, [PathStep(source.qualified_name, source.file_path, source.line_start)])
        ]
        seen: set[tuple[str, str]] = {(source.file_path, source.qualified_name)}
        while queue:
            current, steps = queue.pop(0)
            if len(steps) > _MAX_DEPTH:
                continue
            for callee in graph.callees_of_ref(current):
                key = (callee.file_path, callee.qualified_name)
                if key in seen:
                    continue
                pf = parsed_files.get(callee.file_path)
                if _looks_like_sink(callee, pf):
                    add_path(
                        source,
                        [
                            {
                                "function": step.function,
                                "file": step.file_path,
                                "line": step.line,
                            }
                            for step in steps
                        ]
                        + [
                            {
                                "function": callee.qualified_name,
                                "file": callee.file_path,
                                "line": callee.line_start,
                            }
                        ],
                    )
                    if len(paths) >= max_paths:
                        break
                    continue
                seen.add(key)
                queue.append(
                    (
                        callee,
                        steps
                        + [
                            PathStep(
                                callee.qualified_name,
                                callee.file_path,
                                callee.line_start,
                            )
                        ],
                    )
                )
            if len(paths) >= max_paths:
                break

    return {
        "source_count": len(sources),
        "path_count": len(paths),
        "paths": paths,
    }