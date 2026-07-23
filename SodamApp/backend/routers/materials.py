"""
자재관리 API — 거래처별 품목 카탈로그, 재고, 구매요청서(PurchaseOrder)

메뉴: 자재관리 > 구매요청서 작성 / 거래처·품목 관리 / 재고관리
"""
import json
import datetime
from typing import Optional, List

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import User as AuthUser, Business, Vendor, Product, Inventory, PurchaseOrder
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
    for v in sorted(vendors, key=lambda x: (x.order_index or 0, x.name)):
        items = []
        for p in sorted(by_vendor.get(v.id, []), key=lambda x: x.name):
            inv = inv_map.get(p.id)
            items.append({
                "id": p.id,
                "product_code": p.product_code,
                "name": p.name,
                "category": p.category,
                "spec": p.spec,
                "unit_price": p.unit_price,
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
            },
            "products": items,
        })

    return {
        "status": "success",
        "business_name": biz.name if biz else "셈하나",
        "data": data,
    }


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
    return {"status": "success", "data": [_order_to_dict(o) for o in orders]}


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
