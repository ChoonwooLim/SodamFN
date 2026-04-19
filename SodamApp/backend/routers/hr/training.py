from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

from routers.auth import get_admin_user
from models import Staff, StaffTraining, StaffCertification, User as AuthUser
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

class TrainingCreate(BaseModel):
    staff_id: int
    training_type: str
    training_name: Optional[str] = None
    completed_date: Optional[date] = None
    expiry_date: Optional[date] = None
    certificate_number: Optional[str] = None
    institution: Optional[str] = None
    hours: float = 0
    status: str = "미이수"
    note: Optional[str] = None

class CertCreate(BaseModel):
    staff_id: int
    cert_name: str
    cert_number: Optional[str] = None
    issued_date: Optional[date] = None
    expiry_date: Optional[date] = None
    issuing_body: Optional[str] = None
    status: str = "유효"
    note: Optional[str] = None

# Training CRUD
@router.get("/training/{staff_id}")
def get_trainings(staff_id: int, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    stmt = select(StaffTraining).where(StaffTraining.staff_id == staff_id).order_by(StaffTraining.created_at.desc())
    trainings = session.exec(stmt).all()

    stmt2 = select(StaffCertification).where(StaffCertification.staff_id == staff_id).order_by(StaffCertification.created_at.desc())
    certs = session.exec(stmt2).all()

    return {"status": "success", "trainings": trainings, "certifications": certs}

@router.post("/training")
def create_training(data: TrainingCreate, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.get(Staff, data.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    training = StaffTraining(
        business_id=bid or staff.business_id,
        **data.dict()
    )
    session.add(training)
    session.commit()
    session.refresh(training)
    return {"status": "success", "data": training}

@router.put("/training/{training_id}")
def update_training(training_id: int, data: TrainingCreate, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    training = session.get(StaffTraining, training_id)
    if not training:
        raise HTTPException(status_code=404, detail="교육 기록을 찾을 수 없습니다.")
    for key, val in data.dict(exclude_unset=True).items():
        if key != 'staff_id':
            setattr(training, key, val)
    session.add(training)
    session.commit()
    session.refresh(training)
    return {"status": "success", "data": training}

@router.delete("/training/{training_id}")
def delete_training(training_id: int, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    training = session.get(StaffTraining, training_id)
    if not training:
        raise HTTPException(status_code=404, detail="교육 기록을 찾을 수 없습니다.")
    session.delete(training)
    session.commit()
    return {"status": "success"}

# Certification CRUD
@router.post("/certification")
def create_cert(data: CertCreate, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.get(Staff, data.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    cert = StaffCertification(business_id=bid or staff.business_id, **data.dict())
    session.add(cert)
    session.commit()
    session.refresh(cert)
    return {"status": "success", "data": cert}

@router.put("/certification/{cert_id}")
def update_cert(cert_id: int, data: CertCreate, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    cert = session.get(StaffCertification, cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="자격증을 찾을 수 없습니다.")
    for key, val in data.dict(exclude_unset=True).items():
        if key != 'staff_id':
            setattr(cert, key, val)
    session.add(cert)
    session.commit()
    session.refresh(cert)
    return {"status": "success", "data": cert}

@router.delete("/certification/{cert_id}")
def delete_cert(cert_id: int, _admin: AuthUser = Depends(get_admin_user), session: Session = Depends(get_session)):
    cert = session.get(StaffCertification, cert_id)
    if not cert:
        raise HTTPException(status_code=404, detail="자격증을 찾을 수 없습니다.")
    session.delete(cert)
    session.commit()
    return {"status": "success"}

# Summary for dashboard - training compliance
@router.get("/training/summary/all")
def training_summary(_admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """All active staff training compliance summary"""
    stmt = apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "재직")
    staffs = session.exec(stmt).all()

    REQUIRED_TRAININGS = ["산업안전보건교육", "성희롱예방교육", "장애인인식개선", "직장내괴롭힘예방", "개인정보보호"]

    result = []
    for s in staffs:
        stmt_t = select(StaffTraining).where(StaffTraining.staff_id == s.id)
        trainings = session.exec(stmt_t).all()

        completed = set()
        expiring = []
        for t in trainings:
            if t.status == "이수":
                completed.add(t.training_type)
            if t.expiry_date:
                days_left = (t.expiry_date - date.today()).days
                if 0 <= days_left <= 30:
                    expiring.append({"type": t.training_type, "days_left": days_left})

        missing = [rt for rt in REQUIRED_TRAININGS if rt not in completed]

        result.append({
            "staff_id": s.id,
            "staff_name": s.name,
            "completed_count": len(completed),
            "total_required": len(REQUIRED_TRAININGS),
            "missing": missing,
            "expiring": expiring,
        })

    return {"status": "success", "data": result}
