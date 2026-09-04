"""Natural-language repository query (Tier 2).

Answers questions about a repository *deterministically* from the index that
already exists — code health, git analytics, wiki, architecture, call graph and
the latest scan's findings. Every answer carries the concrete sources it was
computed from, so the response is inspectable rather than model vibes.

Intent detection is keyword-driven; when a provider is configured and the
question is open-ended, the engine can upgrade to an LLM answer grounded in the
same deterministic evidence (injection-safe: repository content is quoted as
data, never as instructions).
"""

from __future__ import annotations

import re
from typing import Any

from app.analysis.knowledge import KnowledgeGraph

_INTENT_RULES: list[tuple[str, tuple[str, ...]]] = [
    ("hotspots", ("hotspot", "churn", "bug-fix", "bug fix", "risky file", "where do bugs")),
    ("ownership", ("owner", "bus factor", "who wrote", "who owns", "author")),
    ("health", ("health", "score", "maintain", "smell", "complex", "bad code", "quality")),
    ("performance", ("performance", "slow", "perf", "hot path")),
    ("wiki", ("what does", "what is", "how does", "explain", "does this file", "what's in")),
    ("callers", ("who calls", "where is", "used by", "caller", "call graph", "dependents")),
    ("dependencies", ("dependenc", "import", "package", "library", "supply chain", "vuln dep")),
    ("architecture", ("architect", "module", "layer", "tangle", "cycle", "diagram")),
    ("findings", ("finding", "issue", "vulnerab", "bug", "defect", "security", "sql", "xss", "rce")),
    ("tests", ("test", "coverage", "pytest", "jest")),
    ("stats", ("how many", "count", "size", "lines", "files", "loc", "symbol")),
    ("recency", ("recent", "last commit", "latest", "newest", "touched")),
]

_INTENT_TITLES: dict[str, str] = {
    "hotspots": "Code hotspots",
    "ownership": "Ownership & bus factor",
    "health": "Code health",
    "performance": "Performance signals",
    "wiki": "File / symbol explanation",
    "callers": "Callers & dependents",
    "dependencies": "Dependencies",
    "architecture": "Architecture",
    "findings": "Latest scan findings",
    "tests": "Tests",
    "stats": "Repository statistics",
    "recency": "Recent activity",
    "unknown": "Repository summary",
}


def detect_intent(question: str) -> str:
    """Map a natural-language question to one of the supported intents."""
    q = question.lower()
    for intent, needles in _INTENT_RULES:
        if any(n in q for n in needles):
            return intent
    return "unknown"


def _answer_hotspots(git: dict[str, Any]) -> dict[str, Any]:
    if not git.get("available"):
        return {"answer": "This repository has no git history (imported as an archive), so hotspots cannot be computed.", "sources": []}
    rows = sorted(git.get("files", []), key=lambda r: r.get("hotspot_score", 0), reverse=True)[:5]
    if not rows:
        return {"answer": "No file activity found in the analyzed commit window.", "sources": []}
    lines = [f"{r['path']} — hotspot {r['hotspot_score']} ({r['bug_fixes']} bug-fix commits, churn {r['churn']})" for r in rows]
    return {
        "answer": "Top code hotspots (recency-weighted churn × bug-fix signals):\n" + "\n".join(f"- {text}" for text in lines),
        "sources": [{"kind": "git", "file": r["path"]} for r in rows],
    }


def _answer_ownership(git: dict[str, Any]) -> dict[str, Any]:
    if not git.get("available"):
        return {"answer": "No git history available, so ownership cannot be computed.", "sources": []}
    rows = sorted(git.get("files", []), key=lambda r: r.get("bus_factor", 0), reverse=True)[:5]
    if not rows:
        return {"answer": "No ownership data in the analyzed window.", "sources": []}
    lines = [
        f"{r['path']} — bus factor {r['bus_factor']} (top author {r['top_author']} at {int(r['top_author_share'] * 100)}%)"
        for r in rows
    ]
    return {
        "answer": "Files with the thinnest ownership (lowest bus factor):\n" + "\n".join(f"- {text}" for text in lines),
        "sources": [{"kind": "git", "file": r["path"]} for r in rows],
    }


def _answer_health(health: dict[str, Any]) -> dict[str, Any]:
    avg = health.get("average_score")
    if avg is None:
        return {"answer": "No parseable files were scored.", "sources": []}
    worst = health.get("refactor_targets", [])[:4]
    lines = []
    for t in worst:
        issues = ", ".join(i["title"] for i in t.get("issues", [])[:2])
        lines.append(f"{t['path']} — score {t['score']}/10 ({issues})")
    answer = f"Average code health is {avg}/10 across {health.get('files_scored')} files. "
    answer += "Worst-scoring files:\n" + "\n".join(f"- {text}" for text in lines) if lines else "No files need attention."
    return {
        "answer": answer,
        "sources": [{"kind": "health", "file": t["path"]} for t in worst],
    }


def _answer_performance(health: dict[str, Any]) -> dict[str, Any]:
    files = health.get("files", [])
    hits = [
        f for f in files
        if any(i.get("lens") == "performance" for i in f.get("issues", []))
    ][:5]
    if not hits:
        return {"answer": "No performance detectors fired — no obvious hot paths found.", "sources": []}
    lines = [f"{f['path']} — {', '.join(i['title'] for i in f['issues'] if i.get('lens') == 'performance')}" for f in hits]
    return {
        "answer": "Files with performance risk:\n" + "\n".join(f"- {text}" for text in lines),
        "sources": [{"kind": "health", "file": f["path"]} for f in hits],
    }


def _answer_wiki(question: str, wiki: dict[str, Any], graph: KnowledgeGraph) -> dict[str, Any]:
    pages = wiki.get("pages", [])
    q = question.lower()
    # try symbol name first (a bare identifier in the question)
    token_re = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b")
    candidates: list[str] = []
    for m in token_re.finditer(q):
        name = m.group(1)
        if name in {"what", "does", "how", "is", "the", "this", "file", "code", "repo", "repository"}:
            continue
        for page in pages:
            for sym in page.get("symbols", []):
                if sym["name"].lower() == name:
                    candidates.append(f"{page['path']}::{sym['name']} ({sym['kind']}, lines {sym['line_start']}-{sym['line_end']})")
    if candidates:
        return {
            "answer": "Matching symbols:\n" + "\n".join(f"- {c}" for c in candidates[:6]),
            "sources": [{"kind": "wiki"}],
        }
    # file-name match
    for page in pages:
        if page["path"].split("/")[-1].lower().replace(".py", "").replace(".js", "") in q:
            summary = page.get("summary") or ""
            doc = page.get("docstring")
            answer = f"{page['path']}: {summary}"
            if doc:
                answer += f"\n\n{doc[:300]}"
            return {"answer": answer, "sources": [{"kind": "wiki", "file": page["path"]}]}
    return {"answer": None, "sources": []}


def _answer_callers(question: str, graph: KnowledgeGraph) -> dict[str, Any]:
    q = question.lower()
    name: str | None = None
    for m in re.finditer(r"\b([a-zA-Z_][a-zA-Z0-9_]{2,})\b", q):
        candidate = m.group(1)
        if candidate in {"who", "calls", "where", "used", "function", "symbol"}:
            continue
        ref = graph.find_qualified(candidate)
        if ref is not None:
            name = candidate
            break
    if name is None:
        return {"answer": None, "sources": []}
    ref = graph.find_qualified(name)
    assert ref is not None
    callers = graph.callers_of_ref(ref)
    if not callers:
        return {"answer": f"No in-repo callers of `{name}` found — it may be an entry point or dead code.", "sources": [{"kind": "graph", "file": ref.file_path}]}
    lines = "\n".join(f"- {c}" for c in callers[:10])
    return {
        "answer": f"`{name}` ({ref.kind}, {ref.file_path}:{ref.line_start}) is called by {len(callers)} symbols:\n{lines}",
        "sources": [{"kind": "graph", "file": ref.file_path}],
    }


def _answer_dependencies(question: str, graph: KnowledgeGraph) -> dict[str, Any]:
    std = {"os", "sys", "re", "json", "sqlite3", "typing", "datetime", "pathlib", "logging", "math", "random", "string", "collections", "functools", "itertools", "time", "abc", "enum", "dataclasses", "contextlib"}
    third_party: dict[str, int] = {}
    for pf in graph.files.values():
        for imp in pf.imports:
            root = imp.module.split(".")[0]
            if root not in std and root != pf.path.split("/")[0]:
                third_party[root] = third_party.get(root, 0) + 1
    if not third_party:
        return {"answer": "No third-party imports detected in the analyzed files.", "sources": []}
    ranked = sorted(third_party.items(), key=lambda kv: -kv[1])[:10]
    lines = "\n".join(f"- {name} ({n} import sites)" for name, n in ranked)
    return {
        "answer": f"Most-used third-party modules ({len(third_party)} total):\n{lines}",
        "sources": [{"kind": "graph"}],
    }


def _answer_architecture(architecture: dict[str, Any]) -> dict[str, Any]:
    nodes = architecture.get("nodes", [])
    edges = architecture.get("edges", [])
    if not nodes:
        return {"answer": "No architecture graph available.", "sources": []}
    layers = max((n.get("layer", 0) for n in nodes), default=0) + 1
    top = sorted(nodes, key=lambda n: n.get("imports", 0), reverse=True)[:5]
    lines = "\n".join(f"- {n['label']} ({n['files']} files, {n['imports']} imports)" for n in top)
    return {
        "answer": f"{len(nodes)} modules across {layers} layers with {len(edges)} inter-module edges. Most connected:\n{lines}",
        "sources": [{"kind": "architecture"}],
    }


def _answer_findings(findings: list[dict[str, Any]]) -> dict[str, Any]:
    if not findings:
        return {"answer": "The latest scan found no findings.", "sources": []}
    by_sev: dict[str, int] = {}
    for f in findings:
        by_sev[f.get("severity", "info")] = by_sev.get(f.get("severity", "info"), 0) + 1
    sev = ", ".join(f"{n} {k}" for k, n in sorted(by_sev.items()))
    lines = "\n".join(f"- [{f.get('severity', '').upper()}] {f.get('title')} — {f.get('file_path')}:{f.get('line_start')} ({f.get('status')}, {int((f.get('confidence') or 0) * 100)}%)" for f in findings[:8])
    return {
        "answer": f"Latest scan: {len(findings)} findings ({sev}).\n{lines}",
        "sources": [{"kind": "finding", "file": f.get("file_path")} for f in findings[:8]],
    }


def _answer_tests(graph: KnowledgeGraph) -> dict[str, Any]:
    test_files = [p for p in graph.files if re.search(r"(^|/)(test_|tests?/|.*\.(test|spec)\.)", p, re.IGNORECASE)]
    if not test_files:
        return {"answer": "No test files detected in the working copy.", "sources": []}
    total_tests = 0
    for p in test_files:
        for sym in graph.symbols_in(p):
            if sym.kind == "function" and (sym.name.startswith("test_") or sym.name.startswith("test")):
                total_tests += 1
    lines = "\n".join(f"- {p}" for p in test_files[:10])
    return {
        "answer": f"{len(test_files)} test files and ~{total_tests} test functions:\n{lines}",
        "sources": [{"kind": "graph", "file": p} for p in test_files[:10]],
    }


def _answer_stats(graph: KnowledgeGraph, health: dict[str, Any]) -> dict[str, Any]:
    files = list(graph.files.values())
    funcs = sum(1 for pf in files for s in pf.symbols if s.kind in ("function", "method"))
    classes = sum(1 for pf in files for s in pf.symbols if s.kind == "class")
    imports = sum(len(pf.imports) for pf in files)
    calls = sum(len(pf.calls) for pf in files)
    lines = sum(len(pf.source.splitlines()) for pf in files)
    answer = (
        f"{len(files)} parseable files · {lines} lines · {funcs} functions/methods · "
        f"{classes} classes · {imports} imports · {calls} call sites."
    )
    return {"answer": answer, "sources": [{"kind": "graph"}]}


def _answer_recency(git: dict[str, Any]) -> dict[str, Any]:
    if not git.get("available"):
        return {"answer": "No git history available.", "sources": []}
    files = sorted(git.get("files", []), key=lambda r: r.get("last_touched", ""), reverse=True)[:5]
    lines = "\n".join(f"- {r['path']} (last touched {r['last_touched']}, {r['commits']} commits)" for r in files)
    return {
        "answer": f"Most recently touched files ({git.get('commits_analyzed')} commits analyzed):\n{lines}",
        "sources": [{"kind": "git", "file": r["path"]} for r in files],
    }


def _answer_unknown(
    question: str, health: dict[str, Any], git: dict[str, Any], graph: KnowledgeGraph
) -> dict[str, Any]:
    avg = health.get("average_score")
    files = len(graph.files)
    hist = "with git history" if git.get("available") else "without git history"
    return {
        "answer": (
            f"I couldn't map that question to a deterministic answer, but here is the "
            f"repository snapshot: {files} parseable files, average health {avg}/10, {hist}. "
            "Ask about hotspots, ownership, health, a specific file or function, dependencies, "
            "architecture, tests, or the latest scan findings."
        ),
        "sources": [{"kind": "health"}],
    }


_HANDLERS = {
    "hotspots": lambda q, c: _answer_hotspots(c["git"]),
    "ownership": lambda q, c: _answer_ownership(c["git"]),
    "health": lambda q, c: _answer_health(c["health"]),
    "performance": lambda q, c: _answer_performance(c["health"]),
    "wiki": lambda q, c: _answer_wiki(q, c["wiki"], c["graph"]),
    "callers": lambda q, c: _answer_callers(q, c["graph"]),
    "dependencies": lambda q, c: _answer_dependencies(q, c["graph"]),
    "architecture": lambda q, c: _answer_architecture(c["architecture"]),
    "findings": lambda q, c: _answer_findings(c["findings"]),
    "tests": lambda q, c: _answer_tests(c["graph"]),
    "stats": lambda q, c: _answer_stats(c["graph"], c["health"]),
    "recency": lambda q, c: _answer_recency(c["git"]),
    "unknown": lambda q, c: _answer_unknown(q, c["health"], c["git"], c["graph"]),
}


def answer_question(
    question: str,
    *,
    graph: KnowledgeGraph,
    health: dict[str, Any],
    git: dict[str, Any],
    wiki: dict[str, Any],
    architecture: dict[str, Any],
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Deterministically answer a natural-language question from the index.

    ``findings`` are lightweight dicts (title/severity/file_path/line_start/
    status/confidence) from the latest completed scan.
    """
    intent = detect_intent(question)
    ctx = {
        "graph": graph,
        "health": health,
        "git": git,
        "wiki": wiki,
        "architecture": architecture,
        "findings": findings,
    }
    result = _HANDLERS[intent](question, ctx)
    if result.get("answer") is None and intent in ("wiki", "callers"):
        result = _answer_unknown(question, health, git, graph)
    return {
        "question": question,
        "intent": intent,
        "intent_title": _INTENT_TITLES[intent],
        "answer": result["answer"],
        "sources": result.get("sources", []),
        "mode": "deterministic",
    }