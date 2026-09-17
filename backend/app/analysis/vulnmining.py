"""Historical vulnerability pattern mining (Tier 3, research feature 21).

Mines git history for *where vulnerabilities came from*: for each finding of
the latest scan we run ``git blame`` on its lines to find the introducing
commit (author, date, subject), then aggregate — who introduces the most
findings, how old the vulnerable lines are, and which file roles keep
repeating.

Archive imports (no history) degrade gracefully with an explicit explanation.
"""

from __future__ import annotations

import re
from collections import Counter
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from app.analysis.process import run_command

_SHA_RE = re.compile(r"\^?[0-9a-f]{7,40}$")

_FIX_SUBJECT_RE = re.compile(
    r"\b(fix|fixes|fixed|repair|patch|resolve|resolves|resolved|bug|hotfix|revert)\b",
    re.IGNORECASE,
)

_FINDING_FN_HINTS = re.compile(
    r"(search|login|auth|query|fetch|load|parse|exec|delete|upload|run)", re.IGNORECASE
)


def _parse_blame_porcelain(stdout: str) -> dict[int, str]:
    """Map final line number -> introducing commit hash from ``git blame`` porcelain."""
    line_sha: dict[int, str] = {}
    current_sha = ""
    final_line = 0
    for raw in stdout.splitlines():
        if not raw.startswith("\t"):
            # block header: <sha> <orig> <final> <count>
            parts = raw.split(" ")
            if len(parts) >= 4 and _SHA_RE.match(parts[0]):
                current_sha = parts[0].lstrip("^")
                try:
                    final_line = int(parts[2])
                except ValueError:
                    continue
        else:
            if final_line and current_sha:
                line_sha[final_line] = current_sha
            final_line += 1
    return line_sha


async def _commit_info(src: Path, sha: str) -> dict[str, Any] | None:
    result = await run_command(
        ["git", "log", "-1", "--pretty=format:%H%x1f%an%x1f%aI%x1f%s", sha],
        cwd=src,
        timeout_seconds=20,
        max_output_chars=4000,
    )
    if not result.ok:
        return None
    parts = (result.stdout or "").split("\x1f")
    if len(parts) < 4:
        return None
    return {"sha": parts[0][:12], "author": parts[1], "date": parts[2], "subject": parts[3]}


def _parse_log_messages(stdout: str) -> list[str]:
    return [s for s in (stdout or "").split("\x00") if s.strip()]


async def _blame_lines(
    src: Path, path: str, line_start: int, line_end: int, revision: str | None = None
) -> list[str]:
    """Blame a line range at a revision; return introducing commit shas (in order)."""
    args = ["git", "blame", "-L", f"{line_start},{line_end}", "--porcelain", "--", path]
    if revision:
        args = ["git", "blame", revision, "-L", f"{line_start},{line_end}", "--porcelain", "--", path]
    blame = await run_command(args, cwd=src, timeout_seconds=30, max_output_chars=200_000)
    if not blame.ok:
        return []
    line_map = _parse_blame_porcelain(blame.stdout or "")
    return list(dict.fromkeys(line_map.values()))


async def mine_vulnerability_history(
    src: Path,
    findings: list[dict[str, Any]],
) -> dict[str, Any]:
    """Blame each finding's lines and aggregate introducing-commit signals."""
    git_dir = src / ".git"
    if not git_dir.exists():
        return {"available": False, "reason": "no_git_history", "findings_analyzed": 0}

    analyzed: list[dict[str, Any]] = []
    authors: Counter[str] = Counter()
    subjects: list[str] = []
    now = datetime.now(UTC)

    for finding in findings:
        path = finding.get("file_path", "")
        line = finding.get("line_start") or finding.get("line") or 1
        line_end = finding.get("line_end") or line
        row: dict[str, Any] = {
            "rule": finding.get("rule") or finding.get("external_id") or "unknown",
            "severity": finding.get("severity", "low"),
            "file_path": path,
            "line_start": line,
        }
        try:
            # blame at HEAD, then walk back through fix-style commits so the
            # reported "introducing" commit is the one that *added* the pattern
            # rather than the last commit that merely touched the same lines.
            shas = await _blame_lines(src, path, line, line_end)
            hops = 0
            while shas and hops < 5:
                info = await _commit_info(src, shas[0])
                if info is None:
                    break
                if not _FIX_SUBJECT_RE.search(info["subject"]):
                    break  # non-fix commit = candidate introducer
                parent_shas = await _blame_lines(src, path, line, line_end, revision=f"{shas[0]}^")
                if not parent_shas or parent_shas == shas:
                    break
                shas = parent_shas
                hops += 1
            if not shas:
                row["status"] = "no_blame"
                analyzed.append(row)
                continue
            info = await _commit_info(src, shas[0])
            if info is None:
                row["status"] = "commit_missing"
                analyzed.append(row)
                continue
            authors[info["author"]] += 1
            subjects.append(info["subject"])
            row.update(
                {
                    "status": "introduced",
                    "introducing_commit": info["sha"],
                    "author": info["author"],
                    "introduced_at": info["date"],
                    "subject": info["subject"],
                }
            )
            try:
                introduced = datetime.fromisoformat(info["date"].replace("Z", "+00:00"))
                row["age_days"] = max(0, int((now - introduced).total_seconds() / 86400))
            except ValueError:
                row["age_days"] = None
            analyzed.append(row)
        except Exception as exc:  # pragma: no cover - defensive
            row["status"] = f"error: {type(exc).__name__}"
            analyzed.append(row)

    introduced = [a for a in analyzed if a.get("status") == "introduced"]
    fix_subjects = [s for s in subjects if _FIX_SUBJECT_RE.search(s)]
    ages = [a["age_days"] for a in introduced if a.get("age_days") is not None]
    repeated_roles = Counter(
        path.rsplit("/", 1)[-1].rsplit(".", 1)[0].lower() for a in introduced for path in [a["file_path"]]
    )

    top_authors = [{"author": name, "introduced_findings": n} for name, n in authors.most_common(10)]
    return {
        "available": True,
        "findings_analyzed": len(analyzed),
        "introduced_findings": len(introduced),
        "top_introducing_authors": top_authors,
        "fix_commits_in_window": len(fix_subjects),
        "median_finding_age_days": round(sum(ages) / len(ages), 1) if ages else None,
        "oldest_finding_age_days": max(ages) if ages else None,
        "repeated_vulnerable_roles": [
            {"file_role": role, "findings": n}
            for role, n in repeated_roles.most_common(8)
            if _FINDING_FN_HINTS.search(role) or n >= 2
        ],
        "findings": introduced,
        "method": "git blame on finding lines + commit-message mining",
    }
