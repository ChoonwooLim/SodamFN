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
    NOW: Tracks UploadHistory for undo functionality.
    """
    import traceback
    from sqlmodel import select
    from models import Vendor, DailyExpense, UploadHistory
    from services.profit_loss_service import sync_all_expenses
    
    try:
        content = await file.read()
        service = ExcelService("dummy_path")
        result = service.parse_upload(content)
        
        if result.get("status") == "error":
            return result
        
        expenses_data = result.get("data", [])
        
        # --- Create Upload History Record ---
        with Session(engine) as session:
            upload_history = UploadHistory(
                filename=file.filename or "uploaded_file.xlsx",
                upload_type="expense",
                record_count=0,
                status="active"
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id
        
        inserted_count = 0
        vendor_created_count = 0
        processed_months = set()
        
        # Phase 1: Insert data
        with Session(engine) as session:
            # Re-attach upload_history if needed (not strictly necessary if we rely on ID)
            
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
                            vendor_type="expense",
                            created_by_upload_id=upload_id # Track creation source
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
                        note=None,
                        upload_id=upload_id # Track source
                    )
                    session.add(daily_expense)
                    inserted_count += 1
                    
                    # Track months for P/L sync
                    processed_months.add((date_obj.year, date_obj.month))
            
            # Update History Count
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = inserted_count
                session.add(upload_record)
                
            session.commit()
        
        # Phase 2: Sync P/L in a separate session
        if processed_months:
            with Session(engine) as sync_session:
                for (year, month) in processed_months:
                    try:
                        sync_all_expenses(year, month, sync_session)
                    except Exception as sync_err:
                        print(f"P/L Sync error for {year}-{month}: {sync_err}")
                sync_session.commit()
            
        return {
            "status": "success", 
            "message": f"{inserted_count}건의 지출 내역이 저장되었습니다. (신규 거래처 {vendor_created_count}개 생성)",
            "count": inserted_count,
            "vendors_created": vendor_created_count,
            "upload_id": upload_id
        }
            
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Excel Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

# --- HISTORY & ROLLBACK ENDPOINTS ---

@router.get("/uploads/history")
def get_upload_history(type: str = None):
    from models import UploadHistory
    from sqlmodel import select, desc
    
    with Session(engine) as session:
        statement = select(UploadHistory).order_by(desc(UploadHistory.created_at)).limit(20)
        if type:
            statement = statement.where(UploadHistory.upload_type == type)
        results = session.exec(statement).all()
        return results

@router.delete("/uploads/{upload_id}")
def rollback_upload(upload_id: int):
    """
    Rollback an upload by ID.
    Deletes all expenses created by this upload.
    Updates UploadHistory status to 'rolled_back'.
    Optionally deletes vendors created by this upload IF they are not used elsewhere (safe check).
    """
    from models import UploadHistory, DailyExpense, Vendor
    from sqlmodel import select
    from services.profit_loss_service import sync_all_expenses
    
    with Session(engine) as session:
        history = session.get(UploadHistory, upload_id)
        if not history:
            raise HTTPException(status_code=404, detail="Upload not found")
        
        if history.status == "rolled_back":
             raise HTTPException(status_code=400, detail="Already rolled back")

        # 1. Select Expenses to Delete
        expenses = session.exec(select(DailyExpense).where(DailyExpense.upload_id == upload_id)).all()
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
        vendors_created = session.exec(select(Vendor).where(Vendor.created_by_upload_id == upload_id)).all()
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
                select(DailyExpense).where(DailyExpense.vendor_id == vendor.id)
            ).all() # .count() is deprecated/tricky in some versions, len(all) is safe for small sets
            
            if len(remaining_expenses_count) == 0:
                session.delete(vendor)
                vendor_delete_count += 1
        
        # 3. Update History Status
        history.status = "rolled_back"
        session.add(history)
        
        session.commit()
        
        # 4. Re-sync P/L
        # New session/connection might be safer for complex sync logic if it uses its own session
        try:
            with Session(engine) as sync_session:
                for (year, month) in sync_months:
                    sync_all_expenses(year, month, sync_session)
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
