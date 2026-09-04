"""Repository knowledge layer.

Builds the symbol graph from parsed files:

- which file each symbol lives in (by simple and qualified name)
- which files import which other files
- which function calls which other function (resolved through imports)

This graph powers the LLM context builder: for a candidate issue we can answer
"who calls this function", "what does this function call", and "which files
import this one" without re-reading the whole repository.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.analysis.models import ParsedFile

PY_IMPORT_MODULES = {
    "os",
    "sys",
    "re",
    "json",
    "subprocess",
    "sqlite3",
    "hashlib",
    "random",
    "string",
    "datetime",
    "time",
    "typing",
    "collections",
    "functools",
    "itertools",
    "pathlib",
    "logging",
    "math",
    "argparse",
    "http",
    "urllib",
    "socket",
    "threading",
    "asyncio",
    "unittest",
    "pytest",
    "abc",
    "enum",
    "dataclasses",
    "contextlib",
    "base64",
    "hmac",
    "secrets",
    "flask",
    "django",
    "fastapi",
    "requests",
    "boto3",
    "numpy",
    "pandas",
}


@dataclass
class SymbolRef:
    """Resolved definition of a symbol."""

    name: str
    qualified_name: str
    file_path: str
    language: str
    kind: str
    line_start: int
    line_end: int
    extra: dict = field(default_factory=dict)


class KnowledgeGraph:
    """Index over all parsed files of one scan."""

    def __init__(self, parsed_files: list[ParsedFile]):
        self.files: dict[str, ParsedFile] = {pf.path: pf for pf in parsed_files}
        # name -> list of refs (simple + qualified indexing)
        self._by_name: dict[str, list[SymbolRef]] = {}
        # (file_path, name) -> refs defined in that file
        self._file_symbols: dict[str, list[SymbolRef]] = {}
        # file -> imported file paths (when resolvable inside the repo)
        self._file_imports: dict[str, set[str]] = {}
        # qualified caller -> [(callee_name, line)]
        self._calls: dict[str, list[tuple[str, int]]] = {}
        # callee simple name -> caller qualified names (resolved where possible)
        self._callers_by_simple: dict[str, set[str]] = {}
        self._callers_by_file_line: dict[tuple[str, int], set[str]] = {}

        self._index()

    # ------------------------------------------------------------- indexing
    def _index(self) -> None:
        for path, pf in self.files.items():
            for sym in pf.symbols:
                ref = SymbolRef(
                    name=sym.name,
                    qualified_name=sym.qualified_name,
                    file_path=path,
                    language=pf.language,
                    kind=sym.kind,
                    line_start=sym.line_start,
                    line_end=sym.line_end,
                    extra=sym.extra,
                )
                self._by_name.setdefault(sym.name, []).append(ref)
                self._by_name.setdefault(sym.qualified_name, []).append(ref)
                self._file_symbols.setdefault(path, []).append(ref)
            for imp in pf.imports:
                target = self.resolve_import(path, imp.module)
                if target:
                    self._file_imports.setdefault(path, set()).add(target)
            for call in pf.calls:
                self._calls.setdefault(call.caller, []).append((call.callee, call.line))
                self._callers_by_simple.setdefault(call.callee, set()).add(call.caller)

        # resolve callers by (file, line): the function defined at that location
        for caller_q, callees in self._calls.items():
            caller_ref = self.find_qualified(caller_q)
            if caller_ref is None:
                continue
            for callee_name, _call_line in callees:
                resolved = self.resolve_callee(caller_ref.file_path, callee_name)
                if resolved:
                    self._callers_by_file_line.setdefault(
                        (resolved.file_path, resolved.line_start), set()
                    ).add(caller_q)

    # ------------------------------------------------------------- queries
    def file_imports(self, file_path: str) -> list[str]:
        return sorted(self._file_imports.get(file_path, set()))

    def files_importing(self, file_path: str) -> list[str]:
        return sorted(p for p, targets in self._file_imports.items() if file_path in targets)

    def symbols_in(self, file_path: str) -> list[SymbolRef]:
        return list(self._file_symbols.get(file_path, []))

    def function_symbols(self, file_path: str) -> list[SymbolRef]:
        return [r for r in self._file_symbols.get(file_path, []) if r.kind in ("function", "method")]

    def find_qualified(self, qualified_name: str) -> SymbolRef | None:
        refs = self._by_name.get(qualified_name)
        if not refs:
            return None
        return refs[0]

    def resolve_callee(self, caller_file: str, callee_name: str) -> SymbolRef | None:
        """Resolve a call by simple name from the caller file's perspective."""
        if callee_name in {"print", "len", "range", "type", "isinstance", "super", "self"}:
            return None
        candidates = self._by_name.get(callee_name, [])
        if not candidates:
            return None
        same_file = [c for c in candidates if c.file_path == caller_file]
        if same_file:
            return same_file[0]
        # a symbol imported into this file
        pf = self.files.get(caller_file)
        if pf:
            imported = {n for imp in pf.imports for n in imp.imported_names}
            for c in candidates:
                if c.name == callee_name and callee_name in imported:
                    return c
        return None

    def callers_of_ref(self, ref: SymbolRef) -> list[str]:
        return sorted(self._callers_by_file_line.get((ref.file_path, ref.line_start), set()))

    def callees_of_ref(self, ref: SymbolRef) -> list[SymbolRef]:
        out: list[SymbolRef] = []
        for callee_name, _line in self._calls.get(ref.qualified_name, []):
            resolved = self.resolve_callee(ref.file_path, callee_name)
            if resolved:
                out.append(resolved)
        return out

    def calls_in(self, file_path: str, line_start: int, line_end: int) -> list[tuple[str, int]]:
        """Call expressions inside a line range of a file (simple name, line)."""
        pf = self.files.get(file_path)
        if not pf:
            return []
        return [(c.callee, c.line) for c in pf.calls if line_start <= c.line <= line_end]  # noqa: E501

    def import_graph_path(self, start_file: str, end_file: str, max_depth: int = 6) -> list[str]:
        """BFS shortest path start_file -> ... -> end_file through file imports."""
        if start_file == end_file:
            return [start_file]
        queue: list[tuple[str, list[str]]] = [(start_file, [start_file])]
        visited = {start_file}
        while queue:
            current, path = queue.pop(0)
            if len(path) >= max_depth:
                continue
            for target in self._file_imports.get(current, set()):
                if target in visited:
                    continue
                visited.add(target)
                new_path = path + [target]
                if target == end_file:
                    return new_path
                queue.append((target, new_path))
        return []

    # ------------------------------------------------------------- resolution
    def resolve_import(self, source_file: str, module: str) -> str | None:
        """Map an import statement to an in-repo file path (or None for 3rd party)."""
        lang = self.files[source_file].language if source_file in self.files else None
        if module in PY_IMPORT_MODULES or module.split(".")[0] in PY_IMPORT_MODULES:
            return None
        if lang == "python":
            return self._resolve_python_import(source_file, module)
        return self._resolve_js_import(source_file, module)

    def _resolve_python_import(self, source_file: str, module: str) -> str | None:
        # relative: count leading dots -> move up directories
        parts = module.split(".")
        up = 0
        while parts and parts[0] == "":
            up += 1
            parts.pop(0)
        base_dir = _parent_dir(source_file, up)
        rel = "/".join(parts)
        candidates = [
            f"{base_dir}/{rel}.py" if base_dir else f"{rel}.py",
            f"{base_dir}/{rel}/__init__.py" if base_dir else f"{rel}/__init__.py",
        ]
        for candidate in candidates:
            candidate = candidate.replace("\\", "/").lstrip("/")
            if candidate in self.files:
                return candidate
        # top-level relative to repo root
        if base_dir:
            for candidate in (f"{rel}.py", f"{rel}/__init__.py"):
                if candidate in self.files:
                    return candidate
        return None

    def _resolve_js_import(self, source_file: str, module: str) -> str | None:
        if not module.startswith("."):
            return None  # bare package -> npm dependency
        segs = module.split("/")
        ups = 0
        while segs and segs[0] in (".", ".."):
            if segs[0] == "..":
                ups += 1
            segs.pop(0)
        base_dir = _parent_dir(source_file, ups)
        rel = "/".join(segs)
        rel_path = f"{base_dir}/{rel}" if base_dir else rel
        for ext in [
            "",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".mjs",
            ".cjs",
            ".d.ts",
            "/index.ts",
            "/index.js",
        ]:
            candidate = rel_path + ext
            if candidate in self.files:
                return candidate
        return None


def _join_rel(base: str, tail: str) -> str:
    if not base:
        return tail
    return f"{base}/{tail}"


def _parent_dir(source_file: str, up: int) -> str:
    parts = source_file.split("/")
    if up <= 0:
        return "/".join(parts[:-1])
    parts = parts[: -(up + 1)]
    return "/".join(parts)
