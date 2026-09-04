"""Repository CRUD routes."""

import logging
import shutil
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis.ingest import archive_path, repository_dir
from app.api.dependencies import get_current_user, get_db
from app.core.config import get_settings
from app.core.ratelimit import check_action, enforce
from app.db.models import OAuthAccount, Repository, SourceType
from app.schemas.repository import (
    ArchiveImportRequest,
    OAuthImportRequest,
    RepositoryCreate,
    RepositoryRead,
)

# Only real ZIP payloads are accepted (magic-byte sniff, never just the file
# extension). A ZIP begins with the local-file-header signature "PK\x03\x04",
# or "PK\x05\x06" for an empty archive.
_ZIP_MAGIC = (b"PK\x03\x04", b"PK\x05\x06")

_logger = logging.getLogger("repoverix.http")

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository(
    payload: RepositoryCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new repository for the current user."""
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_import_repository

        await assert_can_import_repository(db, current_user)
    repository = Repository(
        owner_id=current_user.id,
        name=payload.name,
        source_type=payload.source_type,
        source_url=str(payload.source_url) if payload.source_url else None,
        default_branch=payload.default_branch,
        status="registered",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)
    return repository


@router.post("/archive", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository_from_archive(
    payload: ArchiveImportRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a repository from a hosted archive URL.

    The archive is downloaded and extracted (with the same hardening as ZIP
    uploads) when the first scan runs. Works for public AWS S3 objects,
    presigned S3 URLs, GitHub codeload/release assets and any other direct
    ``.zip`` URL.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "import_archive"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_import_repository

        await assert_can_import_repository(db, current_user)
    # Content is validated as a ZIP at scan time by the hardened extractor;
    # the URL itself may be a codeload-style link without a .zip suffix.
    name = payload.name or Path(str(payload.url)).stem[:200] or "archive-repo"
    repository = Repository(
        owner_id=current_user.id,
        name=name.strip(),
        source_type=SourceType.archive,
        source_url=str(payload.url),
        default_branch=payload.default_branch,
        status="registered",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)
    return repository


@router.post("/oauth", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository_from_oauth(
    payload: OAuthImportRequest,
    request: Request,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a repository through a connected GitHub/GitLab account.

    The connection's access token authenticates the scan-time clone, so private
    repositories the user granted access to can be audited. Only the clean URL
    is stored on the repository row — never the token.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "import_oauth"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_import_repository

        await assert_can_import_repository(db, current_user)
    result = await db.execute(
        select(OAuthAccount).where(
            OAuthAccount.user_id == current_user.id,
            OAuthAccount.provider == payload.provider,
        )
    )
    account = result.scalar_one_or_none()
    if account is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Connect your {payload.provider} account first (OAuth)",
        )

    host = "gitlab.com" if payload.provider == "gitlab" else "github.com"
    path = payload.repo_path.strip().strip("/")
    if path.endswith(".git"):
        path = path[:-4]
    if not path or "/" not in path:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="repo_path must look like 'owner/repository'",
        )
    name = payload.name or path.rsplit("/", 1)[-1]
    repository = Repository(
        owner_id=current_user.id,
        name=name.strip()[:200],
        source_type=SourceType(payload.provider),
        source_url=f"https://{host}/{path}",
        default_branch=payload.default_branch,
        status="registered",
        oauth_account_id=account.id,
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)
    return repository


@router.get("", response_model=list[RepositoryRead])
async def list_repositories(
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all repositories owned by the current user."""
    result = await db.execute(
        select(Repository)
        .where(Repository.owner_id == current_user.id)
        .order_by(Repository.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{repository_id}", response_model=RepositoryRead)
async def get_repository(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single repository by ID."""
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.owner_id == current_user.id,
        )
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")
    return repository


@router.delete("/{repository_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repository_id: uuid.UUID,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a repository and its stored files."""
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.owner_id == current_user.id,
        )
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    repo_id = str(repository.id)
    await db.delete(repository)
    await db.commit()
    try:
        shutil.rmtree(repository_dir(repo_id), ignore_errors=True)
    except OSError:
        pass


@router.post("/zip", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository_from_zip(
    request: Request,
    name: str = Form(min_length=1, max_length=200),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a repository from an uploaded ZIP archive (stored for scan-time extraction).

    The payload is streamed to disk with a hard size cap (never buffered whole
    in memory), then its *content* is sniffed for ZIP magic bytes — the file
    extension alone is never trusted.
    """
    if get_settings().rate_limit_enabled:
        enforce(check_action(str(current_user.id), "upload_zip"))
    if get_settings().billing_enforce:
        from app.services.billing import assert_can_import_repository

        await assert_can_import_repository(db, current_user)

    clean_name = (name or "").strip()
    if not clean_name:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="name cannot be empty")
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip archives are supported"
        )

    repository = Repository(
        owner_id=current_user.id,
        name=clean_name[:200],
        source_type=SourceType.zip,
        status="registered",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)

    repo_id = str(repository.id)
    dest = archive_path(repo_id)
    max_bytes = get_settings().max_upload_bytes
    try:
        written = 0
        with dest.open("wb") as writer:
            while chunk := await file.read(1024 * 1024):
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                        detail="Archive exceeds the upload size limit",
                    )
                writer.write(chunk)
    except HTTPException:
        dest.unlink(missing_ok=True)
        await db.delete(repository)
        await db.commit()
        raise
    except OSError as exc:
        dest.unlink(missing_ok=True)
        await db.delete(repository)
        await db.commit()
        _logger.warning("Failed to persist uploaded archive for repository %s", repo_id, exc_info=exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not store archive"
        ) from exc

    # Content check on the stored bytes (streaming never kept them in memory).
    head = dest.open("rb").read(4)
    if not head or not head.startswith(_ZIP_MAGIC):
        dest.unlink(missing_ok=True)
        await db.delete(repository)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid ZIP archive")
    return repository
