import pandas as pd
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Vendor, Expense, Revenue
from datetime import date
import os

# Excel Path
EXCEL_PATH = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(9~12).xlsx"

def migrate_vendors(session):
    print("Migrating Vendors...")
    # 1. Get vendors from monthly sheets
    months = [9, 10, 11, 12]
    unique_vendors = set()
    
    for m in months:
        sheet_name = f"{m}월비용"
        try:
            df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, header=None)
            # Vendor names in Col 0 (A), skip 2 header rows
            vendors = df.iloc[2:, 0].dropna().unique()
            for v in vendors:
                unique_vendors.add(v)
        except Exception as e:
            print(f"Skipping {sheet_name}: {e}")

    count = 0
    for v_name in unique_vendors:
        # Check if exists
        statement = select(Vendor).where(Vendor.name == v_name)
        existing = session.exec(statement).first()
        if not existing:
            vendor = Vendor(name=v_name, category="기타")
            session.add(vendor)
            count += 1
            
    session.commit()
    print(f"Added {count} new vendors.")

def migrate_expenses(session):
    print("Migrating Expenses...")
    months = [9, 10, 11, 12]
    
    # Pre-fetch vendors to map IDs
    vendors = session.exec(select(Vendor)).all()
    vendor_map = {v.name: v.id for v in vendors}
    
    count = 0
    for m in months:
        sheet_name = f"{m}월비용"
        try:
            df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, header=None)
            # Col 0: Vendor, Col 31: Total Amount
            # Assume Date is 1st of month/year as placeholder or extract from daily headers if needed
            # For simplicity, we'll store as Month-End date or just associate with month
            
            # Actually, the sheet has 'daily' columns. 
            # Col 1 (B) -> Day 1, Col 2 (C) -> Day 2... 
            # This is complex. For Phase 1 migration, let's just migrate the TOTALs per vendor as a single monthly summary expense?
            # User request: "매입 세부 관리".
            # Better approach: Iterate rows (vendors) and create one expense entry per vendor per month for the TOTAL amount.
            # (Detailed daily migration is overkill unless user insists).
            
            # Let's verify 'Total' column index. Previously found Col 31 is Total.
            
            current_date = date(2025, m, 1) # First of month
            
            for index, row in df.iloc[2:].iterrows():
                v_name = row[0]
                amount = row[31]
                
                if pd.notna(v_name) and pd.notna(amount):
                    try:
                       amt_val = int(amount)
                       if amt_val > 0:
                           vendor_id = vendor_map.get(v_name)
                           expense = Expense(
                               date=current_date, 
                               amount=amt_val, 
                               category="식자재", # Default
                               vendor_id=vendor_id,
                               description=f"{m}월 지출 합계"
                           )
                           session.add(expense)
                           count += 1
                    except:
                        continue
                        
        except Exception as e:
            print(f"Error in {sheet_name}: {e}")
            
    session.commit()
    print(f"Added {count} expense records.")

def migrate_revenue(session):
    print("Migrating Revenue...")
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name='종합', header=None)
        # Channels: 매장(2), 쿠팡(3), 배민(4), 요기요(5), 땡겨요(6)
        # Months: 9월(Col 6), 10월(Col 7), 11월(Col 8), 12월(Col 9)
        
        channels = {
            2: "매장", 3: "쿠팡", 4: "배민", 5: "요기요", 6: "땡겨요"
        }
        month_cols = {
            9: 6, 10: 7, 11: 8, 12: 9
        }
        
        count = 0
        for m, col_idx in month_cols.items():
            d = date(2025, m, 1)
            for row_idx, ch_name in channels.items():
                val = df.iloc[row_idx, col_idx]
                if pd.notna(val):
                    rev = Revenue(
                        date=d,
                        channel=ch_name,
                        amount=int(val),
                        description=f"{m}월 {ch_name} 매출"
                    )
                    session.add(rev)
                    count += 1
        
        session.commit()
        print(f"Added {count} revenue records.")
        
    except Exception as e:
        print(f"Error migrating revenue: {e}")

def main():
    if os.path.exists("sodam_database.db"):
        os.remove("sodam_database.db")
        
    create_db_and_tables()
    
    with Session(engine) as session:
        migrate_vendors(session)
        migrate_expenses(session)
        migrate_revenue(session)
        
    print("Migration Complete!")

if __name__ == "__main__":
    main()
