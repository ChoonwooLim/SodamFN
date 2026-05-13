"""자동수집 파이프라인 라우터.

cron + 대시보드 + 마이그레이션 + 백업 복구. 8개 cron 은 Task 10 에서 추가.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session
from database import engine
from models import User, DailyExpense
from routers.auth import get_admin_user

router = APIRouter(prefix="/auto-collection", tags=["auto-collection"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(
            status_code=400,
            detail="사업장 정보가 없습니다. (SuperAdmin은 먼저 대상 사업장을 선택하세요.)",
        )
    return bid


class MigrationRequest(BaseModel):
    period_start: date
    period_end: date


@router.post("/migrate")
def trigger_migration(
    req: MigrationRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """마이그레이션 B 실행."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from services.auto_collection_sync.migration import migrate_business
        report = migrate_business(s, bid, req.period_start, req.period_end)
        return {
            "overwritten_count": report.overwritten_count,
            "new_auto_count": report.new_auto_count,
            "channels": report.channels,
        }


@router.post("/dailyexpense/{row_id}/restore")
def restore_manual_row(
    row_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """백업된 manual_overwritten 행을 manual 로 복구."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.get(DailyExpense, row_id)
        if not row or row.business_id != bid:
            raise HTTPException(404, "행을 찾을 수 없습니다.")
        if row.source != "manual_overwritten":
            raise HTTPException(400, "이 행은 백업 행이 아닙니다.")
        row.source = "manual"
        s.add(row); s.commit()
        return {"ok": True, "id": row.id}
