"""Pull-request auditing pipeline (deterministic, repository-evidence based).

Workflow for ``POST /repositories/{id}/pull-requests/analyze``:

1. fetch the PR's head ref (and base ref) into the repository clone
2. compute the ``base...head`` diff
3. check out HEAD in a temporary worktree
4. parse the tree and run the change-impact engine (0-100 risk, blast radius,
   affected APIs, security/auth and database context, tests, churn)
5. run the static detectors on the *changed files only*, but ground each
   candidate with repository-level evidence (callers from the knowledge graph,
   source->transformation->sink chains) via the normal evidence engine
6. flag regression risks: previous scan findings whose file/line this diff
   touches
7. assemble the structured review + per-file inline comments (line-anchored to
   added lines so GitHub accepts them when the review is posted)

The change is never audited in isolation — a changed line may affect callers
elsewhere, which is exactly what the impact engine and caller enrichment
capture. Everything here is deterministic; no LLM is required.
"""

from __future__ import annotations

import shutil
from pathlib import Path

from app.analysis import changes
from app.analysis.discovery import walk_repo_files
from app.analysis.evidence import candidates_from_static, finalize_candidate
from app.analysis.intel import _language_of
from app.analysis.knowledge import KnowledgeGraph
from app.analysis.models import ParsedFile
from app.analysis.orchestrate import enrich_candidates_with_callers
from app.analysis.parsing import is_supported, parse_source
from app.analysis.process import run_command
from app.core.config import Settings, get_settings
from app.db.models import Finding, Repository

_FETCH_TIMEOUT = 300


async def ensure_git_backed(repository: Repository) -> Path:
    """Return the clone path or raise ValueError when the repo has no git history."""
    src = Path(repository.storage_path) if repository.storage_path else None
    if src is None or not src.exists():
        raise ValueError("repository has no local working copy")
    if not (src / ".git").exists():
        raise ValueError(
            "PR auditing requires a git-backed GitHub repository "
            "(archives and zip uploads have no commit history to compare)"
        )
    return src


def _auth_clone_url(owner: str, repo: str, token: str | None, *, provider: str = "github") -> str:
    if provider == "gitlab":
        host = "gitlab.com"  # overridden at call-site when self-hosted
        if token:
            return f"https://oauth2:{token}@{host}/{owner}/{repo}.git"
        return f"https://{host}/{owner}/{repo}.git"
    # GitHub (default)
    if token:
        return f"https://x-access-token:{token}@github.com/{owner}/{repo}.git"
    return f"https://github.com/{owner}/{repo}.git"


async def _git(
    src: Path, args: list[str], *, timeout: int = _FETCH_TIMEOUT, max_output: int = 600_000
) -> str:
    result = await run_command(["git", *args], cwd=src, timeout_seconds=timeout, max_output_chars=max_output)
    if not result.ok:
        raise ValueError((result.stderr or result.stdout or "git failed")[-500:])
    return result.stdout


async def prepare_commits(
    src: Path,
    pr,
    *,
    owner: str,
    repo: str,
    token: str | None,
) -> tuple[str, str, str, str]:
    """Fetch base + head refs for a **GitHub** PR; returns (base_ref, base_sha, head_ref, head_sha)."""
    base_ref, base_sha = pr.base_ref, pr.base_sha
    head_ref, head_sha = pr.head_ref, pr.head_sha
    fetch_url = _auth_clone_url(owner, repo, token, provider="github")
    # HEAD of the PR: refs/pull/N/head on GitHub
    try:
        await _git(
            src,
            ["fetch", "--no-tags", fetch_url, f"+refs/pull/{pr.number}/head:refs/rvx/pr/{pr.number}"],
        )
    except ValueError as exc:
        raise ValueError(
            "could not fetch the pull request head — is the repository private "
            "and is GitHub connected / REPOVERIX_GITHUB_TOKEN set?"
        ) from exc
    # Ensure the base commit is present (fetch its branch ref first, then the sha)
    try:
        await _git(
            src,
            ["fetch", "--no-tags", fetch_url, f"+refs/heads/{base_ref}:refs/remotes/rvx-base/{base_ref}"],
        )
    except ValueError:
        pass  # base may already be local, fall through to the sha fetch below
    try:
        await _git(src, ["cat-file", "-e", f"{base_sha}^{{commit}}"], timeout=30)
    except ValueError:
        try:
            await _git(src, ["fetch", "--no-tags", fetch_url, base_sha], timeout=180)
        except ValueError as exc:
            raise ValueError(f"could not fetch the PR base commit {base_sha[:8]}") from exc
    return base_ref, base_sha, head_ref, head_sha


async def prepare_commits_gitlab(
    src: Path,
    mr,
    *,
    host: str,
    namespace: str,
    repo: str,
    token: str | None,
) -> tuple[str, str, str, str]:
    """Fetch base + head refs for a **GitLab** MR; returns (base_ref, base_sha, head_ref, head_sha).

    GitLab exposes ``diff_refs.base_sha`` / ``diff_refs.head_sha`` directly in
    the MR payload, so we just ensure both commits are present in the clone.
    """
    base_sha = mr.base_sha
    head_sha = mr.head_sha
    source_branch = mr.source_branch
    target_branch = mr.target_branch

    if token:
        fetch_url = f"https://oauth2:{token}@{host}/{namespace}/{repo}.git"
    else:
        fetch_url = f"https://{host}/{namespace}/{repo}.git"

    try:
        await _git(
            src,
            [
                "fetch",
                "--no-tags",
                fetch_url,
                f"+refs/heads/{source_branch}:refs/rvx/gl-mr/{source_branch}",
            ],
        )
    except ValueError as exc:
        raise ValueError(
            f"could not fetch the MR source branch '{source_branch}' — is the project private "
            "and is GitLab connected / REPOVERIX_GITLAB_TOKEN set?"
        ) from exc

    try:
        await _git(src, ["cat-file", "-e", f"{base_sha}^{{commit}}"], timeout=30)
    except ValueError:
        try:
            await _git(
                src,
                [
                    "fetch",
                    "--no-tags",
                    fetch_url,
                    f"+refs/heads/{target_branch}:refs/remotes/rvx-gl-base/{target_branch}",
                ],
                timeout=180,
            )
        except ValueError as exc:
            raise ValueError(f"could not fetch the MR base commit {base_sha[:8]}") from exc

    return target_branch, base_sha, source_branch, head_sha


async def open_worktree(src: Path, head_sha: str, tag: str) -> Path:
    """Detached checkout of ``head_sha``; returns the worktree path."""
    settings = get_settings()
    base = Path(settings.pr_worktree_dir)
    base.mkdir(parents=True, exist_ok=True)
    wt = base / f"{tag}-{head_sha[:8]}"
    if wt.exists():
        shutil.rmtree(wt, ignore_errors=True)
    try:
        await _git(src, ["worktree", "add", "--detach", "--force", str(wt), head_sha], timeout=180)
    except ValueError as exc:
        await _git(src, ["worktree", "prune"], timeout=30)
        raise ValueError(f"could not create the head worktree: {exc}") from exc
    return wt


async def close_worktree(src: Path, wt: Path) -> None:
    try:
        await _git(src, ["worktree", "remove", "--force", str(wt)], timeout=60)
    except ValueError:
        shutil.rmtree(wt, ignore_errors=True)
    finally:
        try:
            await _git(src, ["worktree", "prune"], timeout=30)
        except ValueError:
            pass


def parse_tree(src: Path, settings: Settings | None = None) -> dict[str, ParsedFile]:
    """Parse supported source files of a working copy (bounded), rel-path keyed."""
    settings = settings or get_settings()
    parsed: dict[str, ParsedFile] = {}
    files_raw, _ = walk_repo_files(src)
    for full in files_raw[: settings.intel_max_files]:
        lang = _language_of(full)
        if lang is None or not is_supported(lang):
            continue
        rel = full.relative_to(src).as_posix()
        try:
            parsed[rel] = parse_source(full.read_text(encoding="utf-8", errors="replace"), lang, rel)
        except Exception:
            continue
    return parsed


def detect_changed_files(
    parsed: dict[str, ParsedFile],
    changed_files: list[str],
):
    """Deterministic findings over changed files, grounded with graph evidence."""
    from app.analysis import detectors

    changed = {f for f in changed_files if f in parsed}
    if not changed:
        return [], KnowledgeGraph([])
    pfs = [parsed[f] for f in sorted(changed)]
    static_findings = detectors.run_detectors(pfs)
    graph = KnowledgeGraph(list(parsed.values()))
    candidates = candidates_from_static(static_findings, graph, parsed)
    enriched = enrich_candidates_with_callers(candidates, graph)
    specs = []
    for candidate in enriched:
        spec = finalize_candidate(candidate, None, llm_used=False, config_name="static_only")
        if spec is not None:
            specs.append(spec)
    return specs, graph


def _spec_dict(spec) -> dict:
    rule: str | None = (spec.extra or {}).get("rule")
    for node in spec.evidence:
        extra = getattr(node, "extra", None) or {}
        candidate_rule = extra.get("rule")
        if isinstance(candidate_rule, str) and candidate_rule:
            rule = candidate_rule
            break
    return {
        "external_id": spec.external_id,
        "title": spec.title,
        "category": spec.category.value,
        "severity": spec.severity.value,
        "status": spec.status.value,
        "confidence": round(spec.confidence, 3),
        "file_path": spec.file_path,
        "function_name": spec.function_name,
        "line_start": spec.line_start,
        "line_end": spec.line_end,
        "description": spec.description[:1000],
        "recommendation": (spec.recommendation or "")[:1000],
        "rule": rule,
        "evidence": [
            {
                "kind": node.kind.value,
                "file_path": node.file_path,
                "line_start": node.line_start,
                "line_end": node.line_end,
                "snippet": node.snippet,
                "description": node.description[:500],
            }
            for node in spec.evidence
        ],
    }


def _added_lines_for_file(hunks: list[changes.DiffHunk], file: str) -> set[int]:
    for hunk in hunks:
        if hunk.file == file:
            return hunk.added_lines
    return set()


def build_inline_comments(findings: list[dict], hunks: list[changes.DiffHunk]) -> list[dict]:
    """Line comments only where the finding anchors on an *added* diff line."""
    comments: list[dict] = []
    for finding in findings:
        line = finding.get("line_start")
        if not line:
            continue
        added = _added_lines_for_file(hunks, finding["file_path"])
        if line not in added:
            continue
        body = (
            f"**{finding['title']}** — {finding['severity'].upper()} / {finding['status'].upper()} "
            f"(confidence {finding['confidence']:.0%}, rule {finding.get('rule') or 'n/a'})\n\n"
            f"{finding['description'][:600]}"
        )
        if finding.get("recommendation"):
            body += f"\n\nSuggested fix: {finding['recommendation'][:300]}"
        comments.append({"path": finding["file_path"], "line": line, "body": body[:4000]})
    return comments


async def analyze_pull_request(
    *,
    repository: Repository,
    src: Path,
    pr,
    hunks: list[changes.DiffHunk],
    wt: Path,
    previous_findings: list[Finding] | None = None,
    settings: Settings | None = None,
) -> dict:
    """Assemble the structured review from a prepared diff + head worktree."""
    settings = settings or get_settings()
    parsed = parse_tree(wt, settings)
    health_by_file: dict[str, float] | None = None
    insight = getattr(repository, "insight", None)
    if insight is not None and insight.health:
        health_by_file = {f["path"]: float(f["score"]) for f in (insight.health.get("files") or [])}

    impact = await changes.analyze_change(
        wt,
        parsed,
        hunks,
        health_by_file=health_by_file,
    )
    specs, _graph = detect_changed_files(parsed, impact["changed_files"])
    finding_dicts = [_spec_dict(s) for s in specs]

    # regression risks: previous repository findings this diff touches
    regression_risks: list[dict] = []
    changed_set = set(impact["changed_files"])
    added_by_file = {h.file: h.added_lines for h in hunks}
    for prev in previous_findings or []:
        if prev.file_path not in changed_set:
            continue
        touched_lines = added_by_file.get(prev.file_path, set())
        prev_lines = range(prev.line_start or 0, (prev.line_end or prev.line_start or 0) + 1)
        overlap = bool(touched_lines & set(prev_lines))
        regression_risks.append(
            {
                "external_id": prev.external_id,
                "title": prev.title,
                "category": prev.category.value,
                "severity": prev.severity.value,
                "status": prev.status.value,
                "file_path": prev.file_path,
                "line_start": prev.line_start,
                "line_end": prev.line_end,
                "line_touched": overlap,
                "note": (
                    "the diff modifies lines inside this previously-reported defect"
                    if overlap
                    else "the diff modifies a file that previously contained this defect"
                ),
            }
        )
    regression_risks.sort(key=lambda r: (not r["line_touched"], r["file_path"]))

    changed_areas = sorted({p.split("/")[0] for p in impact["changed_files"]})
    summary_lines = [
        f"{len(impact['changed_files'])} file(s) changed "
        f"(+{impact['added_lines']}/-{impact['removed_lines']} lines) across "
        f"{len(changed_areas)} area(s): {', '.join(changed_areas)}.",
        f"Change risk {impact['risk_score']}/100 ({impact['risk_level'].upper()}).",
    ]
    if impact["blast_radius"]["caller_count"]:
        summary_lines.append(
            f"{impact['blast_radius']['caller_count']} callers outside the diff could be affected "
            "(blast radius over the call graph)."
        )
    if impact.get("affected_apis"):
        summary_lines.append(f"{len(impact['affected_apis'])} API endpoint registration(s) in changed files.")
    if impact["tests_to_run"]:
        summary_lines.append("Tests to run: " + ", ".join(impact["tests_to_run"][:6]) + ".")
    if regression_risks:
        summary_lines.append(
            f"{len(regression_risks)} previously-reported finding(s) sit in changed code "
            f"({sum(1 for r in regression_risks if r['line_touched'])} directly line-touched)."
        )
    if impact.get("missing_companion_files"):
        summary_lines.append(
            "History usually co-changes: " + ", ".join(impact["missing_companion_files"][:5]) + "."
        )

    comments = build_inline_comments(finding_dicts, hunks)
    return {
        "pr": {
            "number": pr.number,
            "title": pr.title,
            "author": pr.author,
            "state": pr.state,
            "html_url": pr.html_url,
            "base_ref": pr.base_ref,
            "base_sha": pr.base_sha,
            "head_ref": pr.head_ref,
            "head_sha": pr.head_sha,
        },
        "risk_score": impact["risk_score"],
        "risk_level": impact["risk_level"],
        "risk_components": impact["risk_components"],
        "risk_factors": impact["risk_factors"],
        "risk_formula": impact["risk_formula"],
        "summary": " ".join(summary_lines),
        "summary_lines": summary_lines,
        "stats": {
            "files": len(impact["changed_files"]),
            "added_lines": impact["added_lines"],
            "removed_lines": impact["removed_lines"],
            "findings": len(finding_dicts),
            "verified_findings": sum(1 for f in finding_dicts if f["status"] == "verified"),
            "probable_findings": sum(1 for f in finding_dicts if f["status"] == "probable"),
            "comments": len(comments),
            "regression_risks": len(regression_risks),
        },
        "changed_files": impact["changed_files"],
        "changed_symbols": impact["changed_symbols"],
        "blast_radius": impact["blast_radius"],
        "affected_apis": impact.get("affected_apis", []),
        "security_context": impact.get("security_context", {}),
        "tests_to_run": impact["tests_to_run"],
        "missing_companion_files": impact["missing_companion_files"],
        "findings": finding_dicts,
        "regression_risks": regression_risks,
        "comments": comments,
        "directives": impact["directives"],
    }
