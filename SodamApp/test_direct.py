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
            
            # simulate get_retirement_calculation_detail logic
            payment = session.exec(select(RetirementPayment).where(RetirementPayment.staff_id == staff.id)).first()
            calc_end_date = payment.end_date if payment else (getattr(staff, 'contract_end_date', None) or date.today())
            
            try:
                legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date)
                print(f"[{staff.name}] _calc_accrued_retirement Success => legal={legal}, breakdown={breakdown.get('total_gross_3m')}")
                
                payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff.id).order_by(Payroll.month.desc()).limit(4)).all()
                from dateutil.relativedelta import relativedelta
                from datetime import timedelta, datetime
                start_3m_date = calc_end_date - relativedelta(months=3) + timedelta(days=1)
                
                history = []
                for p in payrolls:
                    p_month_dt = datetime.strptime(f"{p.month}-01", "%Y-%m-%d").date()
                    from calendar import monthrange
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
                        })
                print(f"[{staff.name}] History built successfully, {len(history)} elements.")
            except Exception as e:
                import traceback
                traceback.print_exc()

if __name__ == "__main__":
    test_calc_direct()
