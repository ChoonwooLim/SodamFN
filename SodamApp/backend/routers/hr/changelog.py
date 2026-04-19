from fastapi import APIRouter, HTTPException, Depends, Query
from sqlmodel import Session, select
from datetime import datetime
from typing import Optional
from pydantic import BaseModel

from routers.auth import get_admin_user
from models import User as AuthUser, Staff, StaffChangeLog
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()


class ChangeLogCreate(BaseModel):
    change_type: str = "메모"
    field_name: str = ""
    old_value: Optional[str] = None
    new_value: Optional[str] = None
    note: Optional[str] = None


# NOTE: /changelog/recent MUST be registered before /changelog/{staff_id}
# to avoid FastAPI interpreting "recent" as a staff_id path parameter.

@router.get("/changelog/recent")
def get_recent_changes(
    limit: int = Query(default=20, le=100),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """대시보드용 — 전체 직원 최근 인사변경 이력"""
    stmt = apply_bid_filter(select(StaffChangeLog), StaffChangeLog, bid)
    stmt = stmt.order_by(StaffChangeLog.created_at.desc()).limit(limit)
    logs = session.exec(stmt).all()
    return {"status": "success", "data": logs}


@router.get("/changelog/{staff_id}")
def get_staff_changelog(
    staff_id: int,
    page: int = Query(default=1, ge=1),
    size: int = Query(default=20, le=100),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """특정 직원의 인사변경 이력 (페이지네이션, 최신순)"""
    staff = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    # Total count
    count_stmt = apply_bid_filter(select(StaffChangeLog), StaffChangeLog, bid).where(
        StaffChangeLog.staff_id == staff_id
    )
    all_logs = session.exec(count_stmt).all()
    total = len(all_logs)

    # Paginated query
    offset = (page - 1) * size
    stmt = (
        apply_bid_filter(select(StaffChangeLog), StaffChangeLog, bid)
        .where(StaffChangeLog.staff_id == staff_id)
        .order_by(StaffChangeLog.created_at.desc())
        .offset(offset)
        .limit(size)
    )
    logs = session.exec(stmt).all()

    return {
        "status": "success",
        "data": logs,
        "total": total,
        "page": page,
        "size": size,
    }


@router.post("/changelog/{staff_id}")
def add_changelog_entry(
    staff_id: int,
    data: ChangeLogCreate,
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """수동 메모/이력 추가"""
    staff = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    log = StaffChangeLog(
        business_id=bid or staff.business_id,
        staff_id=staff_id,
        staff_name=staff.name,
        change_type=data.change_type,
        field_name=data.field_name,
        old_value=data.old_value,
        new_value=data.new_value,
        note=data.note,
        changed_by="관리자",
    )
    session.add(log)
    session.commit()
    session.refresh(log)

    return {"status": "success", "data": log}
