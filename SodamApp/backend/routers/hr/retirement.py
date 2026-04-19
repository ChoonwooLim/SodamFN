from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime
from dateutil.relativedelta import relativedelta
from calendar import monthrange

from sqlmodel import Session, select

from routers.auth import get_admin_user
from models import User as AuthUser, Staff, RetirementPayment, Payroll, MonthlyProfitLoss
from database import get_session
from tenant_filter import get_bid_from_token, apply_bid_filter

router = APIRouter()

class RetirementPaymentCreate(BaseModel):
    staff_id: int
    end_date: date
    paid_amount: int = 0
    payment_date: Optional[date] = None
    payment_method: str = "계좌이체"
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    note: Optional[str] = None

class RetirementPaymentUpdate(BaseModel):
    paid_amount: Optional[int] = None
    payment_date: Optional[date] = None
    payment_method: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    note: Optional[str] = None
    status: Optional[str] = None


def _calc_accrued_retirement(staff, end_date, session: Session):
    start = staff.start_date
    work_days = (end_date - start).days + 1
    
    payrolls = session.exec(
        select(Payroll).where(Payroll.staff_id == staff.id).order_by(Payroll.month.desc())
    ).all()
    
    pl_accrued = 0
    for p in payrolls:
        if hasattr(p, 'retirement_pay') and p.retirement_pay:
            pl_accrued += p.retirement_pay
        else:
            pl_accrued += int(p.total_pay * 0.0833)
            
    legal_retirement = 0
    breakdown = {}
    
    if work_days >= 365 and payrolls:
        recent = payrolls[:4]
        
        from datetime import timedelta
        start_3m_date = end_date - relativedelta(months=3) + timedelta(days=1)
        exact_days = (end_date - start_3m_date).days + 1
        if exact_days <= 0: exact_days = 90
        
        total_gross = 0
        from calendar import monthrange
        for p in recent:
            try:
                p_month_dt = datetime.strptime(f"{p.month}-01", "%Y-%m-%d").date()
                last_day = monthrange(p_month_dt.year, p_month_dt.month)[1]
                p_end = date(p_month_dt.year, p_month_dt.month, last_day)
                
                i_start = max(start_3m_date, p_month_dt)
                i_end = min(end_date, p_end)
                
                if i_start <= i_end:
                    days_in_period = (i_end - i_start).days + 1
                    must_prorate = i_start > p_month_dt
                    
                    b_pay = int((p.base_pay or 0) * days_in_period / last_day) if must_prorate else (p.base_pay or 0)
                    h_pay = int((p.bonus_holiday or 0) * days_in_period / last_day) if must_prorate else (p.bonus_holiday or 0)
                    m_pay = int((p.bonus_meal or 0) * days_in_period / last_day) if must_prorate else (p.bonus_meal or 0)
                    
                    total_gross += (b_pay + h_pay + m_pay)
            except:
                pass
        
        daily_wage = total_gross / exact_days
        legal_retirement = int(daily_wage * 30 * work_days / 365)
        
        breakdown = {
            "total_gross_3m": int(total_gross),
            "exact_days_3m": exact_days,
            "daily_wage": int(daily_wage),
            "recent_months": [p.month for p in recent]
        }
    elif work_days >= 365:
        avg_monthly = staff.hourly_wage if staff.hourly_wage >= 100000 else staff.hourly_wage * 209
        daily_wage = avg_monthly / 30
        legal_retirement = int(daily_wage * 30 * work_days / 365)
        
        breakdown = {
            "total_gross_3m": avg_monthly * 3,
            "exact_days_3m": 90,
            "daily_wage": int(daily_wage),
            "recent_months": ["기록없음(기본급추정)"]
        }
    
    return legal_retirement, work_days, pl_accrued, breakdown

@router.get("/retirement")
def get_retirement_list(_admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    resigned = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.status == "퇴사")
    ).all()
    
    payments = session.exec(
        apply_bid_filter(select(RetirementPayment), RetirementPayment, bid)
    ).all()
    payment_by_staff = {p.staff_id: p for p in payments}
    
    result = []
    for staff in resigned:
        payment = payment_by_staff.get(staff.id)
        
        if payment:
            legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, payment.end_date, session)
            
            result.append({
                "staff_id": staff.id,
                "staff_name": staff.name,
                "start_date": str(staff.start_date),
                "end_date": str(payment.end_date),
                "work_days": payment.work_days,
                "accrued_amount": payment.accrued_amount,
                "paid_amount": payment.paid_amount,
                "difference": payment.difference,
                "payment_date": str(payment.payment_date) if payment.payment_date else None,
                "status": payment.status,
                "payment_id": payment.id,
                "note": payment.note,
                "pl_accrued": getattr(payment, 'pl_accrued', 0),
                "under_one_year": payment.work_days < 365,
                "breakdown": breakdown
            })
        else:
            legal, work_days, pl_accrued, breakdown = _calc_accrued_retirement(staff, date.today(), session)
            result.append({
                "staff_id": staff.id,
                "staff_name": staff.name,
                "start_date": str(staff.start_date),
                "end_date": None,
                "work_days": work_days,
                "accrued_amount": legal,
                "paid_amount": 0,
                "difference": 0,
                "payment_date": None,
                "status": "미등록",
                "payment_id": None,
                "note": None,
                "pl_accrued": pl_accrued,
                "under_one_year": work_days < 365,
                "breakdown": breakdown
            })
    
    return {"status": "success", "data": result}

@router.get("/retirement/calc/{staff_id}")
def get_retirement_calculation_detail(staff_id: int, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == staff_id)).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
        
    payment = session.exec(apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(RetirementPayment.staff_id == staff_id)).first()
    # 퇴직금 지급 기록이 있으면 그 종료일 사용, 없으면 계약종료일 or 오늘
    # 단, 재직 중인 직원은 미래 계약종료일이 아닌 오늘 기준으로 산정
    raw_end = payment.end_date if payment else (getattr(staff, 'contract_end_date', None) or date.today())
    calc_end_date = min(raw_end, date.today()) if raw_end else date.today()
    
    legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date, session)
    
    payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff_id).order_by(Payroll.month.desc()).limit(4)).all()
    
    from datetime import timedelta
    start_3m_date = calc_end_date - relativedelta(months=3) + timedelta(days=1)
    
    history = []
    for p in payrolls:
        try:
            p_month_dt = datetime.strptime(f"{p.month}-01", "%Y-%m-%d").date()
            last_day = monthrange(p_month_dt.year, p_month_dt.month)[1]
            p_end = date(p_month_dt.year, p_month_dt.month, last_day)
            
            i_start = max(start_3m_date, p_month_dt)
            i_end = min(calc_end_date, p_end)
            
            if i_start <= i_end:
                days_in_period = (i_end - i_start).days + 1
                must_prorate = i_start > p_month_dt
                
                history.append({
                    "period": f"{i_start.strftime('%Y-%m-%d')} ~ {i_end.strftime('%Y-%m-%d')}",
                    "days": days_in_period,
                    "base_pay": int((p.base_pay or 0) * days_in_period / last_day) if must_prorate else (p.base_pay or 0),
                    "meal_pay": int((p.bonus_meal or 0) * days_in_period / last_day) if must_prorate else (p.bonus_meal or 0),
                    "holiday_pay": int((p.bonus_holiday or 0) * days_in_period / last_day) if must_prorate else (p.bonus_holiday or 0)
                })
        except Exception:
            pass
            
    history.reverse()
    for h in history:
        h["subtotal"] = h["base_pay"] + h["meal_pay"] + h["holiday_pay"]

    return {
        "status": "success",
        "data": {
            "staff": {
                "emp_no": staff.id,
                "name": staff.name,
                "dept": staff.department if hasattr(staff, 'department') else "",
                "level": staff.position if hasattr(staff, 'position') else "직급없음",
                "start_date": str(staff.start_date),
                "end_date": str(calc_end_date),
                "work_days": w_days
            },
            "breakdown": breakdown,
            "history": history,
            "legal_retirement": legal
        }
    }

@router.post("/retirement")
def create_retirement_payment(data: RetirementPaymentCreate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    staff = session.exec(
        apply_bid_filter(select(Staff), Staff, bid).where(Staff.id == data.staff_id)
    ).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    
    existing = session.exec(
        apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(
            RetirementPayment.staff_id == data.staff_id
        )
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="이미 퇴직금 지급 기록이 존재합니다.")
    
    legal, work_days, pl_accrued, breakdown = _calc_accrued_retirement(staff, data.end_date, session)
    difference = data.paid_amount - legal
    
    reversal_amount = 0
    if work_days < 365:
        reversal_amount = pl_accrued
        note_prefix = f"[1년미만 퇴사] 적립 환입: -{reversal_amount:,}원"
        if data.paid_amount > 0:
            note_prefix += f" / 실지급: {data.paid_amount:,}원"
        auto_note = note_prefix + (f" / {data.note}" if data.note else "")
    else:
        auto_note = data.note
    
    payment = RetirementPayment(
        business_id=bid,
        staff_id=data.staff_id,
        staff_name=staff.name,
        start_date=staff.start_date,
        end_date=data.end_date,
        work_days=work_days,
        accrued_amount=legal if work_days >= 365 else 0,
        paid_amount=data.paid_amount,
        difference=difference if work_days >= 365 else data.paid_amount,
        payment_date=data.payment_date or data.end_date,
        payment_method=data.payment_method,
        bank_name=data.bank_name or staff.bank_name,
        account_number=data.account_number or staff.account_number,
        note=auto_note,
        status="환입완료" if work_days < 365 and data.paid_amount == 0 else ("지급완료" if data.payment_date else "대기"),
    )
    session.add(payment)
    
    target_date = data.payment_date or data.end_date
    target_year = target_date.year
    target_month = target_date.month
    pl = session.exec(
        apply_bid_filter(select(MonthlyProfitLoss), MonthlyProfitLoss, bid).where(
            MonthlyProfitLoss.year == target_year,
            MonthlyProfitLoss.month == target_month,
        )
    ).first()
    
    if pl:
        if work_days < 365:
            pl.expense_retirement = max(0, (pl.expense_retirement or 0) - reversal_amount + data.paid_amount)
            session.add(pl)
        elif difference > 0:
            pl.expense_retirement = (pl.expense_retirement or 0) + difference
            session.add(pl)
    
    session.commit()
    
    msg_parts = [f"{staff.name} 퇴직금 기록 완료"]
    if work_days < 365:
        msg_parts.append(f"1년 미만 퇴사 → P/L 적립 환입: -{reversal_amount:,}원")
        if data.paid_amount > 0:
            msg_parts.append(f"실지급: {data.paid_amount:,}원")
    else:
        msg_parts.append(f"법적 퇴직금: {legal:,}원, 지급: {data.paid_amount:,}원, 차액: {difference:,}원")
    
    return {
        "status": "success",
        "message": " / ".join(msg_parts),
        "data": {
            "legal_retirement": legal,
            "pl_accrued": pl_accrued,
            "reversal": reversal_amount,
            "paid": data.paid_amount,
            "work_days": work_days,
            "under_one_year": work_days < 365,
        }
    }

@router.put("/retirement/{payment_id}")
def update_retirement_payment(payment_id: int, data: RetirementPaymentUpdate, _admin: AuthUser = Depends(get_admin_user), bid = Depends(get_bid_from_token), session: Session = Depends(get_session)):
    payment = session.exec(
        apply_bid_filter(select(RetirementPayment), RetirementPayment, bid).where(
            RetirementPayment.id == payment_id
        )
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="지급 기록을 찾을 수 없습니다.")
    
    update_dict = data.dict(exclude_unset=True)
    for key, value in update_dict.items():
        setattr(payment, key, value)
    
    if 'paid_amount' in update_dict:
        payment.difference = payment.paid_amount - payment.accrued_amount
    
    session.add(payment)
    session.commit()
    
    return {"status": "success", "message": "퇴직금 기록이 수정되었습니다."}
