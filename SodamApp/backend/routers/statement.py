"""전자명세서 API (Popbill StatementService 6종 양식 통합).

- POST /api/statement/issue                단건 즉시 발행 (DB INSERT → 팝빌 → DB UPDATE)
- GET  /api/statement/search               발행 이력 (DB+팝빌 병합)
- GET  /api/statement/info/{mgt_key}       단건 상세
- POST /api/statement/{mgt_key}/send-fax   팩스 추가 발송
- POST /api/statement/{mgt_key}/send-sms   SMS 추가 발송
- GET  /api/statement/popbill-url          팝빌 콘솔 진입
- GET  /api/statement/status               프로바이더 상태
- GET  /api/statement/issuer               현재 사업장의 공급자 prefill
- GET  /api/statement/form-codes           양식 6종 메타 (frontend conditional 필드)

자동 이메일 발송: invoiceeEmail + email_subject 채워지면 팝빌이 자동.
"""
from __future__ import annotations

import json
import os
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import Session, select

from database import get_session
from models import Business, Statement, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.statement_service import (
    FORM_CODES,
    StatementDetail,
    StatementDraft,
    get_provider,
)

router = APIRouter(prefix="/statement", tags=["statement"])


# ─── helpers ──────────────────────────────────────────────────────

def _normalize(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _load_settings(business: Business) -> dict:
    try:
        return json.loads(business.settings_json) if business.settings_json else {}
    except Exception:  # noqa: BLE001
        return {}


def _build_issuer_from_business(business: Business) -> dict:
    """Business + settings_json → 공급자 기본 정보 dict (TaxInvoice 와 동일 패턴)."""
    settings = _load_settings(business)
    return {
        "corp_num": _normalize(business.business_number or ""),
        "corp_name": business.name or "",
        "ceo_name": business.owner_name or settings.get("representative", "") or "",
        "addr": business.address or "",
        "biz_class": settings.get("biz_class", "") or settings.get("business_type", "") or "",
        "biz_type": settings.get("biz_type", "") or business.business_type or "",
        "contact_name": business.owner_name or "",
        "email": settings.get("email", "") or "",
        "tel": business.phone or "",
    }


# ─── schemas ──────────────────────────────────────────────────────

class DetailIn(BaseModel):
    itemName: str
    purchaseDT: Optional[str] = None     # YYYYMMDD (없으면 write_date 사용)
    qty: str = "1"
    unitCost: str = "0"
    supplyCost: str = "0"
    tax: str = "0"
    spec: Optional[str] = ""
    remark: Optional[str] = ""


class IssueIn(BaseModel):
    item_code: str = Field(..., description="121~126 또는 사업장 등록 양식코드")
    form_code: Optional[str] = Field("", description="사업장 등록 양식코드 (선택, 빈값=기본)")
    write_date: Optional[str] = None
    tax_type: str = "과세"
    purpose_type: str = "영수"
    # 공급받는자
    receiver_corp_num: str = ""
    receiver_corp_name: str = ""
    receiver_ceo_name: Optional[str] = ""
    receiver_addr: Optional[str] = ""
    receiver_email: Optional[str] = ""
    receiver_tel: Optional[str] = ""
    # 금액
    supply_cost_total: str = "0"
    tax_total: str = "0"
    total_amount: str
    # 비고
    remark1: Optional[str] = ""
    remark2: Optional[str] = ""
    remark3: Optional[str] = ""
    details: List[DetailIn] = Field(default_factory=list)
    # 양식별 특수 필드 (key/value 자유)
    property_bag: Optional[dict] = Field(default_factory=dict)
    # 자동 이메일 발송 (비어있으면 안 함)
    email_subject: Optional[str] = ""
    # 선택 mgt_key (없으면 자동)
    mgt_key: Optional[str] = None


class SendFaxIn(BaseModel):
    item_code: str = Field(..., description="발행 시 사용한 양식 코드")
    sender_fax: str
    receiver_fax: str


class SendSmsIn(BaseModel):
    item_code: str
    sender_phone: str
    receiver_phone: str
    content: str


# ─── endpoints ────────────────────────────────────────────────────

@router.get("/status")
def get_status(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    env_override = os.getenv("STATEMENT_PROVIDER", "").strip().lower() or "auto"
    is_stub = provider.name == "stub"
    note = (
        "⚠️ STUB 모드. 실제 발행 없이 더미 응답."
        if is_stub
        else f"✅ 실제 발행 활성 (팝빌 IsTest={os.getenv('POPBILL_IS_TEST', 'true')})."
    )
    return {"active": provider.name, "env_override": env_override, "is_stub": is_stub, "note": note}


@router.get("/form-codes")
def list_form_codes(_admin: User = Depends(get_admin_user)):
    """6종 양식 메타. 프론트가 셀렉트 옵션 + 양식별 conditional 필드 동적 렌더링."""
    return FORM_CODES


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
    return _build_issuer_from_business(business)


@router.post("/issue")
def issue_statement(
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
    issuer = _build_issuer_from_business(business)
    if not issuer["corp_num"] or len(issuer["corp_num"]) != 10:
        raise HTTPException(
            status_code=400,
            detail="사업자등록번호가 설정되지 않았습니다. (환경설정 > 회사정보 관리)",
        )

    # 작성일자
    write_date = (body.write_date or "").strip() or date.today().strftime("%Y%m%d")
    if not re.fullmatch(r"\d{8}", write_date):
        raise HTTPException(status_code=400, detail="작성일자는 YYYYMMDD 형식이어야 합니다.")

    # mgt_key — 팝빌 관리번호 규칙: 최대 24자. 영문/숫자만 안전.
    # SDM(3) + YYYYMMDDHHMMSS(14) + uuid(4) = 21자
    if body.mgt_key and body.mgt_key.strip():
        mgt_key = body.mgt_key.strip()
        if len(mgt_key) > 24:
            raise HTTPException(status_code=400, detail="mgt_key 는 24자 이내여야 합니다.")
    else:
        import uuid
        mgt_key = f"SDM{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"

    # 공급받는자 검증 (사업자번호 있으면 10자리)
    receiver_num = _normalize(body.receiver_corp_num or "")
    if receiver_num and len(receiver_num) != 10:
        raise HTTPException(status_code=400, detail="공급받는자 사업자번호는 10자리여야 합니다.")

    # 품목 변환
    details = [
        StatementDetail(
            serialNum=i + 1,
            purchaseDT=(d.purchaseDT or write_date),
            itemName=d.itemName,
            qty=d.qty,
            unitCost=d.unitCost,
            supplyCost=d.supplyCost,
            tax=d.tax,
            spec=d.spec or "",
            remark=d.remark or "",
        )
        for i, d in enumerate(body.details)
    ]

    draft = StatementDraft(
        item_code=body.item_code,
        mgt_key=mgt_key,
        write_date=write_date,
        form_code=body.form_code or "",
        tax_type=body.tax_type,
        purpose_type=body.purpose_type,
        sender_corp_num=issuer["corp_num"],
        sender_corp_name=issuer["corp_name"],
        sender_ceo_name=issuer["ceo_name"],
        sender_addr=issuer["addr"],
        sender_biz_class=issuer["biz_class"],
        sender_biz_type=issuer["biz_type"],
        sender_contact_name=issuer["contact_name"],
        sender_email=issuer["email"],
        sender_tel=issuer["tel"],
        receiver_corp_num=receiver_num,
        receiver_corp_name=body.receiver_corp_name or "",
        receiver_ceo_name=body.receiver_ceo_name or "",
        receiver_addr=body.receiver_addr or "",
        receiver_email=body.receiver_email or "",
        receiver_tel=body.receiver_tel or "",
        supply_cost_total=str(body.supply_cost_total),
        tax_total=str(body.tax_total),
        total_amount=str(body.total_amount),
        remark1=body.remark1 or "",
        remark2=body.remark2 or "",
        remark3=body.remark3 or "",
        property_bag=body.property_bag or {},
        detail_list=details,
        email_subject=body.email_subject or "",
    )

    # DB INSERT (status=pending)
    row = Statement(
        business_id=bid,
        item_code=body.item_code,
        mgt_key=mgt_key,
        write_date=write_date,
        total_amount=str(body.total_amount),
        receiver_corp_num=receiver_num,
        receiver_corp_name=body.receiver_corp_name or "",
        status="pending",
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    # 팝빌 호출
    provider = get_provider()
    result = provider.issue(draft)

    # DB UPDATE (status / receipt_num / error_message / email_sent_at)
    if result.ok:
        row.status = "issued"
        row.receipt_num = result.receipt_num
        if draft.email_subject:
            row.email_sent_at = datetime.now()
    else:
        row.status = "failed"
        row.error_message = result.error
    session.add(row)
    session.commit()

    if not result.ok:
        # 라우터는 200 + ok:false 로 응답 (UI 에서 명확한 에러 표시)
        return {
            "ok": False,
            "id": row.id,
            "item_code": result.item_code,
            "mgt_key": result.mgt_key,
            "error": result.error,
        }

    return {
        "ok": True,
        "id": row.id,
        "item_code": result.item_code,
        "mgt_key": result.mgt_key,
        "receipt_num": result.receipt_num,
        "issue_dt": result.issue_dt,
        "email_sent": bool(draft.email_subject),
    }


@router.get("/search")
def search(
    item_code: Optional[str] = Query(None, description="121~126 (필터링)"),
    s_date: Optional[str] = Query(None, description="시작일 YYYYMMDD (기본: 90일 전)"),
    e_date: Optional[str] = Query(None, description="종료일 YYYYMMDD (기본: 오늘)"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """DB 우선 + 팝빌 search 병합. 사업장 격리 적용."""
    sd = s_date or (date.today() - timedelta(days=90)).strftime("%Y%m%d")
    ed = e_date or date.today().strftime("%Y%m%d")

    # DB 쿼리 (business_id 격리)
    db_rows = []
    if bid:
        stmt = select(Statement).where(Statement.business_id == bid)
        if item_code:
            stmt = stmt.where(Statement.item_code == item_code)
        stmt = stmt.where(Statement.write_date >= sd, Statement.write_date <= ed)
        stmt = stmt.order_by(Statement.write_date.desc(), Statement.id.desc())
        stmt = stmt.offset((page - 1) * per_page).limit(per_page)
        db_rows = session.exec(stmt).all()

    db_list = [
        {
            "source": "db",
            "id": r.id,
            "item_code": r.item_code,
            "mgt_key": r.mgt_key,
            "write_date": r.write_date,
            "total_amount": r.total_amount,
            "receiver_corp_num": r.receiver_corp_num,
            "receiver_corp_name": r.receiver_corp_name,
            "status": r.status,
            "receipt_num": r.receipt_num,
            "error_message": r.error_message,
            "email_sent_at": r.email_sent_at.isoformat() if r.email_sent_at else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in db_rows
    ]

    # 팝빌 search (item_code 필수 — 양식별 조회)
    popbill_result = {"ok": True, "list": [], "total": 0}
    if item_code:
        provider = get_provider()
        popbill_result = provider.search(
            item_code=item_code, s_date=sd, e_date=ed,
            page=page, per_page=per_page,
        )

    return {
        "ok": True,
        "db": db_list,
        "db_count": len(db_list),
        "popbill": popbill_result,
        "page": page,
        "per_page": per_page,
        "s_date": sd,
        "e_date": ed,
        "item_code": item_code,
    }


@router.get("/info/{mgt_key}")
def get_info(
    mgt_key: str,
    item_code: str = Query(..., description="발행 시 사용한 양식 코드"),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    # DB 우선 조회 (사업장 격리)
    db_row = None
    if bid:
        stmt = select(Statement).where(
            Statement.business_id == bid,
            Statement.item_code == item_code,
            Statement.mgt_key == mgt_key,
        )
        db_row = session.exec(stmt).first()

    provider = get_provider()
    popbill_info = provider.get_info(item_code, mgt_key)

    return {
        "ok": True,
        "db": (
            {
                "id": db_row.id,
                "status": db_row.status,
                "receipt_num": db_row.receipt_num,
                "total_amount": db_row.total_amount,
                "write_date": db_row.write_date,
                "email_sent_at": db_row.email_sent_at.isoformat() if db_row.email_sent_at else None,
                "error_message": db_row.error_message,
                "created_at": db_row.created_at.isoformat(),
            }
            if db_row
            else None
        ),
        "popbill": popbill_info,
    }


def _verify_tenant_owns_statement(
    session: Session, bid: Optional[int], item_code: str, mgt_key: str,
) -> None:
    """다른 사업장의 mgt_key 로 팩스/SMS 발송 차단."""
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    row = session.exec(
        select(Statement).where(
            Statement.business_id == bid,
            Statement.item_code == item_code,
            Statement.mgt_key == mgt_key,
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="해당 사업장에서 발행한 명세서를 찾을 수 없습니다.")


@router.post("/{mgt_key}/send-fax")
def send_fax(
    mgt_key: str,
    body: SendFaxIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_statement(session, bid, body.item_code, mgt_key)
    provider = get_provider()
    result = provider.send_fax(
        body.item_code, mgt_key, body.sender_fax, body.receiver_fax,
    )
    return result


@router.post("/{mgt_key}/send-sms")
def send_sms(
    mgt_key: str,
    body: SendSmsIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_statement(session, bid, body.item_code, mgt_key)
    provider = get_provider()
    result = provider.send_sms(
        body.item_code, mgt_key, body.sender_phone, body.receiver_phone, body.content,
    )
    return result


@router.get("/popbill-url")
def popbill_url(
    togo: str = Query("BOX", description="BOX=발행함 / WRITE=작성 / CERT=인증서등록"),
    _admin: User = Depends(get_admin_user),
):
    provider = get_provider()
    try:
        url = provider.get_popbill_url(togo=togo)
        return {"ok": True, "url": url, "togo": togo}
    except Exception as e:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=str(e))
