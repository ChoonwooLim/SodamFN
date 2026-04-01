from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from services.ocr_service import OCRService
from services.excel_service import ExcelService
from models import Expense, Revenue, Session, create_engine, SQLModel, User
from database import engine, get_session 
from sqlmodel import Session
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token, apply_bid_filter
import datetime

router = APIRouter()

# --- EXPENSE ENDPOINTS ---

@router.get("/uploads/history")
def get_upload_history(type: str = None, _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    from models import UploadHistory
    from sqlmodel import select, desc
    
    session = session
    if True:  # was: with Session(engine) as session:
        statement = apply_bid_filter(select(UploadHistory), UploadHistory, bid).order_by(desc(UploadHistory.created_at)).limit(20)
        if type:
            statement = statement.where(UploadHistory.upload_type == type)
        results = session.exec(statement).all()
        return results

@router.delete("/uploads/{upload_id}")
def rollback_upload(upload_id: int, _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Rollback an upload by ID.
    Deletes all expenses created by this upload.
    Updates UploadHistory status to 'rolled_back'.
    Optionally deletes vendors created by this upload IF they are not used elsewhere (safe check).
    """
    from models import UploadHistory, DailyExpense, Vendor
    from sqlmodel import select
    from services.profit_loss_service import sync_all_expenses
    
    session = session
    if True:  # was: with Session(engine) as session:
        history = session.exec(apply_bid_filter(select(UploadHistory), UploadHistory, bid).where(UploadHistory.id == upload_id)).first()
        if not history:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        if history.status == "rolled_back":
             raise HTTPException(status_code=400, detail="Already rolled back")

        # 1. Select Expenses to Delete
        expenses = session.exec(apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(DailyExpense.upload_id == upload_id)).all()
        expense_count = len(expenses)
        
        # Track months for re-sync
        sync_months = set()
        for exp in expenses:
            sync_months.add((exp.date.year, exp.date.month))
            session.delete(exp)
            
        # 2. Select Vendors to Delete (created by this upload)
        # Only delete if they have no other expenses (orphaned)
        # Actually simplest is to just delete if created_by_upload_id matches.
        # But if user manually added expenses to this vendor later, we shouldn't delete the vendor?
        # Let's verify if vendor has other expenses.
        vendors_created = session.exec(apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.created_by_upload_id == upload_id)).all()
        vendor_delete_count = 0
        
        for vendor in vendors_created:
            # Check for other expenses not from this upload
            # Since we just deleted all expenses from this upload in the session (but not committed),
            # counting expenses for this vendor in DB might still show them if not flushed?
            # session.delete puts them in deleted state.
            # Let's count remaining expenses.
            # We can use session.exec with count, filtering DailyExpense.vendor_id == vendor.id.
            # Since deletion is pending in session, standard count query usually sees pre-transaction state unless we flush.
            session.flush() # Ensure expenses are marked deleted
            
            remaining_expenses_count = session.exec(
                apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(DailyExpense.vendor_id == vendor.id)
            ).all() # .count() is deprecated/tricky in some versions, len(all) is safe for small sets
            
            if len(remaining_expenses_count) == 0:
                session.delete(vendor)
                vendor_delete_count += 1
        
        # 3. If this was a bank deposit upload, also reset classification rules
        if history.upload_type == "revenue":
            # Check if any deleted vendors were bank deposit related
            bank_vendors = [v for v in vendors_created if v.item and '은행입금' in v.item]
            if bank_vendors or any('현금매출' in (e.vendor_name or '') for e in expenses):
                # Delete all bank_deposit_revenue VendorRules for this business
                from models import VendorRule
                bank_rules = session.exec(
                    apply_bid_filter(select(VendorRule), VendorRule, bid).where(
                        VendorRule.source == "bank_deposit_revenue"
                    )
                ).all()
                for r in bank_rules:
                    session.delete(r)
                print(f"Reset {len(bank_rules)} bank deposit classification rules")
        
        # 4. Update History Status
        history.status = "rolled_back"
        session.add(history)
        
        session.commit()
        
        # 4. Re-sync P/L + Clean up DeliveryRevenue if delivery upload
        try:
            sync_session = session
            if True:  # was: with Session(engine) as sync_session:
                from services.profit_loss_service import sync_revenue_to_pl
                for (year, month) in sync_months:
                    sync_all_expenses(year, month, sync_session, bid)
                    sync_revenue_to_pl(year, month, sync_session, bid)
                    
                    # Recalculate delivery fees from remaining DeliveryRevenue records
                    from models import DeliveryRevenue, MonthlyProfitLoss
                    all_dr = sync_session.exec(
                        apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid).where(
                            DeliveryRevenue.year == year, DeliveryRevenue.month == month,
                        )
                    ).all()
                    total_delivery_fees = sum(d.total_fees for d in all_dr)
                    pl = sync_session.exec(
                        apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                            MonthlyProfitLoss.year == year, MonthlyProfitLoss.month == month,
                        )
                    ).first()
                    if pl:
                        pl.expense_delivery_fee = total_delivery_fees
                        sync_session.add(pl)
                        
                sync_session.commit()
        except Exception as e:
            print(f"Rollback Sync Error: {e}")
            
        return {
            "status": "success",
            "message": f"Rollback successful. Deleted {expense_count} expenses and {vendor_delete_count} vendors.",
            "deleted_expenses": expense_count,
            "deleted_vendors": vendor_delete_count
        }

# --- REVENUE ENDPOINTS ---

