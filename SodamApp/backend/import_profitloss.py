"""
Import data from 소담김밥손익계산서(7~12).xlsx into the database
"""
import pandas as pd
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session
from database import engine
from models import MonthlyProfitLoss, DailyExpense
import datetime

EXCEL_PATH = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx"

def import_monthly_summary():
    """Import data from '종합' sheet into MonthlyProfitLoss table"""
    df = pd.read_excel(EXCEL_PATH, sheet_name='종합', header=None)
    
    # Parse the structure based on analysis:
    # Row 1 has months (7월, 8월, ..., 12월) in columns 4-9
    # Rows 2-6: Revenue items (매장매출, 쿠팡, 배민, 요기요, 땡겨요)
    # Rows 8+: Expense items
    
    months = [7, 8, 9, 10, 11, 12]
    col_offset = 4  # Columns 4-9 contain month data
    
    with Session(engine) as session:
        for i, month in enumerate(months):
            col = col_offset + i
            
            # Parse revenue values (handle NaN as 0)
            def get_val(row_idx, col_idx):
                val = df.iloc[row_idx, col_idx]
                if pd.isna(val):
                    return 0
                if isinstance(val, str):
                    val = val.strip()
                    if val == '' or not val.replace('.', '').replace('-', '').isdigit():
                        return 0
                try:
                    return int(float(val))
                except (ValueError, TypeError):
                    return 0
            
            record = MonthlyProfitLoss(
                year=2025,
                month=month,
                revenue_store=get_val(2, col),      # 매장매출
                revenue_coupang=get_val(3, col),    # 쿠팡 정산금
                revenue_baemin=get_val(4, col),     # 배민 정산금
                revenue_yogiyo=get_val(5, col),     # 요기요 정산금
                revenue_ddangyo=get_val(6, col),    # 땡겨요 정산금
                expense_labor=get_val(8, col),      # 인건비
                expense_rent=get_val(9, col),       # 임대관리비
                expense_utility=get_val(10, col),   # 제세공과금
                expense_vat=get_val(11, col),       # 부가가치세
                expense_biz_tax=get_val(12, col),   # 사업소득세
                expense_income_tax=get_val(13, col),# 근로소득세
                expense_card_fee=get_val(14, col),  # 카드수수료
                expense_material=get_val(15, col),  # 재료비
                expense_retirement=get_val(16, col),# 퇴직금적립
            )
            
            # Check if already exists
            from sqlmodel import select
            existing = session.exec(
                select(MonthlyProfitLoss)
                .where(MonthlyProfitLoss.year == 2025, MonthlyProfitLoss.month == month)
            ).first()
            
            if existing:
                print(f"  Updating 2025-{month:02d}...")
                for key in ['revenue_store', 'revenue_coupang', 'revenue_baemin', 
                           'revenue_yogiyo', 'revenue_ddangyo', 'expense_labor',
                           'expense_rent', 'expense_utility', 'expense_vat',
                           'expense_biz_tax', 'expense_income_tax', 'expense_card_fee',
                           'expense_material', 'expense_retirement']:
                    setattr(existing, key, getattr(record, key))
                session.add(existing)
            else:
                print(f"  Creating 2025-{month:02d}...")
                session.add(record)
        
        session.commit()
        print("Monthly summary import complete!")

def import_daily_expenses():
    """Import data from monthly expense sheets (7월비용 ~ 12월비용)"""
    months = [7, 8, 9, 10, 11, 12]
    
    with Session(engine) as session:
        # Clear existing daily expenses for 2025
        from sqlmodel import select
        existing = session.exec(
            select(DailyExpense)
            .where(DailyExpense.date >= datetime.date(2025, 7, 1))
            .where(DailyExpense.date < datetime.date(2026, 1, 1))
        ).all()
        for e in existing:
            session.delete(e)
        session.commit()
        
        for month in months:
            sheet_name = f"{month}월비용"
            print(f"  Processing {sheet_name}...")
            
            try:
                df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, header=None)
            except Exception as e:
                print(f"    Error reading {sheet_name}: {e}")
                continue
            
            # Row 0 has dates (1, 2, 3, ... 31) starting from column 1
            # Column 0 has vendor names
            # Data starts from row 1
            
            for row_idx in range(1, len(df)):
                vendor_name = df.iloc[row_idx, 0]
                if pd.isna(vendor_name) or str(vendor_name).strip() == '':
                    continue
                vendor_name = str(vendor_name).strip()
                
                for day in range(1, 32):
                    col_idx = day  # Column 1 = day 1, etc.
                    if col_idx >= len(df.columns):
                        break
                    
                    val = df.iloc[row_idx, col_idx]
                    if pd.isna(val) or val == 0:
                        continue
                    
                    try:
                        amount = int(val)
                        expense_date = datetime.date(2025, month, day)
                        
                        expense = DailyExpense(
                            date=expense_date,
                            vendor_name=vendor_name,
                            amount=amount,
                            category="재료비"
                        )
                        session.add(expense)
                    except (ValueError, TypeError):
                        continue
            
            session.commit()
        
        print("Daily expenses import complete!")

if __name__ == "__main__":
    print("Importing Profit/Loss data from Excel...")
    print("\n1. Importing monthly summary...")
    import_monthly_summary()
    print("\n2. Importing daily expenses...")
    import_daily_expenses()
    print("\nDone!")
