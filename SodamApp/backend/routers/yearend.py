"""연말정산 어드민 라우터 (사업주 호출).

- 자체 집계 (Payroll → snapshot)
- 문서 업로드 + 파싱
- 대조 검증
- 초안 PDF 생성
- 직원앱 노출 토글
- 감사 로그 조회
"""
from __future__ import annotations
import hashlib
import io
import json
import logging
from datetime import datetime
from typing import List, Optional

from fastapi import (APIRouter, BackgroundTasks, Depends, File, Form,
                     HTTPException, Query, Request, Response, UploadFile)
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlmodel import Session, select

from database import get_session
from models import (Business, Staff, User,
                    YearEndReport, YearEndDocument, YearEndSimplified,
                    YearEndAuditLog)
from routers.auth import get_admin_user
from services.storage_service import get_storage
from services.yearend import aggregator, parser, reconciler, audit, generator
from services.yearend.tax_calculator import get_calculator
from tenant_filter import get_bid_from_token

logger = logging.getLogger("sodam.yearend")
router = APIRouter(prefix="/yearend", tags=["yearend"])


# ─────────── Schemas ───────────

class EmployeeRow(BaseModel):
    staff_id: int
    name: str
    income_type: str
    status: str
    reconciliation_status: str
    total_pay_year: int
    decided_tax: Optional[int]
    refund_amount: Optional[int]
    distributed_to_staff: bool


class YearSummary(BaseModel):
    year: int
    total_employees: int
    counts_by_status: dict
    refund_total: int
    additional_payment_total: int


class ReportDetail(BaseModel):
    report: dict
    documents: List[dict]
    simplified: Optional[dict]
    recent_audit_logs: List[dict]


# ─────────── Helpers ───────────

def _ensure_report(session: Session, biz_id: int, staff_id: int, year: int) -> YearEndReport:
    """YearEndReport 행 보장 (없으면 빈 행 생성)."""
    r = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if r is None:
        staff = session.get(Staff, staff_id)
        income_type = aggregator._infer_income_type(staff) if staff else "earned"
        r = YearEndReport(business_id=biz_id, staff_id=staff_id, year=year,
                          income_type=income_type)
        session.add(r)
        session.flush()
    return r


def _serialize_report(r: YearEndReport) -> dict:
    return {
        "id": r.id, "year": r.year, "staff_id": r.staff_id, "income_type": r.income_type,
        "status": r.status, "reconciliation_status": r.reconciliation_status,
        "reconciliation_diff": r.reconciliation_diff,
        "total_pay_year": r.total_pay_year, "taxable_pay": r.taxable_pay,
        "nontaxable_pay": r.nontaxable_pay,
        "taxes_withheld_total": r.taxes_withheld_total,
        "insurance_4major_total": r.insurance_4major_total,
        "confirmed_total_pay": r.confirmed_total_pay,
        "confirmed_taxes_paid": r.confirmed_taxes_paid,
        "decided_tax": r.decided_tax, "refund_amount": r.refund_amount,
        "aggregated_at": r.aggregated_at.isoformat() if r.aggregated_at else None,
        "confirmed_at": r.confirmed_at.isoformat() if r.confirmed_at else None,
        "distributed_to_staff": r.distributed_to_staff,
        "distributed_at": r.distributed_at.isoformat() if r.distributed_at else None,
    }


# ─────────── Year summary & employee list ───────────

@router.get("/{year}/summary")
def get_year_summary(year: int, request: Request,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_admin_user)) -> YearSummary:
    biz_id = get_bid_from_token(request)
    staffs = session.exec(
        select(Staff).where(Staff.business_id == biz_id, Staff.status == "재직")
    ).all()
    reports = session.exec(
        select(YearEndReport).where(YearEndReport.business_id == biz_id,
                                    YearEndReport.year == year)
    ).all()
    rmap = {r.staff_id: r for r in reports}

    counts = {"draft": 0, "aggregated": 0, "uploaded": 0, "reconciled": 0, "distributed": 0}
    refund_total = 0
    add_total = 0
    for s in staffs:
        r = rmap.get(s.id)
        status = r.status if r else "draft"
        counts[status] = counts.get(status, 0) + 1
        if r and r.refund_amount is not None:
            if r.refund_amount < 0:
                refund_total += -r.refund_amount  # 환급은 양의 절댓값
            else:
                add_total += r.refund_amount

    return YearSummary(
        year=year, total_employees=len(staffs),
        counts_by_status=counts,
        refund_total=refund_total, additional_payment_total=add_total,
    )


@router.get("/{year}/employees", response_model=List[EmployeeRow])
def list_employees(year: int, request: Request,
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)) -> List[EmployeeRow]:
    biz_id = get_bid_from_token(request)
    staffs = session.exec(
        select(Staff).where(Staff.business_id == biz_id)
    ).all()
    reports = session.exec(
        select(YearEndReport).where(YearEndReport.business_id == biz_id,
                                    YearEndReport.year == year)
    ).all()
    rmap = {r.staff_id: r for r in reports}

    out: List[EmployeeRow] = []
    for s in staffs:
        r = rmap.get(s.id)
        if r is None:
            out.append(EmployeeRow(
                staff_id=s.id, name=s.name,
                income_type=aggregator._infer_income_type(s),
                status="draft", reconciliation_status="pending",
                total_pay_year=0, decided_tax=None, refund_amount=None,
                distributed_to_staff=False,
            ))
        else:
            out.append(EmployeeRow(
                staff_id=s.id, name=s.name, income_type=r.income_type,
                status=r.status, reconciliation_status=r.reconciliation_status,
                total_pay_year=r.total_pay_year, decided_tax=r.decided_tax,
                refund_amount=r.refund_amount,
                distributed_to_staff=r.distributed_to_staff,
            ))
    return out


@router.get("/{year}/employees/{staff_id}", response_model=ReportDetail)
def get_employee_report(year: int, staff_id: int, request: Request,
                        session: Session = Depends(get_session),
                        user: User = Depends(get_admin_user)) -> ReportDetail:
    biz_id = get_bid_from_token(request)
    r = _ensure_report(session, biz_id, staff_id, year)
    session.commit()

    docs = session.exec(
        select(YearEndDocument)
        .where(YearEndDocument.staff_id == staff_id, YearEndDocument.year == year)
        .order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    simp = session.exec(
        select(YearEndSimplified)
        .where(YearEndSimplified.staff_id == staff_id, YearEndSimplified.year == year)
        .order_by(YearEndSimplified.parsed_at.desc())
    ).first()
    logs = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.staff_id == staff_id, YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .limit(5)
    ).all()

    return ReportDetail(
        report=_serialize_report(r),
        documents=[{
            "id": d.id, "kind": d.kind, "filename": d.original_filename,
            "uploaded_at": d.uploaded_at.isoformat(), "parse_status": d.parse_status,
            "parse_error": d.parse_error, "file_url": d.file_url,
        } for d in docs],
        simplified={
            "insurance_amount": simp.insurance_amount,
            "medical_amount": simp.medical_amount,
            "education_amount": simp.education_amount,
            "donation_amount": simp.donation_amount,
            "house_loan_principal": simp.house_loan_principal,
            "house_loan_interest": simp.house_loan_interest,
            "pension_amount": simp.pension_amount,
            "irp_amount": simp.irp_amount,
            "credit_card_amount": simp.credit_card_amount,
            "debit_card_amount": simp.debit_card_amount,
            "traditional_market": simp.traditional_market,
            "public_transport": simp.public_transport,
            "cultural_amount": simp.cultural_amount,
        } if simp else None,
        recent_audit_logs=[{
            "action": l.action, "actor_role": l.actor_role,
            "occurred_at": l.occurred_at.isoformat(), "actor_ip": l.actor_ip,
        } for l in logs],
    )


@router.post("/{year}/employees/{staff_id}/aggregate")
def trigger_aggregate(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = aggregator.refresh_snapshot(
        business_id=biz_id, staff_id=staff_id, year=year, session=session
    )
    session.commit()
    return _serialize_report(report)


def _aggregate_all_bg(biz_id: int, year: int, session: Session):
    staffs = session.exec(select(Staff).where(Staff.business_id == biz_id)).all()
    for s in staffs:
        try:
            aggregator.refresh_snapshot(
                business_id=biz_id, staff_id=s.id, year=year, session=session
            )
        except Exception as e:
            logger.error("aggregate-all staff_id=%s error: %s", s.id, e)
    session.commit()


@router.post("/{year}/aggregate-all")
def aggregate_all(year: int, request: Request, bg: BackgroundTasks,
                  session: Session = Depends(get_session),
                  user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    bg.add_task(_aggregate_all_bg, biz_id, year, session)
    return {"status": "scheduled", "year": year}


# ─────────── Document upload & parse ───────────

ALLOWED_KINDS = {"simplified", "withholding_receipt", "other"}
MAX_PDF_BYTES = 10 * 1024 * 1024  # 10MB


def _storage_key_for_doc(doc: YearEndDocument) -> str:
    """YearEndDocument → R2 storage key (업로드 시 사용한 패턴 재구성)."""
    return (
        f"yearend/{doc.business_id}/{doc.year}/{doc.staff_id}/"
        f"{doc.kind}_{doc.file_hash[:12]}.pdf"
    )


def _parse_document_sync(doc_id: int, session: Session) -> None:
    """Background task: 업로드된 PDF 파싱 → DB 저장."""
    from models import YearEndDocument, YearEndReport, YearEndSimplified
    import tempfile, requests

    doc = session.get(YearEndDocument, doc_id)
    if not doc:
        return

    tmp_path = None
    try:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            resp = requests.get(doc.file_url, timeout=30)
            resp.raise_for_status()
            tmp.write(resp.content)
            tmp_path = tmp.name

        if doc.kind == "withholding_receipt":
            data = parser.parse_withholding_receipt(tmp_path)
            r = session.exec(
                select(YearEndReport).where(YearEndReport.staff_id == doc.staff_id,
                                            YearEndReport.year == doc.year)
            ).first()
            if r is None:
                r = YearEndReport(business_id=doc.business_id, staff_id=doc.staff_id,
                                  year=doc.year)
                session.add(r); session.flush()
            r.confirmed_doc_id = doc.id
            r.confirmed_total_pay = data.total_pay
            r.confirmed_taxes_paid = data.taxes_paid_at_work
            r.decided_tax = data.decided_tax
            r.refund_amount = data.refund_amount
            r.confirmed_at = datetime.utcnow()
            if r.status in ("draft", "aggregated"):
                r.status = "uploaded"

        elif doc.kind == "simplified":
            data = parser.parse_simplified(tmp_path)
            existing = session.exec(
                select(YearEndSimplified).where(YearEndSimplified.document_id == doc.id)
            ).first()
            if existing is None:
                existing = YearEndSimplified(
                    document_id=doc.id, staff_id=doc.staff_id, year=doc.year,
                )
                session.add(existing)
            for f in ["insurance_amount", "medical_amount", "education_amount",
                      "donation_amount", "house_loan_principal", "house_loan_interest",
                      "pension_amount", "irp_amount", "credit_card_amount",
                      "debit_card_amount", "traditional_market", "public_transport",
                      "cultural_amount"]:
                setattr(existing, f, getattr(data, f, 0))
            existing.raw_extracted_text = data.raw_text
            existing.parsed_at = datetime.utcnow()

        doc.parse_status = "parsed"
        doc.parsed_at = datetime.utcnow()
        doc.parse_error = None
        session.commit()
        logger.info("yearend parse OK doc_id=%s kind=%s", doc.id, doc.kind)

    except Exception as e:
        doc.parse_status = "error"
        doc.parse_error = str(e)[:500]
        session.commit()
        logger.error("yearend parse FAIL doc_id=%s: %s", doc.id, e)
    finally:
        if tmp_path:
            try:
                import os as _os
                _os.unlink(tmp_path)
            except Exception:
                pass


@router.post("/{year}/employees/{staff_id}/documents")
async def upload_document(
    year: int, staff_id: int,
    request: Request, bg: BackgroundTasks,
    file: UploadFile = File(...),
    kind: str = Form(...),
    session: Session = Depends(get_session),
    user: User = Depends(get_admin_user),
):
    biz_id = get_bid_from_token(request)

    if kind not in ALLOWED_KINDS:
        raise HTTPException(400, f"kind 는 {ALLOWED_KINDS} 중 하나")

    if (file.content_type or "").lower() != "application/pdf":
        raise HTTPException(400, "PDF 파일만 업로드 가능")

    content = await file.read()
    if len(content) > MAX_PDF_BYTES:
        raise HTTPException(413, "10MB 이하 PDF만 허용")

    file_hash = hashlib.sha256(content).hexdigest()

    # 중복 체크
    dup = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id,
            YearEndDocument.year == year,
            YearEndDocument.kind == kind,
            YearEndDocument.file_hash == file_hash,
        )
    ).first()
    if dup:
        raise HTTPException(409, "동일 파일이 이미 업로드되어 있습니다")

    # R2/미디어 서버 저장 — storage_service.upload_file(BinaryIO, key, content_type)
    storage = get_storage()
    key = f"yearend/{biz_id}/{year}/{staff_id}/{kind}_{file_hash[:12]}.pdf"
    file_url = storage.upload_file(io.BytesIO(content), key, content_type="application/pdf")

    doc = YearEndDocument(
        business_id=biz_id, staff_id=staff_id, year=year, kind=kind,
        file_url=file_url, original_filename=file.filename or "upload.pdf",
        file_size=len(content), file_hash=file_hash,
        uploaded_by_user_id=user.id, uploaded_at=datetime.utcnow(),
    )
    session.add(doc)
    _ensure_report(session, biz_id, staff_id, year)
    session.commit()
    session.refresh(doc)

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="upload", actor_user_id=user.id, actor_role="admin",
        document_id=doc.id, actor_ip=ip, user_agent=ua,
        detail=json.dumps({"kind": kind, "filename": file.filename}, ensure_ascii=False),
    )
    session.commit()

    bg.add_task(_parse_document_sync, doc.id, session)

    return {
        "id": doc.id, "kind": doc.kind, "file_url": doc.file_url,
        "parse_status": doc.parse_status, "filename": doc.original_filename,
    }


@router.get("/{year}/employees/{staff_id}/documents")
def list_documents(year: int, staff_id: int, request: Request,
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    docs = session.exec(
        select(YearEndDocument).where(
            YearEndDocument.staff_id == staff_id, YearEndDocument.year == year
        ).order_by(YearEndDocument.uploaded_at.desc())
    ).all()
    return [{
        "id": d.id, "kind": d.kind, "filename": d.original_filename,
        "uploaded_at": d.uploaded_at.isoformat(), "parse_status": d.parse_status,
        "parse_error": d.parse_error, "file_url": d.file_url, "file_size": d.file_size,
    } for d in docs]


@router.delete("/documents/{document_id}")
def delete_document(document_id: int, request: Request,
                    session: Session = Depends(get_session),
                    user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    doc = session.get(YearEndDocument, document_id)
    if not doc or doc.business_id != biz_id:
        raise HTTPException(404, "문서를 찾을 수 없습니다")

    try:
        # storage_service.delete_file 은 key 를 받음 (URL 아님) → 업로드 패턴 재구성
        get_storage().delete_file(_storage_key_for_doc(doc))
    except Exception as e:
        logger.warning("storage delete failed for doc_id=%s: %s", doc.id, e)

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=doc.staff_id, year=doc.year,
        action="delete", actor_user_id=user.id, actor_role="admin",
        document_id=document_id, actor_ip=ip, user_agent=ua,
    )
    session.delete(doc)
    session.commit()
    return {"deleted": document_id}


@router.post("/documents/{document_id}/reparse")
def reparse_document(document_id: int, request: Request, bg: BackgroundTasks,
                     session: Session = Depends(get_session),
                     user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    doc = session.get(YearEndDocument, document_id)
    if not doc or doc.business_id != biz_id:
        raise HTTPException(404)
    doc.parse_status = "pending"; doc.parse_error = None
    session.commit()
    bg.add_task(_parse_document_sync, document_id, session)
    return {"status": "scheduled", "document_id": document_id}


# ─────────── Reconcile ───────────

@router.post("/{year}/employees/{staff_id}/reconcile")
def trigger_reconcile(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    r = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if r is None:
        raise HTTPException(404, "report 없음 — 먼저 집계 또는 업로드 필요")
    status, diff = reconciler.reconcile(r)
    r.reconciliation_status = status
    r.reconciliation_diff = diff
    if r.status in ("uploaded", "aggregated"):
        r.status = "reconciled"
    session.commit()
    return {"reconciliation_status": status, "reconciliation_diff": diff}


# ─────────── PDF generation ───────────

def _build_pdf_response(*, report, staff, business, simplified, mask_rn: bool,
                        income_type: str, is_draft: bool, filename: str) -> Response:
    if income_type == "business":
        html = generator.render_business_income_html(
            report=report, staff=staff, business=business,
            is_draft=is_draft, mask_resident_number=mask_rn,
        )
    else:
        html = generator.render_withholding_html(
            report=report, staff=staff, business=business,
            simplified=simplified, is_draft=is_draft,
            mask_resident_number=mask_rn,
        )
    pdf_bytes = generator.html_to_pdf(html)
    headers = {
        "Content-Disposition": f'attachment; filename*=UTF-8\'\'{filename}',
    }
    return Response(content=pdf_bytes, media_type="application/pdf", headers=headers)


@router.get("/{year}/employees/{staff_id}/draft-receipt.pdf")
def download_draft_pdf(year: int, staff_id: int, request: Request,
                       session: Session = Depends(get_session),
                       user: User = Depends(get_admin_user)):
    from urllib.parse import quote
    biz_id = get_bid_from_token(request)

    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404, "report 없음")
    staff = session.get(Staff, staff_id)
    business = session.get(Business, biz_id)
    simplified = session.exec(
        select(YearEndSimplified).where(YearEndSimplified.staff_id == staff_id,
                                        YearEndSimplified.year == year)
    ).first()

    label = "근로소득" if report.income_type == "earned" else "사업소득"
    filename = quote(f"{label}원천징수영수증_{year}_{staff.name}_초안.pdf")

    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="regenerate", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()

    return _build_pdf_response(
        report=report, staff=staff, business=business, simplified=simplified,
        mask_rn=False, income_type=report.income_type,
        is_draft=True, filename=filename,
    )


@router.get("/{year}/employees/{staff_id}/draft-receipt.preview")
def preview_draft_html(year: int, staff_id: int, request: Request,
                       session: Session = Depends(get_session),
                       user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    staff = session.get(Staff, staff_id)
    business = session.get(Business, biz_id)
    simplified = session.exec(
        select(YearEndSimplified).where(YearEndSimplified.staff_id == staff_id,
                                        YearEndSimplified.year == year)
    ).first()
    if report.income_type == "business":
        html = generator.render_business_income_html(
            report=report, staff=staff, business=business,
            is_draft=True, mask_resident_number=False,
        )
    else:
        html = generator.render_withholding_html(
            report=report, staff=staff, business=business, simplified=simplified,
            is_draft=True, mask_resident_number=False,
        )
    return Response(content=html, media_type="text/html; charset=utf-8")


# ─────────── Distribute / Revoke ───────────

@router.post("/{year}/employees/{staff_id}/distribute")
def distribute_report(year: int, staff_id: int, request: Request,
                      session: Session = Depends(get_session),
                      user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    if report.reconciliation_status == "mismatch":
        raise HTTPException(400, "대조 불일치 상태에서는 직원앱 노출 불가")
    report.distributed_to_staff = True
    report.distributed_at = datetime.utcnow()
    if report.status != "distributed":
        report.status = "distributed"
    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="distribute", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()
    return _serialize_report(report)


@router.post("/{year}/employees/{staff_id}/revoke")
def revoke_report(year: int, staff_id: int, request: Request,
                  session: Session = Depends(get_session),
                  user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    report = session.exec(
        select(YearEndReport).where(YearEndReport.staff_id == staff_id,
                                    YearEndReport.year == year)
    ).first()
    if report is None:
        raise HTTPException(404)
    report.distributed_to_staff = False
    if report.status == "distributed":
        report.status = "reconciled"
    ip, ua = audit.extract_actor_meta(request)
    audit.log_action(
        session=session, business_id=biz_id, staff_id=staff_id, year=year,
        action="revoke", actor_user_id=user.id, actor_role="admin",
        actor_ip=ip, user_agent=ua,
    )
    session.commit()
    return _serialize_report(report)


# ─────────── Audit logs ───────────

@router.get("/{year}/employees/{staff_id}/audit-logs")
def get_audit_logs(year: int, staff_id: int, request: Request,
                   limit: int = Query(50, ge=1, le=500),
                   offset: int = Query(0, ge=0),
                   session: Session = Depends(get_session),
                   user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    rows = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.business_id == biz_id,
               YearEndAuditLog.staff_id == staff_id,
               YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .offset(offset).limit(limit)
    ).all()
    return [{
        "id": r.id, "action": r.action, "actor_role": r.actor_role,
        "actor_user_id": r.actor_user_id, "actor_ip": r.actor_ip,
        "occurred_at": r.occurred_at.isoformat(), "detail": r.detail,
        "document_id": r.document_id,
    } for r in rows]


@router.get("/{year}/audit-logs")
def get_year_audit_logs(year: int, request: Request,
                         limit: int = Query(100, ge=1, le=1000),
                         offset: int = Query(0, ge=0),
                         session: Session = Depends(get_session),
                         user: User = Depends(get_admin_user)):
    biz_id = get_bid_from_token(request)
    rows = session.exec(
        select(YearEndAuditLog)
        .where(YearEndAuditLog.business_id == biz_id,
               YearEndAuditLog.year == year)
        .order_by(YearEndAuditLog.occurred_at.desc())
        .offset(offset).limit(limit)
    ).all()
    return [{
        "id": r.id, "staff_id": r.staff_id, "action": r.action,
        "actor_role": r.actor_role, "occurred_at": r.occurred_at.isoformat(),
    } for r in rows]
