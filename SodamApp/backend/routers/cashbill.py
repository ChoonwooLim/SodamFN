"""현금영수증 발행 API (Popbill CashbillService).

- POST /api/cashbill/issue           단건 발행
- GET  /api/cashbill/search          90일 발행 이력
- GET  /api/cashbill/info/{mgt_key}  단건 상세
- POST /api/cashbill/cancel          취소 발행
- GET  /api/cashbill/popbill-url     팝빌 페이지 URL (PBOX, WRITE)
- GET  /api/cashbill/issuer          현재 사업장의 가맹점 정보 (prefill)
- GET  /api/cashbill/status          프로바이더 상태
"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session

from database import get_session
from models import Business, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.cashbill_service import CashbillDraft, get_provider

router = APIRouter(prefix="/cashbill", tags=["cashbill"])


def _normalize(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _load_settings(business: Business) -> dict:
    try:
        return json.loads(business.settings_json) if business.settings_json else {}
    except Exception:
        return {}


def _build_franchise(business: Business) -> dict:
    settings = _load_settings(business)
    return {
        "corp_num": _normalize(business.business_number or ""),
        "corp_name": business.name or "",
        "ceo_name": business.owner_name or settings.get("representative", "") or "",
        "addr": business.address or "",
        "tel": business.phone or "",
    }


# ─── schemas ───

class IssueIn(BaseModel):
    trade_usage: str = Field("소득공제용", description="소득공제용 / 지출증빙용")
    trade_opt: str = Field("일반", description="일반 / 도서공연 / 대중교통")
    taxation_type: str = Field("과세", description="과세 / 비과세")
    identity_num: str = Field(..., description="식별번호: 휴대폰/주민/사업자")
    customer_name: Optional[str] = ""
    item_name: str = Field(..., description="상품명")
    order_number: Optional[str] = ""
    email: Optional[str] = ""
    hp: Optional[str] = ""
    smssend_yn: bool = False
    trade_date: Optional[str] = None         # YYYYMMDD (없으면 오늘)
    supply_cost: str
    tax: str = "0"
    service_fee: str = "0"
    total_amount: str
    mgt_key: Optional[str] = None


class CancelIn(BaseModel):
    mgt_key: str
    orig_confirm_num: str = Field(..., description="원거래 confirmNum (필수)")
    orig_trade_date: str = Field(..., description="원거래 거래일자 YYYYMMDD (필수)")
    memo: Optional[str] = "취소"


# ─── endpoints ───

@router.get("/status")
def status(_admin: User = Depends(get_admin_user)):
    p = get_provider()
    is_stub = p.name == "stub"
    return {
        "active": p.name,
        "is_stub": is_stub,
        "env_override": os.getenv("CASHBILL_PROVIDER", "").strip().lower() or "auto",
        "note": "STUB 모드" if is_stub else f"실제 발행 활성 (IsTest={os.getenv('POPBILL_IS_TEST', 'true')})",
    }


@router.get("/issuer")
def get_issuer(
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    return _build_franchise(business)


@router.post("/issue")
def issue(
    body: IssueIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    franchise = _build_franchise(business)
    if not franchise["corp_num"] or len(franchise["corp_num"]) != 10:
        raise HTTPException(status_code=400, detail="가맹점 사업자번호가 설정되지 않았습니다. (환경설정 > 회사정보 관리)")

    # 식별번호 검증
    id_num = _normalize(body.identity_num)
    if body.trade_usage == "지출증빙용" and len(id_num) != 10:
        raise HTTPException(status_code=400, detail="지출증빙용은 사업자번호 10자리가 필요합니다.")
    if body.trade_usage == "소득공제용" and not (len(id_num) in (10, 11, 13)):
        raise HTTPException(status_code=400, detail="소득공제용 식별번호는 휴대폰(10~11자리) 또는 주민번호(13자리)여야 합니다.")

    trade_date = (body.trade_date or "").strip() or date.today().strftime("%Y%m%d")
    if not re.fullmatch(r"\d{8}", trade_date):
        raise HTTPException(status_code=400, detail="거래일자는 YYYYMMDD 형식이어야 합니다.")

    mgt_key = (body.mgt_key or "").strip() or f"CB{datetime.now().strftime('%Y%m%d%H%M%S')}"

    draft = CashbillDraft(
        mgt_key=mgt_key,
        trade_date=trade_date,
        trade_usage=body.trade_usage,
        trade_opt=body.trade_opt,
        taxation_type=body.taxation_type,
        identity_num=id_num,
        franchise_corp_num=franchise["corp_num"],
        franchise_corp_name=franchise["corp_name"],
        franchise_ceo_name=franchise["ceo_name"],
        franchise_addr=franchise["addr"],
        franchise_tel=franchise["tel"],
        customer_name=body.customer_name or "",
        item_name=body.item_name,
        order_number=body.order_number or "",
        email=body.email or "",
        hp=body.hp or "",
        smssend_yn=body.smssend_yn,
        supply_cost=str(body.supply_cost),
        tax=str(body.tax),
        service_fee=str(body.service_fee),
        total_amount=str(body.total_amount),
    )
    result = get_provider().issue(draft)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "발행 실패")
    return result.to_dict()


@router.get("/info/{mgt_key}")
def get_info(mgt_key: str, _admin: User = Depends(get_admin_user)):
    return get_provider().get_info(mgt_key)


@router.get("/search")
def search(
    s_date: Optional[str] = Query(None, description="시작일 YYYYMMDD (기본: 90일 전)"),
    e_date: Optional[str] = Query(None, description="종료일 YYYYMMDD (기본: 오늘)"),
    d_type: str = Query("T", description="T=거래일 / R=등록일"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    _admin: User = Depends(get_admin_user),
):
    sd = s_date or (date.today() - timedelta(days=90)).strftime("%Y%m%d")
    ed = e_date or date.today().strftime("%Y%m%d")
    return get_provider().search(s_date=sd, e_date=ed, d_type=d_type, page=page, per_page=per_page)


@router.post("/cancel")
def cancel(body: CancelIn, _admin: User = Depends(get_admin_user)):
    """발행된 현금영수증 취소 (revokeRegistIssue — 취소 거래로 새 발행).

    팝빌은 원거래 confirmNum + tradeDate 가 필요. 발행 후 응답 또는 /info 로 미리
    확보한 값을 호출자가 전달.
    """
    res = get_provider().cancel(
        body.mgt_key, body.orig_confirm_num, body.orig_trade_date, body.memo or "취소",
    )
    if not res.ok:
        raise HTTPException(status_code=400, detail=res.error or "취소 실패")
    return res.to_dict()


@router.get("/popbill-url")
def popbill_url(
    togo: str = Query("PBOX", description="PBOX(매출발행함) / WRITE(작성)"),
    _admin: User = Depends(get_admin_user),
):
    try:
        url = get_provider().get_popbill_url(togo=togo)
        return {"ok": True, "url": url, "togo": togo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/balance")
def get_balance(_admin: User = Depends(get_admin_user)):
    """팝빌 잔액 조회 — 회원 + 파트너 분리 표시 (현금영수증 100원/건 기준)."""
    p = get_provider()
    bal = p.get_balance()  # {"member", "partner", "usable"}
    is_test_mode = (os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes"))
    return {
        "ok": True,
        "balance": bal.get("usable"),
        "member_balance": bal.get("member"),
        "partner_balance": bal.get("partner"),
        "is_test": is_test_mode,
        "unit_cost": 100,
        "note": (
            "TEST 환경 잔액 (test.popbill.com 충전)" if is_test_mode
            else "LIVE 환경 잔액 — 파트너 잔액(SODAM 충전) + 회원 잔액"
        ),
    }


@router.get("/charge-url")
def get_charge_url(_admin: User = Depends(get_admin_user)):
    """팝빌 포인트 충전 페이지 URL."""
    try:
        url = get_provider().get_charge_url()
        return {"ok": True, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
