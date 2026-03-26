from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
from typing import Optional
from services.ocr_service import OCRService
from services.excel_service import ExcelService
from models import Expense, Revenue, Session, create_engine, SQLModel, User
from database import engine 
from sqlmodel import Session
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token, apply_bid_filter
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

@router.post("/upload/image/purchase")
async def upload_purchase_receipt_image(file: UploadFile = File(...), _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
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
        with Session(engine) as session:
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
        with Session(engine) as session:
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
            with Session(engine) as sync_session:
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

@router.post("/upload/excel/expense")
async def upload_expense_excel(file: UploadFile = File(...), _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
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
                status="active",
                business_id=bid
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
                        apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.name == item_name)
                    ).first()
                    
                    if not vendor:
                        vendor = Vendor(
                            name=item_name,
                            category=category,
                            vendor_type="expense",
                            created_by_upload_id=upload_id, # Track creation source
                            business_id=bid
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
                        upload_id=upload_id, # Track source
                        business_id=bid
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
                        sync_all_expenses(year, month, sync_session, bid)
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
def get_upload_history(type: str = None, _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
    from models import UploadHistory
    from sqlmodel import select, desc
    
    with Session(engine) as session:
        statement = apply_bid_filter(select(UploadHistory), UploadHistory, bid).order_by(desc(UploadHistory.created_at)).limit(20)
        if type:
            statement = statement.where(UploadHistory.upload_type == type)
        results = session.exec(statement).all()
        return results

@router.delete("/uploads/{upload_id}")
def rollback_upload(upload_id: int, _admin: User = Depends(get_admin_user), bid = Depends(get_bid_from_token)):
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
        
        # 3. Update History Status
        history.status = "rolled_back"
        session.add(history)
        
        session.commit()
        
        # 4. Re-sync P/L + Clean up DeliveryRevenue if delivery upload
        try:
            with Session(engine) as sync_session:
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
async def upload_revenue_excel(
    file: UploadFile = File(...),
    password: Optional[str] = Form(None),
    classifications: Optional[str] = Form(None),
    _admin: User = Depends(get_admin_user),
    bid = Depends(get_bid_from_token)
):
    """
    Smart revenue Excel upload.
    Supports: POS 일자별 매출, 카드상세매출, 월별 카드매출 요약, 배달앱 정산
    Optional password for encrypted files.
    """
    import traceback
    from sqlmodel import select
    from models import Vendor, DailyExpense, UploadHistory, VendorRule
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
                status="active",
                business_id=bid
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id
        
        inserted_count = 0
        skipped_count = 0
        dedup_skipped = 0
        # --- Handle Optional Target Classifications ---
        if classifications:
            try:
                import json
                rules = json.loads(classifications)
                with Session(engine) as s:
                    for rule in rules:
                        # rule is like { memo: "홍길동", category: "카드수수료" }
                        existing_rule = s.exec(
                            apply_bid_filter(select(VendorRule), VendorRule, bid).where(
                                VendorRule.original_name == rule['memo'],
                                VendorRule.source == "bank_deposit_revenue"
                            )
                        ).first()
                        if existing_rule:
                            existing_rule.category = rule['category']
                            s.add(existing_rule)
                        else:
                            new_rule = VendorRule(
                                original_name=rule['memo'],
                                category=rule['category'],
                                source="bank_deposit_revenue",
                                business_id=bid
                            )
                            s.add(new_rule)
                    s.commit()
            except Exception as e:
                print(f"Classification parse error: {e}")

        dedup_replaced = 0
        dedup_skipped = 0
        delivery_initialized = 0
        vendor_created_count = 0
        card_fee_calculated = None
        cash_sales_calculated = 0
        personal_income_calculated = 0
        processed_months = set()
        
        with Session(engine) as session:
            # Build vendor lookup
            vendors = session.exec(apply_bid_filter(select(Vendor), Vendor, bid)).all()
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
                    apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
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

                if file_type == "delivery_settlement":
                    import calendar
                    # Determine the channel from the summary
                    summary_info = result.get("summary", {})
                    channel_name = summary_info.get("channel", "")
                    
                    # Map channel to revenue vendor keyword and P/L field
                    CHANNEL_VENDOR_KW = {
                        "쿠팡": "쿠팡", "쿠팡이츠": "쿠팡", "Coupang": "쿠팡",
                        "배민": "배달의민족", "배달의민족": "배달의민족", "Baemin": "배달의민족",
                        "요기요": "요기요", "Yogiyo": "요기요",
                        "땡겨요": "땡겨요", "Ddangyo": "땡겨요",
                    }
                    channel_kw = CHANNEL_VENDOR_KW.get(channel_name, channel_name)
                    
                    # Find all unique periods (year, month) to clear
                    periods_to_clear = set((d.year, d.month) for d in upload_dates)
                    
                    for (y, m) in periods_to_clear:
                        last_day = calendar.monthrange(y, m)[1]
                        start_d = datetime.date(y, m, 1)
                        end_d = datetime.date(y, m, last_day)
                        
                        # Delete ALL delivery-category DailyExpense for this channel+month
                        # by matching vendor_name containing the channel keyword
                        all_delivery = session.exec(
                            apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
                                DailyExpense.date >= start_d,
                                DailyExpense.date <= end_d,
                                DailyExpense.category == 'delivery',
                            )
                        ).all()
                        
                        for old_rec in all_delivery:
                            if channel_kw and channel_kw in (old_rec.vendor_name or ''):
                                session.delete(old_rec)
                                delivery_initialized += 1
                        
                        # Also delete from DeliveryRevenue table for this channel+month
                        from models import DeliveryRevenue
                        CHANNEL_KEY_MAP = {"쿠팡": "Coupang", "쿠팡이츠": "Coupang", "배달의민족": "Baemin", "배민": "Baemin",
                                           "요기요": "Yogiyo", "땡겨요": "Ddangyo", "Coupang": "Coupang", "Baemin": "Baemin",
                                           "Yogiyo": "Yogiyo", "Ddangyo": "Ddangyo"}
                        dr_channel = CHANNEL_KEY_MAP.get(channel_name, channel_name)
                        old_dr = session.exec(
                            apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid).where(
                                DeliveryRevenue.channel == dr_channel,
                                DeliveryRevenue.year == y,
                                DeliveryRevenue.month == m,
                            )
                        ).first()
                        if old_dr:
                            session.delete(old_dr)
                        
                        # Reset the corresponding P/L revenue field for this channel
                        from models import MonthlyProfitLoss
                        PL_CHANNEL_FIELD = {"Coupang": "revenue_coupang", "Baemin": "revenue_baemin",
                                            "Yogiyo": "revenue_yogiyo", "Ddangyo": "revenue_ddangyo"}
                        pl_field = PL_CHANNEL_FIELD.get(dr_channel)
                        if pl_field:
                            pl = session.exec(
                                apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                                    MonthlyProfitLoss.year == y, MonthlyProfitLoss.month == m,
                                )
                            ).first()
                            if pl:
                                setattr(pl, pl_field, 0)
                                session.add(pl)
                    
                    if delivery_initialized > 0:
                        session.flush()
                        print(f"[Dedup] delivery_settlement: cleared {delivery_initialized} old records for channel '{channel_kw}'")
            
            for item in revenue_data:
                if file_type == "bank_deposit_card":
                    # Bank deposits are NOT revenue — they're for card fee calculation
                    memo = item.get('memo', '')
                    default_cat = item.get('default_category', '?')
                    card_co = item.get('card_company')
                    
                    # 1. Check VendorRule first (previously classified by user)
                    rule = session.exec(
                        apply_bid_filter(select(VendorRule), VendorRule, bid).where(
                            VendorRule.original_name == memo,
                            VendorRule.source == "bank_deposit_revenue"
                        )
                    ).first()
                    cat = rule.category if rule else None
                    
                    # 2. If no rule, auto-classify known types (skip modal)
                    if not cat:
                        if card_co:  # Auto-detected card company
                            cat = '카드입금'
                        elif default_cat == '배달앱입금':
                            cat = '배달앱입금'
                        elif default_cat == '페이입금':
                            cat = '페이입금'
                        elif default_cat == '무시':
                            cat = '무시'
                    
                    # 3. If still no cat → need user classification (show in modal)
                    if not cat and not classifications:
                        if not hasattr(session, '_unclassified_memos'):
                            session._unclassified_memos = {}
                        if memo not in session._unclassified_memos:
                            session._unclassified_memos[memo] = {
                                "memo": memo,
                                "total_amount": 0,
                                "count": 0,
                                "default_category": default_cat,
                                "card_company": card_co,
                                "sample_dates": []
                            }
                        session._unclassified_memos[memo]["total_amount"] += item['amount']
                        session._unclassified_memos[memo]["count"] += 1
                        if len(session._unclassified_memos[memo]["sample_dates"]) < 3:
                            session._unclassified_memos[memo]["sample_dates"].append(item['date'])
                        continue
                    
                    # Apply classification from current upload classifications
                    if not cat and classifications:
                        import json as json_lib
                        try:
                            cls_rules = json_lib.loads(classifications) if isinstance(classifications, str) else classifications
                            for cr in cls_rules:
                                if cr.get('memo') == memo:
                                    cat = cr.get('category')
                                    break
                        except:
                            pass
                    
                    if not cat or cat == '무시':
                        continue
                    
                    date_str = item['date']
                    amount = item['amount']
                    try:
                        date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                    except:
                        continue
                    
                    # Track totals by category for summary
                    if not hasattr(session, '_bank_deposit_totals'):
                        session._bank_deposit_totals = {}
                    if cat not in session._bank_deposit_totals:
                        session._bank_deposit_totals[cat] = {"amount": 0, "count": 0}
                    session._bank_deposit_totals[cat]["amount"] += amount
                    session._bank_deposit_totals[cat]["count"] += 1
                    
                    # Track per-card-company deposits
                    card_co = item.get('card_company')
                    if card_co and cat == '카드입금':
                        if not hasattr(session, '_card_company_deposits'):
                            session._card_company_deposits = {}
                        if card_co not in session._card_company_deposits:
                            session._card_company_deposits[card_co] = {"amount": 0, "count": 0}
                        session._card_company_deposits[card_co]["amount"] += amount
                        session._card_company_deposits[card_co]["count"] += 1
                    
                    processed_months.add((date_obj.year, date_obj.month))
                    
                    # 현금매출 → 실제 매출로 저장 (POS에 안 잡힌 현금)
                    if cat == '현금매출':
                        memo = item.get('memo', '')
                        vendor_name = f"현금매출({memo})"
                        vendor = vendor_by_name.get(vendor_name)
                        if not vendor:
                            vendor = Vendor(
                                name=vendor_name, category='store',
                                item='은행입금:현금매출', vendor_type='revenue',
                                created_by_upload_id=upload_id, business_id=bid
                            )
                            session.add(vendor)
                            session.flush()
                            vendor_by_name[vendor_name] = vendor
                            vendor_created_count += 1
                        
                        existing = session.exec(
                            apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
                                DailyExpense.date == date_obj,
                                DailyExpense.vendor_id == vendor.id,
                            )
                        ).first()
                        if existing:
                            if existing.upload_id == upload_id:
                                existing.amount += amount
                                session.add(existing)
                            else:
                                skipped_count += 1
                        else:
                            expense = DailyExpense(
                                date=date_obj, vendor_name=vendor.name, vendor_id=vendor.id,
                                amount=amount, category='store', note=f'현금입금: {memo}',
                                upload_id=upload_id, payment_method='Cash', business_id=bid
                            )
                            session.add(expense)
                            inserted_count += 1
                            cash_sales_calculated += amount
                    
                    # 카드/페이/배달앱/개인 → 집계만 (매출 중복 방지)
                    continue
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
                        business_id=bid
                    )
                    session.add(vendor)
                    session.flush()
                    vendor_by_name[vendor_name] = vendor
                    vendor_created_count += 1
                
                # Duplicate check: same date + vendor
                existing = session.exec(
                    apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
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
                    business_id=bid
                )
                session.add(expense)
                inserted_count += 1
                processed_months.add((date_obj.year, date_obj.month))
            
            # Check if there are unclassified bank deposit memos
            if file_type == "bank_deposit_card" and hasattr(session, '_unclassified_memos') and session._unclassified_memos:
                # Rollback - don't save anything yet
                session.rollback()
                # Delete the upload history record
                with Session(engine) as cleanup_session:
                    old_upload = cleanup_session.get(UploadHistory, upload_id)
                    if old_upload:
                        cleanup_session.delete(old_upload)
                        cleanup_session.commit()
                
                items = list(session._unclassified_memos.values())
                # Sort: high amount first
                items.sort(key=lambda x: -x['total_amount'])
                return {
                    "status": "requires_classification",
                    "message": "은행 입금내역의 송금자를 분류해주세요.",
                    "items": items,
                    "file_type": "bank_deposit_card",
                    "total_records": len(revenue_data),
                }
            # If bank_deposit_card with classifications completed, return summary
            if file_type == "bank_deposit_card" and hasattr(session, '_bank_deposit_totals'):
                totals = session._bank_deposit_totals
                summary_info = result.get("summary", {})
                card_company_deposits = getattr(session, '_card_company_deposits', {})
                
                # Calculate card fee: compare card sales from DB vs card+pay deposits
                card_deposit_total = totals.get('카드입금', {}).get('amount', 0) + totals.get('페이입금', {}).get('amount', 0)
                
                # Get card sales for the same month from DailyExpense
                target_year = summary_info.get('year', datetime.datetime.now().year)
                target_month = summary_info.get('month', datetime.datetime.now().month)
                import calendar
                last_day = calendar.monthrange(target_year, target_month)[1]
                start_d = datetime.date(target_year, target_month, 1)
                end_d = datetime.date(target_year, target_month, last_day)
                
                card_sales = session.exec(
                    apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
                        DailyExpense.date >= start_d,
                        DailyExpense.date <= end_d,
                        DailyExpense.payment_method == 'Card',
                        DailyExpense.category == 'store',
                    )
                ).all()
                card_sales_total = sum(e.amount for e in card_sales)
                card_fee = card_sales_total - card_deposit_total if card_sales_total > 0 else 0
                
                # Per-card-company breakdown
                # Map vendor names in DB to card company names
                VENDOR_TO_COMPANY = {
                    '신한': '신한카드', '국민': 'KB국민', 'KB': 'KB국민',
                    'BC': 'BC카드', '비씨': 'BC카드', '현대': '현대카드',
                    '하나': '하나카드', '삼성': '삼성카드', '우리': '우리카드',
                    'NH': 'NH농협', '농협': 'NH농협', '롯데': '롯데카드',
                }
                card_sales_by_company = {}
                for e in card_sales:
                    vn = e.vendor_name or ''
                    matched_company = None
                    for kw, company in VENDOR_TO_COMPANY.items():
                        if kw in vn:
                            matched_company = company
                            break
                    if matched_company:
                        if matched_company not in card_sales_by_company:
                            card_sales_by_company[matched_company] = 0
                        card_sales_by_company[matched_company] += e.amount
                
                # Build per-company fee table
                all_companies = set(list(card_company_deposits.keys()) + list(card_sales_by_company.keys()))
                card_company_fees = []
                for co in sorted(all_companies):
                    dep = card_company_deposits.get(co, {}).get('amount', 0)
                    sales = card_sales_by_company.get(co, 0)
                    fee = sales - dep
                    rate = round(fee / sales * 100, 2) if sales > 0 else 0
                    card_company_fees.append({
                        "company": co,
                        "deposit": dep,
                        "sales": sales,
                        "fee": fee,
                        "rate": rate,
                    })
                
                cash_count = totals.get('현금매출', {}).get('count', 0)
                cash_total = totals.get('현금매출', {}).get('amount', 0)
                
                if inserted_count > 0:
                    upload_record = session.get(UploadHistory, upload_id)
                    if upload_record:
                        upload_record.record_count = inserted_count
                        session.add(upload_record)
                    session.commit()
                else:
                    session.rollback()
                    with Session(engine) as cleanup_s:
                        old_up = cleanup_s.get(UploadHistory, upload_id)
                        if old_up:
                            cleanup_s.delete(old_up)
                            cleanup_s.commit()
                
                return {
                    "status": "success",
                    "file_type": "bank_deposit_card",
                    "file_type_label": "🏦 은행 입금내역 분석",
                    "count": inserted_count,
                    "bank_summary": {
                        "card_deposit": card_deposit_total,
                        "card_sales": card_sales_total,
                        "card_fee": card_fee,
                        "card_fee_rate": round(card_fee / card_sales_total * 100, 2) if card_sales_total > 0 else 0,
                        "card_companies": card_company_fees,
                        "cash_sales_count": cash_count,
                        "cash_sales_total": cash_total,
                        "categories": {k: v for k, v in totals.items()},
                        "period": f"{target_year}년 {target_month}월"
                    }
                }
            
            # Update upload history
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = inserted_count
                session.add(upload_record)
            
            session.commit()
        
        # --- Save DeliveryRevenue (fee details) for delivery settlements ---
        if file_type == "delivery_settlement" and result.get("summary"):
            try:
                import json as json_lib
                from models import DeliveryRevenue
                summary = result["summary"]
                channel = summary.get("channel", "")
                
                # Parse year/month from the period string (e.g., "2026년 1월")
                import re
                period = summary.get("period", "")
                period_match = re.search(r'(\d{4})년\s*(\d{1,2})월', period)
                if period_match and channel:
                    dr_year = int(period_match.group(1))
                    dr_month = int(period_match.group(2))
                    
                    # Map channel name to DeliveryRevenue channel key
                    CHANNEL_KEY_MAP = {"쿠팡": "Coupang", "배민": "Baemin", "배달의민족": "Baemin", "요기요": "Yogiyo", "땡겨요": "Ddangyo"}
                    dr_channel = CHANNEL_KEY_MAP.get(channel, channel)
                    
                    with Session(engine) as dr_session:
                        # Upsert: check if record already exists
                        existing_dr = dr_session.exec(
                            apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid).where(
                                DeliveryRevenue.channel == dr_channel,
                                DeliveryRevenue.year == dr_year,
                                DeliveryRevenue.month == dr_month,
                            )
                        ).first()
                        
                        if existing_dr:
                            existing_dr.total_sales = summary.get("total_sales", 0)
                            existing_dr.total_fees = summary.get("total_fees", 0)
                            existing_dr.settlement_amount = summary.get("total_amount", 0)
                            existing_dr.order_count = summary.get("order_count", 0)
                            if summary.get("fee_breakdown"):
                                existing_dr.fee_breakdown = json.dumps(summary["fee_breakdown"], ensure_ascii=False)
                            dr_session.add(existing_dr)
                        else:
                            fee_bd_json = None
                            if summary.get("fee_breakdown"):
                                fee_bd_json = json.dumps(summary["fee_breakdown"], ensure_ascii=False)
                            dr_record = DeliveryRevenue(
                                channel=dr_channel,
                                year=dr_year,
                                month=dr_month,
                                total_sales=summary.get("total_sales", 0),
                                total_fees=summary.get("total_fees", 0),
                                settlement_amount=summary.get("total_amount", 0),
                                order_count=summary.get("order_count", 0),
                                fee_breakdown=fee_bd_json,
                                business_id=bid
                            )
                            dr_session.add(dr_record)
                        dr_session.commit()
                        
                        # --- Auto-sync delivery fees to P/L ---
                        # Aggregate ALL delivery apps' fees for this month and update P/L
                        from models import MonthlyProfitLoss
                        all_dr = dr_session.exec(
                            apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid).where(
                                DeliveryRevenue.year == dr_year,
                                DeliveryRevenue.month == dr_month,
                            )
                        ).all()
                        total_delivery_fees = sum(d.total_fees for d in all_dr)
                        
                        pl = dr_session.exec(
                            apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
                                MonthlyProfitLoss.year == dr_year,
                                MonthlyProfitLoss.month == dr_month,
                            )
                        ).first()
                        
                        if pl:
                            pl.expense_delivery_fee = total_delivery_fees
                            dr_session.add(pl)
                        else:
                            pl = MonthlyProfitLoss(
                                business_id=bid,
                                year=dr_year,
                                month=dr_month,
                                expense_delivery_fee=total_delivery_fees
                            )
                            dr_session.add(pl)
                        dr_session.commit()
                        
                        print(f"[Delivery Fee] {dr_year}년 {dr_month}월 총 배달앱수수료: {total_delivery_fees:,}원 → P/L 반영 완료")
            except Exception as e:
                print(f"DeliveryRevenue save error (non-fatal): {e}")
                import traceback
                traceback.print_exc()

        # --- Compute and Save Metrics for Bank Deposit Uploads based on AI/User Rules ---
        if file_type == "bank_deposit_card" and result.get("summary"):
            try:
                from models import MonthlyProfitLoss, DailyExpense, VendorRule
                from sqlmodel import select, func
                summary = result["summary"]
                y = summary.get("year")
                m = summary.get("month")
                
                # Check mapping for unmapped elements
                unmapped_items = []
                data = result.get("data", [])
                
                # Pre-fetch existing rules
                with Session(engine) as s:
                    existing_rules = s.exec(
                        apply_bid_filter(select(VendorRule), VendorRule, bid).where(
                            VendorRule.source == "bank_deposit_revenue"
                        )
                    ).all()
                    rule_map = {r.original_name: r.category for r in existing_rules}
                    
                    total_card_deposit = 0
                    total_cash_sales = 0
                    total_personal = 0
                    
                    for row in data:
                        memo = row.get("memo", "")
                        amount = row.get("amount", 0)
                        date_str = row.get("date")
                        row_date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                        
                        mapped_category = rule_map.get(memo)
                        if not mapped_category:
                            cat_guess = row.get("default_category", "?")
                            if cat_guess == "?": # User intervention required!
                                unmapped_items.append({
                                    "memo": memo,
                                    "amount": amount,
                                    "date": date_str,
                                    "default_category": cat_guess
                                })
                            else:
                                mapped_category = cat_guess # apply default safe guess silently
                                
                        if not mapped_category:
                            continue
                            
                        # Perform actual logic
                        if mapped_category == "카드수수료":
                            total_card_deposit += amount
                        elif mapped_category == "현금매출":
                            total_cash_sales += amount
                            cash_sales_calculated += amount
                            processed_months.add((row_date_obj.year, row_date_obj.month))
                        elif mapped_category == "개인가계부":
                            total_personal += amount
                            personal_income_calculated += amount
                            processed_months.add((row_date_obj.year, row_date_obj.month))

                # Return requires classification if any
                if unmapped_items:
                    # rollback transaction
                    if upload_id is not None:
                        with Session(engine) as dbs:
                            rec = dbs.get(UploadHistory, upload_id)
                            if rec:
                                dbs.delete(rec)
                                dbs.commit()
                    return {
                        "status": "requires_classification",
                        "items": unmapped_items,
                        "file_name": file.filename,
                        "message": f"확인되지 않은 송금자 {len(unmapped_items)}건의 분류가 필요합니다."
                    }

                # Save Data if no unmapped!
                with Session(engine) as dbs:
                    # Update MonthlyProfitLoss (Card fee calculation)
                    import calendar
                    last_day = calendar.monthrange(y, m)[1]
                    start_d = datetime.date(y, m, 1)
                    end_d = datetime.date(y, m, last_day)

                    sales_stmt = select(func.sum(DailyExpense.amount)).where(
                        DailyExpense.date >= start_d,
                        DailyExpense.date <= end_d,
                        DailyExpense.payment_method == 'Card',
                        DailyExpense.category == 'store'
                    )
                    sales_stmt = apply_bid_filter(sales_stmt, DailyExpense, bid)
                    total_card_sales = dbs.exec(sales_stmt).one() or 0

                    card_fee = total_card_sales - total_card_deposit
                    if card_fee < 0:
                        card_fee = 0
                    card_fee_calculated = card_fee

                    pl_stmt = select(MonthlyProfitLoss).where(
                        MonthlyProfitLoss.year == y,
                        MonthlyProfitLoss.month == m
                    )
                    pl_stmt = apply_bid_filter(pl_stmt, MonthlyProfitLoss, bid)
                    pl_record = dbs.exec(pl_stmt).first()
                    
                    if pl_record:
                        pl_record.expense_card_fee = card_fee
                        dbs.add(pl_record)
                    else:
                        pl_record = MonthlyProfitLoss(
                            year=y, month=m, business_id=bid, expense_card_fee=card_fee
                        )
                        dbs.add(pl_record)
                        
                    # Now insert cash and personal income! We just insert them into DailyExpense.
                    for row in data:
                        memo = row.get("memo", "")
                        amount = row.get("amount", 0)
                        date_str = row.get("date")
                        row_date_obj = datetime.datetime.strptime(date_str, "%Y-%m-%d").date()
                        cat = rule_map.get(memo) or row.get("default_category", "?")
                        
                        if cat in ["현금매출", "개인가계부"]:
                            daily_category = "store" if cat == "현금매출" else "개인가계부"
                            expense = DailyExpense(
                                date=row_date_obj,
                                amount=amount,
                                vendor_name=f"{memo} (입금)",
                                payment_method="Cash",
                                category=daily_category,
                                note="은행입금자동",
                                upload_id=upload_id,
                                business_id=bid
                            )
                            dbs.add(expense)

                    dbs.commit()
            except Exception as e:
                import traceback
                print(f"Bank deposit rule/P&L mapping error: {traceback.format_exc()}")
        
        # Sync P/L (expenses + revenue)
        if processed_months:
            try:
                with Session(engine) as sync_session:
                    for (year, month) in processed_months:
                        sync_all_expenses(year, month, sync_session, bid)
                        sync_revenue_to_pl(year, month, sync_session, bid)
                    sync_session.commit()
            except Exception as e:
                print(f"Revenue Upload P/L Sync error: {e}")
        
        summary = result.get("summary", {})
        dedup_msg = ""
        if dedup_skipped > 0:
            dedup_msg += f" (카드매출 {dedup_skipped}건 자동제외)"
        if dedup_replaced > 0:
            dedup_msg += f" (카드통합 {dedup_replaced}건 대체)"
        if delivery_initialized > 0:
            dedup_msg += f" (기존 배달매출 데이터 {delivery_initialized}건 덮어쓰기)"
        if card_fee_calculated is not None:
            dedup_msg += f" (수수료 {int(card_fee_calculated):,}원 산출"
            if cash_sales_calculated > 0:
                dedup_msg += f", 현금매출 {int(cash_sales_calculated):,}원"
            if personal_income_calculated > 0:
                dedup_msg += f", 개인소득 {int(personal_income_calculated):,}원"
            dedup_msg += ")"
        
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


# --- Business Logo Upload ---
@router.post("/upload/image/business-logo")
async def upload_business_logo(
    file: UploadFile = File(...), 
    _admin: User = Depends(get_admin_user),
    bid: int = Depends(get_bid_from_token)
):
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
