"""
자재관리 API — 거래처별 품목 카탈로그, 재고, 구매요청서(PurchaseOrder), 영수증 보관함(Receipt)

메뉴: 자재관리 > 구매요청서 작성 / 거래처·품목 관리 / 재고관리 / 영수증 보관함
"""
import io
import os
import json
import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import or_
from sqlmodel import Session, select

from database import get_session
from models import (
    User as AuthUser, Business, Vendor, Product, Inventory,
    PurchaseOrder, Receipt, DailyExpense, ProductPrice,
)
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter(prefix="/api/materials", tags=["materials"])


# ─── Schemas ───

class InventoryUpdate(BaseModel):
    current_stock: Optional[float] = None
    safety_stock: Optional[float] = None


class OrderItemIn(BaseModel):
    product_id: Optional[int] = None
    name: str
    spec: Optional[str] = None
    quantity: float
    unit_price: int = 0


class OrderIn(BaseModel):
    vendor_id: int
    memo: Optional[str] = None
    items: List[OrderItemIn]


class OrdersCreate(BaseModel):
    orders: List[OrderIn]


class OrderPatch(BaseModel):
    status: Optional[str] = None      # draft, sent, completed, canceled
    sent_via: Optional[str] = None    # phone, kakao, copy
    memo: Optional[str] = None


def _order_to_dict(o: PurchaseOrder) -> dict:
    return {
        "id": o.id,
        "vendor_id": o.vendor_id,
        "vendor_name": o.vendor_name,
        "vendor_phone": o.vendor_phone,
        "order_date": o.order_date.isoformat() if o.order_date else None,
        "items": json.loads(o.items_json or "[]"),
        "item_count": o.item_count,
        "total_amount": o.total_amount,
        "memo": o.memo,
        "status": o.status,
        "sent_via": o.sent_via,
        "sent_at": o.sent_at.isoformat() if o.sent_at else None,
        "completed_at": o.completed_at.isoformat() if o.completed_at else None,
        "created_at": o.created_at.isoformat() if o.created_at else None,
    }


# ─── Catalog: 거래처(지출) + 품목 + 재고 통합 ───

@router.get("/catalog")
def get_catalog(
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    biz = session.get(Business, bid) if bid else None

    v_stmt = apply_bid_filter(
        select(Vendor).where(Vendor.vendor_type == "expense"), Vendor, bid
    )
    vendors = session.exec(v_stmt).all()

    p_stmt = apply_bid_filter(select(Product), Product, bid)
    products = session.exec(p_stmt).all()

    # 재고는 product 단위 (Inventory PK = product_id)
    inv_map = {}
    if products:
        inv_rows = session.exec(
            select(Inventory).where(Inventory.product_id.in_([p.id for p in products]))
        ).all()
        inv_map = {r.product_id: r for r in inv_rows}

    by_vendor = {}
    for p in products:
        by_vendor.setdefault(p.vendor_id, []).append(p)

    data = []
    for v in sorted(vendors, key=lambda x: (not x.is_primary, x.order_index or 0, x.name)):
        items = []
        for p in sorted(by_vendor.get(v.id, []), key=lambda x: x.name):
            inv = inv_map.get(p.id)
            items.append({
                "id": p.id,
                "product_code": p.product_code,
                "name": p.name,
                "category": p.category,
                "spec": p.spec,
                "weight": p.weight,
                "unit": p.unit,
                "pack_qty": p.pack_qty,
                "unit_price": p.unit_price,
                "price_updated": p.price_updated.isoformat() if p.price_updated else None,
                "tax_type": p.tax_type,
                "note": p.note,
                "current_stock": inv.current_stock if inv else 0.0,
                "safety_stock": inv.safety_stock if inv else 0.0,
            })
        data.append({
            "vendor": {
                "id": v.id,
                "name": v.name,
                "category": v.category,
                "phone": v.phone,
                "item": v.item,
                "contact_info": v.contact_info,
                "is_primary": bool(v.is_primary),
            },
            "products": items,
        })

    return {
        "status": "success",
        "business_name": biz.name if biz else "셈하나",
        "data": data,
    }


# ─── 주거래처 ───

@router.get("/primary-vendors")
def get_primary_vendors(
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    """주거래처 목록 + 거래 요약 (이번달/최근 3개월 매입, 품목 수, 최근 거래일)."""
    vendors = session.exec(
        apply_bid_filter(select(Vendor).where(Vendor.is_primary == True), Vendor, bid)  # noqa: E712
    ).all()

    today = datetime.date.today()
    since = today - datetime.timedelta(days=90)
    month_start = today.replace(day=1)

    data = []
    for v in sorted(vendors, key=lambda x: (x.order_index or 0, x.name)):
        product_count = len(session.exec(
            select(Product.id).where(Product.vendor_id == v.id)
        ).all())
        rows = session.exec(
            select(DailyExpense).where(
                DailyExpense.vendor_id == v.id, DailyExpense.date >= since
            )
        ).all()
        last_purchase = max((r.date for r in rows), default=None)
        data.append({
            "id": v.id,
            "name": v.name,
            "category": v.category,
            "phone": v.phone,
            "item": v.item,
            "contact_info": v.contact_info,
            "product_count": product_count,
            "month_total": sum(r.amount for r in rows if r.date >= month_start),
            "recent3m_total": sum(r.amount for r in rows),
            "last_purchase": last_purchase.isoformat() if last_purchase else None,
        })
    return {"status": "success", "data": data}


# ─── Inventory ───

@router.put("/inventory/{product_id}")
def upsert_inventory(
    product_id: int,
    payload: InventoryUpdate,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    product = session.exec(
        apply_bid_filter(select(Product).where(Product.id == product_id), Product, bid)
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="품목을 찾을 수 없습니다.")

    inv = session.get(Inventory, product_id)
    if not inv:
        inv = Inventory(product_id=product_id)
    if payload.current_stock is not None:
        inv.current_stock = payload.current_stock
    if payload.safety_stock is not None:
        inv.safety_stock = payload.safety_stock
    inv.last_checked_at = datetime.datetime.now()
    session.add(inv)
    session.commit()
    return {"status": "success"}


# ─── Purchase Orders (구매요청서) ───

@router.post("/orders")
def create_orders(
    payload: OrdersCreate,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    if not payload.orders:
        raise HTTPException(status_code=400, detail="요청서 항목이 없습니다.")

    created = []
    for o in payload.orders:
        vendor = session.get(Vendor, o.vendor_id)
        if not vendor:
            raise HTTPException(status_code=404, detail=f"거래처(id={o.vendor_id})를 찾을 수 없습니다.")
        items = [
            {
                "product_id": it.product_id,
                "name": it.name,
                "spec": it.spec,
                "quantity": it.quantity,
                "unit_price": it.unit_price,
                "amount": int(round(it.quantity * it.unit_price)),
            }
            for it in o.items
            if it.quantity > 0
        ]
        if not items:
            continue
        order = PurchaseOrder(
            business_id=bid,
            vendor_id=vendor.id,
            vendor_name=vendor.name,
            vendor_phone=vendor.phone,
            items_json=json.dumps(items, ensure_ascii=False),
            item_count=len(items),
            total_amount=sum(i["amount"] for i in items),
            memo=o.memo,
            status="draft",
        )
        session.add(order)
        session.flush()
        created.append(order)

    session.commit()
    for o in created:
        session.refresh(o)
    return {"status": "success", "data": [_order_to_dict(o) for o in created]}


@router.get("/orders")
def list_orders(
    status: Optional[str] = None,
    limit: int = 50,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    stmt = apply_bid_filter(select(PurchaseOrder), PurchaseOrder, bid)
    if status:
        stmt = stmt.where(PurchaseOrder.status == status)
    stmt = stmt.order_by(PurchaseOrder.created_at.desc()).limit(min(limit, 200))
    orders = session.exec(stmt).all()
    biz = session.get(Business, bid) if bid else None
    return {
        "status": "success",
        "business_name": biz.name if biz else "셈하나",
        "data": [_order_to_dict(o) for o in orders],
    }


@router.patch("/orders/{order_id}")
def patch_order(
    order_id: int,
    payload: OrderPatch,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    order = session.exec(
        apply_bid_filter(
            select(PurchaseOrder).where(PurchaseOrder.id == order_id), PurchaseOrder, bid
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="요청서를 찾을 수 없습니다.")

    if payload.status is not None:
        if payload.status not in ("draft", "sent", "completed", "canceled"):
            raise HTTPException(status_code=400, detail="잘못된 상태값입니다.")
        order.status = payload.status
        if payload.status == "sent" and order.sent_at is None:
            order.sent_at = datetime.datetime.now()
        if payload.status == "completed" and order.completed_at is None:
            order.completed_at = datetime.datetime.now()
    if payload.sent_via is not None:
        order.sent_via = payload.sent_via
    if payload.memo is not None:
        order.memo = payload.memo

    session.add(order)
    session.commit()
    session.refresh(order)
    return {"status": "success", "data": _order_to_dict(order)}


@router.delete("/orders/{order_id}")
def delete_order(
    order_id: int,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    order = session.exec(
        apply_bid_filter(
            select(PurchaseOrder).where(PurchaseOrder.id == order_id), PurchaseOrder, bid
        )
    ).first()
    if not order:
        raise HTTPException(status_code=404, detail="요청서를 찾을 수 없습니다.")
    session.delete(order)
    session.commit()
    return {"status": "success"}


# ─── Receipts (영수증 보관함) ───

class ReceiptPatch(BaseModel):
    vendor_name: Optional[str] = None
    receipt_date: Optional[str] = None   # YYYY-MM-DD
    amount: Optional[int] = None
    category: Optional[str] = None
    payment_method: Optional[str] = None  # Card, Cash
    memo: Optional[str] = None
    force_attach: Optional[bool] = None  # 중복(duplicate) 영수증을 사용자가 확인 후 매입 반영


def _receipt_to_dict(r: Receipt) -> dict:
    return {
        "id": r.id,
        "image_url": r.image_url,
        "receipt_date": r.receipt_date.isoformat() if r.receipt_date else None,
        "vendor_name": r.vendor_name,
        "amount": r.amount,
        "category": r.category,
        "payment_method": r.payment_method,
        "memo": r.memo,
        "status": r.status,
        "purchase_order_id": r.purchase_order_id,
        "daily_expense_id": r.daily_expense_id,
        "created_at": r.created_at.isoformat() if r.created_at else None,
    }


def _sync_pl(session: Session, bid, d: datetime.date):
    """해당 월 손익 재집계 (실패해도 영수증 처리는 계속)."""
    try:
        from services.profit_loss_service import sync_all_expenses
        sync_all_expenses(d.year, d.month, session, bid)
    except Exception:
        pass


def _find_or_create_vendor(session: Session, bid, name: str, category: Optional[str]) -> Vendor:
    vendor = session.exec(
        apply_bid_filter(select(Vendor), Vendor, bid).where(Vendor.name == name)
    ).first()
    if not vendor:
        vendor = Vendor(name=name, category=category, vendor_type="expense", business_id=bid)
        session.add(vendor)
        session.flush()
    return vendor


def _record_item_prices(session: Session, bid, receipt: Receipt, vendor: Vendor):
    """영수증 품목 라인을 거래처 품목과 이름 매칭 → 단가 이력 기록 + 최신 구매가 반영.

    라인 금액은 (단가×수량)일 수 있으므로 완벽하지 않음 — 품목 화면에서 수동 보정 가능.
    구매일자별 변동을 반영하기 위해 영수증 날짜가 기존 기준일보다 새로우면 단가 갱신."""
    if not receipt.ocr_json:
        return
    try:
        items = json.loads(receipt.ocr_json).get("items") or []
    except Exception:
        return
    if not items:
        return
    products = session.exec(select(Product).where(Product.vendor_id == vendor.id)).all()
    if not products:
        return
    d = receipt.receipt_date or datetime.date.today()

    def norm(s):
        return (s or "").replace(" ", "").lower()

    for it in items:
        iname = norm(it.get("name") if isinstance(it, dict) else None)
        try:
            amt = int(float(str(it.get("amount")).replace(",", "")))
        except (TypeError, ValueError, AttributeError):
            continue
        if not iname or amt <= 0:
            continue
        for p in products:
            pname = norm(p.name)
            if pname and (pname in iname or iname in pname):
                session.add(ProductPrice(business_id=bid, product_id=p.id, price=amt,
                                         price_date=d, source="receipt", receipt_id=receipt.id))
                if not p.unit_price or (p.price_updated is None or d >= p.price_updated):
                    p.unit_price = amt
                    p.price_updated = d
                    session.add(p)
                break


def _find_duplicate(session: Session, bid, d, amount, exclude_receipt_id=None):
    """같은 날짜·금액의 기존 내역 탐지 — 계좌이체/카드사용내역과의 이중 반영 방지.

    순서: ① 이미 업로드된 영수증 ② 지출내역(은행/카드 동기화·수동)
    ③ 카드 승인내역(CardPurchase) ④ 계좌 출금(BankTransaction)."""
    if not d or not amount:
        return None

    r_stmt = apply_bid_filter(select(Receipt), Receipt, bid).where(
        Receipt.receipt_date == d, Receipt.amount == amount)
    if exclude_receipt_id:
        r_stmt = r_stmt.where(Receipt.id != exclude_receipt_id)
    dup_r = session.exec(r_stmt).first()
    if dup_r:
        return f"이미 업로드된 영수증(#{dup_r.id} {dup_r.vendor_name or ''})"

    exp = session.exec(apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
        DailyExpense.date == d, DailyExpense.amount == amount,
        DailyExpense.source != "receipt")).first()
    if exp:
        return f"지출내역({exp.source}: {exp.vendor_name})"

    from models import CardPurchase, BankTransaction
    card_stmt = select(CardPurchase).where(
        CardPurchase.approval_date == d, CardPurchase.amount == amount,
        CardPurchase.status == "승인")
    if bid:
        card_stmt = card_stmt.where(CardPurchase.business_id == bid)
    card = session.exec(card_stmt).first()
    if card:
        return f"카드승인({card.card_corp} {card.merchant_name or ''})"

    bt = session.exec(select(BankTransaction).where(
        BankTransaction.trans_date == d, BankTransaction.out_amount == amount)).first()
    if bt:
        return f"계좌이체({(bt.remark1 or '').strip()})"

    return None


def _attach_expense(session: Session, bid, receipt: Receipt):
    """영수증을 매입·비용관리(DailyExpense)에 반영.
    같은 (날짜·거래처·결제수단)의 영수증 지출 행이 있으면 금액 합산 (natural key 유니크 제약 대응)."""
    vendor = _find_or_create_vendor(session, bid, receipt.vendor_name, receipt.category)
    d = receipt.receipt_date or datetime.date.today()
    existing = session.exec(
        apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(
            DailyExpense.date == d,
            DailyExpense.vendor_id == vendor.id,
            DailyExpense.payment_method == receipt.payment_method,
            DailyExpense.source == "receipt",
        )
    ).first()
    if existing:
        existing.amount += receipt.amount
        expense = existing
    else:
        expense = DailyExpense(
            business_id=bid,
            date=d,
            vendor_name=vendor.name,
            vendor_id=vendor.id,
            amount=receipt.amount,
            category=receipt.category or "기타경비",
            payment_method=receipt.payment_method,
            note="영수증 자동등록",
            source="receipt",
        )
        session.add(expense)
    session.flush()
    receipt.daily_expense_id = expense.id
    receipt.status = "classified"
    try:
        _record_item_prices(session, bid, receipt, vendor)
    except Exception:
        pass
    _sync_pl(session, bid, d)


def _detach_expense(session: Session, bid, receipt: Receipt):
    """영수증 반영분을 지출에서 차감. 0 이하가 되면 지출 행 삭제."""
    if not receipt.daily_expense_id:
        return
    expense = session.get(DailyExpense, receipt.daily_expense_id)
    # FK 참조 해제를 먼저 flush (지출 행 삭제 시 ForeignKeyViolation 방지)
    receipt.daily_expense_id = None
    receipt.status = "pending"
    session.add(receipt)
    session.flush()
    if expense:
        d = expense.date
        expense.amount -= receipt.amount
        if expense.amount <= 0:
            session.delete(expense)
        session.flush()
        _sync_pl(session, bid, d)


@router.post("/receipts")
async def upload_receipt(
    file: UploadFile = File(...),
    purchase_order_id: Optional[int] = Form(None),
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    if not (file.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다.")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="이미지가 너무 큽니다 (최대 15MB).")

    from services.storage_service import get_storage
    storage = get_storage()
    ts = int(datetime.datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "receipt.jpg")[1].lower() or ".jpg"
    key = f"receipts/{bid or 0}/{ts}{ext}"
    image_url = storage.upload_file(io.BytesIO(content), key, file.content_type)

    # AI 추출 (실패해도 보관은 진행 — pending 상태로 수동 보완)
    from services.receipt_ocr_service import extract_receipt, normalize_extraction
    raw = None
    try:
        raw = extract_receipt(content)
    except Exception:
        pass
    norm = normalize_extraction(raw)

    receipt = Receipt(
        business_id=bid,
        image_url=image_url,
        storage_key=key,
        receipt_date=norm["receipt_date"],
        vendor_name=norm["vendor_name"],
        amount=norm["amount"],
        category=norm["category"],
        payment_method=norm["payment_method"],
        ocr_json=json.dumps(raw, ensure_ascii=False, default=str) if raw else None,
        purchase_order_id=purchase_order_id,
    )
    session.add(receipt)
    session.flush()

    # 계좌이체/카드내역 이중 반영 방지 — 같은 날짜·금액 내역이 있으면 보관만 하고 매입 미반영
    dup_reason = None
    try:
        dup_reason = _find_duplicate(session, bid, receipt.receipt_date, receipt.amount,
                                     exclude_receipt_id=receipt.id)
    except Exception:
        pass

    if dup_reason:
        receipt.status = "duplicate"
        receipt.memo = f"중복 감지: {dup_reason}"
        session.add(receipt)
    elif receipt.vendor_name and receipt.amount > 0:
        _attach_expense(session, bid, receipt)

    session.commit()
    session.refresh(receipt)
    return {"status": "success", "data": _receipt_to_dict(receipt), "extracted": bool(raw),
            "duplicate": bool(dup_reason)}


@router.get("/receipts")
def list_receipts(
    q: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 60,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    stmt = apply_bid_filter(select(Receipt), Receipt, bid)
    if status:
        stmt = stmt.where(Receipt.status == status)
    if q and q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Receipt.vendor_name.ilike(like), Receipt.memo.ilike(like)))
    try:
        if date_from:
            stmt = stmt.where(Receipt.receipt_date >= datetime.date.fromisoformat(date_from))
        if date_to:
            stmt = stmt.where(Receipt.receipt_date <= datetime.date.fromisoformat(date_to))
    except ValueError:
        raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 입니다.")
    stmt = stmt.order_by(Receipt.created_at.desc()).limit(min(limit, 200))
    receipts = session.exec(stmt).all()
    return {"status": "success", "data": [_receipt_to_dict(r) for r in receipts]}


@router.patch("/receipts/{receipt_id}")
def patch_receipt(
    receipt_id: int,
    payload: ReceiptPatch,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    receipt = session.exec(
        apply_bid_filter(select(Receipt).where(Receipt.id == receipt_id), Receipt, bid)
    ).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="영수증을 찾을 수 없습니다.")

    # 반영 해제 → 필드 수정 → 재반영 (날짜/거래처/금액 변경에도 지출 정합 유지)
    _detach_expense(session, bid, receipt)

    if payload.vendor_name is not None:
        receipt.vendor_name = payload.vendor_name.strip() or None
    if payload.receipt_date is not None:
        try:
            receipt.receipt_date = datetime.date.fromisoformat(payload.receipt_date) if payload.receipt_date else None
        except ValueError:
            raise HTTPException(status_code=400, detail="날짜 형식은 YYYY-MM-DD 입니다.")
    if payload.amount is not None:
        receipt.amount = max(0, payload.amount)
    if payload.category is not None:
        receipt.category = payload.category or None
    if payload.payment_method is not None:
        receipt.payment_method = "Cash" if payload.payment_method == "Cash" else "Card"
    if payload.memo is not None:
        receipt.memo = payload.memo or None

    # 중복 감지 영수증(카드/계좌이체 내역과 중복)은 사용자가 명시적으로 확인(force_attach)해야만 매입 반영
    if receipt.vendor_name and receipt.amount > 0 and (receipt.status != "duplicate" or payload.force_attach):
        _attach_expense(session, bid, receipt)

    session.add(receipt)
    session.commit()
    session.refresh(receipt)
    return {"status": "success", "data": _receipt_to_dict(receipt)}


@router.delete("/receipts/{receipt_id}")
def delete_receipt(
    receipt_id: int,
    remove_expense: bool = True,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    receipt = session.exec(
        apply_bid_filter(select(Receipt).where(Receipt.id == receipt_id), Receipt, bid)
    ).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="영수증을 찾을 수 없습니다.")

    if remove_expense:
        _detach_expense(session, bid, receipt)

    if receipt.storage_key:
        try:
            from services.storage_service import get_storage
            get_storage().delete_file(receipt.storage_key)
        except Exception:
            pass

    session.delete(receipt)
    session.commit()
    return {"status": "success"}
