from fastapi import APIRouter, HTTPException, Depends, Body
from routers.auth import get_current_user, get_admin_user
from models import User as AuthUser, Announcement
from services.database_service import DatabaseService
from sqlmodel import select, col

router = APIRouter(prefix="/announcements", tags=["Announcements"])


@router.get("")
def get_announcements(_user: AuthUser = Depends(get_current_user)):
    service = DatabaseService()
    try:
        items = service.session.exec(
            select(Announcement).order_by(col(Announcement.pinned).desc(), col(Announcement.created_at).desc())
        ).all()
        return {
            "status": "success",
            "data": [
                {"id": a.id, "title": a.title, "content": a.content, "pinned": a.pinned,
                 "created_at": a.created_at.isoformat() if a.created_at else None}
                for a in items
            ]
        }
    finally:
        service.close()


@router.post("")
def create_announcement(
    title: str = Body(..., embed=True),
    content: str = Body("", embed=True),
    pinned: bool = Body(False, embed=True),
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        ann = Announcement(title=title, content=content, pinned=pinned)
        service.session.add(ann)
        service.session.commit()
        service.session.refresh(ann)
        return {"status": "success", "data": {"id": ann.id}}
    finally:
        service.close()


@router.put("/{ann_id}")
def update_announcement(
    ann_id: int,
    title: str = Body(None, embed=True),
    content: str = Body(None, embed=True),
    pinned: bool = Body(None, embed=True),
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        ann = service.session.get(Announcement, ann_id)
        if not ann:
            raise HTTPException(status_code=404, detail="Not found")
        if title is not None: ann.title = title
        if content is not None: ann.content = content
        if pinned is not None: ann.pinned = pinned
        service.session.add(ann)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()


@router.delete("/{ann_id}")
def delete_announcement(ann_id: int, _admin: AuthUser = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        ann = service.session.get(Announcement, ann_id)
        if not ann:
            raise HTTPException(status_code=404, detail="Not found")
        service.session.delete(ann)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()
