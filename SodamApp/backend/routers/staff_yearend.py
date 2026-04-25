"""연말정산 직원앱 라우터 (직원 본인만 접근).

- /api/staff/yearend/years              내가 볼 수 있는 연도 목록
- /api/staff/yearend/{year}             내 연도 요약
- /api/staff/yearend/{year}/documents   내 문서 목록 (원천징수영수증만)
- /api/staff/yearend/{year}/documents/{id}/download  원본 PDF
- /api/staff/yearend/{year}/draft-receipt.pdf        초안 PDF

권한: get_current_user 통해 인증된 staff 본인 데이터만.
distributed_to_staff=False 인 연도는 404 (존재 자체 숨김).
"""
from __future__ import annotations
import logging
from typing import List, Optional
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlmodel import Session, select

from database import get_session
from models import (Business, Staff, User,
                    YearEndReport, YearEndDocument, YearEndSimplified)
from routers.auth import get_current_user
from services.yearend import audit, generator

logger = logging.getLogger("sodam.staff_yearend")
router = APIRouter(prefix="/yearend", tags=["staff-yearend"])


def _require_staff(user: User) -> int:
    """User → staff_id. Raise if user is admin without linked staff."""
    if user.staff_id is None:
        raise HTTPException(403, "직원 계정이 아닙니다")
    return user.staff_id


def _mask_rn(rn: Optional[str]) -> str:
    if not rn:
        return "-"
    cleaned = rn.replace("-", "")
    if len(cleaned) < 7:
        return rn
    return f"{cleaned[:6]}-{cleaned[6]}******"


@router.get("/years")
def my_years(session: Session = Depends(get_session),
             user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    rows = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id,
               YearEndReport.distributed_to_staff == True)
        .order_by(YearEndReport.year.desc())
    ).all()
    return [{"year": r.year, "income_type": r.income_type,
             "distributed_at": r.distributed_at.isoformat() if r.distributed_at else None}
            for r in rows]


@router.get("/{year}")
def my_report(year: int, session: Session = Depends(get_session),
              user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    staff = session.get(Staff, staff_id)
    business = session.get(Business, r.business_id)
    return {
        "year": r.year,
        "income_type": r.income_type,
        "staff": {
            "name": staff.name,
            "resident_number_masked": _mask_rn(staff.resident_number),
        },
        "business": {"name": business.name if business else "-"},
        "summary": {
            "total_pay_year": r.total_pay_year,
            "decided_tax": r.decided_tax,
            "taxes_paid": r.confirmed_taxes_paid or r.taxes_withheld_total,
            "refund_amount": r.refund_amount,
            "insurance_4major_total": r.insurance_4major_total,
        },
    }


@router.get("/{year}/documents")
def my_documents(year: int, session: Session = Depends(get_session),
                 user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    # 원천징수영수증만 노출 (간소화는 회사 내부 자료)
    docs = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id, YearEndDocument.year == year,
            YearEndDocument.kind == "withholding_receipt",
        ).order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    return [{
        "id": d.id, "filename": d.original_filename,
        "uploaded_at": d.uploaded_at.isoformat(),
    } for d in docs]


@router.get("/{year}/documents/{document_id}/download")
def my_document_download(year: int, document_id: int, request: Request,
                         session: Session = Depends(get_session),
                         user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)
    doc = session.get(YearEndDocument, document_id)
    if doc is None or doc.staff_id != staff_id or doc.year != year \
       or doc.kind != "withholding_receipt":
        raise HTTPException(404)

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=doc.business_id, staff_id=staff_id, year=year,
        action="download", actor_user_id=user.id, actor_role="staff_self",
        document_id=document_id, actor_ip=ip, user_agent=ua,
    )
    session.commit()
    import requests
    resp = requests.get(doc.file_url, timeout=30)
    headers = {
        "Content-Disposition": f'attachment; filename*=UTF-8\'\'{quote(doc.original_filename)}'
    }
    return Response(content=resp.content, media_type="application/pdf", headers=headers)


@router.get("/{year}/draft-receipt.pdf")
def my_draft_receipt(year: int, request: Request,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_current_user)):
    staff_id = _require_staff(user)
    r = session.exec(
        select(YearEndReport)
        .where(YearEndReport.staff_id == staff_id, YearEndReport.year == year,
               YearEndReport.distributed_to_staff == True)
    ).first()
    if r is None:
        raise HTTPException(404)

    staff = session.get(Staff, staff_id)
    business = session.get(Business, r.business_id)
    simplified = session.exec(
        select(YearEndSimplified)
        .where(YearEndSimplified.staff_id == staff_id, YearEndSimplified.year == year)
    ).first()

    if r.income_type == "business":
        html = generator.render_business_income_html(
            report=r, staff=staff, business=business,
            is_draft=True, mask_resident_number=True,
        )
    else:
        html = generator.render_withholding_html(
            report=r, staff=staff, business=business, simplified=simplified,
            is_draft=True, mask_resident_number=True,
        )
    pdf_bytes = generator.html_to_pdf(html)

    label = "근로소득" if r.income_type == "earned" else "사업소득"
    filename = quote(f"{label}원천징수영수증_{year}_{staff.name}.pdf")

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=r.business_id, staff_id=staff_id, year=year,
        action="download", actor_user_id=user.id, actor_role="staff_self",
        actor_ip=ip, user_agent=ua,
        detail='{"target":"draft_receipt"}',
    )
    session.commit()

    return Response(
        content=pdf_bytes, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}'},
    )
