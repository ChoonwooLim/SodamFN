from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional, Dict
import datetime
import json

from models import InventoryCheck, InventoryItem
from database import engine
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter(tags=["inventory-check"])


# ═══════════════════════════════════════
# 📦 재고 체크 항목 관리 (CRUD)
# ═══════════════════════════════════════

class InventoryItemCreate(BaseModel):
    name: str
    emoji: str = "📦"
    unit: str = "개"
    category: str = "기타"
    display_order: int = 0


class InventoryItemUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    unit: Optional[str] = None
    category: Optional[str] = None
    display_order: Optional[int] = None
    is_active: Optional[bool] = None


@router.get("/inventory-items")
def get_inventory_items(bid = Depends(get_bid_from_token)):
    """모든 재고 체크 항목 목록"""
    with Session(engine) as session:
        stmt = select(InventoryItem).order_by(InventoryItem.display_order, InventoryItem.id)
        stmt = apply_bid_filter(stmt, InventoryItem, bid)
        items = session.exec(stmt).all()
        return {"status": "success", "data": [item.dict() for item in items]}


@router.post("/inventory-items")
def create_inventory_item(data: InventoryItemCreate, bid = Depends(get_bid_from_token)):
    """재고 체크 항목 추가"""
    with Session(engine) as session:
        item = InventoryItem(**data.dict(), business_id=bid)
        session.add(item)
        session.commit()
        session.refresh(item)
        return {"status": "success", "message": "항목이 추가되었습니다.", "data": item.dict()}


@router.put("/inventory-items/{item_id}")
def update_inventory_item(item_id: int, data: InventoryItemUpdate):
    """재고 체크 항목 수정"""
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
        for key, value in data.dict(exclude_unset=True).items():
            if value is not None:
                setattr(item, key, value)
        session.add(item)
        session.commit()
        session.refresh(item)
        return {"status": "success", "message": "항목이 수정되었습니다.", "data": item.dict()}


@router.delete("/inventory-items/{item_id}")
def delete_inventory_item(item_id: int):
    """재고 체크 항목 삭제"""
    with Session(engine) as session:
        item = session.get(InventoryItem, item_id)
        if not item:
            raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다.")
        session.delete(item)
        session.commit()
        return {"status": "success", "message": "항목이 삭제되었습니다."}


@router.post("/inventory-items/seed")
def seed_default_items(bid = Depends(get_bid_from_token)):
    """기본 항목 초기 데이터 생성 (항목이 없을 때)"""
    defaults = [
        {"name": "어묵", "emoji": "🐟", "unit": "개", "category": "기본", "display_order": 1},
        {"name": "계란", "emoji": "🥚", "unit": "개", "category": "기본", "display_order": 2},
        {"name": "스팸", "emoji": "✏️", "unit": "개", "category": "주먹밥", "display_order": 3},
        {"name": "순한참치", "emoji": "🐟", "unit": "개", "category": "주먹밥", "display_order": 4},
        {"name": "매콤참치", "emoji": "🌶️", "unit": "개", "category": "주먹밥", "display_order": 5},
        {"name": "불고기", "emoji": "🥩", "unit": "개", "category": "주먹밥", "display_order": 6},
        {"name": "멸치", "emoji": "🐟", "unit": "개", "category": "주먹밥", "display_order": 7},
        {"name": "햄치즈", "emoji": "🧀", "unit": "개", "category": "주먹밥", "display_order": 8},
    ]
    with Session(engine) as session:
        stmt = select(InventoryItem)
        stmt = apply_bid_filter(stmt, InventoryItem, bid)
        existing = session.exec(stmt).first()
        if existing:
            return {"status": "info", "message": "이미 항목이 존재합니다."}
        for d in defaults:
            session.add(InventoryItem(**d, business_id=bid))
        session.commit()
        return {"status": "success", "message": f"{len(defaults)}개 기본 항목이 생성되었습니다."}


# ═══════════════════════════════════════
# 📊 재고 체크 기록
# ═══════════════════════════════════════

class InventoryCheckCreate(BaseModel):
    items: Dict[str, int] = {}   # {"item_id": count, ...}
    note: Optional[str] = None


@router.post("/inventory-check")
def create_inventory_check(data: InventoryCheckCreate, staff_id: int = 0, staff_name: str = "", bid = Depends(get_bid_from_token)):
    """직원이 오픈 재고 체크를 등록"""
    today = datetime.date.today()
    # staff_id=0 means unknown/admin — set to None to avoid FK violation
    db_staff_id = staff_id if staff_id > 0 else None

    with Session(engine) as session:
        existing = session.exec(
            select(InventoryCheck).where(
                InventoryCheck.date == today,
                InventoryCheck.staff_id == db_staff_id
            )
        ).first()

        items_str = json.dumps(data.items, ensure_ascii=False)

        if existing:
            existing.items_json = items_str
            existing.note = data.note
            existing.created_at = datetime.datetime.now()
            session.add(existing)
            session.commit()
            session.refresh(existing)
            result = existing.dict()
            result["items"] = data.items
            return {"status": "success", "message": "재고 체크가 수정되었습니다.", "data": result}

        record = InventoryCheck(
            date=today,
            staff_id=db_staff_id,
            staff_name=staff_name,
            items_json=items_str,
            note=data.note,
            business_id=bid
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        result = record.dict()
        result["items"] = data.items
        return {"status": "success", "message": "재고 체크가 등록되었습니다.", "data": result}


def _enrich_record(r):
    """레코드에 items 파싱 추가"""
    d = r.dict()
    try:
        d["items"] = json.loads(r.items_json) if r.items_json else {}
    except:
        d["items"] = {}
    return d


@router.get("/inventory-check/today")
def get_today_inventory(bid = Depends(get_bid_from_token)):
    """오늘의 재고 체크 목록"""
    today = datetime.date.today()
    with Session(engine) as session:
        stmt = select(InventoryCheck).where(InventoryCheck.date == today).order_by(InventoryCheck.created_at.desc())
        stmt = apply_bid_filter(stmt, InventoryCheck, bid)
        records = session.exec(stmt).all()
        return {"status": "success", "data": [_enrich_record(r) for r in records]}


@router.get("/inventory-check/history")
def get_inventory_history(days: int = 7, bid = Depends(get_bid_from_token)):
    """최근 N일 재고 체크 이력"""
    since = datetime.date.today() - datetime.timedelta(days=days)
    with Session(engine) as session:
        stmt = select(InventoryCheck).where(InventoryCheck.date >= since).order_by(InventoryCheck.date.desc(), InventoryCheck.created_at.desc())
        stmt = apply_bid_filter(stmt, InventoryCheck, bid)
        records = session.exec(stmt).all()

        grouped = {}
        for r in records:
            d = str(r.date)
            if d not in grouped:
                grouped[d] = []
            grouped[d].append(_enrich_record(r))

        return {"status": "success", "data": grouped}


@router.get("/inventory-check/date/{date_str}")
def get_inventory_by_date(date_str: str, bid = Depends(get_bid_from_token)):
    """특정 날짜의 재고 체크"""
    try:
        target_date = datetime.date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용하세요.")

    with Session(engine) as session:
        stmt = select(InventoryCheck).where(InventoryCheck.date == target_date).order_by(InventoryCheck.created_at.desc())
        stmt = apply_bid_filter(stmt, InventoryCheck, bid)
        records = session.exec(stmt).all()
        return {"status": "success", "data": [_enrich_record(r) for r in records]}
