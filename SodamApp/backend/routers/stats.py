from fastapi import APIRouter, HTTPException, UploadFile, File
from services.database_service import DatabaseService
from pydantic import BaseModel
from datetime import date

router = APIRouter()

@router.get("/dashboard")
def get_dashboard_data():
    try:
        service = DatabaseService()
        # Default to December (12) for now
        data = service.get_monthly_summary(month=12)
        
        prev_data = service.get_monthly_summary(month=11)
        growth = 0
        if prev_data['revenue'] > 0:
            growth = ((data['revenue'] - prev_data['revenue']) / prev_data['revenue']) * 100
            
        return {
            "status": "success",
            "data": {
                "month": "12월",
                "net_profit": data['profit'],
                "margin_rate": data['margin'],
                "revenue_growth": round(growth, 1),
                "monthly_trend": [
                    {"name": "8월", "profit": 0}, # Placeholder or fetch real history
                    {"name": "9월", "profit": 23748853},
                    {"name": "10월", "profit": 16890562},
                    {"name": "11월", "profit": 25304912},
                    {"name": "12월", "profit": data['profit']}
                ]
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/revenue")
def get_revenue_breakdown():
    try:
        service = DatabaseService()
        data = service.get_revenue_breakdown(month=12)
        return {"status": "success", "data": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/analytics/cost")
def get_cost_breakdown():
    try:
        service = DatabaseService()
        data = service.get_top_expenses(month=12)
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
    item: str

@router.post("/vendors")
def update_vendor(payload: VendorUpdate):
    try:
        service = DatabaseService()
        success = service.update_vendor_item(payload.name, payload.item)
        if success:
            return {"status": "success"}
        else:
             return {"status": "error", "message": "Failed to update"}
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
