"""CODEF 카드 매입(사용내역) sync 라우터.

POST /api/codef/card-purchases/sync/{connection_id} — 단일 connection sync
POST /api/codef/card-purchases/sync-all              — 사장님 모든 card_purchase connection sync
GET  /api/codef/card-purchases                       — 매입 list 조회
GET  /api/codef/card-purchases/summary               — 월별 카드사·업종 합계
"""
import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Header, Query
from sqlmodel import Session, select
from sqlalchemy import desc

from database import engine
from models import CardPurchase, CodefConnection, User
from routers.auth import get_admin_user
from services.codef.card_purchase_provider import CodefCardPurchaseProvider
from ._helpers import resolve_bid


router = APIRouter(prefix="/api/codef/card-purchases", tags=["codef-card-purchases"])


@router.post("/sync/{connection_id}")
def sync_one(
    connection_id: int,
    months_back: int = Query(3, ge=1, le=12),
    # backward compat: 기존 frontend 가 days_back 으로 호출하면 무시 (billing-list 는 월 단위)
    days_back: Optional[int] = Query(None, deprecated=True),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        conn = s.get(CodefConnection, connection_id)
        if not conn or conn.business_id != bid:
            raise HTTPException(404, "Connection not found")
    provider = CodefCardPurchaseProvider(engine)
    result = provider.sync_one_connection(
        conn, months_back=months_back,
        triggered_by="manual",
        triggered_user_id=admin.id,
    )
    return {
        "ok": result.error is None,
        "organization_label": result.organization_label,
        "new_purchases": result.new_purchases,
        "error": result.error,
        "error_code": result.error_code,
    }


@router.post("/sync-all")
def sync_all(
    months_back: int = Query(3, ge=1, le=12),
    # backward compat: 기존 frontend 가 days_back 으로 호출하면 무시
    days_back: Optional[int] = Query(None, deprecated=True),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        conns = list(s.exec(select(CodefConnection).where(
            CodefConnection.business_id == bid,
            CodefConnection.connection_type == "card_purchase",
            CodefConnection.status == "active",
        )))
    provider = CodefCardPurchaseProvider(engine)
    results = []
    for conn in conns:
        r = provider.sync_one_connection(
            conn, months_back=months_back,
            triggered_by="manual",
            triggered_user_id=admin.id,
        )
        results.append({
            "connection_id": conn.id,
            "organization_label": r.organization_label,
            "new_purchases": r.new_purchases,
            "error": r.error,
            "error_code": r.error_code,
        })
    total = sum(r["new_purchases"] for r in results)
    return {
        "ok": True,
        "connection_count": len(results),
        "total_new_purchases": total,
        "results": results,
    }


@router.get("")
def list_purchases(
    start_date: Optional[datetime.date] = None,
    end_date: Optional[datetime.date] = None,
    card_corp: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        stmt = select(CardPurchase).where(CardPurchase.business_id == bid)
        if start_date:
            stmt = stmt.where(CardPurchase.approval_date >= start_date)
        if end_date:
            stmt = stmt.where(CardPurchase.approval_date <= end_date)
        if card_corp:
            stmt = stmt.where(CardPurchase.card_corp == card_corp)
        stmt = stmt.order_by(desc(CardPurchase.approval_date),
                             desc(CardPurchase.id)).limit(limit)
        rows = list(s.exec(stmt))
    return [
        {
            "id": r.id,
            "card_corp": r.card_corp,
            "approval_date": r.approval_date.isoformat(),
            "approval_time": r.approval_time,
            "approval_number": r.approval_number,
            "merchant_name": r.merchant_name,
            "merchant_no": r.merchant_no,
            "business_type": r.business_type,
            "amount": r.amount,
            "installment": r.installment,
            "status": r.status,
            "card_number_masked": r.card_number_masked,
            "source": r.source,
            "pl_category": r.pl_category,
            "linked_daily_id": r.linked_daily_id,
        } for r in rows
    ]


@router.get("/summary")
def summary(
    year: int = Query(...),
    month: int = Query(..., ge=1, le=12),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """월별 카드사·업종 합계 (취소 제외)."""
    bid = resolve_bid(admin, x_view_as_business)
    start = datetime.date(year, month, 1)
    if month == 12:
        end = datetime.date(year + 1, 1, 1)
    else:
        end = datetime.date(year, month + 1, 1)
    with Session(engine) as s:
        rows = list(s.exec(select(CardPurchase).where(
            CardPurchase.business_id == bid,
            CardPurchase.approval_date >= start,
            CardPurchase.approval_date < end,
            CardPurchase.status == "승인",
        )))
    by_corp: dict[str, int] = {}
    by_biz_type: dict[str, int] = {}
    total = 0
    count = 0
    for r in rows:
        total += r.amount
        count += 1
        by_corp[r.card_corp] = by_corp.get(r.card_corp, 0) + r.amount
        bt = r.business_type or "기타"
        by_biz_type[bt] = by_biz_type.get(bt, 0) + r.amount
    return {
        "year": year,
        "month": month,
        "total": total,
        "count": count,
        "by_corp": by_corp,
        "by_business_type": by_biz_type,
    }
