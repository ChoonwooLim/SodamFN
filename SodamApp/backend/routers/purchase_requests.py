from fastapi import APIRouter, HTTPException, Depends, Body
from routers.auth import get_current_user
from models import User as AuthUser, PurchaseRequest
from services.database_service import DatabaseService
from sqlmodel import select
import json

router = APIRouter(prefix="/purchase-requests", tags=["Purchase Requests"])


@router.post("")
def create_purchase_request(
    staff_id: int = Body(..., embed=True),
    staff_name: str = Body("", embed=True),
    items: list = Body(..., embed=True),
    _user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        req = PurchaseRequest(
            staff_id=staff_id,
            staff_name=staff_name,
            items_json=json.dumps(items, ensure_ascii=False),
            status="pending"
        )
        service.session.add(req)
        service.session.commit()
        service.session.refresh(req)

        # Send Kakao notification to admin
        try:
            from services.notification_service import NotificationService
            from models import GlobalSetting
            admin_phone_setting = service.session.exec(
                select(GlobalSetting).where(GlobalSetting.key == "admin_phone")
            ).first()
            admin_phone = admin_phone_setting.value if admin_phone_setting else None

            if admin_phone:
                items_text = "\n".join([
                    f"• {item.get('name', '')} {item.get('quantity', '')}".strip()
                    for item in items
                ])
                NotificationService.send_purchase_request(
                    phone_num=admin_phone,
                    staff_name=staff_name,
                    items_text=items_text
                )
        except Exception as e:
            print(f"Kakao notification failed: {e}")

        return {"status": "success", "message": "구매 요청이 등록되었습니다.", "id": req.id}
    finally:
        service.close()


@router.get("")
def get_purchase_requests(
    staff_id: int = None,
    _user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        query = select(PurchaseRequest).order_by(PurchaseRequest.created_at.desc())
        if staff_id:
            query = query.where(PurchaseRequest.staff_id == staff_id)
        results = service.session.exec(query.limit(20)).all()
        return {
            "status": "success",
            "data": [
                {
                    "id": r.id,
                    "staff_id": r.staff_id,
                    "staff_name": r.staff_name,
                    "items": json.loads(r.items_json),
                    "status": r.status,
                    "admin_note": r.admin_note,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                }
                for r in results
            ]
        }
    finally:
        service.close()


@router.put("/{request_id}/status")
def update_request_status(
    request_id: int,
    status: str = Body(..., embed=True),
    admin_note: str = Body(None, embed=True),
    _user: AuthUser = Depends(get_current_user)
):
    service = DatabaseService()
    try:
        req = service.session.get(PurchaseRequest, request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")
        req.status = status
        if admin_note:
            req.admin_note = admin_note
        service.session.add(req)
        service.session.commit()
        return {"status": "success", "message": "상태가 업데이트되었습니다."}
    finally:
        service.close()
