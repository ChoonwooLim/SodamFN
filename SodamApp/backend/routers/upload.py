from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from services.ocr_service import OCRService
from services.excel_service import ExcelService
from models import Expense, Revenue, Session, create_engine, SQLModel, User
from database import engine 
from sqlmodel import Session
from routers.auth import get_admin_user
import datetime

router = APIRouter()

# --- EXPENSE ENDPOINTS ---

@router.post("/upload/image/expense")
async def upload_expense_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
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
async def upload_expense_excel(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
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
def get_upload_history(type: str = None, _admin: User = Depends(get_admin_user)):
    from models import UploadHistory
    from sqlmodel import select, desc
    
    with Session(engine) as session:
        statement = select(UploadHistory).order_by(desc(UploadHistory.created_at)).limit(20)
        if type:
            statement = statement.where(UploadHistory.upload_type == type)
        results = session.exec(statement).all()
        return results

@router.delete("/uploads/{upload_id}")
def rollback_upload(upload_id: int, _admin: User = Depends(get_admin_user)):
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
                from services.profit_loss_service import sync_revenue_to_pl
                for (year, month) in sync_months:
                    sync_all_expenses(year, month, sync_session)
                    sync_revenue_to_pl(year, month, sync_session)
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
async def upload_revenue_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
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
async def upload_revenue_excel(file: UploadFile = File(...), password: str = Form(None), _admin: User = Depends(get_admin_user)):
    """
    Smart revenue Excel upload.
    Supports: POS 일자별 매출, 카드상세매출, 월별 카드매출 요약, 배달앱 정산
    Optional password for encrypted files.
    """
    import traceback
    from sqlmodel import select
    from models import Vendor, DailyExpense, UploadHistory
    from services.profit_loss_service import sync_all_expenses, sync_revenue_to_pl
    
    try:
        content = await file.read()
        service = ExcelService("dummy_path")
        result = service.parse_revenue_upload(content, password=password)
        
        if result.get("status") == "error":
            return result
        
        file_type = result.get("file_type")
        
        # Card summary is info-only, no DB insertion
        if file_type == "card_summary":
            return result
        
        revenue_data = result.get("data", [])
        if not revenue_data:
            return {"status": "error", "message": "파싱된 매출 데이터가 없습니다."}
        
        # --- Create Upload History ---
        with Session(engine) as session:
            upload_history = UploadHistory(
                filename=file.filename or "revenue_upload.xlsx",
                upload_type="revenue",
                record_count=0,
                status="active"
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id
        
        inserted_count = 0
        skipped_count = 0
        dedup_skipped = 0
        dedup_replaced = 0
        vendor_created_count = 0
        processed_months = set()
        
        with Session(engine) as session:
            # Build vendor lookup
            vendors = session.exec(select(Vendor)).all()
            vendor_by_name = {v.name: v for v in vendors}
            
            # --- Smart Card Sales Deduplication ---
            # Determine the date range of the upload data
            upload_dates = set()
            for item in revenue_data:
                try:
                    d = datetime.datetime.strptime(item['date'], "%Y-%m-%d").date()
                    upload_dates.add(d)
                except:
                    pass
            
            if upload_dates:
                min_date = min(upload_dates)
                max_date = max(upload_dates)
                
                # Check what card data already exists in DB for this period
                existing_card_expenses = session.exec(
                    select(DailyExpense).where(
                        DailyExpense.date >= min_date,
                        DailyExpense.date <= max_date,
                        DailyExpense.payment_method == 'Card',
                        DailyExpense.category == 'store',
                    )
                ).all()
                
                existing_card_by_date = {}
                for exp in existing_card_expenses:
                    if exp.date not in existing_card_by_date:
                        existing_card_by_date[exp.date] = []
                    existing_card_by_date[exp.date].append(exp)
                
                # Determine if existing data is "aggregated" (카드매출(통합)) or "detailed" (per card company)
                has_aggregated = any(
                    exp.vendor_name == '카드매출(통합)' for exps in existing_card_by_date.values() for exp in exps
                )
                has_detailed = any(
                    '카드' in (exp.vendor_name or '') and exp.vendor_name != '카드매출(통합)'
                    for exps in existing_card_by_date.values() for exp in exps
                )
                
                if file_type == "pos_daily" and has_detailed:
                    # POS daily file uploaded AFTER card detail: skip card entries from POS
                    print(f"[Dedup] POS daily upload: card detail already exists, will skip card entries")
                elif file_type == "card_detail" and has_aggregated:
                    # Card detail file uploaded AFTER POS daily: remove aggregated card entries
                    print(f"[Dedup] Card detail upload: removing aggregated 카드매출(통합) entries")
                    for exps in existing_card_by_date.values():
                        for exp in exps:
                            if exp.vendor_name == '카드매출(통합)':
                                session.delete(exp)
                                dedup_replaced += 1
                    session.flush()
            
            for item in revenue_data:
                if item['amount'] <= 0:
                    continue
                
                # --- Dedup: skip POS card entries if card detail already in DB ---
                payment_type = item.get('payment_type', 'card')
                if file_type == "pos_daily" and payment_type == 'card' and has_detailed:
                    dedup_skipped += 1
                    continue
                
                vendor_name = item['vendor_name']
                date_str = item['date']
                amount = item['amount']
                
                try:
                    date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                except Exception:
                    continue
                
                # Find or create vendor
                vendor = vendor_by_name.get(vendor_name)
                if not vendor:
                    # For card_detail: card company vendors should exist
                    # For pos_daily: may need to create cash or generic card vendor
                    vendor_category = 'delivery' if payment_type == 'delivery' else 'store'
                    vendor = Vendor(
                        name=vendor_name,
                        category=vendor_category,
                        item=f'소담김밥 건대매장:{payment_type}',
                        vendor_type='revenue',
                        created_by_upload_id=upload_id,
                    )
                    session.add(vendor)
                    session.flush()
                    vendor_by_name[vendor_name] = vendor
                    vendor_created_count += 1
                
                # Duplicate check: same date + vendor
                existing = session.exec(
                    select(DailyExpense).where(
                        DailyExpense.date == date_obj,
                        DailyExpense.vendor_id == vendor.id,
                    )
                ).first()
                
                if existing:
                    # For card revenue: multiple card company names map to same vendor
                    # (e.g., 하나카드 + 하나구외환 → 소담김밥 건대본점 하나카드)
                    # Accumulate amounts instead of skipping
                    if payment_type == 'card' and existing.upload_id == upload_id:
                        existing.amount += amount
                        session.add(existing)
                        continue
                    skipped_count += 1
                    continue
                
                payment_method = 'Cash' if payment_type == 'cash' else ('Delivery' if payment_type == 'delivery' else 'Card')
                item_category = 'delivery' if payment_type == 'delivery' else 'store'
                expense = DailyExpense(
                    date=date_obj,
                    vendor_name=vendor.name,
                    vendor_id=vendor.id,
                    amount=amount,
                    category=item_category,
                    note=item.get('note', ''),
                    upload_id=upload_id,
                    payment_method=payment_method,
                )
                session.add(expense)
                inserted_count += 1
                processed_months.add((date_obj.year, date_obj.month))
            
            # Update upload history
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = inserted_count
                session.add(upload_record)
            
            session.commit()
        
        # Sync P/L (expenses + revenue)
        if processed_months:
            try:
                with Session(engine) as sync_session:
                    for (year, month) in processed_months:
                        sync_all_expenses(year, month, sync_session)
                        sync_revenue_to_pl(year, month, sync_session)
                    sync_session.commit()
            except Exception as e:
                print(f"Revenue Upload P/L Sync error: {e}")
        
        summary = result.get("summary", {})
        dedup_msg = ""
        if dedup_skipped > 0:
            dedup_msg = f" (카드상세 데이터 존재로 POS 카드매출 {dedup_skipped}건 자동 제외)"
        if dedup_replaced > 0:
            dedup_msg = f" (POS 통합카드매출 {dedup_replaced}건을 카드사별 상세로 대체)"
        
        return {
            "status": "success",
            "file_type": file_type,
            "file_type_label": result.get("file_type_label", ""),
            "message": f"{inserted_count}건의 매출 내역이 저장되었습니다.{dedup_msg}",
            "count": inserted_count,
            "skipped": skipped_count,
            "dedup_skipped": dedup_skipped,
            "dedup_replaced": dedup_replaced,
            "vendors_created": vendor_created_count,
            "upload_id": upload_id,
            "summary": summary,
        }
            
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Revenue Excel Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)

