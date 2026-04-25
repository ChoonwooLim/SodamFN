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
