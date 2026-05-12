"""카드 가맹점번호 관리 — CardMerchant CRUD.

POST /api/codef/card-merchants/bulk  — 사장님 가맹점번호 표 일괄 등록 (upsert)
GET  /api/codef/card-merchants       — 사업장 가맹점번호 리스트
PATCH /api/codef/card-merchants/{id} — 단건 수정
DELETE /api/codef/card-merchants/{id}

CardMerchant 는 CODEF 카드 매출 수집 + Excel/Manual 입력 모두 지원.
사장님이 카드사로부터 받은 가맹점번호 표를 셈하나에 등록해두면,
CODEF 매출 데이터 적재 시 자동 매칭에도 사용 가능.
"""
from datetime import datetime
from typing import Optional, List

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import engine
from models import User, CardMerchant
from routers.auth import get_admin_user
from services.codef.organization_catalog import get_organization

router = APIRouter(prefix="/api/codef/card-merchants", tags=["codef"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(400, "사업장 정보가 없습니다.")
    return bid


# 사장님 캡쳐 매핑: 표시명 → CODEF organization_code (CODEF 미지원은 None)
CARD_CORP_TO_CODEF: dict = {
    "KB국민카드": "0301",
    "NH카드": "0302",
    "NH농협카드": "0302",
    "롯데카드": "0303",
    "씨티카드": "0304",
    "하나카드": "0305",
    "하나구외환": "0305",     # 하나구외환 = 하나카드
    "신한카드": "0306",
    "현대카드": "0307",
    "우리카드": "0309",
    "BC카드": "0361",
    "비씨카드": "0361",
    "삼성카드": "0364",
    # PG 사 (CODEF 카드 카탈로그 미지원 — None 으로 마킹)
    "카카오페이": None,
    "네이버페이": None,
    "Npay": None,
    "제로페이": None,
    "토스페이": None,
    "페이코": None,
    "SSG페이": None,
}


def _codef_code_for(card_corp: str) -> Optional[str]:
    return CARD_CORP_TO_CODEF.get((card_corp or "").strip())


class MerchantIn(BaseModel):
    card_corp: str = Field(..., description="카드사/PG 표시명 (예: 'KB국민카드', '카카오페이')")
    merchant_id: str = Field(..., description="가맹점번호")
    merchant_name: Optional[str] = None
    fee_rate: Optional[float] = Field(default=None, ge=0, le=0.2, description="수수료율 (예: 0.025 = 2.5%)")
    registered_at: Optional[str] = Field(default=None, description="YYYY-MM-DD")
    status: str = Field(default="active")


class BulkIn(BaseModel):
    merchants: List[MerchantIn]


@router.post("/bulk")
def bulk_upsert(
    body: BulkIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """가맹점번호 일괄 upsert. (business_id, card_corp, merchant_id) 기준 중복 차단."""
    bid = _resolve_bid(admin, x_view_as_business)
    created = 0
    updated = 0
    with Session(engine) as s:
        for m in body.merchants:
            cc = m.card_corp.strip()
            mid = m.merchant_id.strip()
            if not cc or not mid:
                continue
            existing = s.exec(
                select(CardMerchant).where(
                    CardMerchant.business_id == bid,
                    CardMerchant.card_corp == cc,
                    CardMerchant.merchant_id == mid,
                )
            ).first()
            reg_date = None
            if m.registered_at:
                try:
                    reg_date = datetime.strptime(m.registered_at, "%Y-%m-%d").date()
                except (ValueError, TypeError):
                    pass
            if existing:
                if m.merchant_name is not None:
                    existing.merchant_name = m.merchant_name
                if m.fee_rate is not None:
                    existing.fee_rate = m.fee_rate
                    existing.fee_rate_updated_at = datetime.utcnow()
                if reg_date:
                    existing.registered_at = reg_date
                existing.status = m.status
                existing.last_synced_at = datetime.utcnow()
                s.add(existing)
                updated += 1
            else:
                row = CardMerchant(
                    business_id=bid,
                    card_corp=cc,
                    merchant_id=mid,
                    merchant_name=m.merchant_name,
                    fee_rate=m.fee_rate,
                    fee_rate_updated_at=datetime.utcnow() if m.fee_rate is not None else None,
                    registered_at=reg_date,
                    status=m.status,
                    source="manual",
                )
                s.add(row)
                created += 1
        s.commit()
    return {"ok": True, "created": created, "updated": updated, "total": created + updated}


@router.get("")
def list_merchants(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """사업장 가맹점번호 리스트 + CODEF 매핑 정보 + 연결 상태."""
    from models import CodefConnection
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        rows = s.exec(
            select(CardMerchant)
            .where(CardMerchant.business_id == bid)
            .order_by(CardMerchant.card_corp, CardMerchant.merchant_id)
        ).all()
        # 사업장 active CODEF 카드 connection 매핑
        conns = s.exec(
            select(CodefConnection).where(
                CodefConnection.business_id == bid,
                CodefConnection.organization_type == "card",
                CodefConnection.status == "active",
            )
        ).all()
        conn_by_org = {c.organization_code: c for c in conns}

        out = []
        for r in rows:
            codef_code = _codef_code_for(r.card_corp)
            conn = conn_by_org.get(codef_code) if codef_code else None
            out.append({
                "id": r.id,
                "card_corp": r.card_corp,
                "merchant_id": r.merchant_id,
                "merchant_name": r.merchant_name,
                "fee_rate": r.fee_rate,
                "registered_at": r.registered_at.isoformat() if r.registered_at else None,
                "status": r.status,
                "source": r.source,
                "codef_supported": codef_code is not None,
                "codef_org_code": codef_code,
                "codef_connected": conn is not None,
                "codef_connection_id": conn.id if conn else None,
            })
        return out


class MerchantPatchIn(BaseModel):
    card_corp: Optional[str] = None
    merchant_id: Optional[str] = None
    merchant_name: Optional[str] = None
    fee_rate: Optional[float] = Field(default=None, ge=0, le=0.2)
    registered_at: Optional[str] = None
    status: Optional[str] = None


@router.patch("/{merchant_pk}")
def update_merchant(
    merchant_pk: int,
    body: MerchantPatchIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        m = s.get(CardMerchant, merchant_pk)
        if not m or m.business_id != bid:
            raise HTTPException(404, "가맹점 없음")
        if body.card_corp is not None: m.card_corp = body.card_corp.strip()
        if body.merchant_id is not None: m.merchant_id = body.merchant_id.strip()
        if body.merchant_name is not None: m.merchant_name = body.merchant_name
        if body.fee_rate is not None:
            m.fee_rate = body.fee_rate
            m.fee_rate_updated_at = datetime.utcnow()
        if body.registered_at is not None:
            try:
                m.registered_at = datetime.strptime(body.registered_at, "%Y-%m-%d").date()
            except (ValueError, TypeError):
                pass
        if body.status is not None: m.status = body.status
        m.last_synced_at = datetime.utcnow()
        s.add(m)
        s.commit()
        s.refresh(m)
        return {"ok": True, "id": m.id}


@router.delete("/{merchant_pk}")
def delete_merchant(
    merchant_pk: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        m = s.get(CardMerchant, merchant_pk)
        if not m or m.business_id != bid:
            raise HTTPException(404, "가맹점 없음")
        s.delete(m)
        s.commit()
        return {"ok": True, "deleted": merchant_pk}
