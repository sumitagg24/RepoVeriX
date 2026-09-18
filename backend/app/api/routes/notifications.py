"""In-app notification routes.

- ``GET  /notifications``          paginated list (newest first)
- ``GET  /notifications/unread``   unread count only (badge polling)
- ``POST /notifications/read``     mark specific IDs as read
- ``POST /notifications/read-all`` mark every unread notification as read
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user, get_db
from app.db.models import User
from app.services import notifications as svc

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _serialize(n) -> dict:
    return {
        "id": str(n.id),
        "kind": n.kind,
        "title": n.title,
        "body": n.body,
        "action_url": n.action_url,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "payload": n.payload or {},
        "created_at": n.created_at.isoformat(),
    }


@router.get("")
async def list_notifications(
    unread_only: bool = Query(default=False),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return paginated notifications for the authenticated user."""
    rows, unread_count = await svc.list_notifications(
        db,
        current_user.id,
        unread_only=unread_only,
        page=page,
        page_size=page_size,
    )
    return {
        "notifications": [_serialize(n) for n in rows],
        "unread_count": unread_count,
        "page": page,
        "page_size": page_size,
    }


@router.get("/unread")
async def unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return just the unread count — cheap for badge polling."""
    _, count = await svc.list_notifications(db, current_user.id, unread_only=True, page_size=1)
    return {"unread_count": count}


class MarkReadRequest(BaseModel):
    ids: list[uuid.UUID]


@router.post("/read")
async def mark_read(
    payload: MarkReadRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark a list of notification IDs as read."""
    updated = await svc.mark_read(db, current_user.id, payload.ids)
    return {"marked_read": updated}


@router.post("/read-all")
async def mark_all_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Mark every unread notification for the current user as read."""
    updated = await svc.mark_all_read(db, current_user.id)
    return {"marked_read": updated}
