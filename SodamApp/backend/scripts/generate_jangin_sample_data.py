import sys
import os
import random
import datetime
from datetime import time
from dateutil.relativedelta import relativedelta

# Ensure imports work
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from database import engine
from models import (
    Business, Staff, User, Vendor, DailyExpense, MonthlyProfitLoss, 
    Attendance, Payroll, Suggestion, StaffChatMessage, CardSalesApproval
)
from routers.auth import get_password_hash

BUSINESS_ID = 2

def generate_sample_data():
    with Session(engine) as session:
        # Check if business exists
        business = session.exec(select(Business).where(Business.id == BUSINESS_ID)).first()
        if not business:
            print(f"Error: Business with ID {BUSINESS_ID} not found. Ensure '장인김밥' exists as ID 2.")
            return

        print(f"Injecting sample data for '{business.name}' (ID: {BUSINESS_ID})...")

        # 1. Create Staff (4 people)
        staff_data = [
            {"name": "김장인", "role": "점장", "wage": 3000000, "start": "2025-01-01"},
            {"name": "이주방", "role": "주방실장", "wage": 2800000, "start": "2025-03-15"},
            {"name": "박홀서", "role": "홀서빙", "wage": 2500000, "start": "2025-08-01"},
            {"name": "최알바", "role": "아르바이트", "wage": 9860, "start": "2026-01-05"},
        ]
        
        staff_objs = []
        for s in staff_data:
            existing = session.exec(select(Staff).where(Staff.business_id == BUSINESS_ID, Staff.name == s["name"])).first()
            if not existing:
                staff = Staff(
                    name=s["name"], role=s["role"], hourly_wage=s["wage"],
                    start_date=datetime.date.fromisoformat(s["start"]),
                    status="재직", business_id=BUSINESS_ID
                )
                session.add(staff)
                session.commit()
                session.refresh(staff)
                staff_objs.append(staff)
                
                # Create user account for staff
                username = f"jangin_{s['name']}"
                if not session.exec(select(User).where(User.username == username)).first():
                    user = User(
                        username=username,
                        hashed_password=get_password_hash("1234"),
                        real_name=staff.name,
                        role="staff",
                        staff_id=staff.id,
                        business_id=BUSINESS_ID
                    )
                    session.add(user)
                    session.commit()
            else:
                staff_objs.append(existing)

        print("Staff created.")

        # 2. Vendors
        vendors = ["장인식자재", "신선농산", "제일포장", "대한음료"]
        vendor_objs = []
        for v in vendors:
            existing = session.exec(select(Vendor).where(Vendor.business_id == BUSINESS_ID, Vendor.name == v)).first()
            if not existing:
                vendor = Vendor(name=v, category="식자재" if v != "제일포장" else "포장재", business_id=BUSINESS_ID)
                session.add(vendor)
                session.commit()
                session.refresh(vendor)
                vendor_objs.append(vendor)
            else:
                vendor_objs.append(existing)
                
        print("Vendors created.")

        # 3. Monthly P&L and Sales for Jan & Feb 2026
        months = ["2026-01-01", "2026-02-01"]
        for m_str in months:
            m_date = datetime.date.fromisoformat(m_str)
            month_str = m_date.strftime("%Y-%m")
            
            pl = session.exec(select(MonthlyProfitLoss).where(MonthlyProfitLoss.business_id == BUSINESS_ID, MonthlyProfitLoss.year == m_date.year, MonthlyProfitLoss.month == m_date.month)).first()
            if not pl:
                pl = MonthlyProfitLoss(year=m_date.year, month=m_date.month, business_id=BUSINESS_ID)
                session.add(pl)
                
            # Random Sales
            pl.revenue_store = random.randint(20000000, 25000000)
            pl.revenue_baemin = random.randint(10000000, 15000000)
            pl.revenue_coupang = random.randint(5000000, 8000000)
            
            # Rent & Utilities
            pl.expense_rent = 3500000
            pl.expense_utility = random.randint(800000, 1200000)
            pl.expense_material = random.randint(500000, 800000)
            
            # Generate Daily Expenses for this month
            days_in_month = (m_date + relativedelta(months=1) - relativedelta(days=1)).day
            monthly_ingredients = 0
            for day in range(1, days_in_month + 1, 2): # Every 2 days
                date_str = f"{m_date.year}-{m_date.month:02d}-{day:02d}"
                amount = random.randint(150000, 400000)
                monthly_ingredients += amount
                
                vendor = random.choice(vendor_objs)
                expense = DailyExpense(
                    date=datetime.date.fromisoformat(date_str),
                    amount=amount,
                    category=vendor.category,
                    note=f"{vendor.name} 발주",
                    payment_method="Card",
                    vendor_name=vendor.name,
                    business_id=BUSINESS_ID,
                    vendor_id=vendor.id
                )
                session.add(expense)
                
                # Add some card sales
                for _ in range(5):
                    sale = CardSalesApproval(
                        business_id=BUSINESS_ID,
                        approval_date=datetime.date.fromisoformat(date_str),
                        approval_time="12:30:00",
                        card_corp="신한카드",
                        approval_number=f"A{random.randint(100000,999999)}",
                        amount=random.randint(10000, 45000),
                        installment="일시불"
                    )
                    session.add(sale)
                    
            pl.expense_ingredient = monthly_ingredients
            
            # Generate Attendance & Payroll
            monthly_labor = 0
            for staff in staff_objs:
                hours = random.randint(150, 180)
                if staff.role == "아르바이트":
                    base_pay = hours * staff.hourly_wage
                else:
                    base_pay = staff.hourly_wage 
                    
                monthly_labor += base_pay
                
                payroll = session.exec(select(Payroll).where(Payroll.business_id == BUSINESS_ID, Payroll.staff_id == staff.id, Payroll.month == month_str)).first()
                if not payroll:
                    payroll = Payroll(
                        staff_id=staff.id, business_id=BUSINESS_ID, month=month_str,
                        base_pay=base_pay, total_pay=base_pay, deductions=int(base_pay * 0.1) 
                    )
                    session.add(payroll)
                else:
                    payroll.base_pay = base_pay
                    payroll.total_pay = base_pay
                    
                for day in range(1, 5):
                     date_str = f"{m_date.year}-{m_date.month:02d}-{day:02d}"
                     att = Attendance(
                         staff_id=staff.id, business_id=BUSINESS_ID, 
                         date=datetime.date.fromisoformat(date_str),
                         check_in=time(9, 0), check_out=time(18, 0), total_hours=9.0
                     )
                     session.add(att)
                     
            try:
                pl.expense_labor = monthly_labor
                session.commit()
            except Exception as e:
                print("Error committing Payroll or Attendance:")
                print(e)
                session.rollback()

        print("Sales, Expenses, Payroll, and P&L created.")

        # 4. Chat & Suggestions
        if staff_objs:
            sug = Suggestion(
                title="휴게실 의자 교체 요청", content="의자가 너무 낡아서 불편합니다.",
                staff_name=staff_objs[0].name, staff_id=staff_objs[0].id, business_id=BUSINESS_ID
            )
            session.add(sug)
            
            msg1 = StaffChatMessage(
                message="오늘 점심 메뉴 예약 들어왔습니다.", staff_name=staff_objs[1].name, 
                staff_id=staff_objs[1].id, business_id=BUSINESS_ID
            )
            msg2 = StaffChatMessage(
                message="네, 확인했습니다. 준비할게요.", staff_name=staff_objs[0].name, 
                staff_id=staff_objs[0].id, business_id=BUSINESS_ID
            )
            session.add(msg1)
            session.add(msg2)
            
            try:
                session.commit()
            except Exception as e:
                print("Error committing Chat/Suggestions:")
                print(e)
                session.rollback()

        print("Chat and Suggestions created.")
        print("✅ Sample data generation for 장인김밥 completed successfully.")

if __name__ == "__main__":
    try:
        generate_sample_data()
    except Exception as e:
        import traceback
        traceback.print_exc()
        with open("exact_db_error.log", "w") as f:
            f.write(str(e))
            if hasattr(e, "orig"):
                f.write("\nORIG:\n" + str(e.orig))
