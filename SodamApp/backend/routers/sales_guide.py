"""영업관리 (Sales Guide) API 엔드포인트.

설계 문서: docs/superpowers/specs/2026-04-25-sales-guide-design.md (8장)

CRITICAL: get_bid_from_token 은 반드시 Depends() 로 호출. 직접 호출 시
함수가 None 반환하여 모든 데이터가 0건으로 보임 (yearend 16-endpoint 버그 재발 방지).
"""
import datetime
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from tenant_filter import get_bid_from_token
from routers.auth import get_admin_user
from models import SalesGuideProgress, User
from services.sales_guide import compute_sync_status, compute_stats

router = APIRouter(prefix="/sales-guide", tags=["sales-guide"])


# ─────────── Pydantic 스키마 ───────────

class ProgressOut(BaseModel):
    item_key: str
    is_completed: bool
    completed_at: Optional[datetime.date] = None
    expires_at: Optional[datetime.date] = None
    notes: Optional[str] = None
    updated_at: datetime.datetime
    updated_by: Optional[int] = None

    class Config:
        from_attributes = True


class ProgressListResponse(BaseModel):
    business_id: int
    items: list[ProgressOut]


class ProgressPatchRequest(BaseModel):
    is_completed: Optional[bool] = None
    completed_at: Optional[datetime.date] = None
    expires_at: Optional[datetime.date] = None
    notes: Optional[str] = None


# ─────────── CATALOG_FOR_STATS ───────────
# 백엔드에서 통계 계산에만 사용하는 카탈로그 (어떤 항목이 required 인지, syncWith 매핑).
# Frontend 가 전체 콘텐츠(label/description/links 등)를 보유. V1 은 키 일치를 수동 관리.
CATALOG_FOR_STATS: dict = {
    "permits": {
        "label": "인허가·신고",
        "items": [
            {"key": "permits.business_registration", "required": True, "renewalCycle": None,
             "syncWith": "business.business_number"},
            {"key": "permits.restaurant_report", "required": True, "renewalCycle": None},
            {"key": "permits.hygiene_education", "required": True,
             "renewalCycle": {"months": 12}},
            {"key": "permits.health_certificate", "required": True,
             "renewalCycle": {"months": 12}, "syncWith": "hr.health_certificates"},
            {"key": "permits.fire_insurance", "required": True, "renewalCycle": {"months": 12}},
            {"key": "permits.lpg_report", "required": False, "renewalCycle": None},
            {"key": "permits.waste_food_report", "required": True, "renewalCycle": None},
        ],
    },
    "delivery-apps": {
        "label": "배달·온라인 채널",
        "items": [
            {"key": "delivery.baemin", "required": False, "renewalCycle": None},
            {"key": "delivery.coupang_eats", "required": False, "renewalCycle": None},
            {"key": "delivery.yogiyo", "required": False, "renewalCycle": None},
            {"key": "delivery.naver_place", "required": True, "renewalCycle": None},
            {"key": "delivery.kakao_map", "required": True, "renewalCycle": None},
            {"key": "delivery.instagram", "required": False, "renewalCycle": None},
            {"key": "delivery.naver_booking", "required": False, "renewalCycle": None},
            {"key": "delivery.local_apps", "required": False, "renewalCycle": None},
        ],
    },
    "payment": {
        "label": "결제·POS",
        "items": [
            {"key": "payment.card_terminal", "required": True, "renewalCycle": None},
            {"key": "payment.cashbill_merchant", "required": True, "renewalCycle": None},
            {"key": "payment.pos_system", "required": False, "renewalCycle": None},
            {"key": "payment.simple_pay", "required": False, "renewalCycle": None},
            {"key": "payment.delivery_settlement", "required": True, "renewalCycle": None},
        ],
    },
    "tax": {
        "label": "세무·회계 일정",
        "items": [
            {"key": "tax.vat_filing", "required": True, "renewalCycle": {"months": 6}},
            {"key": "tax.income_tax", "required": True, "renewalCycle": {"months": 12}},
            {"key": "tax.withholding", "required": True, "renewalCycle": {"months": 1}},
            {"key": "tax.business_card", "required": False, "renewalCycle": None},
            {"key": "tax.social_insurance_org", "required": True, "renewalCycle": None},
            {"key": "tax.daily_worker_report", "required": False, "renewalCycle": {"months": 1}},
        ],
    },
    "hr": {
        "label": "인력·노무",
        "items": [
            {"key": "hr.labor_contract", "required": True, "renewalCycle": None,
             "syncWith": "hr.contracts"},
            {"key": "hr.social_insurance_staff", "required": True, "renewalCycle": None,
             "syncWith": "hr.insurance_4major"},
            {"key": "hr.minimum_wage", "required": True, "renewalCycle": None},
            {"key": "hr.foreign_worker", "required": False, "renewalCycle": None},
            {"key": "hr.severance_pay", "required": True, "renewalCycle": None},
        ],
    },
    "operations": {
        "label": "운영팁",
        "items": [
            {"key": "ops.hygiene_check", "required": False, "renewalCycle": None},
            {"key": "ops.inventory", "required": False, "renewalCycle": None},
            {"key": "ops.daily_routine", "required": False, "renewalCycle": None},
            {"key": "ops.customer_service", "required": False, "renewalCycle": None},
            {"key": "ops.sns_marketing", "required": False, "renewalCycle": None},
            {"key": "ops.financial_analysis", "required": False, "renewalCycle": None},
            {"key": "ops.crisis_response", "required": False, "renewalCycle": None},
        ],
    },
}


# ─────────── Endpoints ───────────

@router.get("/progress", response_model=ProgressListResponse)
def get_progress(
    bid: int = Depends(get_bid_from_token),
    user: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """현재 사업장의 모든 영업관리 항목 진행상태."""
    if bid is None:
        raise HTTPException(401, "인증 토큰에서 사업장을 식별할 수 없습니다")
    progresses = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == bid)
    ).all()
    return ProgressListResponse(
        business_id=bid,
        items=[ProgressOut.model_validate(p) for p in progresses],
    )


@router.patch("/progress/{item_key}", response_model=ProgressOut)
def patch_progress(
    item_key: str,
    body: ProgressPatchRequest,
    bid: int = Depends(get_bid_from_token),
    user: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """항목 체크/날짜/메모 업데이트. Upsert 시멘틱."""
    if bid is None:
        raise HTTPException(401, "인증 토큰에서 사업장을 식별할 수 없습니다")
    progress = session.exec(
        select(SalesGuideProgress).where(
            SalesGuideProgress.business_id == bid,
            SalesGuideProgress.item_key == item_key,
        )
    ).first()

    if not progress:
        progress = SalesGuideProgress(business_id=bid, item_key=item_key)
        session.add(progress)

    update_data = body.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(progress, k, v)

    progress.updated_at = datetime.datetime.now()
    progress.updated_by = user.id

    session.commit()
    session.refresh(progress)
    return ProgressOut.model_validate(progress)


@router.get("/sync-status")
def get_sync_status(
    bid: int = Depends(get_bid_from_token),
    user: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """외부 모듈(HR·세무) 자동 카운트 정보."""
    if bid is None:
        raise HTTPException(401, "인증 토큰에서 사업장을 식별할 수 없습니다")
    return compute_sync_status(session, bid)


@router.get("/stats")
def get_stats(
    bid: int = Depends(get_bid_from_token),
    user: User = Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """카테고리별·전체 진행률 (서버 계산, 만료·sync 처리 반영)."""
    if bid is None:
        raise HTTPException(401, "인증 토큰에서 사업장을 식별할 수 없습니다")
    sync = compute_sync_status(session, bid)
    return compute_stats(session, bid, CATALOG_FOR_STATS, sync)
