"""Unified diff generation and application.

The repair pipeline must never mutate the original repository: candidate
patches are produced as unified diffs, reviewed, then applied only to an
isolated working copy during verification. This module owns the mechanics.
"""

from __future__ import annotations

import difflib
import re
from dataclasses import dataclass, field
from pathlib import Path

from app.analysis.models import AnalysisError


class PatchError(AnalysisError):
    """Raised when a patch cannot be parsed or applied cleanly."""


@dataclass
class UnifiedPatch:
    """A parsed single-file unified diff."""

    old_path: str
    new_path: str
    hunks: list[dict] = field(default_factory=list)


# --------------------------------------------------------------------------- generation


def make_unified_diff(old_text: str, new_text: str, file_path: str) -> str:
    """Build a unified diff between two versions of one file."""
    diff = difflib.unified_diff(
        old_text.splitlines(keepends=True),
        new_text.splitlines(keepends=True),
        fromfile=f"a/{file_path}",
        tofile=f"b/{file_path}",
    )
    return "".join(diff)


def render_patch(files: list[tuple[str, str, str]]) -> str:
    """Render diffs for multiple (path, old_text, new_text) as one patch text."""
    return "".join(make_unified_diff(old, new, path) for path, old, new in files if old != new)


def diff_stats(patch_text: str) -> tuple[int, int]:
    """Count added/removed lines in a patch (approx, skips diff headers)."""
    added = removed = 0
    for line in patch_text.splitlines():
        if line.startswith(("+++", "---", "diff ", "index ", "@@")):
            continue
        if line.startswith("+"):
            added += 1
        elif line.startswith("-"):
            removed += 1
    return added, removed


# --------------------------------------------------------------------------- parsing


_HUNK_RE = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$")


def parse_patch(patch_text: str) -> list[UnifiedPatch]:
    """Parse a unified diff into per-file patches (supports \\ No newline markers)."""
    files: dict[str, UnifiedPatch] = {}
    order: list[str] = []
    current: UnifiedPatch | None = None
    current_hunk: dict | None = None
    old_lines: list[str] = []
    new_lines: list[str] = []
    state: str | None = None  # "old" | "new" between file headers and hunks

    def flush_hunk() -> None:
        nonlocal current_hunk, old_lines, new_lines, state
        if current_hunk is not None:
            current_hunk["old_lines"] = list(old_lines)
            current_hunk["new_lines"] = list(new_lines)
            assert current is not None
            current.hunks.append(current_hunk)
        current_hunk = None
        old_lines = []
        new_lines = []
        state = None

    for raw in patch_text.splitlines():
        # diff headers
        if raw.startswith("--- "):
            flush_hunk()
            path = raw[4:].strip()
            if path.startswith("a/"):
                path = path[2:]
            current = files.get(path)
            if current is None:
                current = UnifiedPatch(old_path=path, new_path=path)
                files[path] = current
                order.append(path)
            continue
        if raw.startswith("+++ "):
            continue
        if current is None:
            continue
        m = _HUNK_RE.match(raw)
        if m:
            flush_hunk()
            current_hunk = {
                "old_start": int(m.group(1)),
                "old_len": int(m.group(2) or 0),
                "new_start": int(m.group(3)),
                "new_len": int(m.group(4) or 0),
                "header": m.group(5).strip(),
            }
            state = "body"
            continue
        if current_hunk is None:
            continue
        if raw.startswith(("\\ No newline", "\\ No newline at end of file")):
            continue
        marker = raw[:1]
        body = raw[1:] if marker in "+- " else raw
        if marker == "+":
            new_lines.append(body)
        elif marker == "-":
            old_lines.append(body)
        elif marker == " ":
            old_lines.append(body)
            new_lines.append(body)
    flush_hunk()

    result = []
    for path in order:
        patch = files[path]
        if patch.hunks:
            result.append(patch)
    if not result:
        raise PatchError("Patch contains no applicable hunks", code="invalid_patch")
    return result


# --------------------------------------------------------------------------- application


def apply_patch_to_file(source_text: str, patch_text: str, file_path: str) -> str:
    """Apply ``patch_text`` (one or more files) to ``source_text`` of ``file_path``."""
    patches = [p for p in parse_patch(patch_text) if p.old_path == file_path]
    if not patches:
        raise PatchError(f"Patch does not touch {file_path}", code="patch_mismatch")
    result = source_text
    for patch in patches:
        result = _apply_file_patch(result, patch)
    return result


def apply_patch_to_directory(root: Path, patch_text: str) -> list[str]:
    """Apply a unified diff onto files under ``root`` (working copy).

    Returns the list of modified relative paths. Raises ``PatchError`` on the
    first hunk that does not match.
    """
    touched: list[str] = []
    for patch in parse_patch(patch_text):
        target = (root / patch.old_path).resolve()
        root_resolved = root.resolve()
        if not str(target).startswith(str(root_resolved)):
            raise PatchError(
                f"Patch target escapes the working copy: {patch.old_path}",
                code="patch_escape",
            )
        if not target.exists():
            raise PatchError(f"Patch targets missing file: {patch.old_path}", code="patch_conflict")
        old_text = target.read_text(encoding="utf-8", errors="replace")
        new_text = _apply_file_patch(old_text, patch)
        target.write_text(new_text, encoding="utf-8")
        touched.append(patch.old_path)
    return touched


def _apply_file_patch(source_text: str, patch: UnifiedPatch) -> str:
    lines = source_text.splitlines()
    result: list[str] = []
    cursor = 0
    for hunk in patch.hunks:
        old_block = hunk["old_lines"]
        new_block = hunk["new_lines"]
        if not old_block:
            raise PatchError("Add-only hunks are not supported (no anchor)", code="invalid_patch")
        start = hunk["old_start"] - 1  # 1-based to 0-based
        located, index = _locate(lines, cursor, start, old_block)
        if not located:
            raise PatchError(
                f"Patch context does not match file around line {start + 1}",
                code="patch_conflict",
            )
        # everything before the matched block is unchanged
        result.extend(lines[cursor:index])
        # the matched block is replaced by the hunk's new lines (context included)
        if new_block:
            result.extend(new_block)
        cursor = index + len(old_block)
    result.extend(lines[cursor:])
    joined = "\n".join(result)
    if source_text.endswith("\n"):
        joined += "\n"
    return joined


def _locate(lines: list[str], cursor: int, expected_start: int, old_block: list[str]) -> tuple[bool, int]:
    """Find the earliest index >= cursor where old_block matches (fuzzy anchor)."""
    lo = max(cursor, 0)
    window_len = len(lines)
    block_len = len(old_block)
    # try the exact expected position first, then widen the search window
    candidates = [expected_start] + list(range(max(0, expected_start - 15), expected_start + 16))
    for pos in sorted(set(c for c in candidates if lo <= c < window_len)):
        if pos + block_len <= window_len and lines[pos : pos + block_len] == old_block:
            return True, pos
    # last resort: linear search from cursor
    for pos in range(lo, max(lo, window_len - block_len) + 1):
        if lines[pos : pos + block_len] == old_block:
            return True, pos
    return False, cursor


def validate_patch_scope(patch_text: str, allowed_paths: set[str]) -> list[str]:
    """Return touched paths that are NOT in ``allowed_paths`` (empty means safe)."""
    touched = [p.old_path for p in parse_patch(patch_text)]
    return [p for p in touched if p not in allowed_paths]
