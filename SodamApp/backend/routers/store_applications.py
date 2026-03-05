"""
Store Applications Router - 매장 사용 신청 API
Guest 사용자가 매장 사용을 신청하고, 신청 현황을 조회
"""
from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import select
from models import User, StoreApplication
from routers.auth import get_current_user
from services.database_service import DatabaseService

router = APIRouter()


# --- Pydantic Models ---

class StoreApplicationCreate(BaseModel):
    business_name: str
    business_type: str = "음식점"
    owner_name: str
    phone: str
    address: Optional[str] = None
    business_number: Optional[str] = None
    region: Optional[str] = None
    plan_type: str = "free"  # free, basic, premium
    staff_count: int = 1
    message: Optional[str] = None


# --- Endpoints ---

@router.post("")
async def create_application(
    data: StoreApplicationCreate,
    current_user: User = Depends(get_current_user)
):
    """매장 사용 신청 제출 (Guest 사용자 전용)"""
    if current_user.role != "guest":
        raise HTTPException(
            status_code=400,
            detail="이미 매장이 등록된 사용자는 사용신청을 할 수 없습니다."
        )
    
    service = DatabaseService()
    try:
        # 이미 대기 중인 신청이 있는지 확인
        stmt = select(StoreApplication).where(
            StoreApplication.user_id == current_user.id,
            StoreApplication.status == "pending"
        )
        existing = service.session.exec(stmt).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="이미 대기 중인 사용신청이 있습니다. 승인을 기다려 주세요."
            )
        
        application = StoreApplication(
            user_id=current_user.id,
            business_name=data.business_name,
            business_type=data.business_type,
            owner_name=data.owner_name,
            phone=data.phone,
            address=data.address,
            business_number=data.business_number,
            region=data.region,
            plan_type=data.plan_type,
            staff_count=data.staff_count,
            message=data.message,
            status="pending"
        )
        service.session.add(application)
        service.session.commit()
        service.session.refresh(application)
        
        return {
            "message": "사용신청이 접수되었습니다. 관리자 검토 후 승인됩니다.",
            "application_id": application.id,
            "status": application.status
        }
    finally:
        service.close()


@router.get("/my")
async def get_my_applications(
    current_user: User = Depends(get_current_user)
):
    """내 사용신청 현황 조회"""
    service = DatabaseService()
    try:
        stmt = select(StoreApplication).where(
            StoreApplication.user_id == current_user.id
        ).order_by(StoreApplication.created_at.desc())
        applications = service.session.exec(stmt).all()
        
        return [
            {
                "id": app.id,
                "business_name": app.business_name,
                "business_type": app.business_type,
                "owner_name": app.owner_name,
                "phone": app.phone,
                "plan_type": app.plan_type,
                "status": app.status,
                "admin_note": app.admin_note,
                "assigned_username": app.assigned_username,
                "created_at": app.created_at.isoformat() if app.created_at else None,
                "reviewed_at": app.reviewed_at.isoformat() if app.reviewed_at else None
            }
            for app in applications
        ]
    finally:
        service.close()
