"""
사업장 산하 매장 (BusinessStore) CRUD 라우터.

다중매장 보유 업체용 — 사업장 1개에 매장 N개 매핑.
계약서 {work_location} 변수 자동 치환에 사용.
"""
from fastapi import APIRouter, HTTPException, Depends, Body
from sqlmodel import Session, select
from typing import Optional
from pydantic import BaseModel

from routers.auth import get_admin_user
from models import User as AuthUser, BusinessStore
from database import get_session
from tenant_filter import get_bid_from_token

router = APIRouter()


class StoreCreate(BaseModel):
    name: str
    address: Optional[str] = None
    phone: Optional[str] = None
    is_default: bool = False
    sort_order: int = 0


class StoreUpdate(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None
    sort_order: Optional[int] = None


def _resolve_bid(admin: AuthUser, bid_from_token: Optional[int]) -> int:
    bid = bid_from_token or admin.business_id
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다. SuperAdmin 은 먼저 대상 사업장을 선택(View As)하세요.")
    return bid


@router.get("/stores")
def list_stores(
    _admin: AuthUser = Depends(get_admin_user),
    bid_from_token: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """현재 사업장의 매장 목록 (활성 매장 우선, sort_order ASC)."""
    bid = _resolve_bid(_admin, bid_from_token)
    stmt = select(BusinessStore).where(BusinessStore.business_id == bid).order_by(
        BusinessStore.is_active.desc(),
        BusinessStore.sort_order,
        BusinessStore.id,
    )
    stores = session.exec(stmt).all()
    return {"status": "success", "data": [s.model_dump() for s in stores]}


@router.post("/stores")
def create_store(
    payload: StoreCreate,
    _admin: AuthUser = Depends(get_admin_user),
    bid_from_token: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    bid = _resolve_bid(_admin, bid_from_token)
    name = (payload.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="매장명을 입력해 주세요.")

    # is_default=True 신규 시 기존 default 해제
    if payload.is_default:
        existing_defaults = session.exec(
            select(BusinessStore).where(
                BusinessStore.business_id == bid,
                BusinessStore.is_default == True,  # noqa: E712
            )
        ).all()
        for s in existing_defaults:
            s.is_default = False
            session.add(s)

    store = BusinessStore(
        business_id=bid,
        name=name[:128],
        address=(payload.address or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        is_default=payload.is_default,
        is_active=True,
        sort_order=payload.sort_order,
    )
    session.add(store)
    session.commit()
    session.refresh(store)
    return {"status": "success", "data": store.model_dump()}


@router.put("/stores/{store_id}")
def update_store(
    store_id: int,
    payload: StoreUpdate,
    _admin: AuthUser = Depends(get_admin_user),
    bid_from_token: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    bid = _resolve_bid(_admin, bid_from_token)
    store = session.get(BusinessStore, store_id)
    if not store or store.business_id != bid:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")

    if payload.name is not None:
        nm = payload.name.strip()
        if not nm:
            raise HTTPException(status_code=400, detail="매장명은 비울 수 없습니다.")
        store.name = nm[:128]
    if payload.address is not None:
        store.address = payload.address.strip() or None
    if payload.phone is not None:
        store.phone = payload.phone.strip() or None
    if payload.is_active is not None:
        store.is_active = payload.is_active
    if payload.sort_order is not None:
        store.sort_order = payload.sort_order

    session.add(store)
    session.commit()
    session.refresh(store)
    return {"status": "success", "data": store.model_dump()}


@router.put("/stores/{store_id}/set-default")
def set_default_store(
    store_id: int,
    _admin: AuthUser = Depends(get_admin_user),
    bid_from_token: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """선택된 매장을 default 로 설정 (기존 default 해제)."""
    bid = _resolve_bid(_admin, bid_from_token)
    target = session.get(BusinessStore, store_id)
    if not target or target.business_id != bid:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")

    # 모든 default 해제 후 target만 설정
    others = session.exec(
        select(BusinessStore).where(
            BusinessStore.business_id == bid,
            BusinessStore.is_default == True,  # noqa: E712
        )
    ).all()
    for s in others:
        s.is_default = False
        session.add(s)
    target.is_default = True
    session.add(target)
    session.commit()
    return {"status": "success", "message": "기본 매장이 변경되었습니다.", "default_store_id": store_id}


@router.delete("/stores/{store_id}")
def delete_store(
    store_id: int,
    _admin: AuthUser = Depends(get_admin_user),
    bid_from_token: Optional[int] = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """매장 삭제. default 매장이면 다른 매장이 자동으로 default 승격."""
    bid = _resolve_bid(_admin, bid_from_token)
    store = session.get(BusinessStore, store_id)
    if not store or store.business_id != bid:
        raise HTTPException(status_code=404, detail="매장을 찾을 수 없습니다.")

    was_default = store.is_default
    session.delete(store)
    session.flush()

    # default 매장 삭제 시 다른 활성 매장 중 첫 번째를 default 로 승격
    if was_default:
        candidate = session.exec(
            select(BusinessStore)
            .where(BusinessStore.business_id == bid, BusinessStore.is_active == True)  # noqa: E712
            .order_by(BusinessStore.sort_order, BusinessStore.id)
        ).first()
        if candidate:
            candidate.is_default = True
            session.add(candidate)

    session.commit()
    return {"status": "success", "message": "매장이 삭제되었습니다."}
