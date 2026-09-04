"""Build relevant LLM context packages for a candidate issue.

The whole repository is never sent to an LLM. For each candidate we assemble:

- the affected file and surrounding lines / enclosing function
- callers and callees (from the knowledge graph) with code windows
- files that import the affected file, and files it imports
- static-analysis evidence (tool output)
- dependency/test hints

Everything is capped at ``REPOVERIX_LLM_MAX_CONTEXT_CHARS`` and redacted.
"""

from __future__ import annotations

from app.analysis.knowledge import KnowledgeGraph
from app.analysis.models import ParsedFile, StaticFinding
from app.analysis.redaction import redact_text
from app.core.config import get_settings


def _lines(source: str, start: int, end: int | None = None, padding: int = 2) -> str:
    lines = source.splitlines()
    if not lines:
        return ""
    end_line = min(end or start, len(lines))
    lo = max(0, start - 1 - padding)
    hi = min(len(lines), end_line + padding)
    out = []
    for i in range(lo, hi):
        out.append(f"{i + 1:>5} | {lines[i]}")
    return "\n".join(out)


def _function_window(graph: KnowledgeGraph, file_path: str, name: str | None) -> str:
    if not name:
        return ""
    for ref in graph.symbols_in(file_path):
        if ref.name == name:
            pf = graph.files.get(file_path)
            if pf:
                return f"  {file_path}:{ref.line_start}-{ref.line_end} ({name})\n" + _lines(
                    pf.source, ref.line_start, ref.line_end, padding=1
                )
    return ""


def _caller_callee_context(
    graph: KnowledgeGraph,
    file_path: str,
    line_start: int,
    function_name: str | None,
    max_chars: int,
) -> str:
    """Describe who calls and what is called around the candidate location."""
    out: list[str] = []
    budget = max_chars

    # enclosing function
    ref = None
    if function_name:
        for candidate in graph.function_symbols(file_path):
            if candidate.name == function_name and candidate.line_start <= line_start <= candidate.line_end:
                ref = candidate
                break
    if ref is None:
        for candidate in graph.function_symbols(file_path):
            if candidate.line_start <= line_start <= candidate.line_end:
                ref = candidate
                break

    if ref:
        out.append(f"Enclosing function: {ref.qualified_name} ({file_path}:{ref.line_start}-{ref.line_end})")
        callers = graph.callers_of_ref(ref)
        if callers:
            out.append(f"Direct callers: {', '.join(sorted(callers)[:8])}")
        callees = graph.callees_of_ref(ref)
        if callees:
            out.append(
                "Callees resolved in repo: "
                + ", ".join(f"{c.qualified_name} ({c.file_path}:{c.line_start})" for c in callees[:8])
            )
    else:
        calls = graph.calls_in(file_path, line_start - 1, line_start + 1)
        if calls:
            out.append("Calls on these lines: " + ", ".join(f"{name} (line {ln})" for name, ln in calls[:6]))

    # related files
    importers = graph.files_importing(file_path)
    imported = graph.file_imports(file_path)
    if importers:
        out.append(f"Files importing this file: {', '.join(importers[:6])}")
    if imported:
        out.append(f"Files this file imports (in repo): {', '.join(imported[:6])}")
    return "\n".join(out)[:budget]


def build_candidate_context(
    graph: KnowledgeGraph,
    parsed_files: dict[str, ParsedFile],
    finding: StaticFinding,
    *,
    function_name: str | None = None,
    config_name: str,
    source_label: str,
) -> str:
    """Compose the textual context package for one candidate."""
    settings = get_settings()
    budget = settings.llm_max_context_chars
    pf = parsed_files.get(finding.file_path)
    if pf is None:
        pf = graph.files.get(finding.file_path)

    sections: list[str] = []
    used = 0

    def add(title: str, body: str) -> None:
        nonlocal used
        if not body.strip():
            return
        block = f"{title}\n{body}"
        if used + len(block) > budget:
            block = block[: max(0, budget - used)]
        if not block:
            return
        sections.append(block)
        used += len(block)

    lang = pf.language if pf else (finding.extra.get("language") or "text")
    snippet = ""
    if pf:
        snippet = _lines(pf.source, finding.line_start, finding.line_end, padding=3)
    add("Affected code:", f"```{lang}\n{snippet}\n```" if snippet else "(no code available)")

    graph_context = _caller_callee_context(
        graph, finding.file_path, finding.line_start, function_name, min(budget // 3, 6000)
    )
    add("Call relationships:", graph_context)

    related: list[str] = []
    imp = graph.files_importing(finding.file_path)
    imp2 = graph.file_imports(finding.file_path)
    for path in (imp + imp2)[:4]:
        related_pf = parsed_files.get(path)
        if not related_pf:
            continue
        window = _lines(related_pf.source, 1, min(len(related_pf.source.splitlines()), 60))
        related.append(f"--- {path} ---\n{window}")
    add("Related files:", "\n".join(related))

    evidence_lines = []
    for e in finding.evidence:
        loc = f"{e.file_path}:{e.line_start}" if e.file_path else ""
        evidence_lines.append(f"- [{e.kind.value}] {loc} {e.description}")
    if not finding.evidence:
        evidence_lines.append(f"- tool {finding.tool} rule {finding.rule}: {finding.message}")
    add("Static evidence:", "\n".join(evidence_lines))

    add(
        "Meta:",
        f"configuration={config_name} source={source_label} rule={finding.rule} tool={finding.tool}",
    )

    text, _redacted = redact_text("\n\n".join(sections))
    return text[:budget]
