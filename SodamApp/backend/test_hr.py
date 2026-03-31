import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from database import engine
from sqlmodel import Session, select
from models import Staff, RetirementPayment, Payroll
from routers.hr import _calc_accrued_retirement
from datetime import date

def run_test():
    with Session(engine) as session:
        staff_id = 4
        staff = session.exec(select(Staff).where(Staff.id == staff_id)).first()
        if not staff:
            print("Staff not found")
            return
            
        payment = session.exec(select(RetirementPayment).where(RetirementPayment.staff_id == staff_id)).first()
        calc_end_date = payment.end_date if payment else (staff.end_date or date.today())
        
        try:
            print(f"Calling func for {staff.name} end_date {calc_end_date}")
            legal, w_days, p_accrued, breakdown = _calc_accrued_retirement(staff, calc_end_date)
            print("Success!", legal, breakdown)
            
            # Now test the endpoint logic
            from dateutil.relativedelta import relativedelta
            from datetime import datetime
            start_3m_date = calc_end_date - relativedelta(months=3)
            
            payrolls = session.exec(select(Payroll).where(Payroll.staff_id == staff_id).order_by(Payroll.month.desc()).limit(4)).all()
            for p in payrolls:
                p_month_dt = datetime.strptime(f"{p.month}-01", "%Y-%m-%d").date()
                from calendar import monthrange
                last_day = monthrange(p_month_dt.year, p_month_dt.month)[1]
                p_end = date(p_month_dt.year, p_month_dt.month, last_day)

                i_start = max(start_3m_date, p_month_dt)
                i_end = min(calc_end_date, p_end)
                if i_start <= i_end:
                    days_in_period = (i_end - i_start).days + 1
                    print("Period:", i_start, "to", i_end, "days:", days_in_period)
            
        except Exception as e:
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    run_test()
