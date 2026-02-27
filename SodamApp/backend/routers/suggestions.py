from fastapi import APIRouter, HTTPException, Depends, Body
from routers.auth import get_current_user, get_admin_user
from models import User as AuthUser, Suggestion
from services.database_service import DatabaseService
from sqlmodel import select, col

router = APIRouter(prefix="/suggestions", tags=["Suggestions"])


@router.get("")
def get_suggestions(_user: AuthUser = Depends(get_current_user)):
    service = DatabaseService()
    try:
        items = service.session.exec(
            select(Suggestion).order_by(col(Suggestion.created_at).desc())
        ).all()
        return {
            "status": "success",
            "data": [
                {
                    "id": s.id, "staff_id": s.staff_id, "staff_name": s.staff_name,
                    "title": s.title, "content": s.content, "status": s.status,
                    "admin_reply": s.admin_reply,
                    "created_at": s.created_at.isoformat() if s.created_at else None
                }
                for s in items
            ]
        }
    finally:
        service.close()


@router.post("")
def create_suggestion(
    title: str = Body(..., embed=True),
    content: str = Body("", embed=True),
    user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        s = Suggestion(
            staff_id=user.staff_id or 0,
            staff_name=user.real_name or user.username,
            title=title,
            content=content
        )
        service.session.add(s)
        service.session.commit()
        service.session.refresh(s)
        return {"status": "success", "data": {"id": s.id}}
    finally:
        service.close()


@router.put("/{suggestion_id}")
def update_suggestion(
    suggestion_id: int,
    status: str = Body(None, embed=True),
    admin_reply: str = Body(None, embed=True),
    _admin: AuthUser = Depends(get_admin_user)
):
    service = DatabaseService()
    try:
        s = service.session.get(Suggestion, suggestion_id)
        if not s:
            raise HTTPException(status_code=404, detail="Not found")
        if status is not None: s.status = status
        if admin_reply is not None: s.admin_reply = admin_reply
        service.session.add(s)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()


@router.delete("/{suggestion_id}")
def delete_suggestion(suggestion_id: int, _admin: AuthUser = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        s = service.session.get(Suggestion, suggestion_id)
        if not s:
            raise HTTPException(status_code=404, detail="Not found")
        service.session.delete(s)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()
