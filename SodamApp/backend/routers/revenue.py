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


class RevenueUpdate(BaseModel):
    amount: Optional[int] = None
    note: Optional[str] = None
    date: Optional[str] = None
    vendor_id: Optional[int] = None


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
            result.append({
                "id": e.id,
                "date": str(e.date),
                "vendor_id": e.vendor_id,
                "vendor_name": e.vendor_name,
                "amount": e.amount,
                "note": e.note,
                "category": v.category if v else e.category,
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

        # ── Also fetch Revenue table entries (배달앱 data) ──
        # Map delivery channels to vendor IDs
        delivery_vendors = [v for v in revenue_vendors if v.category == "delivery"]
        channel_to_vendor = {}
        for ch_key, keyword in CHANNEL_KEYWORDS.items():
            for v in delivery_vendors:
                if keyword in v.name:
                    channel_to_vendor[ch_key] = v
                    break

        revenue_entries = session.exec(
            select(Revenue)
            .where(Revenue.date >= start_date, Revenue.date < end_date)
        ).all()

        for rev in revenue_entries:
            v = channel_to_vendor.get(rev.channel)
            if v:
                result.append({
                    "id": f"rev_{rev.id}",  # prefix to distinguish from DailyExpense
                    "date": str(rev.date),
                    "vendor_id": v.id,
                    "vendor_name": v.name,
                    "amount": rev.amount or 0,
                    "note": rev.description or "배달앱 정산",
                    "category": "delivery",
                    "item": v.item,
                    "source": "delivery_app",  # flag for frontend
                    "_channel": rev.channel,  # channel key for edit API
                })

        return {"status": "success", "data": result, "vendors": vendors_list}


# ─── GET summary stats ───

@router.get("/summary")
def get_revenue_summary(year: int, month: int, _admin: AuthUser = Depends(get_admin_user)):
    """
    Returns aggregated revenue by category and by day.
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
        by_category = {}
        by_day_map = {}
        by_vendor_map = {}

        for e in expenses:
            v = vendor_map.get(e.vendor_id)
            cat = v.category if v else (e.category or "기타")
            amount = e.amount or 0
            total += amount

            by_category[cat] = by_category.get(cat, 0) + amount

            day_str = str(e.date)
            if day_str not in by_day_map:
                by_day_map[day_str] = {"date": day_str, "total": 0, "store": 0, "delivery": 0}
            by_day_map[day_str]["total"] += amount
            if cat == "store":
                by_day_map[day_str]["store"] += amount
            elif cat == "delivery":
                by_day_map[day_str]["delivery"] += amount

            vname = e.vendor_name
            if vname not in by_vendor_map:
                by_vendor_map[vname] = {"name": vname, "category": cat, "total": 0}
            by_vendor_map[vname]["total"] += amount

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
            note=payload.note
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
    If year=0, returns all records. Otherwise filters by year.
    Groups by year-month and provides per-channel data + monthly totals.
    """
    import json as json_lib

    with Session(engine) as session:
        query = select(DeliveryRevenue)
        if year > 0:
            query = query.where(DeliveryRevenue.year == year)
        query = query.order_by(DeliveryRevenue.year.desc(), DeliveryRevenue.month.desc())

        records = session.exec(query).all()

        # Group by year-month
        monthly = {}
        for r in records:
            key = f"{r.year}-{r.month:02d}"
            if key not in monthly:
                monthly[key] = {
                    "year": r.year,
                    "month": r.month,
                    "channels": {},
                    "total_sales": 0,
                    "total_fees": 0,
                    "total_settlement": 0,
                    "total_orders": 0,
                }
            m = monthly[key]
            fee_bd = {}
            try:
                if r.fee_breakdown:
                    fee_bd = json_lib.loads(r.fee_breakdown)
            except:
                pass

            m["channels"][r.channel] = {
                "total_sales": r.total_sales,
                "total_fees": r.total_fees,
                "settlement_amount": r.settlement_amount,
                "order_count": r.order_count,
                "fee_rate": round(r.total_fees / r.total_sales * 100, 1) if r.total_sales > 0 else 0,
                "fee_breakdown": fee_bd,
            }
            m["total_sales"] += r.total_sales
            m["total_fees"] += r.total_fees
            m["total_settlement"] += r.settlement_amount
            m["total_orders"] += r.order_count

        # Convert to list & compute overall fee rate
        result = []
        for key in sorted(monthly.keys(), reverse=True):
            m = monthly[key]
            m["overall_fee_rate"] = round(m["total_fees"] / m["total_sales"] * 100, 1) if m["total_sales"] > 0 else 0
            result.append(m)

        # Channel summary totals across all months
        channel_totals = {}
        for r in records:
            if r.channel not in channel_totals:
                channel_totals[r.channel] = {"total_sales": 0, "total_fees": 0, "settlement_amount": 0, "order_count": 0}
            ct = channel_totals[r.channel]
            ct["total_sales"] += r.total_sales
            ct["total_fees"] += r.total_fees
            ct["settlement_amount"] += r.settlement_amount
            ct["order_count"] += r.order_count

        for ch, ct in channel_totals.items():
            ct["fee_rate"] = round(ct["total_fees"] / ct["total_sales"] * 100, 1) if ct["total_sales"] > 0 else 0

        return {
            "monthly": result,
            "channel_totals": channel_totals,
            "record_count": len(records),
        }

