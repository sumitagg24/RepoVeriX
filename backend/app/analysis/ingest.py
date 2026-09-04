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


def git_clone_url(url: str, provider: str | None = None, token: str | None = None) -> str:
    """Normalize a repository URL, optionally embedding a provider token.

    Tokens are placed in the URL userinfo so ``git clone`` authenticates with
    the remote. The stored ``source_url`` on the repository row never contains
    the token — it is only injected at clone time.
    """
    from urllib.parse import urlparse, urlunparse

    parsed = urlparse(str(url))
    if parsed.scheme not in ("http", "https"):
        raise AnalysisError("Invalid repository URL", code="invalid_url")
    clean_path = parsed.path[:-4] if parsed.path.endswith(".git") else parsed.path
    if token and provider == "gitlab":
        userinfo = "oauth2:" + token
    elif token and provider == "github":
        userinfo = "x-access-token:" + token
    else:
        userinfo = parsed.username or ""
    netloc = parsed.netloc
    if userinfo:
        netloc = f"{userinfo}@{netloc}"
    return urlunparse((parsed.scheme, netloc, clean_path, "", "", ""))


async def clone_github_repository(
    repo_id: str,
    url: str,
    branch: str = "main",
    token: str | None = None,
    provider: str = "github",
    storage_root: Path | None = None,
) -> Path:
    """Shallow-clone a git repository (GitHub/GitLab/generic) into ``source/``.

    The URL is normalized to an https git URL; repository content is never
    executed here, only cloned. ``token`` is optional and authenticates the
    clone for private repositories of the matching provider.
    """
    clean = git_clone_url(url, provider=provider, token=token)

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
            "Git is not available on this host; cannot clone repositories",
            code="git_unavailable",
        ) from None
    except TimeoutError:
        raise AnalysisError(
            f"Git clone timed out after {settings.git_clone_timeout_seconds}s",
            code="clone_timeout",
        ) from None

    if not result.ok:
        # The requested branch may not exist (e.g. a repo whose default is
        # ``master``): retry without --branch so git picks the remote default.
        if "couldn't find remote ref" in result.stderr or "Remote branch" in result.stderr:
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


async def download_archive(
    repo_id: str,
    url: str,
    storage_root: Path | None = None,
    *,
    client=None,
) -> Path:
    """Download an archive from a hosted URL (S3 object, presigned URL, release
    asset, codeload, ...) and extract it into ``source/`` using the same
    hardened ZIP path as uploads.

    ``client`` is an optional ``httpx.AsyncClient`` (tests inject a mock). The
    download is capped by the configured repository size limits, so a hostile
    URL cannot exhaust the host.
    """
    from urllib.parse import urlparse

    import httpx

    parsed = urlparse(str(url))
    if parsed.scheme not in ("http", "https"):
        raise AnalysisError("Invalid archive URL", code="invalid_url")

    settings = get_settings()
    max_bytes = settings.max_repo_size_mb * 1024 * 1024
    dest = archive_path(repo_id, storage_root)
    close = client is None
    client = client or httpx.AsyncClient(
        timeout=httpx.Timeout(settings.git_clone_timeout_seconds), follow_redirects=True
    )
    try:
        async with client.stream("GET", url) as resp:
            if resp.status_code >= 400:
                raise AnalysisError(
                    f"Download failed ({resp.status_code}) for {url[:120]}", code="download_failed"
                )
            length = resp.headers.get("content-length")
            if length and int(length) > max_bytes:
                raise AnalysisError(
                    f"Archive exceeds the {settings.max_repo_size_mb}MB limit", code="repo_too_large"
                )
            total = 0
            with dest.open("wb") as writer:
                async for chunk in resp.aiter_bytes(1024 * 1024):
                    total += len(chunk)
                    if total > max_bytes:
                        writer.close()
                        dest.unlink(missing_ok=True)
                        raise AnalysisError(
                            f"Archive exceeds the {settings.max_repo_size_mb}MB limit",
                            code="repo_too_large",
                        )
                    writer.write(chunk)
    finally:
        if close:
            await client.aclose()
    if not dest.exists() or dest.stat().st_size == 0:
        raise AnalysisError("Downloaded archive is empty", code="download_failed")
    return extract_archive(repo_id, storage_root)
