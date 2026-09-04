"""Repository CRUD routes."""

import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import Repository
from app.schemas.repository import RepositoryCreate, RepositoryRead

router = APIRouter(prefix="/repositories", tags=["repositories"])


@router.post("", response_model=RepositoryRead, status_code=status.HTTP_201_CREATED)
async def create_repository(
    payload: RepositoryCreate,
    current_user = Depends(get_current_user),
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
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """List all repositories owned by the current user."""
    result = await db.execute(
        select(Repository).where(Repository.owner_id == current_user.id).order_by(Repository.created_at.desc())
    )
    return list(result.scalars().all())


@router.get("/{repository_id}", response_model=RepositoryRead)
async def get_repository(
    repository_id: uuid.UUID,
    current_user = Depends(get_current_user),
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
    current_user = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a repository."""
    result = await db.execute(
        select(Repository).where(
            Repository.id == repository_id,
            Repository.owner_id == current_user.id,
        )
    )
    repository = result.scalar_one_or_none()
    if repository is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Repository not found")

    await db.delete(repository)
    await db.commit()