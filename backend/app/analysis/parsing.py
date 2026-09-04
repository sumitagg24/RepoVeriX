"""Tree-sitter based source parsing.

A thin parser abstraction: ``parse_source(language, source, rel_path)`` returns a
``ParsedFile`` with functions/classes/methods, imports and intra-file call
expressions. Adding a language means adding a grammar and node-type handling —
new languages plug in here without touching downstream stages.
"""

from __future__ import annotations

import re
from typing import Any

from app.analysis.models import AnalysisError, CallInfo, ImportInfo, ParsedFile, SymbolInfo

_grammars: dict[str, Any] = {}


def _language_object(name: str) -> Any:
    """Load a tree-sitter Language once per process."""
    if name in _grammars:
        return _grammars[name]
    try:
        from tree_sitter import Language

        if name == "python":
            import tree_sitter_python

            lang = Language(tree_sitter_python.language())
        elif name == "javascript":
            import tree_sitter_javascript

            lang = Language(tree_sitter_javascript.language())
        elif name == "typescript":
            import tree_sitter_typescript

            lang = Language(tree_sitter_typescript.language_typescript())
        else:
            raise AnalysisError(f"Unsupported language for parsing: {name}", code="unsupported_language")
    except ImportError as exc:  # pragma: no cover - depends on install
        raise AnalysisError(
            "Tree-sitter grammar not installed; cannot parse this repository",
            code="parser_unavailable",
        ) from exc
    _grammars[name] = lang
    return lang


def is_supported(language: str) -> bool:
    return language in {"python", "javascript", "typescript"}


def _node_text(node: Any) -> str:
    if node is None:
        return ""
    return node.text.decode("utf-8", errors="replace")


def _child(node: Any, type_name: str) -> Any | None:
    for child in node.children:
        if child.type == type_name:
            return child
    return None


def _name_of(node: Any) -> str:
    """Read a declaration's name via the grammar field, falling back to a child."""
    named = node.child_by_field_name("name")
    if named is not None:
        return _node_text(named)
    for child in node.children:
        if child.type in ("identifier", "type_identifier", "property_identifier"):
            return _node_text(child)
    return ""


def _row(node: Any) -> tuple[int, int]:
    """(start_row, end_row) 0-indexed → convert to 1-indexed inclusive at call site."""
    return node.start_point[0], node.end_point[0]


def _module_path(rel_path: str, language: str) -> str:
    if language == "python":
        if rel_path.endswith(".py"):
            return rel_path[:-3].replace("/", ".").replace("\\", ".")
        if rel_path.endswith(".pyi"):
            return rel_path[:-4].replace("/", ".").replace("\\", ".")
        return rel_path.replace("/", ".")
    return rel_path


# --------------------------------------------------------------------------- import text parsing


def _split_import_items(text: str) -> list[str]:
    """Split an import clause on top-level commas, ignoring brackets/parens."""
    items: list[str] = []
    current: list[str] = []
    depth = 0
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth = max(0, depth - 1)
        if ch == "," and depth == 0:
            items.append("".join(current).strip())
            current = []
        else:
            current.append(ch)
    if current:
        items.append("".join(current).strip())
    return [i for i in items if i]


def _parse_python_import_statement(rel_path: str, line: int, text: str) -> list[ImportInfo]:
    """Parse ``import os, json as js`` style statements from source text."""
    body = text[len("import") :].strip()
    out: list[ImportInfo] = []
    for item in _split_import_items(body):
        parts = item.split(" as ")
        module = parts[0].strip()
        alias = parts[1].strip() if len(parts) > 1 else None
        if not module:
            continue
        imported = alias or module.split(".")[0]
        out.append(
            ImportInfo(
                module=module,
                raw=text,
                imported_names=[imported],
                file_path=rel_path,
                line=line,
            )
        )
    return out


def _parse_python_import_from_statement(rel_path: str, line: int, text: str) -> list[ImportInfo]:
    """Parse ``from X import a, b as c`` (and relative forms) from source text."""
    cleaned = text.replace("\\\n", " ").replace("\n", " ")
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    match = re.match(r"^from\s+([.\w]*)\s+import\s+(.+)$", cleaned)
    if not match:
        # e.g. `from . import x` (module only dots)
        match = re.match(r"^from\s+(\.+)\s+import\s+(.+)$", cleaned)
    if not match:
        return []
    module = match.group(1)
    names_text = match.group(2)
    if names_text.startswith("("):
        names_text = names_text[1:]
    if names_text.endswith(")"):
        names_text = names_text[:-1]
    names_text = names_text.strip()
    imported: list[str] = []
    for item in _split_import_items(names_text):
        if item in {"*"}:
            imported.append("*")
            continue
        parts = item.split(" as ")
        imported.append(parts[1].strip() if len(parts) > 1 else parts[0].strip().split(".")[0])
    imported = [n for n in imported if n]
    if not imported and names_text == "*":
        imported = ["*"]

    # ``from . import utils``: the name is part of the relative module path
    if module and re.fullmatch(r"\.+", module) and not imported == ["*"]:
        return [
            ImportInfo(
                module=f"{module}{name}",
                raw=text,
                imported_names=[name],
                file_path=rel_path,
                line=line,
            )
            for name in imported
        ]
    return [
        ImportInfo(
            module=module,
            raw=text,
            imported_names=imported,
            file_path=rel_path,
            line=line,
        )
    ]


def _walk(node: Any, type_names: set[str]):
    stack = [node]
    while stack:
        current = stack.pop()
        if current.type in type_names:
            yield current
            continue
        stack.extend(reversed(list(current.children)))


def _call_expressions(node: Any):
    return _walk(node, {"call"})


# --------------------------------------------------------------------------- python


def parse_python(source: str, rel_path: str) -> ParsedFile:
    from tree_sitter import Parser

    parser = Parser(_language_object("python"))
    tree = parser.parse(source.encode("utf-8"))
    parsed = ParsedFile(path=rel_path, language="python", source=source)

    module = _module_path(rel_path, "python")
    class_defs = list(_walk(tree.root_node, {"class_definition"}))
    func_defs = list(_walk(tree.root_node, {"function_definition"}))

    # class symbols
    for cls in class_defs:
        name = _name_of(cls)
        s, e = _row(cls)
        qual = f"{module}:{name}"
        decorators = [n for n in cls.children if n.type == "decorator"]
        parsed.symbols.append(
            SymbolInfo(
                kind="class",
                name=name,
                qualified_name=qual,
                file_path=rel_path,
                language="python",
                line_start=s + 1,
                line_end=e + 1,
                extra={
                    "decorators": [_node_text(d) for d in decorators],
                    "module": module,
                },
            )
        )

    # owner class by deepest line-range containment (nodes are not identity-stable)
    class_ranges = [(s.line_start, s.line_end, s.name) for s in parsed.symbols if s.kind == "class"]

    def _owner_class(fn_start: int, fn_end: int) -> str | None:
        candidates = [(cs, ce, name) for (cs, ce, name) in class_ranges if cs <= fn_start and fn_end <= ce]
        if not candidates:
            return None
        return max(candidates, key=lambda c: c[0])[2]

    def _decorators(node: Any) -> list[str]:
        # decorators hang off a decorated_definition wrapper when present
        direct = [n for n in node.children if n.type == "decorator"]
        if direct:
            return [_node_text(d) for d in direct]
        parent = node.parent
        if parent is not None and parent.type == "decorated_definition":
            return [_node_text(d) for d in parent.children if d.type == "decorator"]
        return []

    for fn in func_defs:
        name = _name_of(fn)
        s, e = _row(fn)
        owner_class = _owner_class(s + 1, e + 1)
        kind = "method" if owner_class else "function"
        display = f"{owner_class}.{name}" if owner_class else name
        qual = f"{module}:{display}"
        decorators = _decorators(fn)
        params = _node_text(_child(fn, "parameters"))
        is_async = _node_text(fn).lstrip().startswith("async")
        parsed.symbols.append(
            SymbolInfo(
                kind=kind,
                name=name,
                qualified_name=qual,
                file_path=rel_path,
                language="python",
                line_start=s + 1,
                line_end=e + 1,
                extra={
                    "module": module,
                    "class": owner_class,
                    "async": is_async,
                    "params": params,
                    "decorators": decorators,
                },
            )
        )

    # calls, attributed to the innermost enclosing function/method
    symbols_sorted = sorted(
        (s for s in parsed.symbols if s.kind != "class"), key=lambda x: (x.line_start, x.line_end)
    )
    for call in _call_expressions(tree.root_node):
        line = call.start_point[0] + 1
        enclosing = None
        for sym in symbols_sorted:
            if sym.line_start > line:
                break
            if sym.line_end >= line:
                enclosing = sym
        if enclosing is None:
            continue
        fn_node = call.child_by_field_name("function")
        if fn_node is None:
            for child in call.children:
                if child.type in ("identifier", "attribute", "member_expression", "dotted_name"):
                    fn_node = child
                    break
        name = _node_text(fn_node) if fn_node is not None else ""
        if not name:
            continue
        last = name.split(".")[-1]
        parsed.calls.append(
            CallInfo(
                caller=enclosing.qualified_name,
                callee=last,
                line=line,
                is_attribute="." in name,
            )
        )

    # imports from statement text (robust across grammar shapes)
    for node in _walk(tree.root_node, {"import_statement"}):
        parsed.imports.extend(
            _parse_python_import_statement(rel_path, node.start_point[0] + 1, _node_text(node))
        )
    for node in _walk(tree.root_node, {"import_from_statement"}):
        parsed.imports.extend(
            _parse_python_import_from_statement(rel_path, node.start_point[0] + 1, _node_text(node))
        )
    return parsed


# --------------------------------------------------------------------------- javascript / typescript


_FN_TYPES = {
    "function_declaration",
    "generator_function_declaration",
    "method_definition",
    "arrow_function",
    "function_expression",
}
_CLASS_TYPES = {"class_declaration"}


def parse_javascript(source: str, rel_path: str, language: str) -> ParsedFile:
    from tree_sitter import Parser

    parser = Parser(_language_object(language))
    tree = parser.parse(source.encode("utf-8"))
    parsed = ParsedFile(path=rel_path, language=language, source=source)

    root = tree.root_node

    # collect (kind, node, owner_class_name) tuples in one traversal
    collected: list[tuple[str, Any, str | None]] = []

    def collect(node: Any, owner: str | None = None) -> None:
        for child in node.children:
            if child.type == "export_statement":
                collect(child, owner)
            elif child.type in _CLASS_TYPES:
                name = _name_of(child) or "<anonymous>"
                collected.append(("class", child, owner))
                body = _child(child, "class_body")
                if body is not None:
                    for method in _walk(body, {"method_definition"}):
                        collected.append(("method", method, name))
            elif child.type in _FN_TYPES:
                collected.append(("function", child, owner))
            elif child.type in ("lexical_declaration", "variable_declaration"):
                for decl in _walk(child, {"variable_declarator"}):
                    value = next((c for c in decl.children if c.type in _FN_TYPES), None)
                    if value is not None:
                        collected.append(("function", value, owner))

    collect(root)

    for kind, node, owner_class in collected:
        if kind == "class":
            s, e = _row(node)
            parsed.symbols.append(
                SymbolInfo(
                    kind="class",
                    name=_name_of(node) or "<anonymous>",
                    qualified_name=f"{rel_path}#{_name_of(node) or '<anonymous>'}",
                    file_path=rel_path,
                    language=language,
                    line_start=s + 1,
                    line_end=e + 1,
                    extra={"exported": _is_exported(node)},
                )
            )
            continue
        if node.type in ("arrow_function", "function_expression"):
            name = ""
            parent = node.parent
            if parent is not None and parent.type == "variable_declarator":
                name = _name_of(parent)
                if "." in name:
                    name = name.split(".")[-1]
            if not name and node.type == "function_expression":
                name = _name_of(node) or "<anonymous>"
            if not name:
                continue
        else:
            name = _name_of(node) or "<anonymous>"
        s, e = _row(node)
        fn_kind = "method" if kind == "method" else "function"
        display = f"{owner_class}.{name}" if owner_class else name
        parsed.symbols.append(
            SymbolInfo(
                kind=fn_kind,
                name=name,
                qualified_name=f"{rel_path}#{display}",
                file_path=rel_path,
                language=language,
                line_start=s + 1,
                line_end=e + 1,
                extra={"class": owner_class, "exported": _is_exported(node)},
            )
        )

    # imports
    for imp in _walk(root, {"import_statement"}):
        source_str = ""
        imported_names: list[str] = []
        for child in imp.children:
            if child.type == "string":
                source_str = _node_text(child)[1:-1]
        clause = _child(imp, "import_clause")
        if clause is not None:
            for ident in _walk(clause, {"identifier", "property_identifier"}):
                imported_names.append(_node_text(ident))
            ns = _child(clause, "namespace_import")
            if ns is not None:
                imported_names.append(_node_text(_child(ns, "identifier") or ""))
        if not source_str:
            continue
        parsed.imports.append(
            ImportInfo(
                module=source_str,
                raw=_node_text(imp),
                imported_names=[n for n in imported_names if n],
                file_path=rel_path,
                line=imp.start_point[0] + 1,
            )
        )

    # calls attributed to innermost function/method
    symbols_sorted = sorted(
        (s for s in parsed.symbols if s.kind != "class"), key=lambda x: (x.line_start, x.line_end)
    )
    for call in _walk(root, {"call_expression", "new_expression"}):
        line = call.start_point[0] + 1
        enclosing = None
        for sym in symbols_sorted:
            if sym.line_start > line:
                break
            if sym.line_end >= line:
                enclosing = sym
        if enclosing is None:
            continue
        fn_node = call.child_by_field_name("function")
        if fn_node is None and call.type == "new_expression":
            fn_node = call.child_by_field_name("constructor")
        if fn_node is None:
            for child in call.children:
                if child.type in ("identifier", "member_expression"):
                    fn_node = child
                    break
        name = _node_text(fn_node) if fn_node is not None else ""
        if not name:
            continue
        last = name.split(".")[-1]
        parsed.calls.append(
            CallInfo(
                caller=enclosing.qualified_name,
                callee=last,
                line=line,
                is_attribute="." in name,
            )
        )

    return parsed


def _is_exported(fn: Any) -> bool:
    parent = fn.parent
    return parent is not None and parent.type == "export_statement"


def parse_source(source: str, language: str, rel_path: str) -> ParsedFile:
    """Parse a source string with the parser registered for ``language``."""
    if language == "python":
        return parse_python(source, rel_path)
    if language in ("javascript", "typescript"):
        return parse_javascript(source, rel_path, language)
    raise AnalysisError(f"Unsupported language: {language}", code="unsupported_language")
