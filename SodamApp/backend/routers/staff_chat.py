from fastapi import APIRouter, HTTPException, Depends, Body, Query
from routers.auth import get_current_user, get_admin_user
from models import User as AuthUser, StaffChatMessage
from services.database_service import DatabaseService
from sqlmodel import select, col

router = APIRouter(prefix="/staff-chat", tags=["Staff Chat"])


@router.get("")
def get_messages(
    limit: int = Query(50, le=200),
    _user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        items = service.session.exec(
            select(StaffChatMessage)
            .order_by(col(StaffChatMessage.created_at).desc())
            .limit(limit)
        ).all()
        return {
            "status": "success",
            "data": [
                {
                    "id": m.id, "staff_id": m.staff_id, "staff_name": m.staff_name,
                    "message": m.message,
                    "created_at": m.created_at.isoformat() if m.created_at else None
                }
                for m in reversed(items)  # oldest first for chat display
            ]
        }
    finally:
        service.close()


@router.post("")
def send_message(
    message: str = Body(..., embed=True),
    user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        msg = StaffChatMessage(
            staff_id=user.staff_id or 0,
            staff_name=user.real_name or user.username,
            message=message
        )
        service.session.add(msg)
        service.session.commit()
        service.session.refresh(msg)
        return {
            "status": "success",
            "data": {
                "id": msg.id, "staff_id": msg.staff_id, "staff_name": msg.staff_name,
                "message": msg.message,
                "created_at": msg.created_at.isoformat() if msg.created_at else None
            }
        }
    finally:
        service.close()


@router.delete("/{message_id}")
def delete_message(message_id: int, _admin: AuthUser = Depends(get_admin_user)):
    service = DatabaseService()
    try:
        msg = service.session.get(StaffChatMessage, message_id)
        if not msg:
            raise HTTPException(status_code=404, detail="Not found")
        service.session.delete(msg)
        service.session.commit()
        return {"status": "success"}
    finally:
        service.close()
