import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from sqlmodel import Session, select
from models import Staff, RetirementPayment, Payroll
from database import engine

def test_calc_direct():
    from routers.hr import _calc_accrued_retirement
    from datetime import date
    with Session(engine) as session:
        staffs = session.exec(select(Staff)).all()
        for staff in staffs:
            if staff.id == 4: continue # skip 4
            print(f"\n--- Testing Staff {staff.id} ({staff.name}) ---")
            
            payment = session.exec(select(RetirementPayment).where(RetirementPayment.staff_id == staff.id)).first()
            calc_end_date = payment.end_date if payment else (getattr(staff, 'contract_end_date', None) or date.today())
            
            try:
                legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date)
                print(f"[{staff.name}] _calc_accrued_retirement Success => legal={legal}, breakdown={breakdown.get('total_gross_3m')}")
            except Exception as e:
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    test_calc_direct()
