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

from sqlmodel import Session, select

from database import get_session
from models import Business, TaxinvoiceRecord, User
from routers.auth import get_admin_user
from tenant_filter import get_bid_from_token
from services.taxinvoice_service import (
    SAMPLE_DATA, TaxinvoiceDetail, TaxinvoiceDraft, get_provider,
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

    # DB INSERT (status=pending)
    db_row = TaxinvoiceRecord(
        business_id=bid,
        key_type="SELL",
        mgt_key=mgt_key,
        write_date=write_date,
        tax_type=body.tax_type,
        total_amount=str(body.total_amount),
        invoicee_corp_num=invoicee_num,
        invoicee_corp_name=body.invoicee_corp_name,
        status="pending",
    )
    session.add(db_row)
    session.commit()
    session.refresh(db_row)

    provider = get_provider()
    result = provider.issue(draft)

    # DB UPDATE
    if result.ok:
        db_row.status = "issued"
        db_row.receipt_num = result.receipt_num
        db_row.invoice_num = result.invoice_num
    else:
        db_row.status = "failed"
        db_row.error_message = result.error
    session.add(db_row)
    session.commit()

    if not result.ok:
        return {
            "ok": False,
            "id": db_row.id,
            "mgt_key": result.mgt_key,
            "error": result.error,
        }

    return {
        "ok": True,
        "id": db_row.id,
        "mgt_key": result.mgt_key,
        "receipt_num": result.receipt_num,
        "invoice_num": result.invoice_num,
        "issue_dt": result.issue_dt,
    }


@router.get("/info/{mgt_key}")
def get_info(
    mgt_key: str,
    key_type: str = Query("SELL"),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    db_row = None
    if bid:
        db_row = session.exec(
            select(TaxinvoiceRecord).where(
                TaxinvoiceRecord.business_id == bid,
                TaxinvoiceRecord.key_type == key_type,
                TaxinvoiceRecord.mgt_key == mgt_key,
            )
        ).first()

    provider = get_provider()
    popbill_info = provider.get_info(mgt_key, key_type=key_type)
    return {
        "ok": True,
        "db": (
            {
                "id": db_row.id, "status": db_row.status,
                "receipt_num": db_row.receipt_num, "invoice_num": db_row.invoice_num,
                "total_amount": db_row.total_amount, "write_date": db_row.write_date,
                "tax_type": db_row.tax_type,
                "email_sent_at": db_row.email_sent_at.isoformat() if db_row.email_sent_at else None,
                "error_message": db_row.error_message,
                "created_at": db_row.created_at.isoformat(),
            }
            if db_row else None
        ),
        "popbill": popbill_info,
    }


@router.get("/search")
def search(
    s_date: Optional[str] = Query(None, description="시작일 YYYYMMDD (기본: 90일 전)"),
    e_date: Optional[str] = Query(None, description="종료일 YYYYMMDD (기본: 오늘)"),
    key_type: str = Query("SELL", description="SELL(매출) / BUY(매입)"),
    d_type: str = Query("W", description="W=작성일 / R=등록일 / I=발행일"),
    page: int = Query(1, ge=1),
    per_page: int = Query(100, ge=1, le=500),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    sd = s_date or (date.today() - timedelta(days=90)).strftime("%Y%m%d")
    ed = e_date or date.today().strftime("%Y%m%d")

    # DB 쿼리
    db_list = []
    if bid:
        stmt = (
            select(TaxinvoiceRecord)
            .where(TaxinvoiceRecord.business_id == bid)
            .where(TaxinvoiceRecord.key_type == key_type)
            .where(TaxinvoiceRecord.write_date >= sd, TaxinvoiceRecord.write_date <= ed)
            .order_by(TaxinvoiceRecord.write_date.desc(), TaxinvoiceRecord.id.desc())
            .offset((page - 1) * per_page).limit(per_page)
        )
        rows = session.exec(stmt).all()
        db_list = [
            {
                "source": "db",
                "id": r.id, "key_type": r.key_type, "mgt_key": r.mgt_key,
                "write_date": r.write_date, "tax_type": r.tax_type,
                "total_amount": r.total_amount,
                "invoicee_corp_num": r.invoicee_corp_num,
                "invoicee_corp_name": r.invoicee_corp_name,
                "status": r.status, "receipt_num": r.receipt_num, "invoice_num": r.invoice_num,
                "error_message": r.error_message,
                "email_sent_at": r.email_sent_at.isoformat() if r.email_sent_at else None,
                "created_at": r.created_at.isoformat(),
            } for r in rows
        ]

    provider = get_provider()
    popbill_result = provider.search(
        s_date=sd, e_date=ed, key_type=key_type, d_type=d_type,
        page=page, per_page=per_page,
    )

    return {
        "ok": True,
        "db": db_list,
        "db_count": len(db_list),
        "popbill": popbill_result,
        "page": page, "per_page": per_page,
        "s_date": sd, "e_date": ed, "key_type": key_type,
    }


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


@router.get("/balance")
def get_balance(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    bal = provider.get_balance()
    is_test_mode = (os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes"))
    return {
        "ok": True, "balance": bal, "is_test": is_test_mode,
        "unit_cost": 100,  # 전자세금계산서 100원/건
        "note": (
            "TEST 환경 잔액 (test.popbill.com 충전)" if is_test_mode
            else "LIVE 환경 잔액 (popbill.com 충전)"
        ),
    }


@router.get("/charge-url")
def get_charge_url(_admin: User = Depends(get_admin_user)):
    provider = get_provider()
    try:
        url = provider.get_charge_url()
        return {"ok": True, "url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


def _verify_tenant_owns_taxinvoice(
    session: Session, bid: Optional[int], key_type: str, mgt_key: str,
) -> None:
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    row = session.exec(
        select(TaxinvoiceRecord).where(
            TaxinvoiceRecord.business_id == bid,
            TaxinvoiceRecord.key_type == key_type,
            TaxinvoiceRecord.mgt_key == mgt_key,
        )
    ).first()
    if not row:
        raise HTTPException(status_code=404, detail="해당 사업장에서 발행한 세금계산서를 찾을 수 없습니다.")


@router.get("/{mgt_key}/view-url")
def view_url(
    mgt_key: str,
    key_type: str = Query("SELL"),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_taxinvoice(session, bid, key_type, mgt_key)
    provider = get_provider()
    try:
        return {"ok": True, "url": provider.get_view_url(key_type, mgt_key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{mgt_key}/print-url")
def print_url(
    mgt_key: str,
    key_type: str = Query("SELL"),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_taxinvoice(session, bid, key_type, mgt_key)
    provider = get_provider()
    try:
        return {"ok": True, "url": provider.get_print_url(key_type, mgt_key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{mgt_key}/pdf-url")
def pdf_url(
    mgt_key: str,
    key_type: str = Query("SELL"),
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_taxinvoice(session, bid, key_type, mgt_key)
    provider = get_provider()
    try:
        return {"ok": True, "url": provider.get_pdf_url(key_type, mgt_key)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class SendEmailIn(BaseModel):
    key_type: str = "SELL"
    receiver_email: str


class CancelIn(BaseModel):
    key_type: str = "SELL"
    memo: Optional[str] = ""


@router.post("/{mgt_key}/send-email")
def send_email(
    mgt_key: str,
    body: SendEmailIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_taxinvoice(session, bid, body.key_type, mgt_key)
    provider = get_provider()
    result = provider.send_email(body.key_type, mgt_key, body.receiver_email)
    if result.get("ok"):
        row = session.exec(
            select(TaxinvoiceRecord).where(
                TaxinvoiceRecord.business_id == bid,
                TaxinvoiceRecord.key_type == body.key_type,
                TaxinvoiceRecord.mgt_key == mgt_key,
            )
        ).first()
        if row:
            row.email_sent_at = datetime.now()
            session.add(row)
            session.commit()
    return result


@router.post("/{mgt_key}/cancel")
def cancel_taxinvoice(
    mgt_key: str,
    body: CancelIn,
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    _verify_tenant_owns_taxinvoice(session, bid, body.key_type, mgt_key)
    provider = get_provider()
    result = provider.cancel_issue(body.key_type, mgt_key, body.memo or "")
    if result.get("ok"):
        row = session.exec(
            select(TaxinvoiceRecord).where(
                TaxinvoiceRecord.business_id == bid,
                TaxinvoiceRecord.key_type == body.key_type,
                TaxinvoiceRecord.mgt_key == mgt_key,
            )
        ).first()
        if row:
            row.status = "cancelled"
            session.add(row)
            session.commit()
    return result


@router.get("/sample")
def get_sample(_admin: User = Depends(get_admin_user)):
    """전자세금계산서 샘플 데이터 (프론트 폼 자동 채우기용)."""
    return SAMPLE_DATA


@router.post("/issue-sample")
def issue_sample(
    _admin: User = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """샘플 데이터로 즉시 발행 (모니터링·테스트용).

    공급받는자: SAMPLE_DATA 의 더미 (사용자가 검토 후 수정 가능).
    """
    if not bid:
        raise HTTPException(status_code=400, detail="사업장 정보가 없습니다.")
    business = session.get(Business, bid)
    if not business:
        raise HTTPException(status_code=404, detail="사업장을 찾을 수 없습니다.")
    issuer = _build_issuer_from_business(business)
    if not issuer["corp_num"] or len(issuer["corp_num"]) != 10:
        raise HTTPException(status_code=400, detail="사업자등록번호 미설정")

    # 샘플 invoicee 의 기본 사업자번호: 자기 사업자번호 (안전)
    sample_invoicee_num = SAMPLE_DATA.get("invoicee_corp_num") or issuer["corp_num"]

    write_date = date.today().strftime("%Y%m%d")
    mgt_key = f"SDM{datetime.now().strftime('%Y%m%d%H%M%S')}"
    details = [
        TaxinvoiceDetail(
            purchaseDT=write_date,
            itemName=d["itemName"],
            qty=d.get("qty", "1"),
            unitCost=d.get("unitCost", "0"),
            supplyCost=d.get("supplyCost", "0"),
            tax=d.get("tax", "0"),
            spec=d.get("spec", ""),
            remark=d.get("remark", ""),
        )
        for d in SAMPLE_DATA.get("details", [])
    ]
    supply = sum(int(d.supplyCost or 0) for d in details)
    tax = sum(int(d.tax or 0) for d in details)
    total = supply + tax

    draft = TaxinvoiceDraft(
        mgt_key=mgt_key, write_date=write_date,
        invoicer_corp_num=issuer["corp_num"], invoicer_corp_name=issuer["corp_name"],
        invoicer_ceo_name=issuer["ceo_name"], invoicer_addr=issuer["addr"],
        invoicer_biz_class=issuer["biz_class"], invoicer_biz_type=issuer["biz_type"],
        invoicer_contact_name=issuer["contact_name"],
        invoicer_email=issuer["email"], invoicer_tel=issuer["tel"],
        invoicee_corp_num=sample_invoicee_num,
        invoicee_corp_name=SAMPLE_DATA["invoicee_corp_name"],
        invoicee_ceo_name=SAMPLE_DATA.get("invoicee_ceo_name", ""),
        invoicee_addr=SAMPLE_DATA.get("invoicee_addr", ""),
        invoicee_email1=SAMPLE_DATA.get("invoicee_email1", ""),
        invoicee_tel=SAMPLE_DATA.get("invoicee_tel", ""),
        invoicee_type=SAMPLE_DATA.get("invoicee_type", "사업자"),
        supply_cost_total=str(supply), tax_total=str(tax), total_amount=str(total),
        tax_type=SAMPLE_DATA.get("tax_type", "과세"),
        purpose_type=SAMPLE_DATA.get("purpose_type", "영수"),
        remark1=SAMPLE_DATA.get("remark1", ""),
        detail_list=details,
    )

    db_row = TaxinvoiceRecord(
        business_id=bid, key_type="SELL", mgt_key=mgt_key, write_date=write_date,
        tax_type=draft.tax_type, total_amount=str(total),
        invoicee_corp_num=sample_invoicee_num,
        invoicee_corp_name=SAMPLE_DATA["invoicee_corp_name"],
        status="pending",
    )
    session.add(db_row)
    session.commit()
    session.refresh(db_row)

    provider = get_provider()
    result = provider.issue(draft)
    if result.ok:
        db_row.status = "issued"
        db_row.receipt_num = result.receipt_num
        db_row.invoice_num = result.invoice_num
    else:
        db_row.status = "failed"
        db_row.error_message = result.error
    session.add(db_row)
    session.commit()

    return {
        "ok": result.ok,
        "id": db_row.id,
        "mgt_key": mgt_key,
        "receipt_num": result.receipt_num,
        "invoice_num": result.invoice_num,
        "total_amount": total,
        "error": result.error,
    }
