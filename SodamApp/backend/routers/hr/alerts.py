from fastapi import APIRouter, Depends
from sqlmodel import Session, select
from datetime import date
from typing import Optional

from routers.auth import get_admin_user
from models import Staff, StaffTraining, StaffCertification, User as AuthUser
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

@router.get("/alerts")
def get_hr_alerts(_admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Consolidated HR alerts"""
    alerts = []
    today = date.today()

    # Get all active staff
    stmt = apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "재직")
    staffs = session.exec(stmt).all()

    for s in staffs:
        # 1. Contract expiry
        if s.contract_end_date:
            days_left = (s.contract_end_date - today).days
            if 0 <= days_left <= 30:
                level = "danger" if days_left <= 7 else "warning" if days_left <= 14 else "info"
                alerts.append({
                    "type": "contract_expiry",
                    "level": level,
                    "staff_id": s.id,
                    "staff_name": s.name,
                    "message": f"근로계약 만료 {days_left}일 전",
                    "detail": f"계약종료일: {s.contract_end_date}",
                    "days_left": days_left,
                })

        # 2. Missing critical documents
        missing_docs = []
        if not s.doc_contract:
            missing_docs.append("근로계약서")
        if not s.doc_health_cert:
            missing_docs.append("건강진단서")
        if not s.doc_id_copy:
            missing_docs.append("신분증사본")
        if not s.doc_bank_copy:
            missing_docs.append("통장사본")
        if missing_docs:
            alerts.append({
                "type": "missing_document",
                "level": "warning",
                "staff_id": s.id,
                "staff_name": s.name,
                "message": f"미제출 서류 {len(missing_docs)}건",
                "detail": ", ".join(missing_docs),
                "days_left": None,
            })

        # 3. Probation ending (3 months from start)
        if s.start_date:
            from dateutil.relativedelta import relativedelta
            probation_end = s.start_date + relativedelta(months=3)
            prob_days = (probation_end - today).days
            if 0 <= prob_days <= 7:
                alerts.append({
                    "type": "probation_end",
                    "level": "info",
                    "staff_id": s.id,
                    "staff_name": s.name,
                    "message": f"수습기간 종료 {prob_days}일 전",
                    "detail": f"수습종료일: {probation_end}",
                    "days_left": prob_days,
                })

        # 4. Training expiring
        stmt_t = select(StaffTraining).where(StaffTraining.staff_id == s.id, StaffTraining.expiry_date != None)
        trainings = session.exec(stmt_t).all()
        for t in trainings:
            if t.expiry_date:
                t_days = (t.expiry_date - today).days
                if 0 <= t_days <= 30:
                    alerts.append({
                        "type": "training_expiry",
                        "level": "warning" if t_days <= 14 else "info",
                        "staff_id": s.id,
                        "staff_name": s.name,
                        "message": f"{t.training_type} 만료 {t_days}일 전",
                        "detail": f"만료일: {t.expiry_date}",
                        "days_left": t_days,
                    })

        # 5. Certification expiring
        stmt_c = select(StaffCertification).where(StaffCertification.staff_id == s.id, StaffCertification.expiry_date != None)
        certs = session.exec(stmt_c).all()
        for c in certs:
            if c.expiry_date:
                c_days = (c.expiry_date - today).days
                if 0 <= c_days <= 30:
                    alerts.append({
                        "type": "cert_expiry",
                        "level": "warning" if c_days <= 14 else "info",
                        "staff_id": s.id,
                        "staff_name": s.name,
                        "message": f"{c.cert_name} 만료 {c_days}일 전",
                        "detail": f"만료일: {c.expiry_date}",
                        "days_left": c_days,
                    })

    # Sort by urgency (danger first, then by days_left)
    level_order = {"danger": 0, "warning": 1, "info": 2}
    alerts.sort(key=lambda a: (level_order.get(a["level"], 3), a.get("days_left") or 999))

    return {"status": "success", "data": alerts, "total": len(alerts)}
