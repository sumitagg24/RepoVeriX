"""Shared value objects used across the analysis engine.

These mirror but do *not* replace the database models in ``app.db.models``.
They are the in-memory working representation produced by each stage; the
orchestrator persists the relevant subset (files, symbols, dependencies,
findings, evidence, analysis runs) into the database.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from app.db.models import (
    EvidenceKind,
    FindingCategory,
    Severity,
)

# --------------------------------------------------------------------------- errors


class AnalysisError(Exception):
    """A domain error with a stable machine-readable code."""

    def __init__(self, message: str, code: str = "analysis_error", *, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.code = code
        self.retryable = retryable


class ToolUnavailableError(AnalysisError):
    """Raised when a required external capability (git, docker, a linter) is missing."""


# --------------------------------------------------------------------------- repository discovery


@dataclass
class RepoFile:
    """One discovered, non-ignored file inside the repository working copy."""

    path: str  # POSIX-style, relative to the repository root
    language: str | None
    size_bytes: int
    sha256: str
    is_test: bool


@dataclass
class ProjectManifest:
    """Summary of repository structure produced during ingestion/parsing."""

    languages: list[str] = field(default_factory=list)
    language_counts: dict[str, int] = field(default_factory=dict)
    file_count: int = 0
    ignored_file_count: int = 0
    total_size_bytes: int = 0
    package_managers: list[str] = field(default_factory=list)
    lockfiles: list[str] = field(default_factory=list)
    test_frameworks: list[str] = field(default_factory=list)
    test_file_count: int = 0
    test_command: str | None = None
    has_tests: bool = False
    git_commit: str | None = None
    git_branch: str | None = None
    source: str = "unknown"  # github | zip | directory
    warnings: list[str] = field(default_factory=list)
    dependencies: list[dict[str, Any]] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "languages": self.languages,
            "language_counts": self.language_counts,
            "file_count": self.file_count,
            "ignored_file_count": self.ignored_file_count,
            "total_size_bytes": self.total_size_bytes,
            "package_managers": self.package_managers,
            "lockfiles": self.lockfiles,
            "test_frameworks": self.test_frameworks,
            "test_file_count": self.test_file_count,
            "test_command": self.test_command,
            "has_tests": self.has_tests,
            "git_commit": self.git_commit,
            "git_branch": self.git_branch,
            "source": self.source,
            "warnings": self.warnings,
            "dependencies": self.dependencies,
        }


# --------------------------------------------------------------------------- parsing


@dataclass
class SymbolInfo:
    """A parsed function / class / method definition."""

    kind: str  # "function" | "class" | "method"
    name: str
    qualified_name: str
    file_path: str
    language: str
    line_start: int
    line_end: int
    extra: dict[str, Any] = field(default_factory=dict)  # decorators, async, exported, params...
    children: list[SymbolInfo] = field(default_factory=list)


@dataclass
class ImportInfo:
    """A module/package import statement at file scope."""

    module: str  # resolved module path (e.g. "backend.users" or "./lib/util")
    raw: str
    imported_names: list[str] = field(default_factory=list)
    file_path: str = ""
    line: int = 0


@dataclass
class CallInfo:
    """One call expression recorded inside a function/method body."""

    caller: str  # qualified name of the enclosing function/method
    callee: str  # name as written (identifier or last member)
    line: int
    column: int = 0
    is_attribute: bool = False


@dataclass
class ParsedFile:
    """Output of the parser for a single source file."""

    path: str
    language: str
    source: str
    symbols: list[SymbolInfo] = field(default_factory=list)
    imports: list[ImportInfo] = field(default_factory=list)
    calls: list[CallInfo] = field(default_factory=list)


# --------------------------------------------------------------------------- static analysis


@dataclass
class EvidenceDraft:
    """A node of a finding's evidence chain before it becomes a DB row."""

    kind: EvidenceKind
    description: str
    file_path: str | None = None
    line_start: int | None = None
    line_end: int | None = None
    snippet: str | None = None
    extra: dict[str, Any] = field(default_factory=dict)
    order_index: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "kind": self.kind.value,
            "description": self.description,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "snippet": self.snippet,
            "extra": self.extra,
        }


@dataclass
class StaticFinding:
    """Normalized output of any static-analysis source (tool or built-in detector)."""

    tool: str  # "repoverix-builtin" | "ruff" | "bandit" | ...
    rule: str  # e.g. "RVX-SQLI-001", "S608"
    file_path: str
    line_start: int
    line_end: int
    severity: Severity
    category: FindingCategory
    message: str
    confidence: float = 0.5
    evidence: list[EvidenceDraft] = field(default_factory=list)
    extra: dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> str:
        """Deterministic de-duplication key within a scan."""
        return f"{self.rule}|{self.file_path}|{self.line_start}|{self.line_end}"

    def to_dict(self) -> dict[str, Any]:
        return {
            "tool": self.tool,
            "rule": self.rule,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "severity": self.severity.value,
            "category": self.category.value,
            "message": self.message,
            "confidence": self.confidence,
            "evidence": [e.to_dict() for e in self.evidence],
            "extra": self.extra,
        }


@dataclass
class ToolRun:
    """Result of executing one external static-analysis tool."""

    tool: str
    available: bool
    succeeded: bool = True
    error: str | None = None
    findings: list[StaticFinding] = field(default_factory=list)
    raw_output: str | None = None


# --------------------------------------------------------------------------- LLM + candidates


@dataclass
class LLMUsage:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    estimated_cost_usd: float = 0.0
    redactions: int = 0

    def to_dict(self) -> dict[str, Any]:
        return {
            "calls": self.calls,
            "input_tokens": self.input_tokens,
            "output_tokens": self.output_tokens,
            "estimated_cost_usd": round(self.estimated_cost_usd, 6),
            "redactions": self.redactions,
        }


@dataclass
class LLMResult:
    """A validated, structured response from an LLM provider."""

    content: str
    data: dict[str, Any]
    usage: LLMUsage = field(default_factory=LLMUsage)
    model: str | None = None
    raw: str = ""


@dataclass
class Candidate:
    """One candidate issue moving through the pipeline."""

    key: str
    title: str
    category: FindingCategory
    severity: Severity
    file_path: str
    line_start: int
    line_end: int
    function_name: str | None
    description: str
    static_findings: list[StaticFinding] = field(default_factory=list)
    evidence: list[EvidenceDraft] = field(default_factory=list)
    llm_assessment: dict[str, Any] | None = None
    base_confidence: float = 0.5
    source: str = "static"  # static | llm | hybrid
    grounded: bool = True  # code-grounding check outcome (see evidence validation)

    def to_dict(self) -> dict[str, Any]:
        return {
            "key": self.key,
            "title": self.title,
            "category": self.category.value,
            "severity": self.severity.value,
            "file_path": self.file_path,
            "line_start": self.line_start,
            "line_end": self.line_end,
            "function_name": self.function_name,
            "source": self.source,
            "grounded": self.grounded,
            "confidence": self.base_confidence,
            "llm_assessment": self.llm_assessment,
            "evidence_count": len(self.evidence),
        }
