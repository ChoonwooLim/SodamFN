"""자동수집 파이프라인 라우터.

cron + 대시보드 + 마이그레이션 + 백업 복구. 8개 cron 은 Task 10 에서 추가.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
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


def _log_dto(log_row):
    """SyncLog → 대시보드 응답 DTO. 채널별 필드명 차이 흡수."""
    if not log_row:
        return {"status": "no_data"}
    # EasyPosSyncLog 는 receipts_*, CoupangEatsSyncLog 는 orders_* 를 사용.
    inserted = (
        getattr(log_row, "inserted_count", None)
        or getattr(log_row, "receipts_inserted", None)
        or getattr(log_row, "orders_inserted", None)
        or 0
    )
    updated = (
        getattr(log_row, "updated_count", None)
        or getattr(log_row, "receipts_updated", None)
        or getattr(log_row, "orders_updated", None)
        or 0
    )
    return {
        "started_at": log_row.started_at.isoformat() if log_row.started_at else None,
        "status": log_row.status,
        "inserted": inserted,
        "updated": updated,
    }


@router.get("/status")
def get_status(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """자동수집 대시보드용 상태 요약."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import (
            EasyPosSyncLog, CoupangEatsSyncLog,
            CardFeeRateLearned, SettlementWatchAlert,
        )
        easypos_last = s.exec(
            select(EasyPosSyncLog).where(EasyPosSyncLog.business_id == bid)
            .order_by(EasyPosSyncLog.started_at.desc()).limit(1)
        ).first()
        coupang_last = s.exec(
            select(CoupangEatsSyncLog).where(CoupangEatsSyncLog.business_id == bid)
            .order_by(CoupangEatsSyncLog.started_at.desc()).limit(1)
        ).first()
        learned = s.exec(
            select(CardFeeRateLearned).where(CardFeeRateLearned.business_id == bid)
        ).all()
        open_alerts = s.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == bid,
                SettlementWatchAlert.status == "open",
            )
        ).all()
        avg_conf = (
            sum(r.confidence for r in learned) / len(learned) if learned else 0.0
        )
        return {
            "channels": {
                "easypos": _log_dto(easypos_last),
                "coupang_eats": _log_dto(coupang_last),
            },
            "fee_estimator": {
                "card_corps_learned": len(learned),
                "avg_confidence": round(avg_conf, 2),
            },
            "settlement_watch": {
                "open_alert_count": len(open_alerts),
            },
        }
