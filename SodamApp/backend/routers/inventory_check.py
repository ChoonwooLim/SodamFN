from fastapi import APIRouter, HTTPException
from sqlmodel import Session, select
from pydantic import BaseModel
from typing import Optional
import datetime

from models import InventoryCheck
from database import engine

router = APIRouter(tags=["inventory-check"])


class InventoryCheckCreate(BaseModel):
    fish_cake: int = 0
    egg: int = 0
    riceball_spam: int = 0
    riceball_mild_tuna: int = 0
    riceball_spicy_tuna: int = 0
    riceball_bulgogi: int = 0
    riceball_anchovy: int = 0
    riceball_ham_cheese: int = 0
    note: Optional[str] = None


@router.post("/inventory-check")
def create_inventory_check(data: InventoryCheckCreate, staff_id: int = 0, staff_name: str = ""):
    """직원이 오픈 재고 체크를 등록"""
    today = datetime.date.today()

    with Session(engine) as session:
        # 같은 직원이 같은 날 이미 등록했으면 업데이트
        existing = session.exec(
            select(InventoryCheck).where(
                InventoryCheck.date == today,
                InventoryCheck.staff_id == staff_id
            )
        ).first()

        if existing:
            for key, value in data.dict().items():
                setattr(existing, key, value)
            existing.created_at = datetime.datetime.now()
            session.add(existing)
            session.commit()
            session.refresh(existing)
            return {"status": "success", "message": "재고 체크가 수정되었습니다.", "data": existing}

        record = InventoryCheck(
            date=today,
            staff_id=staff_id,
            staff_name=staff_name,
            **data.dict()
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return {"status": "success", "message": "재고 체크가 등록되었습니다.", "data": record}


@router.get("/inventory-check/today")
def get_today_inventory():
    """오늘의 재고 체크 목록"""
    today = datetime.date.today()
    with Session(engine) as session:
        records = session.exec(
            select(InventoryCheck).where(InventoryCheck.date == today)
            .order_by(InventoryCheck.created_at.desc())
        ).all()
        return {"status": "success", "data": [r.dict() for r in records]}


@router.get("/inventory-check/history")
def get_inventory_history(days: int = 7):
    """최근 N일 재고 체크 이력"""
    since = datetime.date.today() - datetime.timedelta(days=days)
    with Session(engine) as session:
        records = session.exec(
            select(InventoryCheck).where(InventoryCheck.date >= since)
            .order_by(InventoryCheck.date.desc(), InventoryCheck.created_at.desc())
        ).all()

        # 날짜별로 그룹핑
        grouped = {}
        for r in records:
            d = str(r.date)
            if d not in grouped:
                grouped[d] = []
            grouped[d].append(r.dict())

        return {"status": "success", "data": grouped}


@router.get("/inventory-check/date/{date_str}")
def get_inventory_by_date(date_str: str):
    """특정 날짜의 재고 체크"""
    try:
        target_date = datetime.date.fromisoformat(date_str)
    except ValueError:
        raise HTTPException(status_code=400, detail="잘못된 날짜 형식입니다. YYYY-MM-DD 형식을 사용하세요.")

    with Session(engine) as session:
        records = session.exec(
            select(InventoryCheck).where(InventoryCheck.date == target_date)
            .order_by(InventoryCheck.created_at.desc())
        ).all()
        return {"status": "success", "data": [r.dict() for r in records]}
