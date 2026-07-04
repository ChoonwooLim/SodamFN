"""
Revenue Management API — DailyExpense-based CRUD for revenue vendors.
"""
from fastapi import APIRouter, HTTPException, Depends
from routers.auth import get_admin_user
from models import User as AuthUser
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from sqlmodel import Session, select, func, col
from database import get_session
from models import DailyExpense, Vendor, Revenue, DeliveryRevenue
from services.profit_loss_service import sync_revenue_to_pl
from tenant_filter import get_bid_from_token, apply_bid_filter

# Channel name (in Revenue table) → keyword to match delivery vendor names
CHANNEL_KEYWORDS = {
    "Coupang": "쿠팡",
    "Baemin": "배달의민족",
    "Yogiyo": "요기요",
    "Ddangyo": "땡겨요",
}

router = APIRouter()


# ─── Schemas ───

class RevenueCreate(BaseModel):
    vendor_id: int
    date: str  # YYYY-MM-DD
    amount: int
    note: Optional[str] = None
    payment_method: str = "Card"  # Card, Cash


class RevenueUpdate(BaseModel):
    amount: Optional[int] = None
    note: Optional[str] = None
    date: Optional[str] = None
    vendor_id: Optional[int] = None
    payment_method: Optional[str] = None


# ─── GET daily revenue list ───

@router.get("/daily")
def get_daily_revenue(year: int, month: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Returns all DailyExpense records for revenue vendors in the given month.
    Each record is enriched with vendor name/category/item.
    """
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    # Get all revenue vendors
    revenue_vendors = session.exec(
        apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.vendor_type == "revenue")
    ).all()
    vendor_map = {v.id: v for v in revenue_vendors}
    vendor_ids = list(vendor_map.keys())

    if not vendor_ids:
        return {"status": "success", "data": [], "vendors": []}

    # Get DailyExpense records for these vendors in the date range
    expenses = session.exec(
        apply_bid_filter(select(DailyExpense), DailyExpense, bid)
        .where(
            DailyExpense.vendor_id.in_(vendor_ids),
            DailyExpense.date >= start_date,
            DailyExpense.date < end_date
        )
        .order_by(DailyExpense.date, DailyExpense.vendor_name)
    ).all()

    result = []
    for e in expenses:
        v = vendor_map.get(e.vendor_id)
        # Determine effective category for UI (cash/card/delivery)
        # Default to v.category (store/delivery). If store, check payment_method
        ui_category = v.category if v else e.category
        if ui_category == 'store':
            ui_category = e.payment_method.lower() if e.payment_method else 'card'

        result.append({
            "id": e.id,
            "date": str(e.date),
            "vendor_id": e.vendor_id,
            "vendor_name": e.vendor_name,
            "amount": e.amount,
            "note": e.note,
            "category": v.category if v else e.category,
            "payment_method": e.payment_method or "Card",
            "ui_category": ui_category, # cash, card, delivery
            "item": v.item if v else None,
            "source": e.source or "manual",  # 자동수집 출처: manual / card_sync / manual_overwritten 등
        })

    # Build vendor list for dropdowns
    vendors_list = [
        {
            "id": v.id,
            "name": v.name,
            "category": v.category,
            "item": v.item,
        }
        for v in revenue_vendors
    ]

    # NOTE: Revenue table reads REMOVED — DailyExpense is single source of truth

    return {"status": "success", "data": result, "vendors": vendors_list}


# ─── GET summary stats ───

@router.get("/summary")
def get_revenue_summary(year: int, month: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Returns aggregated revenue by category and by day.
    Categories: cash, card, delivery
    """
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    # Get revenue vendor IDs
    revenue_vendors = session.exec(
        apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.vendor_type == "revenue")
    ).all()
    vendor_map = {v.id: v for v in revenue_vendors}
    vendor_ids = list(vendor_map.keys())

    if not vendor_ids:
        return {
            "status": "success",
            "total": 0,
            "by_category": {},
            "by_day": [],
            "by_vendor": []
        }

    # Total by category
    expenses = session.exec(
        apply_bid_filter(select(DailyExpense), DailyExpense, bid)
        .where(
            DailyExpense.vendor_id.in_(vendor_ids),
            DailyExpense.date >= start_date,
            DailyExpense.date < end_date
        )
    ).all()

    total = 0
    by_category = {"cash": 0, "card": 0, "delivery": 0}
    by_day_map = {}
    by_vendor_map = {}

    for e in expenses:
        v = vendor_map.get(e.vendor_id)
        cat = v.category if v else (e.category or "기타")
        amount = e.amount or 0

        # Refine category based on payment_method for 'store' type
        ui_cat = cat
        if cat == 'store':
            pm = (e.payment_method or "Card").lower()
            ui_cat = 'cash' if pm == 'cash' else 'card'

        # Delivery vendors in DailyExpense are also 'delivery'
        if cat == 'delivery':
            ui_cat = 'delivery'

        total += amount
        by_category[ui_cat] = by_category.get(ui_cat, 0) + amount

        day_str = str(e.date)
        if day_str not in by_day_map:
            by_day_map[day_str] = {"date": day_str, "total": 0, "cash": 0, "card": 0, "delivery": 0}

        by_day_map[day_str]["total"] += amount

        if ui_cat == 'cash':
            by_day_map[day_str]["cash"] += amount
        elif ui_cat == 'card':
            by_day_map[day_str]["card"] += amount
        elif ui_cat == 'delivery':
            by_day_map[day_str]["delivery"] += amount

        vname = e.vendor_name
        if vname not in by_vendor_map:
            by_vendor_map[vname] = {"name": vname, "category": ui_cat, "total": 0}
        by_vendor_map[vname]["total"] += amount

    # NOTE: Revenue table reads REMOVED — DailyExpense is single source of truth

    by_day = sorted(by_day_map.values(), key=lambda x: x["date"])
    by_vendor = sorted(by_vendor_map.values(), key=lambda x: x["total"], reverse=True)

    return {
        "status": "success",
        "total": total,
        "by_category": by_category,
        "by_day": by_day,
        "by_vendor": by_vendor
    }


# ─── POST create revenue entry ───

@router.post("/daily")
def create_daily_revenue(payload: RevenueCreate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Create a single revenue DailyExpense record."""
    vendor = session.get(Vendor, payload.vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    try:
        date_obj = datetime.strptime(payload.date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format (YYYY-MM-DD)")

    expense = DailyExpense(
        date=date_obj,
        vendor_name=vendor.name,
        vendor_id=vendor.id,
        amount=payload.amount,
        category=vendor.category,
        note=payload.note,
        payment_method=payload.payment_method or "Card"
    )
    session.add(expense)
    session.commit()
    session.refresh(expense)

    # Sync to MonthlyProfitLoss
    sync_revenue_to_pl(date_obj.year, date_obj.month, session, bid)

    return {
        "status": "success",
        "id": expense.id,
        "message": "매출 내역이 추가되었습니다."
    }


# ─── PUT update revenue entry ───

@router.put("/daily/{expense_id}")
def update_daily_revenue(expense_id: int, payload: RevenueUpdate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Update a revenue DailyExpense record."""
    expense = session.get(DailyExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Record not found")

    if payload.amount is not None:
        expense.amount = payload.amount
    if payload.note is not None:
        expense.note = payload.note
    if payload.payment_method is not None:
        expense.payment_method = payload.payment_method
    if payload.date is not None:
        try:
            expense.date = datetime.strptime(payload.date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if payload.vendor_id is not None:
        vendor = session.get(Vendor, payload.vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail="Vendor not found")
        expense.vendor_id = vendor.id
        expense.vendor_name = vendor.name
        expense.category = vendor.category

    session.add(expense)
    session.commit()

    # Sync to MonthlyProfitLoss
    sync_revenue_to_pl(expense.date.year, expense.date.month, session, bid)

    return {"status": "success", "message": "매출 내역이 수정되었습니다."}


# ─── DELETE revenue entry ───

@router.delete("/daily/{expense_id}")
def delete_daily_revenue(expense_id: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Delete a revenue DailyExpense record."""
    expense = session.get(DailyExpense, expense_id)
    if not expense:
        raise HTTPException(status_code=404, detail="Record not found")

    expense_year = expense.date.year
    expense_month = expense.date.month
    session.delete(expense)
    session.commit()

    # Sync to MonthlyProfitLoss
    sync_revenue_to_pl(expense_year, expense_month, session, bid)

    return {"status": "success", "message": "매출 내역이 삭제되었습니다."}


# ─── GET delivery revenue summary ───

import json as _json

_LEGACY_CHANNEL_MAP = {
    "Coupang": "쿠팡", "쿠팡이츠": "쿠팡", "쿠팡잇츠": "쿠팡", "쿠팡페이": "쿠팡", "쿠팡": "쿠팡",
    "Baemin": "배민", "배달의민족": "배민", "우아한형제들": "배민", "음식배달": "배민", "배민": "배민",
    "Yogiyo": "요기요", "요기요": "요기요", "위대한상상": "요기요",
    "Ddangyo": "땡겨요", "땡겨요": "땡겨요",
}
_SRC_RANK = {"auto_coupang_excel": 3, "excel": 3, "manual": 2, "bank_sync": 0}
_DISPLAY_CHANNELS = ("쿠팡", "배민", "요기요", "땡겨요")


def _canon_channel(ch: str) -> str:
    return _LEGACY_CHANNEL_MAP.get(ch, ch)


def _consolidate_delivery(dr_rows, de_sales):
    """(채널,월) 별 대표 레코드를 결정적으로 선택해 월별 요약 dict 생성.

    대표 선택 키 = (매출>0, source_rank, total_fees, channel) 최댓값. channel
    문자열로 tie-break 해 결정성 보장. 정산액은 그 슬롯 레코드들의
    settlement_amount non-zero 최댓값. 매출은 대표.total_sales(>0) else de_sales.
    """
    slots = {}
    for r in dr_rows:
        ch = _canon_channel(r.channel)
        if ch not in _DISPLAY_CHANNELS:
            continue
        slots.setdefault((r.year, r.month, ch), []).append(r)

    monthly = {}
    for (y, m, ch), rows in slots.items():
        best = max(rows, key=lambda r: (
            1 if (r.total_sales or 0) > 0 else 0,
            _SRC_RANK.get(r.source, 1),
            r.total_fees or 0,
            r.channel,
        ))
        settle = max((r.settlement_amount or 0) for r in rows)
        sales = best.total_sales if (best.total_sales or 0) > 0 else de_sales.get((y, m, ch), 0)
        fees = best.total_fees or 0
        try:
            fee_bd = _json.loads(best.fee_breakdown) if best.fee_breakdown else {}
        except Exception:
            fee_bd = {}
        mk = f"{y}-{m:02d}"
        mm = monthly.setdefault(mk, {"year": y, "month": m, "channels": {},
                                     "total_sales": 0, "total_fees": 0,
                                     "total_settlement": 0, "total_orders": 0})
        mm["channels"][ch] = {
            "total_sales": sales, "total_fees": fees, "settlement_amount": settle,
            "order_count": best.order_count or 0,
            "fee_rate": round(fees / sales * 100, 1) if sales > 0 else 0,
            "fee_breakdown": fee_bd, "source": best.source,
        }
        mm["total_sales"] += sales
        mm["total_fees"] += fees
        mm["total_settlement"] += settle
        mm["total_orders"] += (best.order_count or 0)

    for mm in monthly.values():
        ts = mm["total_sales"]
        mm["overall_fee_rate"] = round(mm["total_fees"] / ts * 100, 1) if ts > 0 else 0
    return monthly


@router.get("/delivery-summary")
def get_delivery_summary(year: int = 0, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Returns delivery app revenue summary — 결정적 병합(총비용 우선).
    매출은 DeliveryRevenue 대표 레코드(엔진 있으면), 없으면 DailyExpense.
    정산/수수료/분해는 (채널,월) 대표 레코드 기준. `_consolidate_delivery` 참조.
    """
    # 1) DailyExpense delivery 매출 (fallback)
    de_q = apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(DailyExpense.category == "delivery")
    if year > 0:
        de_q = de_q.where(DailyExpense.date >= date(year, 1, 1), DailyExpense.date < date(year + 1, 1, 1))
    de_sales = {}
    for r in session.exec(de_q).all():
        ch = _canon_channel(r.vendor_name or "")
        if ch in _DISPLAY_CHANNELS:
            de_sales[(r.date.year, r.date.month, ch)] = de_sales.get((r.date.year, r.date.month, ch), 0) + (r.amount or 0)

    # 2) DeliveryRevenue 로드
    dr_q = apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid)
    if year > 0:
        dr_q = dr_q.where(DeliveryRevenue.year == year)
    dr_rows = session.exec(dr_q).all()

    # 3) 결정적 병합
    monthly_map = _consolidate_delivery(dr_rows, de_sales)
    result = [monthly_map[k] for k in sorted(monthly_map.keys(), reverse=True)]

    # 4) 채널 총계
    channel_totals = {}
    for mm in monthly_map.values():
        for ch, cd in mm["channels"].items():
            ct = channel_totals.setdefault(ch, {"total_sales": 0, "total_fees": 0, "settlement_amount": 0, "order_count": 0})
            ct["total_sales"] += cd["total_sales"]
            ct["total_fees"] += cd["total_fees"]
            ct["settlement_amount"] += cd["settlement_amount"]
            ct["order_count"] += cd["order_count"]
    for ct in channel_totals.values():
        ct["fee_rate"] = round(ct["total_fees"] / ct["total_sales"] * 100, 1) if ct["total_sales"] > 0 else 0

    return {"monthly": result, "channel_totals": channel_totals, "record_count": len(result)}


# ─── DELETE delivery revenue by month ───

@router.delete("/delivery-summary/{year}/{month}")
def delete_delivery_revenue_month(year: int, month: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Delete all delivery revenue data for a specific year/month.
    Clears both DeliveryRevenue and Revenue tables, then re-syncs P/L.
    """
    # 1. Delete from DeliveryRevenue table
    dr_records = session.exec(
        select(DeliveryRevenue)
        .where(DeliveryRevenue.year == year, DeliveryRevenue.month == month)
    ).all()
    dr_count = len(dr_records)
    for r in dr_records:
        session.delete(r)

    # 2. Delete from Revenue table (delivery app daily entries)
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    rev_records = session.exec(
        apply_bid_filter(select(Revenue), Revenue, bid)
        .where(Revenue.date >= start_date, Revenue.date < end_date)
    ).all()
    rev_count = len(rev_records)
    for r in rev_records:
        session.delete(r)

    session.commit()

    # 3. Re-sync P/L
    sync_revenue_to_pl(year, month, session, bid)

    return {
        "status": "success",
        "message": f"{year}년 {month}월 배달앱 매출 데이터 삭제 완료",
        "deleted": {"delivery_revenue": dr_count, "revenue": rev_count},
    }
