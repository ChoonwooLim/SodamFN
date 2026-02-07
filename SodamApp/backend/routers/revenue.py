"""
Revenue Management API — DailyExpense-based CRUD for revenue vendors.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from sqlmodel import Session, select, func, col
from database import engine
from models import DailyExpense, Vendor, Revenue
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
def get_daily_revenue(year: int, month: int):
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
                })

        return {"status": "success", "data": result, "vendors": vendors_list}


# ─── GET summary stats ───

@router.get("/summary")
def get_revenue_summary(year: int, month: int):
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

        # ── Also include Revenue table entries (배달앱 data) ──
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
                amount = rev.amount or 0
                total += amount
                by_category["delivery"] = by_category.get("delivery", 0) + amount

                day_str = str(rev.date)
                if day_str not in by_day_map:
                    by_day_map[day_str] = {"date": day_str, "total": 0, "store": 0, "delivery": 0}
                by_day_map[day_str]["total"] += amount
                by_day_map[day_str]["delivery"] += amount

                if v.name not in by_vendor_map:
                    by_vendor_map[v.name] = {"name": v.name, "category": "delivery", "total": 0}
                by_vendor_map[v.name]["total"] += amount

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
def create_daily_revenue(payload: RevenueCreate):
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
def update_daily_revenue(expense_id: int, payload: RevenueUpdate):
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
def delete_daily_revenue(expense_id: int):
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
