"""Repository CRUD routes."""

import shutil
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.analysis.ingest import repository_dir
from app.analysis.models import AnalysisError
from app.api.dependencies import get_current_user, get_db
from app.db.models import Repository, SourceType
from app.schemas.repository import RepositoryCreate, RepositoryRead

MAX_UPLOAD_BYTES = 110 * 1024 * 1024  # a little above the ingestion limit

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository(
    payload: RepositoryCreate,
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Register a new repository for the current user."""
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
    name: str = Form(min_length=1, max_length=200),
    file: UploadFile = File(...),
    current_user=Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a repository from an uploaded ZIP archive (stored for scan-time extraction)."""
    if not (file.filename or "").lower().endswith(".zip"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Only .zip archives are supported"
        )
    payload = await file.read()
    if len(payload) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Archive exceeds the upload size limit",
        )
    if not payload.startswith(b"PK\x03\x04") and not payload.startswith(b"PK\x05\x06"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="File is not a valid ZIP archive")

    repository = Repository(
        owner_id=current_user.id,
        name=name.strip(),
        source_type=SourceType.zip,
        status="registered",
    )
    db.add(repository)
    await db.commit()
    await db.refresh(repository)

    try:
        from app.analysis.ingest import store_archive

        store_archive(str(repository.id), payload)
    except AnalysisError as exc:
        await db.delete(repository)
        await db.commit()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=exc.message) from exc
    except OSError as exc:
        await db.delete(repository)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Could not store archive"
        ) from exc
    return repository
