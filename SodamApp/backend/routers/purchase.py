"""
Purchase Management API — DailyExpense-based CRUD for purchase/expense tracking.
Supports card company Excel upload with auto-parsing, CRUD, and P/L sync.
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, List
from datetime import date, datetime
from sqlmodel import Session, select, func, desc
from database import engine
from models import Vendor, DailyExpense, UploadHistory, User
from routers.auth import get_admin_user

router = APIRouter()


# ─── Schemas ───

class PurchaseCreate(BaseModel):
    vendor_name: str
    date: str  # YYYY-MM-DD
    amount: int
    category: Optional[str] = "기타비용"
    note: Optional[str] = None

class PurchaseUpdate(BaseModel):
    amount: Optional[int] = None
    category: Optional[str] = None
    note: Optional[str] = None
    date: Optional[str] = None
    vendor_name: Optional[str] = None


# ─── GET daily purchase list ───

@router.get("/api/purchase/daily")
def get_daily_purchases(year: int, month: int, _admin: User = Depends(get_admin_user)):
    """
    Returns all DailyExpense records for expense vendors in the given month.
    Enriched with vendor info and grouped for frontend display.
    """
    from calendar import monthrange
    
    start_date = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)
    
    with Session(engine) as session:
        # Get all expense vendors
        vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == "expense")
        ).all()
        vendor_map = {v.id: v for v in vendors}
        
        # Get all DailyExpense for the month with expense vendors
        expenses = session.exec(
            select(DailyExpense).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
            ).order_by(desc(DailyExpense.date))
        ).all()
        
        # Filter to only expense vendors
        expense_vendor_ids = set(v.id for v in vendors)
        
        records = []
        for exp in expenses:
            # Include if vendor is expense type, or if no vendor linked
            if exp.vendor_id and exp.vendor_id not in expense_vendor_ids:
                continue
            
            vendor = vendor_map.get(exp.vendor_id)
            records.append({
                "id": exp.id,
                "date": str(exp.date),
                "vendor_name": exp.vendor_name,
                "vendor_id": exp.vendor_id,
                "amount": exp.amount,
                "category": exp.category or "기타비용",
                "note": exp.note or "",
                "vendor_category": vendor.category if vendor else None,
                "upload_id": exp.upload_id,
            })
        
        return {"records": records, "count": len(records)}


# ─── GET summary stats ───

@router.get("/api/purchase/summary")
def get_purchase_summary(year: int, month: int, _admin: User = Depends(get_admin_user)):
    """
    Aggregated purchase stats: by category, by day, by card company (from note).
    """
    from calendar import monthrange
    
    start_date = date(year, month, 1)
    _, last_day = monthrange(year, month)
    end_date = date(year, month, last_day)
    
    with Session(engine) as session:
        # Get expense vendor IDs
        vendors = session.exec(
            select(Vendor).where(Vendor.vendor_type == "expense")
        ).all()
        expense_vendor_ids = set(v.id for v in vendors)
        
        expenses = session.exec(
            select(DailyExpense).where(
                DailyExpense.date >= start_date,
                DailyExpense.date <= end_date,
            )
        ).all()
        
        # Filter
        expenses = [e for e in expenses if not e.vendor_id or e.vendor_id in expense_vendor_ids]
        
        # Totals
        total = sum(e.amount for e in expenses)
        count = len(expenses)
        
        # By category
        by_category = {}
        for e in expenses:
            cat = e.category or "기타비용"
            by_category.setdefault(cat, {"amount": 0, "count": 0})
            by_category[cat]["amount"] += e.amount
            by_category[cat]["count"] += 1
        
        # By day
        by_day = {}
        for e in expenses:
            d = str(e.date)
            by_day.setdefault(d, {"amount": 0, "count": 0})
            by_day[d]["amount"] += e.amount
            by_day[d]["count"] += 1
        
        # By card company (parse from note field: "카드사:XXX")
        # Separate bank transfers from card purchases
        BANK_KEYWORDS = ['은행']  # 신한은행, 국민은행, etc.
        by_card = {}
        by_bank = {}
        for e in expenses:
            card = None
            if e.note and "카드사:" in e.note:
                card = e.note.split("카드사:")[1].split(",")[0].strip()
            
            if card:
                is_bank = any(kw in card for kw in BANK_KEYWORDS)
                target = by_bank if is_bank else by_card
                target.setdefault(card, {"amount": 0, "count": 0})
                target[card]["amount"] += e.amount
                target[card]["count"] += 1
            else:
                by_card.setdefault("기타", {"amount": 0, "count": 0})
                by_card["기타"]["amount"] += e.amount
                by_card["기타"]["count"] += 1
        
        # Top vendors (개인가계부, 세금과공과, 임차료 제외 - 사업용 매입만)
        EXCLUDED_CATEGORIES = {'개인가계부', '개인생활비', '세금과공과', '제세공과금', '부가가치세', '사업소득세', '근로소득세', '임차료', '임대료', '임대관리비', '인건비', '퇴직금적립'}
        # Build vendor_id -> category map for vendor-level filtering
        vendor_cat_map = {v.id: v.category for v in vendors}
        by_vendor = {}
        for e in expenses:
            # Check both expense category and vendor category
            exp_cat = e.category or ''
            vnd_cat = vendor_cat_map.get(e.vendor_id, '') or ''
            if exp_cat in EXCLUDED_CATEGORIES or vnd_cat in EXCLUDED_CATEGORIES:
                continue
            vn = e.vendor_name
            by_vendor.setdefault(vn, {"amount": 0, "count": 0})
            by_vendor[vn]["amount"] += e.amount
            by_vendor[vn]["count"] += 1
        
        top_vendors = sorted(by_vendor.items(), key=lambda x: -x[1]["amount"])[:10]
        
        return {
            "total": total,
            "count": count,
            "by_category": by_category,
            "by_day": by_day,
            "by_card_company": by_card,
            "by_bank_transfer": by_bank,
            "top_vendors": [{"name": k, **v} for k, v in top_vendors],
        }


# ─── POST upload card company Excel ───

@router.post("/api/purchase/upload")
async def upload_purchase_excel(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
    """
    Upload a card company or bank Excel file.
    Auto-detects format and parses into DailyExpense records.
    """
    import traceback
    import tempfile
    import os
    from services.purchase_parser import parse_purchase_file
    from services.profit_loss_service import sync_all_expenses
    
    try:
        content = await file.read()
        filename = file.filename or "purchase_upload.xlsx"
        
        # Save to temp file for parser
        suffix = os.path.splitext(filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        
        try:
            records = parse_purchase_file(tmp_path, filename)
        finally:
            os.unlink(tmp_path)
        
        if not records:
            return {"status": "error", "message": "파싱된 매입 데이터가 없습니다. 파일 형식을 확인해주세요."}
        
        # ─── AI 자동 분류 적용 ───
        from services.smart_classifier import apply_rules
        auto_classified_count = apply_rules(records)
        
        card_company = records[0].get('card_company', '알수없음')
        
        # Create Upload History
        with Session(engine) as session:
            upload_history = UploadHistory(
                filename=filename,
                upload_type="purchase",
                record_count=0,
                status="active"
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id
        
        inserted_count = 0
        skipped_count = 0
        vendor_created_count = 0
        processed_months = set()
        
        with Session(engine) as session:
            # Build vendor lookup
            vendors = session.exec(select(Vendor)).all()
            vendor_by_name = {v.name: v for v in vendors}
            
            for rec in records:
                vendor_name = rec['vendor_name']
                date_obj = rec['date']
                amount = rec['amount']
                category = rec['category']
                
                if amount <= 0:
                    continue
                
                # Find or create vendor
                vendor = vendor_by_name.get(vendor_name)
                if not vendor:
                    vendor = Vendor(
                        name=vendor_name,
                        category=category,
                        vendor_type="expense",
                        created_by_upload_id=upload_id,
                    )
                    session.add(vendor)
                    session.flush()
                    vendor_by_name[vendor_name] = vendor
                    vendor_created_count += 1
                
                # Duplicate check: same date + vendor + amount
                existing = session.exec(
                    select(DailyExpense).where(
                        DailyExpense.date == date_obj,
                        DailyExpense.vendor_id == vendor.id,
                        DailyExpense.amount == amount,
                    )
                ).first()
                
                if existing:
                    skipped_count += 1
                    continue
                
                # Store card company in note for tracking
                note_parts = []
                if rec.get('card_company'):
                    note_parts.append(f"카드사:{rec['card_company']}")
                if rec.get('approval_no') and rec['approval_no'] not in ['', 'nan']:
                    note_parts.append(f"승인:{rec['approval_no']}")
                if rec.get('business_type') and rec['business_type'] not in ['', 'nan']:
                    note_parts.append(f"업종:{rec['business_type']}")
                
                expense = DailyExpense(
                    date=date_obj,
                    vendor_name=vendor_name,
                    vendor_id=vendor.id,
                    amount=amount,
                    category=category,
                    note=", ".join(note_parts) if note_parts else None,
                    upload_id=upload_id,
                )
                session.add(expense)
                inserted_count += 1
                processed_months.add((date_obj.year, date_obj.month))
            
            # Update history
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = inserted_count
                session.add(upload_record)
            
            session.commit()
        
        # Sync P/L
        if processed_months:
            try:
                with Session(engine) as sync_session:
                    for (year, month) in processed_months:
                        sync_all_expenses(year, month, sync_session)
                    sync_session.commit()
            except Exception as e:
                print(f"Purchase Upload P/L Sync error: {e}")
        
        return {
            "status": "success",
            "message": f"{card_company} {inserted_count}건 저장 완료 (중복 {skipped_count}건 제외, 신규 거래처 {vendor_created_count}개, 🤖자동분류 {auto_classified_count}건)",
            "card_company": card_company,
            "count": inserted_count,
            "skipped": skipped_count,
            "vendors_created": vendor_created_count,
            "auto_classified": auto_classified_count,
            "upload_id": upload_id,
            "total_parsed": len(records),
        }
    
    except ValueError as ve:
        return {"status": "error", "message": str(ve)}
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Purchase Upload Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


# ─── 2-Step Upload: Preview → Confirm ───

def _find_similar_vendors(vendor_name: str, existing_vendors: list, min_overlap: int = 3) -> list:
    """3글자 이상 겹치는 유사 거래처를 찾는다."""
    similar = []
    vn = vendor_name.strip()
    if len(vn) < min_overlap:
        return similar
    for v in existing_vendors:
        ev_name = v.name.strip()
        if ev_name == vn:
            # Exact match — not "similar", it's the same
            continue
        # Check if any substring of length min_overlap overlaps
        matched = False
        for i in range(len(vn) - min_overlap + 1):
            substr = vn[i:i + min_overlap]
            if substr in ev_name:
                matched = True
                break
        if not matched:
            for i in range(len(ev_name) - min_overlap + 1):
                substr = ev_name[i:i + min_overlap]
                if substr in vn:
                    matched = True
                    break
        if matched:
            similar.append({
                "id": v.id,
                "name": v.name,
                "category": v.category or "기타경비",
            })
    return similar


@router.post("/api/purchase/upload/preview")
async def upload_purchase_preview(file: UploadFile = File(...), _admin: User = Depends(get_admin_user)):
    """
    Step 1: Parse file, auto-exclude card payments/salary, find similar vendors.
    Returns parsed records + vendor review data for user confirmation.
    """
    import traceback, tempfile, os
    from services.purchase_parser import parse_purchase_file
    from services.smart_classifier import apply_rules

    try:
        content = await file.read()
        filename = file.filename or "purchase_upload.xlsx"

        suffix = os.path.splitext(filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp.write(content)
            tmp_path = tmp.name

        try:
            records = parse_purchase_file(tmp_path, filename)
        finally:
            os.unlink(tmp_path)

        if not records:
            return {"status": "error", "message": "파싱된 매입 데이터가 없습니다. 파일 형식을 확인해주세요."}

        # Apply AI classification
        auto_classified_count = apply_rules(records)
        card_company = records[0].get('card_company', '알수없음')

        # Serialize records (dates to string)
        serialized = []
        for r in records:
            sr = dict(r)
            if hasattr(sr['date'], 'isoformat'):
                sr['date'] = sr['date'].isoformat()
            else:
                sr['date'] = str(sr['date'])
            serialized.append(sr)

        # Load existing vendors for similarity check
        with Session(engine) as session:
            existing_vendors = session.exec(
                select(Vendor).where(Vendor.vendor_type == "expense")
            ).all()

            # Build vendor review list
            vendor_names_in_file = list(set(r['vendor_name'] for r in records))
            vendor_by_name = {v.name: v for v in existing_vendors}

            vendor_review = []
            for vn in sorted(vendor_names_in_file):
                if vn in vendor_by_name:
                    # Exact match exists — no review needed
                    continue
                similar = _find_similar_vendors(vn, existing_vendors)
                vendor_review.append({
                    "vendor_name": vn,
                    "similar_vendors": similar,
                    "is_new": len(similar) == 0,
                    "record_count": sum(1 for r in records if r['vendor_name'] == vn),
                    "total_amount": sum(r['amount'] for r in records if r['vendor_name'] == vn),
                })

        return {
            "status": "success",
            "card_company": card_company,
            "records": serialized,
            "total_parsed": len(records),
            "auto_classified": auto_classified_count,
            "vendor_review": vendor_review,
        }

    except ValueError as ve:
        return {"status": "error", "message": str(ve)}
    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Upload Preview Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


class VendorDecision(BaseModel):
    action: str  # "merge" | "new"
    vendor_id: Optional[int] = None  # for merge
    category: Optional[str] = None  # for new

class ConfirmUploadPayload(BaseModel):
    records: List[dict]
    vendor_decisions: dict  # vendor_name -> VendorDecision


@router.post("/api/purchase/upload/confirm")
async def upload_purchase_confirm(payload: ConfirmUploadPayload, _admin: User = Depends(get_admin_user)):
    """
    Step 2: Save records with user's vendor decisions applied.
    """
    import traceback
    from services.profit_loss_service import sync_all_expenses

    try:
        records = payload.records
        decisions = payload.vendor_decisions

        if not records:
            return {"status": "error", "message": "저장할 데이터가 없습니다."}

        card_company = records[0].get('card_company', '알수없음')

        # Create Upload History
        with Session(engine) as session:
            upload_history = UploadHistory(
                filename=f"confirmed_{card_company}.xlsx",
                upload_type="purchase",
                record_count=0,
                status="active"
            )
            session.add(upload_history)
            session.commit()
            session.refresh(upload_history)
            upload_id = upload_history.id

        inserted_count = 0
        skipped_count = 0
        vendor_created_count = 0
        processed_months = set()

        with Session(engine) as session:
            # Build vendor lookup
            vendors = session.exec(select(Vendor)).all()
            vendor_by_name = {v.name: v for v in vendors}
            vendor_by_id = {v.id: v for v in vendors}

            for rec in records:
                vendor_name = rec['vendor_name']
                date_str = rec['date']
                amount = rec.get('amount', 0)
                category = rec.get('category', '기타경비')

                if amount <= 0:
                    continue

                try:
                    date_obj = datetime.strptime(str(date_str)[:10], "%Y-%m-%d").date()
                except:
                    continue

                # Apply vendor decision
                decision = decisions.get(vendor_name)
                if decision:
                    dec = decision if isinstance(decision, dict) else decision.dict()
                    if dec.get('action') == 'merge' and dec.get('vendor_id'):
                        # Merge: use existing vendor
                        merged_vendor = vendor_by_id.get(dec['vendor_id'])
                        if merged_vendor:
                            vendor_name = merged_vendor.name
                            category = merged_vendor.category or category
                    elif dec.get('action') == 'new' and dec.get('category'):
                        category = dec['category']

                # Find or create vendor
                vendor = vendor_by_name.get(vendor_name)
                if not vendor:
                    vendor = Vendor(
                        name=vendor_name,
                        category=category,
                        vendor_type="expense",
                        created_by_upload_id=upload_id,
                    )
                    session.add(vendor)
                    session.flush()
                    vendor_by_name[vendor_name] = vendor
                    vendor_by_id[vendor.id] = vendor
                    vendor_created_count += 1

                # Duplicate check
                existing = session.exec(
                    select(DailyExpense).where(
                        DailyExpense.date == date_obj,
                        DailyExpense.vendor_id == vendor.id,
                        DailyExpense.amount == amount,
                    )
                ).first()

                if existing:
                    skipped_count += 1
                    continue

                note_parts = []
                if rec.get('card_company'):
                    note_parts.append(f"카드사:{rec['card_company']}")
                if rec.get('approval_no') and str(rec['approval_no']) not in ['', 'nan']:
                    note_parts.append(f"승인:{rec['approval_no']}")

                expense = DailyExpense(
                    date=date_obj,
                    vendor_name=vendor_name,
                    vendor_id=vendor.id,
                    amount=amount,
                    category=category,
                    note=", ".join(note_parts) if note_parts else None,
                    upload_id=upload_id,
                )
                session.add(expense)
                inserted_count += 1
                processed_months.add((date_obj.year, date_obj.month))

            # Update history
            upload_record = session.get(UploadHistory, upload_id)
            if upload_record:
                upload_record.record_count = inserted_count
                session.add(upload_record)
            session.commit()

        # Sync P/L
        if processed_months:
            try:
                with Session(engine) as sync_session:
                    for (year, month) in processed_months:
                        sync_all_expenses(year, month, sync_session)
                    sync_session.commit()
            except Exception as e:
                print(f"Purchase Confirm P/L Sync error: {e}")

        return {
            "status": "success",
            "message": f"{card_company} {inserted_count}건 저장 완료 (중복 {skipped_count}건 제외, 신규 거래처 {vendor_created_count}개)",
            "card_company": card_company,
            "count": inserted_count,
            "skipped": skipped_count,
            "vendors_created": vendor_created_count,
            "upload_id": upload_id,
        }

    except Exception as e:
        error_detail = f"{str(e)}\n{traceback.format_exc()}"
        print(f"Purchase Confirm Error: {error_detail}")
        raise HTTPException(status_code=500, detail=error_detail)


# ─── POST create single purchase ───

@router.post("/api/purchase")
def create_purchase(payload: PurchaseCreate, _admin: User = Depends(get_admin_user)):
    """Create a single purchase entry manually."""
    from services.profit_loss_service import sync_all_expenses
    
    with Session(engine) as session:
        date_obj = datetime.strptime(payload.date, "%Y-%m-%d").date()
        
        # Find or create vendor
        vendor = session.exec(
            select(Vendor).where(Vendor.name == payload.vendor_name)
        ).first()
        
        if not vendor:
            vendor = Vendor(
                name=payload.vendor_name,
                category=payload.category,
                vendor_type="expense",
            )
            session.add(vendor)
            session.flush()
        
        expense = DailyExpense(
            date=date_obj,
            vendor_name=payload.vendor_name,
            vendor_id=vendor.id,
            amount=payload.amount,
            category=payload.category,
            note=payload.note,
        )
        session.add(expense)
        session.commit()
        session.refresh(expense)
        
        # Sync P/L
        try:
            sync_all_expenses(date_obj.year, date_obj.month, session)
            session.commit()
        except Exception:
            pass
        
        return {"status": "success", "id": expense.id}


# ─── PUT update purchase ───

@router.put("/api/purchase/{expense_id}")
def update_purchase(expense_id: int, payload: PurchaseUpdate, _admin: User = Depends(get_admin_user)):
    """Update a purchase entry."""
    from services.profit_loss_service import sync_all_expenses
    from services.smart_classifier import learn_rule
    
    with Session(engine) as session:
        expense = session.get(DailyExpense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="매입 내역을 찾을 수 없습니다.")
        
        old_year, old_month = expense.date.year, expense.date.month
        old_category = expense.category
        original_vendor_name = expense.vendor_name
        
        if payload.amount is not None:
            expense.amount = payload.amount
        if payload.category is not None:
            expense.category = payload.category
        if payload.note is not None:
            expense.note = payload.note
        if payload.date is not None:
            expense.date = datetime.strptime(payload.date, "%Y-%m-%d").date()
        if payload.vendor_name is not None:
            expense.vendor_name = payload.vendor_name
            # Update vendor link
            vendor = session.exec(
                select(Vendor).where(Vendor.name == payload.vendor_name)
            ).first()
            if vendor:
                expense.vendor_id = vendor.id
        
        session.add(expense)
        session.commit()
        
        # ─── 카테고리 변경 시: 동일 업체 전체 자동 변경 + AI 학습 ───
        same_vendor_updated = 0
        affected_months = set()
        affected_months.add((old_year, old_month))
        affected_months.add((expense.date.year, expense.date.month))
        
        if payload.category is not None and payload.category != old_category:
            source = "toggle_personal" if payload.category == "개인생활비" or old_category == "개인생활비" else "category_change"
            learn_rule(
                original_name=original_vendor_name,
                category=payload.category,
                source=source,
                session=session,
            )
            
            # 동일 업체명의 다른 매입 내역도 모두 같은 카테고리로 변경
            same_vendor_expenses = session.exec(
                select(DailyExpense).where(
                    DailyExpense.vendor_name == original_vendor_name,
                    DailyExpense.id != expense_id,
                    DailyExpense.category != payload.category,
                )
            ).all()
            
            for sv_exp in same_vendor_expenses:
                affected_months.add((sv_exp.date.year, sv_exp.date.month))
                sv_exp.category = payload.category
                session.add(sv_exp)
                same_vendor_updated += 1
            
            session.commit()
        
        # Sync P/L for all affected months
        try:
            for y, m in affected_months:
                sync_all_expenses(y, m, session)
            session.commit()
        except Exception:
            pass
        
        return {
            "status": "success",
            "id": expense.id,
            "same_vendor_updated": same_vendor_updated,
        }


# ─── DELETE purchase ───

@router.delete("/api/purchase/{expense_id}")
def delete_purchase(expense_id: int, _admin: User = Depends(get_admin_user)):
    """Delete a purchase entry."""
    from services.profit_loss_service import sync_all_expenses
    
    with Session(engine) as session:
        expense = session.get(DailyExpense, expense_id)
        if not expense:
            raise HTTPException(status_code=404, detail="매입 내역을 찾을 수 없습니다.")
        
        year, month = expense.date.year, expense.date.month
        session.delete(expense)
        session.commit()
        
        # Sync P/L
        try:
            sync_all_expenses(year, month, session)
            session.commit()
        except Exception:
            pass
        
        return {"status": "success", "message": "삭제되었습니다."}


# ─── Rules API (AI 학습 규칙 관리) ───

@router.get("/api/purchase/rules")
def get_classification_rules(_admin: User = Depends(get_admin_user)):
    """학습된 자동 분류 규칙 목록 조회"""
    from services.smart_classifier import get_rules
    rules = get_rules()
    return {"status": "success", "rules": rules, "count": len(rules)}


@router.delete("/api/purchase/rules/{rule_id}")
def delete_classification_rule(rule_id: int, _admin: User = Depends(get_admin_user)):
    """학습된 규칙 삭제"""
    from services.smart_classifier import delete_rule
    success = delete_rule(rule_id)
    if success:
        return {"status": "success"}
    raise HTTPException(status_code=404, detail="규칙을 찾을 수 없습니다.")

