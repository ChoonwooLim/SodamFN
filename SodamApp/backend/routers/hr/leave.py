from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select
from datetime import date, datetime
from typing import Optional
from pydantic import BaseModel

from routers.auth import get_admin_user, get_current_user
from models import Staff, LeaveBalance, LeaveRequest, User as AuthUser
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

# --- Pydantic Schemas ---

class LeaveRequestCreate(BaseModel):
    staff_id: int
    leave_type: str = "연차"
    start_date: date
    end_date: date
    days: float = 1.0
    reason: Optional[str] = None

class LeaveRequestUpdate(BaseModel):
    status: str  # 승인, 반려
    reject_reason: Optional[str] = None

class LeaveBalanceAdjust(BaseModel):
    total_annual: Optional[float] = None
    total_sick: Optional[float] = None
    total_special: Optional[float] = None

# --- Helper: Calculate legal annual leave by Korean Labor Standards Act ---

def calc_legal_annual_leave(start_date: date, ref_year: int) -> float:
    """근로기준법 기반 연차 자동 계산
    - 1년 미만: 1개월 개근 시 1일 (최대 11일)
    - 1년 이상: 15일
    - 3년 이상: 매 2년마다 +1일 (최대 25일)
    """
    from dateutil.relativedelta import relativedelta

    # Reference date: Jan 1 of ref_year
    ref_date = date(ref_year, 1, 1)

    if start_date >= ref_date:
        return 0  # Not yet started

    # Calculate months of service as of ref_year start
    work_start = start_date

    # Years of service at start of reference year
    years_worked = (ref_date - work_start).days / 365.25

    if years_worked < 1:
        # 1년 미만: count full months worked in this year
        months_worked = 0
        check = work_start
        while check < date(ref_year, 12, 31):
            check += relativedelta(months=1)
            if check <= date(ref_year, 12, 31):
                months_worked += 1
        return min(months_worked, 11)

    # 1년 이상
    base = 15
    if years_worked >= 3:
        extra = int((years_worked - 1) / 2)
        base = min(15 + extra, 25)

    return float(base)

# --- Endpoints ---

@router.get("/leave/balance/{staff_id}")
def get_leave_balance(staff_id: int, year: Optional[int] = None, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Get or auto-create leave balance for a staff member"""
    if not year:
        year = date.today().year

    staff = session.get(Staff, staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    # Try to find existing balance
    stmt = select(LeaveBalance).where(LeaveBalance.staff_id == staff_id, LeaveBalance.year == year)
    balance = session.exec(stmt).first()

    if not balance:
        # Auto-create with legal calculation
        total_annual = calc_legal_annual_leave(staff.start_date, year) if staff.start_date else 0
        balance = LeaveBalance(
            business_id=bid or staff.business_id,
            staff_id=staff_id,
            year=year,
            total_annual=total_annual,
        )
        session.add(balance)
        session.commit()
        session.refresh(balance)

    # Get all requests for this year
    stmt_req = select(LeaveRequest).where(
        LeaveRequest.staff_id == staff_id,
        LeaveRequest.start_date >= date(year, 1, 1),
        LeaveRequest.start_date <= date(year, 12, 31),
    ).order_by(LeaveRequest.start_date.desc())
    requests = session.exec(stmt_req).all()

    return {
        "status": "success",
        "balance": balance,
        "requests": requests,
        "staff_name": staff.name,
        "start_date": str(staff.start_date) if staff.start_date else None,
    }

@router.put("/leave/balance/{staff_id}")
def update_leave_balance(staff_id: int, year: int, data: LeaveBalanceAdjust, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Manually adjust leave balance (admin override)"""
    stmt = select(LeaveBalance).where(LeaveBalance.staff_id == staff_id, LeaveBalance.year == year)
    balance = session.exec(stmt).first()
    if not balance:
        raise HTTPException(status_code=404, detail="잔여 현황을 찾을 수 없습니다.")

    if data.total_annual is not None:
        balance.total_annual = data.total_annual
    if data.total_sick is not None:
        balance.total_sick = data.total_sick
    if data.total_special is not None:
        balance.total_special = data.total_special

    session.add(balance)
    session.commit()
    session.refresh(balance)
    return {"status": "success", "balance": balance}

@router.post("/leave/request")
def create_leave_request(data: LeaveRequestCreate, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Create a new leave request"""
    staff = session.get(Staff, data.staff_id)
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")

    req = LeaveRequest(
        business_id=bid or staff.business_id,
        staff_id=data.staff_id,
        staff_name=staff.name,
        leave_type=data.leave_type,
        start_date=data.start_date,
        end_date=data.end_date,
        days=data.days,
        reason=data.reason,
        status="대기",
    )
    session.add(req)

    # Auto-approve if admin is creating it directly
    req.status = "승인"
    req.approved_at = datetime.now()
    req.approved_by = "관리자"

    # Update balance
    year = data.start_date.year
    stmt = select(LeaveBalance).where(LeaveBalance.staff_id == data.staff_id, LeaveBalance.year == year)
    balance = session.exec(stmt).first()
    if not balance:
        total_annual = calc_legal_annual_leave(staff.start_date, year) if staff.start_date else 0
        balance = LeaveBalance(
            business_id=bid or staff.business_id,
            staff_id=data.staff_id,
            year=year,
            total_annual=total_annual,
        )
        session.add(balance)
        session.commit()
        session.refresh(balance)

    # Update used counts based on leave type
    if data.leave_type in ["연차", "반차(오전)", "반차(오후)"]:
        balance.used_annual += data.days
    elif data.leave_type == "병가":
        balance.used_sick += data.days
    elif data.leave_type in ["경조사", "출산휴가", "특별휴가", "공가"]:
        balance.used_special += data.days

    session.add(balance)
    session.commit()
    session.refresh(req)

    return {"status": "success", "data": req}

@router.put("/leave/request/{request_id}")
def update_leave_request(request_id: int, data: LeaveRequestUpdate, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Approve or reject a leave request"""
    req = session.get(LeaveRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="휴가 신청을 찾을 수 없습니다.")

    old_status = req.status
    req.status = data.status

    if data.status == "승인":
        req.approved_at = datetime.now()
        req.approved_by = "관리자"

        # If was previously not approved, update balance
        if old_status != "승인":
            year = req.start_date.year
            stmt = select(LeaveBalance).where(LeaveBalance.staff_id == req.staff_id, LeaveBalance.year == year)
            balance = session.exec(stmt).first()
            if balance:
                if req.leave_type in ["연차", "반차(오전)", "반차(오후)"]:
                    balance.used_annual += req.days
                elif req.leave_type == "병가":
                    balance.used_sick += req.days
                elif req.leave_type in ["경조사", "출산휴가", "특별휴가", "공가"]:
                    balance.used_special += req.days
                session.add(balance)

    elif data.status == "반려":
        req.reject_reason = data.reject_reason
        # If was approved, reverse the balance
        if old_status == "승인":
            year = req.start_date.year
            stmt = select(LeaveBalance).where(LeaveBalance.staff_id == req.staff_id, LeaveBalance.year == year)
            balance = session.exec(stmt).first()
            if balance:
                if req.leave_type in ["연차", "반차(오전)", "반차(오후)"]:
                    balance.used_annual = max(0, balance.used_annual - req.days)
                elif req.leave_type == "병가":
                    balance.used_sick = max(0, balance.used_sick - req.days)
                elif req.leave_type in ["경조사", "출산휴가", "특별휴가", "공가"]:
                    balance.used_special = max(0, balance.used_special - req.days)
                session.add(balance)

    elif data.status == "취소":
        # Reverse balance if was approved
        if old_status == "승인":
            year = req.start_date.year
            stmt = select(LeaveBalance).where(LeaveBalance.staff_id == req.staff_id, LeaveBalance.year == year)
            balance = session.exec(stmt).first()
            if balance:
                if req.leave_type in ["연차", "반차(오전)", "반차(오후)"]:
                    balance.used_annual = max(0, balance.used_annual - req.days)
                elif req.leave_type == "병가":
                    balance.used_sick = max(0, balance.used_sick - req.days)
                elif req.leave_type in ["경조사", "출산휴가", "특별휴가", "공가"]:
                    balance.used_special = max(0, balance.used_special - req.days)
                session.add(balance)

    session.add(req)
    session.commit()
    session.refresh(req)

    return {"status": "success", "data": req}

@router.delete("/leave/request/{request_id}")
def delete_leave_request(request_id: int, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Delete a leave request"""
    req = session.get(LeaveRequest, request_id)
    if not req:
        raise HTTPException(status_code=404, detail="휴가 신청을 찾을 수 없습니다.")

    # If was approved, reverse the balance
    if req.status == "승인":
        year = req.start_date.year
        stmt = select(LeaveBalance).where(LeaveBalance.staff_id == req.staff_id, LeaveBalance.year == year)
        balance = session.exec(stmt).first()
        if balance:
            if req.leave_type in ["연차", "반차(오전)", "반차(오후)"]:
                balance.used_annual = max(0, balance.used_annual - req.days)
            elif req.leave_type == "병가":
                balance.used_sick = max(0, balance.used_sick - req.days)
            elif req.leave_type in ["경조사", "출산휴가", "특별휴가", "공가"]:
                balance.used_special = max(0, balance.used_special - req.days)
            session.add(balance)

    session.delete(req)
    session.commit()

    return {"status": "success"}

@router.get("/leave/summary")
def get_leave_summary(year: Optional[int] = None, _admin: AuthUser = Depends(get_admin_user), bid=Depends(get_bid_from_token), session: Session = Depends(get_session)):
    """Get leave summary for all active staff"""
    if not year:
        year = date.today().year

    # Get all active staff
    stmt = apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "재직")
    staffs = session.exec(stmt).all()

    result = []
    for s in staffs:
        stmt_bal = select(LeaveBalance).where(LeaveBalance.staff_id == s.id, LeaveBalance.year == year)
        balance = session.exec(stmt_bal).first()

        if not balance:
            total_annual = calc_legal_annual_leave(s.start_date, year) if s.start_date else 0
            balance = LeaveBalance(
                business_id=bid or s.business_id,
                staff_id=s.id,
                year=year,
                total_annual=total_annual,
            )
            session.add(balance)

        result.append({
            "staff_id": s.id,
            "staff_name": s.name,
            "role": s.role,
            "start_date": str(s.start_date) if s.start_date else None,
            "total_annual": balance.total_annual,
            "used_annual": balance.used_annual,
            "remaining_annual": balance.total_annual - balance.used_annual,
            "total_sick": balance.total_sick,
            "used_sick": balance.used_sick,
            "total_special": balance.total_special,
            "used_special": balance.used_special,
        })

    session.commit()

    return {"status": "success", "data": result, "year": year}
