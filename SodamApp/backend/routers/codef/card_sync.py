"""CODEF 카드 동기화 라우터.

POST /api/codef/sync-cards/run     — Orbitron cron (X-Cron-Secret 헤더)
POST /api/codef/sync-cards/manual  — 사용자 버튼 (admin 권한 + 5분 쿨다운)
GET  /api/codef/sync-cards/history — 최근 N일 호출 이력
"""
import datetime
import os
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlmodel import Session, select, desc

from database import engine
from models import User, CodefCallLog
from routers.auth import get_admin_user
from ._helpers import resolve_bid
from tasks.codef_card_sync_task import (
    run_card_sync_for_all_businesses,
    sync_business_cards,
)


router = APIRouter(prefix="/api/codef/sync-cards", tags=["codef"])


def _check_cron_secret(x_cron_secret: str = Header(default="")):
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(403, "invalid cron secret")
    return True


@router.post("/run")
def cron_run(_: bool = Depends(_check_cron_secret)):
    summary = run_card_sync_for_all_businesses()
    return {
        "ok": True,
        "summary": {
            "businesses": summary.business_count,
            "connections": summary.connection_count,
            "new_approvals": summary.total_new_approvals,
            "new_payments": summary.total_new_payments,
            "failed_business_ids": summary.failed_business_ids,
        },
    }


@router.post("/manual")
def manual_run(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    report = sync_business_cards(
        business_id=bid,
        triggered_by="user_button",
        triggered_user_id=admin.id,
    )
    return {
        "ok": True,
        "report": {
            "connections": len(report.results),
            "new_approvals": report.total_new_approvals,
            "new_payments": report.total_new_payments,
            "failed_count": report.failed_count,
            "results": [
                {
                    "organization_code": r.organization_code,
                    "organization_label": r.organization_label,
                    "new_approvals": r.new_approvals,
                    "new_payments": r.new_payments,
                    "new_merchants": r.new_merchants,
                    "error": r.error,
                    "error_code": r.error_code,
                }
                for r in report.results
            ],
        },
    }


@router.get("/history")
def history(
    days: int = 30,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    days = max(1, min(days, 90))
    cutoff = datetime.date.today() - datetime.timedelta(days=days)
    with Session(engine) as s:
        stmt = (
            select(CodefCallLog)
            .where(
                CodefCallLog.business_id == bid,
                CodefCallLog.called_date >= cutoff,
            )
            .order_by(desc(CodefCallLog.called_at))
            .limit(500)
        )
        logs = list(s.exec(stmt))
    return {
        "history": [
            {
                "id": log.id,
                "called_at": log.called_at.isoformat() if log.called_at else None,
                "called_date": log.called_date.isoformat() if log.called_date else None,
                "api_path": log.api_path,
                "organization_code": log.organization_code,
                "status": log.status,
                "rows_returned": log.rows_returned,
                "result_code": log.result_code,
                "estimated_cost_krw": log.estimated_cost_krw,
                "triggered_by": log.triggered_by,
            }
            for log in logs
        ]
    }
