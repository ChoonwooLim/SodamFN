from fastapi import APIRouter, UploadFile, File, HTTPException
from services.ocr_service import OCRService
from services.excel_service import ExcelService
from models import Expense, Revenue, Session, create_engine, SQLModel
from database import engine 
from sqlmodel import Session
import datetime

router = APIRouter()

# --- EXPENSE ENDPOINTS ---

@router.post("/upload/image/expense")
async def upload_expense_image(file: UploadFile = File(...)):
    """
    Processes an image upload for receipt OCR (Expense).
    """
    try:
        content = await file.read()
        service = OCRService()
        result = service.process_image(content)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/excel/expense")
async def upload_expense_excel(file: UploadFile = File(...)):
    """
    Processes an excel upload and bulk inserts to DailyExpense.
    Also auto-creates/links vendors and syncs P/L.
    """
    import traceback
    from sqlmodel import select
    from models import Vendor, DailyExpense
    from services.profit_loss_service import sync_all_expenses
    
    try:
        content = await file.read()
        service = ExcelService("dummy_path")
        result = service.parse_upload(content)
        
        if result.get("status") == "error":
            return result
        
        expenses_data = result.get("data", [])
        inserted_count = 0
        vendor_created_count = 0
        processed_months = set()
        
        with Session(engine) as session:
            for item in expenses_data:
                if item['amount'] > 0:
                    item_name = item['item'] or "미지정"
                    category = item['category'] or "기타"
                    
                    # Parse date
                    date_str = item['date']
                    try:
                        date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                    except:
                        continue
                    
                    # Find or create vendor
                    vendor = session.exec(
                        select(Vendor).where(Vendor.name == item_name)
                    ).first()
                    
                    if not vendor:
                        vendor = Vendor(
                            name=item_name,
                            category=category,
                            vendor_type="expense"
                        )
                        session.add(vendor)
                        session.flush()  # Get the ID
                        vendor_created_count += 1
                    
                    # Create DailyExpense record
                    daily_expense = DailyExpense(
                        date=date_obj,
                        vendor_name=item_name,
                        vendor_id=vendor.id,
                        amount=item['amount'],
                        category=category,
                        note=None
                    )
                    session.add(daily_expense)
                    inserted_count += 1
                    
                    # Track months for P/L sync
                    processed_months.add((date_obj.year, date_obj.month))
            
            session.commit()
            
            # Sync P/L for all processed months
            for (year, month) in processed_months:
                try:
                    sync_all_expenses(year, month, session)
                except Exception as sync_err:
                    print(f"P/L Sync error for {year}-{month}: {sync_err}")
            
            session.commit()
            
        return {
            "status": "success", 
            "message": f"{inserted_count}건의 지출 내역이 저장되었습니다. (신규 거래처 {vendor_created_count}개 생성)",
            "count": inserted_count,
            "vendors_created": vendor_created_count
        }
            
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Excel Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

# --- REVENUE ENDPOINTS ---

@router.post("/upload/image/revenue")
async def upload_revenue_image(file: UploadFile = File(...)):
    """
    Processes an image upload for REVENUE (Mock).
    Maybe extracting daily sales report photo?
    """
    try:
        # Mock implementation for Revenue OCR
        import random
        today = datetime.date.today().strftime("%Y-%m-%d")
        
        # Simulate processing
        return {
            "status": "success",
            "data": {
                "date": today,
                "amount": random.randint(500000, 1500000),
                "channel": "매장",
                "description": "일일 매출 리포트 스캔"
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/excel/revenue")
async def upload_revenue_excel(file: UploadFile = File(...)):
    """
    Processes an excel upload and bulk inserts REVENUE.
    """
    try:
        content = await file.read()
        service = ExcelService("dummy_path")
        result = service.parse_revenue_upload(content)
        
        if result.get("status") == "error":
            return result
        
        revenue_data = result.get("data", [])
        inserted_count = 0
        
        with Session(engine) as session:
            for item in revenue_data:
                if item['amount'] > 0:
                    rev = Revenue(
                        date=item['date'],
                        amount=item['amount'],
                        channel=item['channel'],
                        description=item['description']
                    )
                    session.add(rev)
                    inserted_count += 1
            session.commit()
            
        return {
            "status": "success", 
            "message": f"{inserted_count}건의 매출 내역이 저장되었습니다.",
            "count": inserted_count
        }
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
