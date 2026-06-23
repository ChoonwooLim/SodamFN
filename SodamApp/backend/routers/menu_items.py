# -*- coding: utf-8 -*-
"""매장별 통합 메뉴 상품 API — 메뉴판/가격표 + 레시피관리 공용."""
import json
import os
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from pydantic import BaseModel
from sqlmodel import Session, select
from database import get_session
from models import MenuItem, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token, apply_bid_filter
from services.default_menu import default_menu_rows

router = APIRouter()


# ── Schemas ──
class MenuItemIn(BaseModel):
    item_type: str = "product"
    name: str
    category: Optional[str] = None
    price: int = 0
    emoji: Optional[str] = None
    spec: Optional[str] = None
    ingredients: List[str] = []
    steps: List[str] = []
    image_url: Optional[str] = None
    sort_order: int = 0
    is_active: bool = True


class MenuItemPatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    price: Optional[int] = None
    emoji: Optional[str] = None
    spec: Optional[str] = None
    ingredients: Optional[List[str]] = None
    steps: Optional[List[str]] = None
    image_url: Optional[str] = None
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


def _to_dict(m: MenuItem) -> dict:
    def _arr(s):
        if not s:
            return []
        try:
            return json.loads(s)
        except Exception:
            return []
    return {
        "id": m.id, "item_type": m.item_type, "name": m.name, "category": m.category,
        "price": m.price, "emoji": m.emoji, "spec": m.spec,
        "ingredients": _arr(m.ingredients), "steps": _arr(m.steps),
        "image_url": m.image_url, "sort_order": m.sort_order, "is_active": m.is_active,
    }


def _seed_if_empty(session: Session, bid: int):
    """매장에 메뉴가 0건이면 기본 메뉴로 채운다 (idempotent)."""
    if bid is None or bid < 0:
        return
    existing = session.exec(
        apply_bid_filter(select(MenuItem), MenuItem, bid)
    ).first()
    if existing:
        return
    for item_type, order, d in default_menu_rows():
        session.add(MenuItem(
            business_id=bid, item_type=item_type, name=d["name"],
            category=d.get("category"), price=d.get("price", 0), emoji=d.get("emoji"),
            spec=d.get("spec"),
            ingredients=json.dumps(d.get("ingredients", []), ensure_ascii=False),
            steps=json.dumps(d.get("steps", []), ensure_ascii=False),
            sort_order=order, is_active=True,
        ))
    session.commit()


@router.get("/api/menu-items")
def list_menu_items(item_type: Optional[str] = None,
                    _admin: User = Depends(get_admin_user),
                    bid=Depends(get_bid_from_token),
                    session: Session = Depends(get_session)):
    """매장 메뉴 목록. 비어 있으면 기본 메뉴 자동 시드."""
    _seed_if_empty(session, bid)
    stmt = apply_bid_filter(select(MenuItem), MenuItem, bid)
    if item_type:
        stmt = stmt.where(MenuItem.item_type == item_type)
    rows = session.exec(stmt.order_by(MenuItem.sort_order, MenuItem.id)).all()
    return {"items": [_to_dict(m) for m in rows], "count": len(rows)}


@router.post("/api/menu-items")
def create_menu_item(data: MenuItemIn,
                     _admin: User = Depends(get_admin_user),
                     bid=Depends(get_bid_from_token),
                     session: Session = Depends(get_session)):
    if bid is None or bid < 0:
        raise HTTPException(status_code=400, detail="매장 정보가 없습니다.")
    m = MenuItem(
        business_id=bid, item_type=data.item_type, name=data.name, category=data.category,
        price=data.price, emoji=data.emoji, spec=data.spec,
        ingredients=json.dumps(data.ingredients, ensure_ascii=False),
        steps=json.dumps(data.steps, ensure_ascii=False),
        image_url=data.image_url, sort_order=data.sort_order, is_active=data.is_active,
    )
    session.add(m)
    session.commit()
    session.refresh(m)
    return _to_dict(m)


@router.put("/api/menu-items/{item_id}")
def update_menu_item(item_id: int, data: MenuItemPatch,
                     _admin: User = Depends(get_admin_user),
                     bid=Depends(get_bid_from_token),
                     session: Session = Depends(get_session)):
    m = session.get(MenuItem, item_id)
    if not m or (bid is not None and m.business_id != bid):
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다.")
    fields = data.dict(exclude_unset=True)
    for k in ("ingredients", "steps"):
        if k in fields and fields[k] is not None:
            fields[k] = json.dumps(fields[k], ensure_ascii=False)
    for k, v in fields.items():
        setattr(m, k, v)
    session.add(m)
    session.commit()
    session.refresh(m)
    return _to_dict(m)


@router.delete("/api/menu-items/{item_id}")
def delete_menu_item(item_id: int,
                     _admin: User = Depends(get_admin_user),
                     bid=Depends(get_bid_from_token),
                     session: Session = Depends(get_session)):
    m = session.get(MenuItem, item_id)
    if not m or (bid is not None and m.business_id != bid):
        raise HTTPException(status_code=404, detail="메뉴를 찾을 수 없습니다.")
    session.delete(m)
    session.commit()
    return {"status": "success"}


@router.post("/api/menu-items/upload-image")
async def upload_menu_image(file: UploadFile = File(...),
                            _admin: User = Depends(get_admin_user)):
    """메뉴(상품) 사진 업로드 → 저장 후 URL 반환. 프론트가 image_url 로 저장."""
    from services.storage_service import get_storage
    allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드할 수 있습니다. (JPG/PNG/GIF/WEBP)")
    storage = get_storage()
    ts = int(datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "menu.jpg")[1] or ".jpg"
    storage_key = f"menu_images/menu_{ts}{ext}"
    url = storage.upload_file(file.file, storage_key, file.content_type)
    return {"status": "success", "url": url}
