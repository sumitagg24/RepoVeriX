"""Candidate repair generation.

Two tiers:

1. **Deterministic rule templates** for the strong built-in rules. They only
   fire when the source matches a known shape exactly, and they validate that
   the expected lines still exist before producing a diff.
2. **LLM generation** (prompt ``repair_generation_v1``) used when a template is
   not applicable; the returned patch must parse, stay within allowed paths and
   apply cleanly to the repository file before being accepted.

Repairs never touch the original repository: they produce a unified diff which
the verification engine applies to an isolated copy (Section 31).
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from app.analysis.knowledge import KnowledgeGraph
from app.analysis.llm import LLMUsage, complete_json, load_prompt, provider_label
from app.analysis.models import AnalysisError, ParsedFile
from app.analysis.patchops import PatchError, apply_patch_to_file, render_patch
from app.db.models import Finding

TEMPLATE_RULES = {
    "RVX-SQLI-001": "parameterized query",
    "RVX-SECRET-001": "move secret to environment",
    "RVX-SECRET-002": "move secret to environment",
    "RVX-CMDI-001": "remove shell execution",
    "RVX-EVAL-001": "disable dynamic evaluation",
    "RVX-CRYPTO-001": "use stronger hash",
}

_EVAL_LINES_RE = re.compile(r"^\s*(return\s+)?eval\(([^)]*)\)\s*$")
_CMD_SPLIT_RE = re.compile(r"^([\"']?)(.*?)\1$")


@dataclass
class RepairResult:
    """Outcome of repair generation for a finding."""

    diff: str
    description: str
    reasoning: str
    expected_effect: str
    generated_by: str
    files_changed: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- deterministic templates


def _file_text(source_root: Path, file_path: str) -> str:
    target = (source_root / file_path).resolve()
    root_resolved = source_root.resolve()
    if not str(target).startswith(str(root_resolved)) or not target.exists():
        raise AnalysisError(f"Source file missing: {file_path}", code="source_missing")
    return target.read_text(encoding="utf-8", errors="replace")


def _safe_replace(text: str, old: str, new: str, file_path: str) -> str:
    if old not in text:
        raise AnalysisError(
            f"Expected code shape no longer present in {file_path}; refusing template patch",
            code="template_mismatch",
        )
    return text.replace(old, new, 1)


def finding_rule(finding: Finding) -> str:
    """Best-effort recovery of the detector rule for a persisted finding."""
    for ev in finding.evidence:
        if ev.extra and isinstance(ev.extra, dict) and ev.extra.get("rule"):
            return str(ev.extra["rule"])
        if ev.description and "rule " in ev.description:
            m = re.search(r"rule\s+(RVX-[A-Z0-9-]+|S\d+|B\d+)", ev.description)
            if m:
                return m.group(1)
    return _RULE_BY_TITLE.get(finding.title, "unknown")


_RULE_BY_TITLE = {
    "Potential SQL Injection": "RVX-SQLI-001",
    "Potential Command Injection": "RVX-CMDI-001",
    "Hardcoded Secret Detected": "RVX-SECRET-001",
    "Hardcoded Secret Detected (Keyword Argument)": "RVX-SECRET-002",
    "Unsafe Dynamic Code Execution": "RVX-EVAL-001",
    "Weak Cryptographic Hash": "RVX-CRYPTO-001",
}


def template_repair(finding: Finding, source_root: Path) -> RepairResult | None:
    """Produce a deterministic patch when the code matches a known shape."""
    rule = finding_rule(finding)
    file_path = finding.file_path
    try:
        text = _file_text(source_root, file_path)
    except AnalysisError:
        return None
    lines = text.splitlines()

    if rule in ("RVX-SQLI-001", "RVX-SQLI-JS-001") and file_path.endswith(".py"):
        return _template_sqli_python(finding, text, lines, file_path)
    if rule in ("RVX-SECRET-001", "RVX-SECRET-002") and file_path.endswith(".py"):
        return _template_secret(finding, text, lines, file_path)
    if rule == "RVX-CMDI-001" and file_path.endswith(".py"):
        return _template_cmdi_python(finding, text, lines, file_path)
    if rule == "RVX-EVAL-001" and file_path.endswith(".py"):
        return _template_eval_python(finding, text, lines, file_path)
    if rule == "RVX-CRYPTO-001" and file_path.endswith(".py"):
        return _template_crypto_python(finding, text, lines, file_path)
    return None


def _template_sqli_python(
    finding: Finding, text: str, lines: list[str], file_path: str
) -> RepairResult | None:
    """Parameterize ``<var> = f"SELECT ... {param} ..."`` + ``cursor.execute(<var>)``."""
    sink_line = finding.line_start
    if not sink_line or sink_line > len(lines):
        return None
    sink = lines[sink_line - 1]
    var_m = re.search(r"\.\s*(execute|executemany)\s*\(\s*([a-zA-Z_][a-zA-Z0-9_]*)", sink)
    if not var_m:
        return None
    var_name = var_m.group(2)
    # find assignment within preceding lines of same function
    build_line_no, build_text = None, ""
    for i in range(sink_line - 2, max(0, sink_line - 40), -1):
        m = re.search(rf"\b{re.escape(var_name)}\s*=\s*(f[\"'])(.*)$", lines[i])
        if m:
            build_line_no, build_text = i, lines[i]
            break
    if build_line_no is None:
        return None
    interpolations = re.findall(r"\{([a-zA-Z_][a-zA-Z0-9_]*)\}", build_text)
    if not interpolations or len(set(interpolations)) > 3:
        return None
    # split the f-string literal into query + params (no back-references: each
    # quote style is tried explicitly)
    m = None
    for _quote in ('"', "'"):
        pattern = rf"\s*{re.escape(var_name)}\s*=\s*f{_quote}(.*?){_quote}\s*$"
        m = re.fullmatch(pattern, build_text)
        if m:
            break
    if not m:
        return None
    raw_query = m.group(1)
    # Replace each interpolation with a `?`. Any quotes immediately wrapping an
    # interpolation are SQL-string quoting of the value and must be removed
    # together with it (they are not part of the SQL text).
    param_re = re.compile(r"[\"']?\{([a-zA-Z_][a-zA-Z0-9_]*)\}[\"']?")
    matches = list(param_re.finditer(raw_query))
    if not matches:
        return None
    params: list[str] = []
    out = []
    prev = 0
    for mm in matches:
        out.append(raw_query[prev : mm.start()])
        out.append("?")
        params.append(mm.group(1))
        prev = mm.end()
    out.append(raw_query[prev:])
    fixed_query = "".join(out)
    # a parameter tuple needs a trailing comma for a single parameter (the
    # closing paren of the tuple is included; the sink replacement adds the
    # execute() call's own closing paren)
    param_tuple = f"({', '.join(params)},)" if len(params) == 1 else f"({', '.join(params)})"
    indent = build_text[: len(build_text) - len(build_text.lstrip())]
    fixed_build = f'{indent}{var_name} = "{fixed_query}"'
    fixed_sink = re.sub(
        rf"(\.\s*(execute|executemany)\s*\(\s*){re.escape(var_name)}\s*\)",
        rf"\g<1>{var_name}, {param_tuple})",
        sink,
    )
    new_text = _safe_replace(text, lines[build_line_no], fixed_build, file_path)
    new_text = _safe_replace(new_text, sink, fixed_sink, file_path)
    return RepairResult(
        diff=render_patch([(file_path, text, new_text)]),
        description="Replace the interpolated SQL string with a parameterized query",
        reasoning=(
            f"{var_name} was built by interpolating user input into SQL; the patch uses "
            "`?` placeholders and passes values as query parameters."
        ),
        expected_effect="The dynamic string is no longer interpolated; values are bound by the driver.",
        generated_by="repoverix-template",
        files_changed=[file_path],
    )


def _template_secret(finding: Finding, text: str, lines: list[str], file_path: str) -> RepairResult | None:
    line = finding.line_start or 1
    if line > len(lines):
        return None
    target = lines[line - 1]
    m = re.search(r"^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*([rubf]*)([\"']).*\3\s*$", target)
    if not m:
        return None
    name, prefix = m.group(1), m.group(2)
    if "f" in prefix.lower():
        return None
    patched = text
    if not re.search(r"^\s*import\s+os\b", patched, re.M):
        patched = "import os\n" + patched
    replacement = f'{name} = os.environ.get("{name}", "")'
    new_text = _safe_replace(patched, target, replacement, file_path)
    return RepairResult(
        diff=render_patch([(file_path, text, new_text)]),
        description=f"Move the hardcoded value of `{name}` to an environment variable",
        reasoning="Credentials embedded in source are exposed to anyone with repository access; "
        f"reading `{name}` from the environment removes the literal while keeping the interface.",
        expected_effect="No credential literal remains in the source file.",
        generated_by="repoverix-template",
        files_changed=[file_path],
    )


def _template_cmdi_python(
    finding: Finding, text: str, lines: list[str], file_path: str
) -> RepairResult | None:
    line = finding.line_start or 1
    if line > len(lines):
        return None
    target = lines[line - 1]
    if "shell=True" not in target:
        return None
    # subprocess.call(f"ping -c 1 {host}", shell=True) -> subprocess.run([...], shell=False)
    m = re.search(
        r"(subprocess\.(?:call|run|check_call|Popen))\s*\(\s*f?[\"']([^\"']*)\{([a-zA-Z_][a-zA-Z0-9_]*)\}([^\"']*)[\"']\s*,\s*shell=True\s*\)",
        target,
    )
    if not m:
        return None
    func, literal_start, var, literal_end = m.group(1), m.group(2), m.group(3), m.group(4)
    literal_start = literal_start.strip()
    literal_end = literal_end.strip()
    args = []
    if literal_start:
        args.append(f'"{literal_start.strip()}"')
    args.append(var)
    if literal_end:
        args.append(f'"{literal_end.strip()}"')
    fixed = f"{func}([{', '.join(args)}], shell=False)"
    new_text = _safe_replace(text, target, target.replace(m.group(0), fixed), file_path)
    return RepairResult(
        diff=render_patch([(file_path, text, new_text)]),
        description="Replace shell=True execution with an argument list",
        reasoning="shell=True routes the command through the shell; passing an argument vector "
        "with shell=False prevents shell metacharacter injection.",
        expected_effect="The command runs without a shell; interpolated input becomes an argument.",
        generated_by="repoverix-template",
        files_changed=[file_path],
    )


def _template_eval_python(
    finding: Finding, text: str, lines: list[str], file_path: str
) -> RepairResult | None:
    """Replace a single-line ``eval(...)`` statement with an explicit rejection."""
    line = finding.line_start or 1
    if line > len(lines):
        return None
    target = lines[line - 1]
    stripped = target.strip()
    if not re.match(r"^(return\s+)?eval\([^()]*\)\s*$", stripped):
        return None
    indent = target[: len(target) - len(target.lstrip())]
    replacement = f'{indent}raise ValueError("Dynamic evaluation is disabled")'
    new_text = _safe_replace(text, target, replacement, file_path)
    return RepairResult(
        diff=render_patch([(file_path, text, new_text)]),
        description="Disable dynamic eval of caller-supplied expressions",
        reasoning="eval of non-constant input allows arbitrary code execution.",
        expected_effect="Calling the function now raises instead of executing arbitrary code.",
        generated_by="repoverix-template",
        files_changed=[file_path],
    )


def _template_crypto_python(
    finding: Finding, text: str, lines: list[str], file_path: str
) -> RepairResult | None:
    line = finding.line_start or 1
    if line > len(lines):
        return None
    target = lines[line - 1]
    if "hashlib.md5(" not in target:
        return None
    new_text = _safe_replace(text, target, target.replace("hashlib.md5(", "hashlib.sha256("), file_path)
    return RepairResult(
        diff=render_patch([(file_path, text, new_text)]),
        description="Replace MD5 with SHA-256",
        reasoning="MD5 is cryptographically broken for security purposes.",
        expected_effect="The fingerprint uses a collision-resistant hash.",
        generated_by="repoverix-template",
        files_changed=[file_path],
    )


# --------------------------------------------------------------------------- LLM generation


async def llm_repair(
    provider: Any,
    finding: Finding,
    source_root: Path,
    graph: KnowledgeGraph | None,
    parsed_files: dict[str, ParsedFile],
    usage: LLMUsage,
) -> RepairResult:
    """Generate a repair via the LLM and validate it against the repository."""
    from app.analysis.context import _lines as numbered_lines

    file_path = finding.file_path
    try:
        text = _file_text(source_root, file_path)
    except AnalysisError as exc:
        raise exc

    language = "python" if file_path.endswith((".py", ".pyi")) else "javascript"
    evidence_summary = "\n".join(f"- [{e.kind.value}] {e.description[:200]}" for e in finding.evidence)
    related = ""
    if graph is not None:
        importers = graph.files_importing(file_path)
        imported = graph.file_imports(file_path)
        if importers or imported:
            related = "Files importing this file: " + ", ".join(importers[:5] + imported[:5])
    system = load_prompt("system_security")
    template = load_prompt("repair_generation")
    numbered = numbered_lines(text, 1, len(text.splitlines()) or 1, padding=0)
    user = template.format(
        title=finding.title,
        rule=finding_rule(finding),
        file_path=file_path,
        line_start=finding.line_start or 1,
        line_end=finding.line_end or finding.line_start or 1,
        function_name=finding.function_name or "module-level",
        description=finding.description[:1500],
        evidence_summary=evidence_summary[:2000],
        language=language,
        file_content=numbered,
        repo_context=related[:3000],
    )
    data = await complete_json(provider, system, user, usage)
    if data.get("error"):
        raise AnalysisError(
            f"LLM declined to generate a fix: {data.get('reasoning', '')}", code="no_confident_fix"
        )
    files_map = data.get("files") or {}
    if not isinstance(files_map, dict) or file_path not in files_map:
        raise AnalysisError("LLM patch does not include the affected file", code="invalid_patch")

    # Validate: every provided file must exist in the repo, stay in scope, and
    # not be wildly larger than the original (safety net against model drift)
    diffs = []
    for path, content in files_map.items():
        candidate = (source_root / path).resolve()
        if not str(candidate).startswith(str(source_root.resolve())) or not candidate.exists():
            raise AnalysisError(f"LLM patch references unknown file: {path}", code="invalid_patch")
        old_text = candidate.read_text(encoding="utf-8", errors="replace")
        if len(content) > len(old_text) * 4 + 20000:
            raise AnalysisError("LLM patch is unreasonably large; rejected", code="invalid_patch")
        diffs.append((path, old_text, content))
    patch_text = render_patch(diffs)

    # sanity: the generated content must keep a parseable structure
    try:
        apply_patch_to_file(text, patch_text, file_path)
    except PatchError as exc:
        raise AnalysisError(f"Generated patch does not apply: {exc.message}", code="invalid_patch") from exc

    return RepairResult(
        diff=patch_text,
        description=str(data.get("description") or "LLM-generated fix")[:500],
        reasoning=str(data.get("reasoning") or "")[:2000],
        expected_effect=str(data.get("expected_effect") or "")[:500],
        generated_by=provider_label(provider),
        files_changed=list(files_map.keys()),
    )


# --------------------------------------------------------------------------- dispatch


async def generate_repair(
    finding: Finding,
    *,
    source_root: Path,
    provider: Any = None,
    usage: LLMUsage | None = None,
    graph: KnowledgeGraph | None = None,
    parsed_files: dict[str, ParsedFile] | None = None,
) -> RepairResult:
    """Generate a candidate repair, preferring deterministic templates."""
    template = template_repair(finding, source_root)
    if template is not None:
        return template
    if provider is None:
        raise AnalysisError(
            "No deterministic repair template applies to this finding and no LLM "
            "provider is configured (set REPOVERIX_OPENAI_API_KEY / ANTHROPIC / GEMINI).",
            code="repair_unavailable",
        )
    return await llm_repair(
        provider,
        finding,
        source_root,
        graph,
        parsed_files or {},
        usage or LLMUsage(),
    )
