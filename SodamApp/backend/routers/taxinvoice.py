"""전자세금계산서 API (Popbill TaxinvoiceService 래핑).

- POST /api/taxinvoice/issue          단건 즉시 발행
- GET  /api/taxinvoice/search         발행 이력 조회
- GET  /api/taxinvoice/info/{mgt_key} 단건 상세
- GET  /api/taxinvoice/popbill-url    팝빌 대시보드 바로가기 URL
- GET  /api/taxinvoice/status         프로바이더 상태
- GET  /api/taxinvoice/issuer         현재 사업장의 공급자 기본정보 (프론트 prefill용)

공급자는 현재 로그인 비즈니스(`Business`)의 정보를 자동으로 채워 넣는다.
settings_json에 email/fax/representative_eng 등 추가 필드가 있으면 우선 사용.
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
from services.taxinvoice_service import (
    TaxinvoiceDetail, TaxinvoiceDraft, get_provider,
)

router = APIRouter(prefix="/taxinvoice", tags=["taxinvoice"])


# ─── helpers ───

def _normalize(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _load_settings(business: Business) -> dict:
    try:
        return json.loads(business.settings_json) if business.settings_json else {}
    except Exception:
        return {}


def _build_issuer_from_business(business: Business) -> dict:
    """Business + settings_json → 공급자 기본 정보 dict."""
    settings = _load_settings(business)
    return {
        "corp_num": _normalize(business.business_number or ""),
        "corp_name": business.name or "",
        "ceo_name": business.owner_name or settings.get("representative", "") or "",
        "addr": business.address or "",
        "biz_class": settings.get("biz_class", "") or settings.get("business_type", "") or "",  # 업태
        "biz_type": settings.get("biz_type", "") or business.business_type or "",                # 종목
        "contact_name": business.owner_name or "",
        "email": settings.get("email", "") or "",
        "tel": business.phone or "",
    }


# ─── schemas ───

class DetailIn(BaseModel):
    itemName: str
    purchaseDT: Optional[str] = None  # YYYYMMDD (없으면 writeDate 사용)
    qty: str = "1"
    unitCost: str = "0"
    supplyCost: str = "0"
    tax: str = "0"
    spec: Optional[str] = ""
    remark: Optional[str] = ""


class IssueIn(BaseModel):
    # 공급받는자
    invoicee_corp_num: str = Field(..., description="10자리 사업자번호")
    invoicee_corp_name: str
    invoicee_ceo_name: Optional[str] = ""
    invoicee_addr: Optional[str] = ""
    invoicee_email1: Optional[str] = ""       # 알림 수신 이메일
    invoicee_tel: Optional[str] = ""
    invoicee_type: str = "사업자"
    # 세부
    write_date: Optional[str] = None          # YYYYMMDD (없으면 오늘)
    tax_type: str = "과세"                     # 과세 / 영세 / 면세
    purpose_type: str = "청구"                 # 청구 / 영수
    supply_cost_total: str
    tax_total: str
    total_amount: str
    remark1: Optional[str] = ""
    details: List[DetailIn] = Field(default_factory=list)
    # 선택: 사용자 지정 관리번호 (없으면 auto)
    mgt_key: Optional[str] = None


# ─── endpoints ───

@router.get("/status")
def get_status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env_override = os.getenv("TAXINVOICE_PROVIDER", "").strip().lower() or "auto"
    is_stub = provider.name == "stub"
    note = (
        "⚠️ STUB 모드. 실제 팝빌 호출 없이 더미 응답만 반환합니다."
        if is_stub
        else f"✅ 실제 발행 활성 (팝빌 테스트환경 IsTest={os.getenv('POPBILL_IS_TEST', 'true')})."
    )
    return {"active": provider.name, "env_override": env_override, "is_stub": is_stub, "note": note}


@router.get("/issuer")
def get_issuer(
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """현재 로그인 사업장의 공급자 기본정보 반환 (프론트 prefill)."""
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    return _build_issuer_from_business(business)


@router.post("/issue")
def issue_taxinvoice(
    body: IssueIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    # 공급자: 현재 비즈니스
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    issuer = _build_issuer_from_business(business)
    if not issuer["corp_num"] or len(issuer["corp_num"]) != 10:
        raise HTTPException(status_code=400, detail="사업자등록번호가 설정되지 않았습니다. (환경설정 > 회사정보 관리)")

    # 공급받는자 검증
    invoicee_num = _normalize(body.invoicee_corp_num)
    if body.invoicee_type == "사업자" and len(invoicee_num) != 10:
        raise HTTPException(status_code=400, detail="공급받는자 사업자번호는 10자리여야 합니다.")

    # 날짜
    write_date = (body.write_date or "").strip() or date.today().strftime("%Y%m%d")
    if not re.fullmatch(r"\d{8}", write_date):
        raise HTTPException(status_code=400, detail="작성일자는 YYYYMMDD 형식이어야 합니다.")

    # mgt_key (유일성 보장)
    mgt_key = (body.mgt_key or "").strip() or f"SDM{datetime.now().strftime('%Y%m%d%H%M%S')}"

    # 품목 변환
    details = [
        TaxinvoiceDetail(
            purchaseDT=(d.purchaseDT or write_date),
            itemName=d.itemName,
            qty=d.qty,
            unitCost=d.unitCost,
            supplyCost=d.supplyCost,
            tax=d.tax,
            spec=d.spec or "",
            remark=d.remark or "",
        )
        for d in body.details
    ]

    draft = TaxinvoiceDraft(
        mgt_key=mgt_key,
        write_date=write_date,
        invoicer_corp_num=issuer["corp_num"],
        invoicer_corp_name=issuer["corp_name"],
        invoicer_ceo_name=issuer["ceo_name"],
        invoicer_addr=issuer["addr"],
        invoicer_biz_class=issuer["biz_class"],
        invoicer_biz_type=issuer["biz_type"],
        invoicer_contact_name=issuer["contact_name"],
        invoicer_email=issuer["email"],
        invoicer_tel=issuer["tel"],
        invoicee_corp_num=invoicee_num,
        invoicee_corp_name=body.invoicee_corp_name,
        invoicee_ceo_name=body.invoicee_ceo_name or "",
        invoicee_addr=body.invoicee_addr or "",
        invoicee_email1=body.invoicee_email1 or "",
        invoicee_tel=body.invoicee_tel or "",
        invoicee_type=body.invoicee_type,
        supply_cost_total=str(body.supply_cost_total),
        tax_total=str(body.tax_total),
        total_amount=str(body.total_amount),
        tax_type=body.tax_type,
        purpose_type=body.purpose_type,
        remark1=body.remark1 or "",
        detail_list=details,
    )

    provider = get_provider()
    result = provider.issue(draft)
    if not result.ok:
        raise HTTPException(status_code=400, detail=result.error or "발행 실패")
    return result.to_dict()


@router.get("/info/{mgt_key}")
def get_info(
    mgt_key: str,
    key_type: str = Query("SELL"),
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    return provider.get_info(mgt_key, key_type=key_type)


@router.get("/search")
def search(
    s_date: Optional[str] = Query(None, description="시작일 YYYYMMDD (기본: 90일 전)"),
    e_date: Optional[str] = Query(None, description="종료일 YYYYMMDD (기본: 오늘)"),
    key_type: str = Query("SELL", description="SELL(매출) / BUY(매입)"),
    d_type: str = Query("W", description="W=작성일 / R=등록일 / I=발행일"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    _admin: User = Depends(get_admin_user),
):
    sd = s_date or (date.today() - timedelta(days=90)).strftime("%Y%m%d")
    ed = e_date or date.today().strftime("%Y%m%d")
    provider = get_provider()
    return provider.search(
        s_date=sd, e_date=ed, key_type=key_type, d_type=d_type,
        page=page, per_page=per_page,
    )


@router.get("/popbill-url")
def popbill_url(
    togo: str = Query("TBOX", description="TBOX=매출발행함 / SBOX=매출임시 / WRITE=작성 / CERT=인증서등록"),
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    try:
        url = provider.get_popbill_url(togo=togo)
        return {"ok": True, "url": url, "togo": togo}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
