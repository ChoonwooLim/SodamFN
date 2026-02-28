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
from database import engine
from models import DailyExpense, Vendor, Revenue, DeliveryRevenue
from services.profit_loss_service import sync_revenue_to_pl

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
def get_daily_revenue(year: int, month: int, _admin: AuthUser = Depends(get_admin_user)):
    """
    Returns all DailyExpense records for revenue vendors in the given month.
    Each record is enriched with vendor name/category/item.
    """
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    with Session(engine) as session:
        # Get all revenue vendors
        revenue_vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == "revenue")
        ).all()
        vendor_map = {v.id: v for v in revenue_vendors}
        vendor_ids = list(vendor_map.keys())

        if not vendor_ids:
            return {"status": "success", "data": [], "vendors": []}

        # Get DailyExpense records for these vendors in the date range
        expenses = session.exec(
            select(DailyExpense)
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
def get_revenue_summary(year: int, month: int, _admin: AuthUser = Depends(get_admin_user)):
    """
    Returns aggregated revenue by category and by day.
    Categories: cash, card, delivery
    """
    start_date = date(year, month, 1)
    if month == 12:
        end_date = date(year + 1, 1, 1)
    else:
        end_date = date(year, month + 1, 1)

    with Session(engine) as session:
        # Get revenue vendor IDs
        revenue_vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == "revenue")
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
            select(DailyExpense)
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
def create_daily_revenue(payload: RevenueCreate, _admin: AuthUser = Depends(get_admin_user)):
    """Create a single revenue DailyExpense record."""
    with Session(engine) as session:
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
        sync_revenue_to_pl(date_obj.year, date_obj.month, session)

        return {
            "status": "success",
            "id": expense.id,
            "message": "매출 내역이 추가되었습니다."
        }


# ─── PUT update revenue entry ───

@router.put("/daily/{expense_id}")
def update_daily_revenue(expense_id: int, payload: RevenueUpdate, _admin: AuthUser = Depends(get_admin_user)):
    """Update a revenue DailyExpense record."""
    with Session(engine) as session:
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
        sync_revenue_to_pl(expense.date.year, expense.date.month, session)

        return {"status": "success", "message": "매출 내역이 수정되었습니다."}


# ─── DELETE revenue entry ───

@router.delete("/daily/{expense_id}")
def delete_daily_revenue(expense_id: int, _admin: AuthUser = Depends(get_admin_user)):
    """Delete a revenue DailyExpense record."""
    with Session(engine) as session:
        expense = session.get(DailyExpense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="Record not found")

        expense_year = expense.date.year
        expense_month = expense.date.month
        session.delete(expense)
        session.commit()

        # Sync to MonthlyProfitLoss
        sync_revenue_to_pl(expense_year, expense_month, session)

        return {"status": "success", "message": "매출 내역이 삭제되었습니다."}


# ─── GET delivery revenue summary ───

@router.get("/delivery-summary")
def get_delivery_summary(year: int = 0, _admin: AuthUser = Depends(get_admin_user)):
    """
    Returns delivery app revenue summary.
    Sources: DailyExpense (primary, single source of truth) + DeliveryRevenue (legacy detail).
    Groups by year-month and provides per-channel data + monthly totals.
    """
    import json as json_lib
    import calendar

    # Vendor name keyword → channel mapping
    VENDOR_TO_CHANNEL = {
        "쿠팡": "쿠팡",
        "배민": "배민",
        "배달의민족": "배민",
        "요기요": "요기요",
        "땡겨요": "땡겨요",
    }

    def _match_channel(vendor_name: str) -> str:
        for keyword, channel in VENDOR_TO_CHANNEL.items():
            if keyword in (vendor_name or ""):
                return channel
        return None

    with Session(engine) as session:
        monthly = {}

        # ── 1. Aggregate from DailyExpense (primary source) ──
        de_query = select(DailyExpense).where(DailyExpense.category == "delivery")
        if year > 0:
            start = date(year, 1, 1)
            end = date(year + 1, 1, 1)
            de_query = de_query.where(DailyExpense.date >= start, DailyExpense.date < end)

        de_records = session.exec(de_query).all()

        # Group by (year, month, channel)
        de_grouped = {}
        for r in de_records:
            ch = _match_channel(r.vendor_name)
            if not ch:
                continue
            key = (r.date.year, r.date.month, ch)
            de_grouped[key] = de_grouped.get(key, 0) + (r.amount or 0)

        for (y, m, ch), total in de_grouped.items():
            month_key = f"{y}-{m:02d}"
            if month_key not in monthly:
                monthly[month_key] = {
                    "year": y, "month": m, "channels": {},
                    "total_sales": 0, "total_fees": 0, "total_settlement": 0, "total_orders": 0,
                }
            mm = monthly[month_key]
            if ch not in mm["channels"]:
                mm["channels"][ch] = {
                    "total_sales": total,  # settlement = total for uploaded files
                    "total_fees": 0,
                    "settlement_amount": total,
                    "order_count": 0,
                    "fee_rate": 0,
                    "fee_breakdown": {},
                    "source": "daily_expense",
                }
                mm["total_sales"] += total
                mm["total_settlement"] += total

        # ── 2. Merge DeliveryRevenue (legacy, has fee details) ──
        dr_query = select(DeliveryRevenue)
        if year > 0:
            dr_query = dr_query.where(DeliveryRevenue.year == year)
        dr_query = dr_query.order_by(DeliveryRevenue.year.desc(), DeliveryRevenue.month.desc())

        records = session.exec(dr_query).all()

        for r in records:
            key = f"{r.year}-{r.month:02d}"
            if key not in monthly:
                monthly[key] = {
                    "year": r.year, "month": r.month, "channels": {},
                    "total_sales": 0, "total_fees": 0, "total_settlement": 0, "total_orders": 0,
                }
            mm = monthly[key]
            fee_bd = {}
            try:
                if r.fee_breakdown:
                    fee_bd = json_lib.loads(r.fee_breakdown)
            except:
                pass

            # If DailyExpense already has this channel, skip DeliveryRevenue (DailyExpense is truth)
            # Map legacy English channel names to Korean
            LEGACY_CHANNEL_MAP = {"Coupang": "쿠팡", "Baemin": "배민", "Yogiyo": "요기요", "Ddangyo": "땡겨요"}
            ch_name = LEGACY_CHANNEL_MAP.get(r.channel, r.channel)
            
            if ch_name in mm["channels"] and mm["channels"][ch_name].get("source") == "daily_expense":
                continue

            mm["channels"][ch_name] = {
                "total_sales": r.total_sales,
                "total_fees": r.total_fees,
                "settlement_amount": r.settlement_amount,
                "order_count": r.order_count,
                "fee_rate": round(r.total_fees / r.total_sales * 100, 1) if r.total_sales > 0 else 0,
                "fee_breakdown": fee_bd,
            }
            mm["total_sales"] += r.total_sales
            mm["total_fees"] += r.total_fees
            mm["total_settlement"] += r.settlement_amount
            mm["total_orders"] += r.order_count

        # Convert to list & compute overall fee rate
        result = []
        for key in sorted(monthly.keys(), reverse=True):
            m = monthly[key]
            m["overall_fee_rate"] = round(m["total_fees"] / m["total_sales"] * 100, 1) if m["total_sales"] > 0 else 0
            result.append(m)

        # Channel summary totals across all months
        channel_totals = {}
        for m in monthly.values():
            for ch, cd in m["channels"].items():
                if ch not in channel_totals:
                    channel_totals[ch] = {"total_sales": 0, "total_fees": 0, "settlement_amount": 0, "order_count": 0}
                ct = channel_totals[ch]
                ct["total_sales"] += cd.get("total_sales", 0)
                ct["total_fees"] += cd.get("total_fees", 0)
                ct["settlement_amount"] += cd.get("settlement_amount", 0)
                ct["order_count"] += cd.get("order_count", 0)

        for ch, ct in channel_totals.items():
            ct["fee_rate"] = round(ct["total_fees"] / ct["total_sales"] * 100, 1) if ct["total_sales"] > 0 else 0

        return {
            "monthly": result,
            "channel_totals": channel_totals,
            "record_count": len(result),
        }


# ─── DELETE delivery revenue by month ───

@router.delete("/delivery-summary/{year}/{month}")
def delete_delivery_revenue_month(year: int, month: int, _admin: AuthUser = Depends(get_admin_user)):
    """
    Delete all delivery revenue data for a specific year/month.
    Clears both DeliveryRevenue and Revenue tables, then re-syncs P/L.
    """
    with Session(engine) as session:
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
            select(Revenue)
            .where(Revenue.date >= start_date, Revenue.date < end_date)
        ).all()
        rev_count = len(rev_records)
        for r in rev_records:
            session.delete(r)

        session.commit()

        # 3. Re-sync P/L
        sync_revenue_to_pl(year, month, session)

        return {
            "status": "success",
            "message": f"{year}년 {month}월 배달앱 매출 데이터 삭제 완료",
            "deleted": {"delivery_revenue": dr_count, "revenue": rev_count},
        }
