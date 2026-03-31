import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from sqlmodel import Session, select
from models import Staff, RetirementPayment, Payroll
from database import engine

def test_calc_direct():
    from routers.hr import _calc_accrued_retirement
    from datetime import date
    with Session(engine) as session:
        staff = session.exec(select(Staff).where(Staff.id == 4)).first()
        payment = session.exec(select(RetirementPayment).where(RetirementPayment.staff_id == 4)).first()
        calc_end_date = payment.end_date if payment else staff.contract_end_date
        
        legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date)
        print(f"[{staff.name}] _calc_accrued_retirement => legal={legal}, w_days={w_days}")
        print(f"breakdown={breakdown}")

if __name__ == "__main__":
    test_calc_direct()
