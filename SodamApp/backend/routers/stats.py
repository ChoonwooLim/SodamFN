from fastapi import APIRouter, HTTPException, UploadFile, File
from services.database_service import DatabaseService
from services.profit_loss_service import sync_all_expenses
from pydantic import BaseModel
from datetime import date
from typing import Optional, List
from models import DailyExpense, Vendor

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_data(year: int = 2025, month: int = 12):
    try:
        with DatabaseService() as service:
            # Summary for selected month
            data = service.get_monthly_summary(year=year, month=month)
            
            # Previous month calculation
            if month == 1:
                prev_year = year - 1
                prev_month = 12
            else:
                prev_year = year
                prev_month = month - 1
                
            prev_data = service.get_monthly_summary(year=prev_year, month=prev_month)
            
            growth = 0
            if prev_data['revenue'] > 0:
                growth = ((data['revenue'] - prev_data['revenue']) / prev_data['revenue']) * 100
                
            # 6-Month Trend Calculation
            monthly_trend = []
            # Loop backwards 5 times + current = 6 months
            curr_y, curr_m = year, month
            
            # Generate list of (year, month) tuples for last 6 months including current
            trend_months = []
            for _ in range(6):
                trend_months.append((curr_y, curr_m))
                if curr_m == 1:
                    curr_y -= 1
                    curr_m = 12
                else:
                    curr_m -= 1
            
            # Reverse to show chronological order
            trend_months.reverse()
            
            for y, m in trend_months:
                summary = service.get_monthly_summary(year=y, month=m)
                monthly_trend.append({"month": f"{m}월", **summary})

            return {
                "status": "success",
                "data": {
                    "year": year, # Include year in response
                    "month": f"{month}월",
                    "revenue": data['revenue'], 
                    "net_profit": data['profit'],
                    "margin_rate": data['margin'],
                    "revenue_growth": round(growth, 1),
                    "monthly_trend": monthly_trend
                }
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/revenue")
def get_revenue_breakdown(year: int = 2025, month: int = 12):
    try:
        with DatabaseService() as service:
            data = service.get_revenue_breakdown(year=year, month=month)
            return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/cost")
def get_cost_breakdown(year: int = 2025, month: int = 12):
    try:
        with DatabaseService() as service:
            data = service.get_top_expenses(year=year, month=month)
            return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vendors")
def get_vendors_list(year: Optional[int] = None, month: Optional[int] = None):
    try:
        with DatabaseService() as service:
            data = service.get_vendors(year=year, month=month)
            return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class VendorUpdate(BaseModel):
    name: str
    item: Optional[str] = None
    category: Optional[str] = None
    vendor_type: str = "expense"
    order_index: int = 0

@router.post("/vendors")
def update_vendor(payload: VendorUpdate):
    try:
        with DatabaseService() as service:
            success = service.update_vendor_full(
                name=payload.name,
                item=payload.item,
                category=payload.category,
                vendor_type=payload.vendor_type,
                order_index=payload.order_index
            )
            if success:
                return {"status": "success"}
            else:
                 return {"status": "error", "message": "Failed to update"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/vendors/{vendor_name}")
def delete_vendor(vendor_name: str):
    try:
        with DatabaseService() as service:
            success = service.delete_vendor(vendor_name)
            if success:
                return {"status": "success"}
            else:
                return {"status": "error", "message": "Vendor not found"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/vendors/id/{vendor_id}")
def delete_vendor_by_id(vendor_id: int):
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import Vendor
        
        with Session(engine) as session:
            vendor = session.get(Vendor, vendor_id)
            if not vendor:
                raise HTTPException(status_code=404, detail="Vendor not found")
            
            # Delete associated expenses? Or handle logic?
            # Existing delete_vendor logic in DatabaseService handles expense deletion/unlinking.
            # Let's replicate or reuse DatabaseService logic if possible, but simpler to just do it here for now.
            
            # Ideally use service, but service.delete_vendor takes name.
            # Let's just do direct deletion.
            
            session.delete(vendor)
            session.commit()
            return {"status": "success"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class VendorPatch(BaseModel):
    name: str = None
    item: str = None
    category: str = None
    vendor_type: str = None
    order_index: int = None

@router.patch("/vendors/{vendor_id}")
def patch_vendor(vendor_id: int, payload: VendorPatch):
    """Update vendor by ID - supports name change"""
    try:
        print(f"[PATCH VENDOR] ID: {vendor_id}, Payload: {payload}")
        from sqlmodel import Session, select
        from database import engine
        from models import Vendor
        
        with Session(engine) as session:
            vendor = session.get(Vendor, vendor_id)
            if not vendor:
                print(f"[PATCH VENDOR] Vendor {vendor_id} not found")
                return {"status": "error", "message": "Vendor not found"}
            
            if payload.name is not None:
                vendor.name = payload.name
            if payload.item is not None:
                vendor.item = payload.item
            if payload.category is not None:
                vendor.category = payload.category
            if payload.vendor_type is not None:
                vendor.vendor_type = payload.vendor_type
            if payload.order_index is not None:
                vendor.order_index = payload.order_index
            
            session.add(vendor)
            session.commit()
            print(f"[PATCH VENDOR] Success: {vendor.name}")
            
        # --- Auto Sync P/L if category changed (in separate session) ---
        if payload.category is not None:
            with Session(engine) as sync_session:
                # Find all months where this vendor has expenses
                expenses = sync_session.exec(
                    select(DailyExpense).where(DailyExpense.vendor_id == vendor_id)
                ).all()
                
                affected_months = set((e.date.year, e.date.month) for e in expenses)
                
                print(f"[SYNC P/L] Triggering sync for {len(affected_months)} months due to Vendor category change")
                for y, m in affected_months:
                    try:
                        sync_all_expenses(y, m, sync_session)
                    except Exception as sync_err:
                        print(f"[SYNC P/L] Error for {y}-{m}: {sync_err}")
                sync_session.commit()
        # -----------------------------------------

        return {"status": "success"}
    except Exception as e:
        print(f"[PATCH VENDOR] Error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

from typing import List

class VendorMergeRequest(BaseModel):
    source_ids: List[int]

@router.post("/vendors/{target_id}/merge")
def merge_vendors(target_id: int, payload: VendorMergeRequest):
    """Merge multiple vendors into one target vendor.
    
    All DailyExpense records from source vendors will be updated
    to point to the target vendor, then source vendors are deleted.
    """
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import Vendor, DailyExpense
        
        with Session(engine) as session:
            # 1. Get target vendor
            target = session.get(Vendor, target_id)
            if not target:
                raise HTTPException(status_code=404, detail="Target vendor not found")
            
            # 2. Validate source IDs
            if target_id in payload.source_ids:
                raise HTTPException(status_code=400, detail="Target vendor cannot be in source list")
            
            merged_count = 0
            deleted_vendors = []
            
            for source_id in payload.source_ids:
                source = session.get(Vendor, source_id)
                if not source:
                    continue
                
                # 3. Update all DailyExpense records
                expenses = session.exec(
                    select(DailyExpense).where(DailyExpense.vendor_id == source_id)
                ).all()
                
                for expense in expenses:
                    expense.vendor_id = target_id
                    expense.vendor_name = target.name
                    session.add(expense)
                    merged_count += 1
                
                # 4. Delete source vendor
                deleted_vendors.append(source.name)
                session.delete(source)
            
            session.commit()
            
            return {
                "status": "success",
                "merged_expenses": merged_count,
                "deleted_vendors": deleted_vendors,
                "target_vendor": target.name
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/backup/excel")
def download_backup():
    try:
        service = DatabaseService()
        filename = f"sodam_backup_{date.today()}.xlsx"
        filepath = f"C:\\WORK\\SodamFN\\{filename}" # Saving to root for easy access
        service.export_to_excel(filepath)
        return {"status": "success", "message": f"Backup saved to {filepath}", "path": filepath}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

class UncategorizedMergeRequest(BaseModel):
    target_name: str
    source_names: List[str]
    category: str = "other"

@router.post("/vendors/merge-uncategorized")
def merge_uncategorized_vendors(payload: UncategorizedMergeRequest):
    """
    Merge uncategorized vendors (by name) into a target vendor.
    1. Find or create target vendor.
    2. Update DailyExpense records with matching names to point to target vendor.
    """
    try:
        from sqlmodel import Session, select
        from database import engine
        from models import Vendor, DailyExpense
        
        with Session(engine) as session:
            # 1. Find or create target vendor
            # Check if target vendor exists by name
            target_vendor = session.exec(
                select(Vendor).where(Vendor.name == payload.target_name)
            ).first()
            
            if not target_vendor:
                # Create new vendor
                # Determine vendor_type based on category (heuristic)
                # This could be improved if frontend sends vendor_type
                vendor_type = "expense" 
                if payload.category in ["delivery", "store", "other_revenue"]:
                     vendor_type = "revenue"
                
                target_vendor = Vendor(
                    name=payload.target_name,
                    category=payload.category,
                    vendor_type=vendor_type
                )
                session.add(target_vendor)
                session.commit()
                session.refresh(target_vendor)
            
            merged_count = 0
            
            # 2. Update DailyExpenses
            # We look for expenses that have vendor_name in source_names
            # And preferably vendor_id IS NULL (but user might want to merge even if some have IDs?)
            # The prompt implies merging "uncategorized" which usually means no ID.
            # But let's be safe and update by name mainly.
            
            for src_name in payload.source_names:
                # Skip if source is same as target
                if src_name == payload.target_name:
                    continue
                    
                expenses = session.exec(
                    select(DailyExpense).where(DailyExpense.vendor_name == src_name)
                ).all()
                
                for expense in expenses:
                    expense.vendor_id = target_vendor.id
                    expense.vendor_name = target_vendor.name
                    session.add(expense)
                    merged_count += 1
            
            # 3. Delete source Vendors if they exist
            # Since these are "uncategorized" vendors appearing in the list, they likely exist in Vendor table.
            for src_name in payload.source_names:
                if src_name == payload.target_name:
                    continue
                    
                source_vendors = session.exec(
                    select(Vendor).where(Vendor.name == src_name)
                ).all()
                
                for sv in source_vendors:
                    session.delete(sv)

            # Also update expenses for target_name itself if they have no ID
            target_expenses = session.exec(
                select(DailyExpense).where(
                    DailyExpense.vendor_name == payload.target_name,
                    DailyExpense.vendor_id == None
                )
            ).all()
            for expense in target_expenses:
                expense.vendor_id = target_vendor.id
                session.add(expense)
            
            session.commit()
            
            # --- Auto Sync P/L after Merge ---
            # All merged expenses now belong to target_vendor. 
            # We need to sync months where target_vendor has expenses.
            # (Fetching again to cover freshly updated/merged ones)
            all_target_expenses = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == target_vendor.id)
            ).all()
            affected_months = set((e.date.year, e.date.month) for e in all_target_expenses)
            
            print(f"[SYNC P/L MERGE] Syncing {len(affected_months)} months for {target_vendor.name}")
            for y, m in affected_months:
                sync_all_expenses(y, m, session)
            # ---------------------------------
            
            return {
                "status": "success",
                "merged_expenses": merged_count,
                "target_vendor": target_vendor.name,
                "target_id": target_vendor.id
            }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
