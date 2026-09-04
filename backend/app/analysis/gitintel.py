"""Git history intelligence: hotspots, ownership, co-change, bus factor.

Runs ``git log`` over the repository's working copy (kept by the ingestion
stage for git clones; archives/zip uploads have no history and report
``available: false``). Everything is deterministic — no LLM.

Signals produced per file:

- **hotspot score**: decayed churn (commits touching the file, weighted by
  recency) plus bug-fix commits (subjects matching fix/bug/repair patterns).
- **ownership**: commit shares per author → bus factor (1 / max share).
- **co-change coupling**: files that changed together in the same commits —
  coupling no import graph shows.
"""

from __future__ import annotations

import re
from collections import Counter, defaultdict
from datetime import UTC, datetime
from pathlib import Path

from app.analysis.process import run_command

__all__ = ["analyze_git_history"]

_LOG_FORMAT = "%x1e%H%x1f%an%x1f%aI%x1f%s"  # \x1e *prefixes* each record
_FIX_SUBJECT_RE = re.compile(r"\b(fix(es|ed)?|bug(fix)?|repair|hotfix|correct|resolve[ds]?)\b", re.IGNORECASE)
_MAX_COMMITS = 4000
_MAX_FILES_PER_COMMIT = 40
_MAX_COCHANGE_PAIRS = 2000


def _parse_log(stdout: str) -> list[dict[str, object]]:
    """Parse ``git log --pretty=<format> --name-only`` output into commits.

    The ``\x1e`` separator *prefixes* every record, so each chunk is
    ``<header line>\n<file list>\n`` (``--name-only`` appends the file list
    after the pretty line).
    """
    commits: list[dict[str, object]] = []
    for chunk in stdout.split("\x1e"):
        chunk = chunk.strip("\n")
        if not chunk:
            continue
        lines = chunk.splitlines()
        header = lines[0]
        parts = header.split("\x1f")
        if len(parts) < 4:
            continue
        files = [f for f in lines[1:] if f and not f.startswith(".")]
        if not files:
            continue
        commits.append(
            {
                "sha": parts[0],
                "author": parts[1],
                "date": parts[2],
                "subject": parts[3],
                "files": files[:_MAX_FILES_PER_COMMIT],
            }
        )
    return commits


def _decay_weight(date_iso: str, now: datetime) -> float:
    """Recency weight: 1.0 for the newest commits, ~0.4 at the window edge."""
    try:
        commit_time = datetime.fromisoformat(date_iso.replace("Z", "+00:00"))
    except ValueError:
        return 0.5
    if commit_time.tzinfo is None:
        commit_time = commit_time.replace(tzinfo=UTC)
    age_days = max(0.0, (now - commit_time).total_seconds() / 86400.0)
    return max(0.1, 1.0 - age_days / 365.0)


async def analyze_git_history(src: Path) -> dict:
    """Compute git analytics for the working copy at ``src``.

    Never raises on git problems: returns ``available: false`` with a reason
    so callers can degrade gracefully.
    """
    git_dir = src / ".git"
    if not git_dir.exists():
        return {"available": False, "reason": "no_git_history"}

    result = await run_command(
        [
            "git",
            "log",
            "--pretty=format:" + _LOG_FORMAT,
            "--name-only",
            "-" + str(_MAX_COMMITS),
        ],
        cwd=src,
        timeout_seconds=60,
        max_output_chars=1_500_000,
    )
    if not result.ok:
        return {"available": False, "reason": "git_error", "error": (result.stderr or result.stdout)[:300]}

    commits = _parse_log(result.stdout)
    if not commits:
        return {"available": False, "reason": "no_commits"}

    now = datetime.now(UTC)
    commits = commits[:_MAX_COMMITS]

    file_commits: Counter[str] = Counter()
    file_bug_fixes: Counter[str] = Counter()
    file_first_seen: dict[str, str] = {}
    file_last_seen: dict[str, str] = {}
    author_commits: Counter[str] = Counter()
    author_file_shares: dict[str, Counter[str]] = defaultdict(Counter)
    cochange: Counter[tuple[str, str]] = Counter()
    commits_30d = 0

    for commit in commits:
        files = commit["files"]
        assert isinstance(files, list)
        author = str(commit["author"])
        date_iso = str(commit["date"])
        is_fix = bool(_FIX_SUBJECT_RE.search(str(commit["subject"])))
        author_commits[author] += 1
        try:
            age = (now - datetime.fromisoformat(date_iso.replace("Z", "+00:00"))).days
        except ValueError:
            age = 999
        if age <= 30:
            commits_30d += 1
        weight = _decay_weight(date_iso, now)

        for path in files:
            file_commits[path] += weight
            if is_fix:
                file_bug_fixes[path] += 1
            file_first_seen.setdefault(path, date_iso)
            file_last_seen[path] = date_iso
            author_file_shares[path][author] += 1

        if len(files) >= 2:
            for i in range(len(files)):
                for j in range(i + 1, len(files)):
                    cochange[(files[i], files[j])] += 1

    # per-file aggregates
    file_rows: list[dict] = []
    for path, churn in file_commits.most_common():
        shares = author_file_shares[path]
        total = sum(shares.values()) or 1
        top_author, top_share = shares.most_common(1)[0]
        bus_factor = round(1.0 / (top_share / total), 2)
        file_rows.append(
            {
                "path": path,
                "churn": round(churn, 2),
                "commits": int(total),
                "bug_fixes": file_bug_fixes[path],
                "hotspot_score": round(churn * 0.7 + file_bug_fixes[path] * 1.5, 2),
                "bus_factor": bus_factor,
                "top_author": top_author,
                "top_author_share": round(top_share / total, 3),
                "last_touched": file_last_seen[path][:10],
            }
        )

    top_pairs = [{"files": [a, b], "co_changes": n} for (a, b), n in cochange.most_common(15)]

    return {
        "available": True,
        "commits_analyzed": len(commits),
        "authors": len(author_commits),
        "top_authors": [{"name": name, "commits": n} for name, n in author_commits.most_common(8)],
        "commits_last_30d": commits_30d,
        "files": file_rows[:200],
        "hotspots": sorted(file_rows, key=lambda r: r["hotspot_score"], reverse=True)[:15],
        "co_change": top_pairs,
        "bus_factor_worst": sorted(file_rows, key=lambda r: r["bus_factor"])[:10],
    }
