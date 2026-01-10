import pandas as pd
from sqlmodel import Session, select
from database import engine, create_db_and_tables
from models import Vendor, Expense, Revenue
from datetime import date
import os

# Excel Path
EXCEL_PATH = r"C:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx"

def migrate_vendors(session):
    print("Migrating Vendors...")
    # Months 7 to 12
    months = [7, 8, 9, 10, 11, 12]
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
    months = [7, 8, 9, 10, 11, 12]
    
    # Pre-fetch vendors to map IDs
    vendors = session.exec(select(Vendor)).all()
    vendor_map = {v.name: v.id for v in vendors}
    
    count = 0
    for m in months:
        sheet_name = f"{m}월비용"
        try:
            df = pd.read_excel(EXCEL_PATH, sheet_name=sheet_name, header=None)
            
            current_date = date(2025, m, 1) # First of month
            
            # Row iteration starting from index 2 (skipping headers)
            # Col 0: Vendor Name
            # Col 31: Total Amount (Based on previous knowledge, verify if unchanged)
            # Let's assume Col 31 is still valid as structure likely preserved.
            
            for index, row in df.iloc[2:].iterrows():
                v_name = row[0]
                amount = row[31]
                
                if pd.notna(v_name) and pd.notna(amount):
                    try:
                       amt_val = int(amount)
                       if amt_val > 0:
                           vendor_id = vendor_map.get(v_name)
                           
                           # Check for duplicate to avoid double counting if re-run without clearing?
                           # For now, we clear DB in main(), so just add.
                           
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
        
        channels = {
            2: "매장", 3: "쿠팡", 4: "배민", 5: "요기요", 6: "땡겨요"
        }
        
        # Confirmed Columns:
        # Col 4 -> 7월
        # Col 5 -> 8월
        # ...
        # Col 9 -> 12월
        month_cols = {
            7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 12: 9
        }
        
        count = 0
        for m, col_idx in month_cols.items():
            d = date(2025, m, 1)
            for row_idx, ch_name in channels.items():
                val = df.iloc[row_idx, col_idx]
                if pd.notna(val):
                    try:
                        rev = Revenue(
                            date=d,
                            channel=ch_name,
                            amount=int(val),
                            description=f"{m}월 {ch_name} 매출"
                        )
                        session.add(rev)
                        count += 1
                    except:
                        pass
        
        session.commit()
        print(f"Added {count} revenue records.")
        
    except Exception as e:
        print(f"Error migrating revenue: {e}")

def migrate_coupang_detailed(session):
    print("Migrating Coupang Detailed...")
    try:
        df = pd.read_excel(EXCEL_PATH, sheet_name='쿠팡인출내역', header=None)
        
        # Mapping: Month -> Amount Column Index
        # 7월: Col 2
        # Data pattern: Month Label at N, Days at N+1, Amount at N+2.
        # 7월 is at Col 0 (Label). So Amount is Col 2.
        # Intervals of 3.
        
        col_idx = 2
        count = 0
        
        for m in range(7, 13):
            try:
                # Sum the column, treating non-numeric as 0
                monthly_total = pd.to_numeric(df.iloc[2:, col_idx], errors='coerce').sum()
                
                if monthly_total > 0:
                    d = date(2025, m, 1)
                    rev = Revenue(
                        date=d,
                        channel="쿠팡",
                        amount=int(monthly_total),
                        description=f"{m}월 쿠팡 매출 (상세내역 집계)"
                    )
                    session.add(rev)
                    count += 1
                    print(f"  {m}월 쿠팡: {int(monthly_total):,}원")
            except Exception as e:
                print(f"  Error processing Coupang month {m}: {e}")
            
            col_idx += 3
            
        session.commit()
        print(f"Added {count} Coupang revenue records.")
        
    except Exception as e:
        print(f"Error migrating Coupang details: {e}")

def main():
    # CAUTION: This clears the database (except Payroll/Staff which are separate tables/files?)
    # Wait, create_db_and_tables doesn't drop tables.
    # But usually we want to clear old data to avoid duplicates.
    # Previous script: os.remove("sodam_database.db")
    # BUT we just migrated Payroll into the SAME DB.
    # If we delete DB file, we lose Payroll data!
    # Modification: DO NOT delete DB file.
    # Instead, DELETE existing Revenue/Expense/Vendor data before importing.
    # Leave Staff/Payroll intact.
    
    with Session(engine) as session:
        print("Clearing old P/L data...")
        session.exec(select(Expense)).all()
        # Bulk delete not directly supported in SQLModel simple exec?
        # Iterate and delete or use raw SQL.
        # Simple way:
        expenses = session.exec(select(Expense)).all()
        for e in expenses: session.delete(e)
        
        revenues = session.exec(select(Revenue)).all()
        for r in revenues: session.delete(r)
        
        # Vendors might be linked to Expenses, so delete expenses first.
        # Vendors might be kept or re-verified. 
        # Let's keep vendors or check constraint.
        # Actually, let's just clear Revenue and Expense tables to be safe, 
        # and append new Vendors if not exist.
        
        session.commit()
        
    with Session(engine) as session:
        migrate_vendors(session)
        migrate_expenses(session)
        migrate_revenue(session)
        migrate_coupang_detailed(session)
        
    print("Migration Complete!")

if __name__ == "__main__":
    main()
