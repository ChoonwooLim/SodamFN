from fastapi import APIRouter, HTTPException, UploadFile, File
from services.database_service import DatabaseService
from pydantic import BaseModel
from datetime import date

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_data(year: int = 2025, month: int = 12):
    try:
        service = DatabaseService()
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
        service = DatabaseService()
        data = service.get_revenue_breakdown(year=year, month=month)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/cost")
def get_cost_breakdown(year: int = 2025, month: int = 12):
    try:
        service = DatabaseService()
        data = service.get_top_expenses(year=year, month=month)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/vendors")
def get_vendors_list():
    try:
        service = DatabaseService()
        data = service.get_vendors()
        return {"status": "success", "data": data}
    except Exception as e:
        return {"status": "error", "message": str(e)}

class VendorUpdate(BaseModel):
    name: str
    item: str = None
    category: str = None
    vendor_type: str = "expense"
    order_index: int = 0

@router.post("/vendors")
def update_vendor(payload: VendorUpdate):
    try:
        service = DatabaseService()
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
        service = DatabaseService()
        success = service.delete_vendor(vendor_name)
        if success:
            return {"status": "success"}
        else:
            return {"status": "error", "message": "Vendor not found"}
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
