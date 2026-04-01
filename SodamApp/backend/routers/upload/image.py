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

@router.post("/upload/image/expense")
async def upload_expense_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user), session: Session = Depends(get_session)):
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

@router.post("/upload/image/purchase")
async def upload_purchase_receipt_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """
    Processes a receipt image for purchase management.
    OCR → extract vendor/amount/date → save to DB.
    """
    import traceback
    from sqlmodel import select
    from models import Vendor, DailyExpense, UploadHistory
    from services.profit_loss_service import sync_all_expenses
    
    try:
        content = await file.read()
        service = OCRService()
        ocr_result = service.process_receipt_image(content)
        
        if ocr_result.get("status") != "success":
            return ocr_result
        
        data = ocr_result["data"]
        vendor_name = data["vendor_name"]
        total_amount = data["total_amount"]
        date_str = data["date"]
        category = data.get("category", "기타비용")
        
        try:
            date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
        except Exception:
            date_obj = datetime.date.today()
        
        # Create Upload History
        session = session
        if True:  # was: with Session(engine) as session:
            upload_history = UploadHistory(
                filename=file.filename or "receipt_photo.jpg",
                upload_type="purchase",
                record_count=0,
                status="active",
                business_id=bid
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id
        
        # Save to DB
        session = session
        if True:  # was: with Session(engine) as session:
            # Find or create vendor
            vendor = session.exec(
                apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.name == vendor_name)
            ).first()
            
            if not vendor:
                vendor = Vendor(
                    name=vendor_name,
                    category=category,
                    vendor_type="expense",
                    created_by_upload_id=upload_id,
                    business_id=bid
                )
                session.add(vendor)
                session.flush()
            
            # Create DailyExpense
            expense = DailyExpense(
                date=date_obj,
                vendor_name=vendor_name,
                vendor_id=vendor.id,
                amount=total_amount,
                category=category,
                note=f"📸 영수증 촬영 업로드",
                upload_id=upload_id,
                card_company="영수증",
                business_id=bid
            )
            session.add(expense)
            
            # Update history
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = 1
                session.add(upload_record)
            
            session.commit()
        
        # Sync P/L
        try:
            sync_session = session
            if True:  # was: with Session(engine) as sync_session:
                sync_all_expenses(date_obj.year, date_obj.month, sync_session, bid)
                sync_session.commit()
        except Exception:
            pass
        
        return {
            "status": "success",
            "message": ocr_result.get("message", "영수증 업로드 완료"),
            "data": data,
            "upload_id": upload_id,
            "saved": {
                "vendor_name": vendor_name,
                "amount": total_amount,
                "date": date_str,
                "category": category,
            }
        }
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Receipt Image Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/upload/image/revenue")
async def upload_revenue_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user), session: Session = Depends(get_session)):
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

@router.post("/upload/image/business-logo")
async def upload_business_logo(
    file: UploadFile = File(...), 
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token)
, session: Session = Depends(get_session)):
    try:
        from models import Business
        from services.database_service import DatabaseService
        from services.storage_service import get_storage
        from datetime import datetime
        import os
        
        storage = get_storage()
        
        # Validate file
        allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml"]
        if file.content_type not in allowed_types:
            raise HTTPException(status_code=400, detail="허용되지 않는 파일 형식입니다. (JPG, PNG, GIF, WEBP, SVG만 가능)")
        
        # Generate storage key
        timestamp = int(datetime.now().timestamp() * 1000)
        ext = os.path.splitext(file.filename or "logo.jpg")[1]
        filename = f"business_{bid}_{timestamp}{ext}"
        storage_key = f"logos/{filename}"
        
        # Upload to R2 (or local disk fallback)
        file_url = storage.upload_file(file.file, storage_key, file.content_type)
        
        # Update DB
        service = DatabaseService()
        try:
            business = service.session.get(Business, bid)
            if not business:
                raise HTTPException(status_code=404, detail="Business not found")
            business.logo_url = file_url
            service.session.add(business)
            service.session.commit()
        finally:
            service.close()
            
        return {"status": "success", "url": file_url}
    except HTTPException:
        raise
    except Exception as e:
        import traceback
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Business Logo Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail="로고 업로드 중 오류가 발생했습니다.")
