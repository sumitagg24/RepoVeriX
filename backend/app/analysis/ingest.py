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
from datetime import UTC, datetime, timedelta
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
    """Persist an uploaded repository archive.

    Writes the local working copy needed for extraction now, and stores the
    durable copy through the artifact-storage seam so re-analysis on another
    replica can fetch it without a re-upload (a no-op duplicate under the
    local backend; object storage in production).
    """
    dest = archive_path(repo_id, storage_root)
    dest.write_bytes(payload)
    try:
        from app.core.artifacts import get_artifact_storage

        get_artifact_storage().put(f"archives/{repo_id}/archive.zip", payload)
    except Exception:  # noqa: BLE001 - durable copy must never block ingestion
        pass
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
    max_files = getattr(get_settings(), "max_files", 10_000)

    try:
        with zipfile.ZipFile(archive) as zf:
            total = 0
            file_count = 0
            for info in zf.infolist():
                if info.is_dir():
                    continue
                file_count += 1
                if file_count > max_files:
                    raise AnalysisError(
                        f"Archive member count exceeds maximum limit of {max_files} files",
                        code="repo_too_large",
                    )
                # Path traversal + absolute path protection
                member = PurePosixPath(info.filename)
                if member.is_absolute() or ".." in member.parts:
                    raise AnalysisError(
                        f"Refusing to extract archive member with unsafe path: {info.filename}",
                        code="unsafe_archive",
                    )
                target = (src / member).resolve()
                if not target.is_relative_to(src.resolve()):
                    raise AnalysisError(
                        f"Refusing to extract archive member escaping target directory: {info.filename}",
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
    # SSRF preflight: never let an attacker point the clone at internal hosts.
    from app.core.ssrf import SSRFBlocked, assert_safe_url

    try:
        assert_safe_url(url)
    except SSRFBlocked as exc:
        raise AnalysisError(
            f"This repository URL is blocked (SSRF guard): {exc}", code="ssrf_blocked"
        ) from None

    clean = git_clone_url(url, provider=provider, token=token)

    settings = get_settings()
    src = source_dir(repo_id, storage_root)
    if src.exists():
        shutil.rmtree(src, ignore_errors=True)
    src.mkdir(parents=True, exist_ok=True)

    safe_git_flags = [
        "-c",
        "protocol.ext.allow=never",
        "-c",
        "protocol.file.allow=never",
        "-c",
        "core.fsmonitor=false",
        "-c",
        "core.hooksPath=/dev/null",
    ]
    git_env = {
        "GIT_TERMINAL_PROMPT": "0",
        "GIT_CONFIG_NOSYSTEM": "1",
    }

    try:
        result = await run_command(
            [settings.git_binary, *safe_git_flags, "clone", "--depth", "1", "--branch", branch, clean, "."],
            cwd=src,
            timeout_seconds=settings.git_clone_timeout_seconds,
            env_extra=git_env,
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
                [settings.git_binary, *safe_git_flags, "clone", "--depth", "1", clean, "."],
                cwd=src,
                timeout_seconds=settings.git_clone_timeout_seconds,
                env_extra=git_env,
            )
    if not result.ok:
        from app.core.redact import redact_string

        detail = redact_string((result.stderr or result.stdout).strip()[-500:])
        raise AnalysisError(
            f"Failed to clone repository: {detail}",
            code="clone_failed",
        )

    # Keep .git: repository intelligence (hotspots, ownership, co-change)
    # needs history. The shallow clone is deepened to a bounded window so the
    # working copy stays small. `.git` is ignored by every analysis walk.
    await deepen_history(src, branch)
    return src


async def deepen_history(src: Path, branch: str | None = None, months: int | None = None) -> None:
    """Best-effort bounded deepening of a shallow clone.

    Extends the shallow history to ``months`` of commits (falling back to a
    200-commit window). Failures degrade gracefully: the clone still works,
    git analytics just see the shallow window. Never raises.
    """
    if not (src / ".git").exists():
        return
    settings = get_settings()
    window = months or settings.git_history_months
    if window <= 0:
        return
    since = (datetime.now(UTC) - timedelta(days=window * 30)).strftime("%Y-%m-%d")
    timeout = min(settings.git_clone_timeout_seconds, 120)
    candidates: list[list[str]] = [
        [settings.git_binary, "fetch", "--shallow-since", since, "origin"],
        [settings.git_binary, "fetch", "--depth", "200", "origin"],
    ]
    if branch:
        candidates = [c + [branch] for c in candidates]
    for argv in candidates:
        try:
            result = await run_command(argv, cwd=src, timeout_seconds=timeout)
        except TimeoutError:
            continue
        if result.ok:
            return
    # Even a failed deepen leaves the depth-1 clone fully usable.


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

    from app.core.ssrf import SSRFBlocked, assert_safe_url, preflight_and_pin, validate_url

    try:
        assert_safe_url(url)
    except SSRFBlocked as exc:
        raise AnalysisError(f"This archive URL is blocked (SSRF guard): {exc}", code="ssrf_blocked") from None

    settings = get_settings()
    max_bytes = settings.max_repo_size_mb * 1024 * 1024
    dest = archive_path(repo_id, storage_root)
    close = client is None

    # Pin the connection to the exact IP the SSRF guard validated (single DNS
    # resolution). Without this, the HTTP client re-resolves the host at
    # connect time and a short-TTL record can swap a public address for a
    # private one between the guard's lookup and the real fetch — DNS rebinding.
    try:
        plan = preflight_and_pin(url)
    except SSRFBlocked as exc:
        raise AnalysisError(f"This archive URL is blocked (SSRF guard): {exc}", code="ssrf_blocked") from None

    fetch_url = plan.pinned_url if plan else url

    async def _guard_redirects(request):
        decision = validate_url(str(request.url))
        if not decision.allowed:
            raise SSRFBlocked(decision.reason)

    async def _keep_host_pinned(request):
        if plan is not None and request.url.host and plan.extensions["sni_hostname"] == request.url.host:
            request.headers["Host"] = plan.headers["Host"]
            request.extensions = {**request.extensions, **plan.extensions}

    if client is None:
        # Our own transport follows redirects, so each hop is preflighted too.
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(settings.git_clone_timeout_seconds),
            follow_redirects=True,
            event_hooks={"request": [_guard_redirects, _keep_host_pinned]},
        )
    else:
        # Injected client (tests / callers): still preflight every hop.
        client.event_hooks["request"].extend([_guard_redirects, _keep_host_pinned])
    try:
        async with client.stream("GET", fetch_url) as resp:
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
    except SSRFBlocked as exc:
        dest.unlink(missing_ok=True)
        raise AnalysisError(f"Archive redirect is blocked (SSRF guard): {exc}", code="ssrf_blocked") from None
    finally:
        if close:
            await client.aclose()
    if not dest.exists() or dest.stat().st_size == 0:
        raise AnalysisError("Downloaded archive is empty", code="download_failed")
    return extract_archive(repo_id, storage_root)
