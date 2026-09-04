"""Repository ingestion.

All untrusted repository material is placed under an isolated per-repository
directory below ``REPOVERIX_REPOSITORY_STORAGE_DIR``:

- ``{root}/{repo_id}/archive.zip``   uploaded ZIP payload
- ``{root}/{repo_id}/source/``       extracted / cloned working copy used by scans

A scan always works on ``source/``. Verification later copies that working copy
into a sandbox, so original content is never mutated.
"""

from __future__ import annotations

import shutil
import zipfile
from pathlib import Path, PurePosixPath

from app.analysis.models import AnalysisError
from app.analysis.process import run_command
from app.core.config import get_settings


def repository_root(storage_root: Path | None = None) -> Path:
    settings = get_settings()
    base = storage_root or Path(settings.repository_storage_dir)
    base.mkdir(parents=True, exist_ok=True)
    return base


def repository_dir(repo_id: str, storage_root: Path | None = None) -> Path:
    root = repository_root(storage_root)
    target = root / str(repo_id)
    target.mkdir(parents=True, exist_ok=True)
    return target


def source_dir(repo_id: str, storage_root: Path | None = None) -> Path:
    return repository_dir(repo_id, storage_root) / "source"


def archive_path(repo_id: str, storage_root: Path | None = None) -> Path:
    return repository_dir(repo_id, storage_root) / "archive.zip"


def store_archive(repo_id: str, payload: bytes, storage_root: Path | None = None) -> Path:
    """Persist an uploaded repository archive."""
    dest = archive_path(repo_id, storage_root)
    dest.write_bytes(payload)
    return dest


def extract_archive(repo_id: str, storage_root: Path | None = None) -> Path:
    """Extract ``archive.zip`` into ``source/``, guarding against path traversal."""
    archive = archive_path(repo_id, storage_root)
    if not archive.exists():
        raise AnalysisError("Repository archive is missing", code="ingestion_failed")

    src = source_dir(repo_id, storage_root)
    if src.exists():
        shutil.rmtree(src, ignore_errors=True)
    src.mkdir(parents=True, exist_ok=True)

    max_total = get_settings().max_repo_size_mb * 1024 * 1024
    max_per_file = get_settings().max_file_size_kb * 1024

    try:
        with zipfile.ZipFile(archive) as zf:
            total = 0
            for info in zf.infolist():
                if info.is_dir():
                    continue
                # Path traversal + absolute path protection
                member = PurePosixPath(info.filename)
                if member.is_absolute() or ".." in member.parts:
                    raise AnalysisError(
                        f"Refusing to extract archive member with unsafe path: {info.filename}",
                        code="unsafe_archive",
                    )
                if info.file_size > max_per_file:
                    raise AnalysisError(
                        f"Archive member exceeds size limit: {info.filename}",
                        code="repo_too_large",
                    )
                total += info.file_size
                if total > max_total:
                    raise AnalysisError(
                        f"Archive exceeds the {get_settings().max_repo_size_mb}MB limit",
                        code="repo_too_large",
                    )
            # second pass actually extracts (size checked above)
            for info in zf.infolist():
                if info.is_dir():
                    continue
                member = PurePosixPath(info.filename)
                target = src.joinpath(*member.parts)
                target.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as reader, target.open("wb") as writer:
                    shutil.copyfileobj(reader, writer, length=1024 * 1024)
    except zipfile.BadZipFile as exc:
        raise AnalysisError("Uploaded file is not a valid ZIP archive", code="invalid_zip") from exc

    # Handle a single top-level folder wrapper (github zip export convention)
    return _unwrap_single_root(src)


def _unwrap_single_root(src: Path) -> Path:
    """If the archive wrapped everything in one folder, treat that folder as the root."""
    entries = [p for p in src.iterdir() if not p.name.startswith("__MACOSX")]
    if len(entries) == 1 and entries[0].is_dir():
        inner = entries[0]
        # Move contents up one level
        for item in list(inner.iterdir()):
            shutil.move(str(item), str(src / item.name))
        shutil.rmtree(inner, ignore_errors=True)
    return src


def clear_source(repo_id: str, storage_root: Path | None = None) -> None:
    src = source_dir(repo_id, storage_root)
    if src.exists():
        shutil.rmtree(src, ignore_errors=True)
    src.mkdir(parents=True, exist_ok=True)


async def clone_github_repository(
    repo_id: str,
    url: str,
    branch: str = "main",
    storage_root: Path | None = None,
) -> Path:
    """Shallow-clone a GitHub repository into ``source/``.

    The URL is normalized to an https git URL; the repository content is never
    executed here, only cloned.
    """
    from urllib.parse import urlparse

    parsed = urlparse(str(url))
    if parsed.scheme not in ("http", "https"):
        raise AnalysisError("Invalid GitHub URL", code="invalid_url")

    clean = f"{parsed.scheme}://{parsed.netloc}{parsed.path}"
    if clean.endswith(".git"):
        clean = clean[:-4]

    settings = get_settings()
    src = source_dir(repo_id, storage_root)
    if src.exists():
        shutil.rmtree(src, ignore_errors=True)
    src.mkdir(parents=True, exist_ok=True)

    try:
        result = await run_command(
            [settings.git_binary, "clone", "--depth", "1", "--branch", branch, clean, "."],
            cwd=src,
            timeout_seconds=settings.git_clone_timeout_seconds,
        )
    except FileNotFoundError:
        raise AnalysisError(
            "Git is not available on this host; cannot clone GitHub repositories",
            code="git_unavailable",
        ) from None
    except TimeoutError:
        raise AnalysisError(
            f"Git clone timed out after {settings.git_clone_timeout_seconds}s",
            code="clone_timeout",
        ) from None

    if not result.ok:
        # Retry with the default branch if the requested one is missing
        if "couldn't find remote ref" in result.stderr and branch != "main":
            result = await run_command(
                [settings.git_binary, "clone", "--depth", "1", clean, "."],
                cwd=src,
                timeout_seconds=settings.git_clone_timeout_seconds,
            )
    if not result.ok:
        detail = (result.stderr or result.stdout).strip()[-500:]
        raise AnalysisError(
            f"Failed to clone repository: {detail}",
            code="clone_failed",
        )

    git_dir = src / ".git"
    if git_dir.exists():
        shutil.rmtree(git_dir, ignore_errors=True)  # keep the working copy small & hermetic
    return src
