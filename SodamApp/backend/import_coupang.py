"""
Migrate Coupang settlement data from Excel to database
Parses the Excel sheet '쿠팡인출내역' which has this structure:
- Columns are organized in pairs per month (day, amount)
- Row 0: header "쿠팡이츠 정산금 입금내역_2025하반기"
- Row 1: column headers (7월, 8월, etc.)
- Rows 2-32: day numbers (1-31) and amounts
- Row 33: 합계 (total)
"""

import pandas as pd
from sqlmodel import Session
from database import engine
from models import Revenue
import datetime

def import_coupang_data():
    excel_path = r'c:\WORK\SodamFN\2025실소득분석\소담김밥손익계산서(7~12).xlsx'
    
    # Read the sheet
    df = pd.read_excel(excel_path, sheet_name='쿠팡인출내역', header=None)
    
    print("Excel data shape:", df.shape)
    print("First 5 rows:")
    print(df.head())
    
    # The structure seems to be: columns in groups of 2 (day, amount) for each month
    # Column layout based on the image:
    # B: 7월 day, C: 7월 amount
    # D: 8월 day, E: 8월 amount
    # etc.
    
    year = 2025
    entries = []
    
    # Month mapping: which column pairs contain which month's data
    # Based on Excel structure: each month has 3 columns - (label/empty, day, amount)
    # Col 0,1,2 = 7월 (label, day, amount)
    # Col 3,4,5 = 8월 (label, day, amount)
    # etc.
    
    month_columns = {
        7: (1, 2),   # 7월: day at col 1, amount at col 2
        8: (4, 5),   # 8월: day at col 4, amount at col 5
        9: (7, 8),   # 9월: day at col 7, amount at col 8
        10: (10, 11),  # 10월
        11: (13, 14),  # 11월
        12: (16, 17)   # 12월
    }
    
    # Skip first 2-3 rows (headers) and last row (total)
    # Data rows are from row 2 to row 32 (days 1-31)
    
    for month, (day_col, amount_col) in month_columns.items():
        print(f"\n=== Processing {month}월 (cols {day_col}, {amount_col}) ===")
        
        # Iterate through data rows (skip header rows, typically row 0-1)
        for row_idx in range(2, 34):  # rows 2-33 contain day data
            try:
                if row_idx >= len(df):
                    continue
                    
                day_val = df.iloc[row_idx, day_col]
                amount_val = df.iloc[row_idx, amount_col]
                
                # Skip if not valid data
                if pd.isna(day_val) or pd.isna(amount_val):
                    continue
                    
                # Skip "합 계" row
                if str(day_val).strip() == '합 계':
                    continue
                
                day = int(day_val)
                amount = int(amount_val)
                
                if day < 1 or day > 31 or amount <= 0:
                    continue
                
                # Validate day exists in month
                try:
                    date = datetime.date(year, month, day)
                except ValueError:
                    continue  # Invalid date (e.g., Feb 30)
                
                entries.append({
                    'date': date,
                    'channel': 'Coupang',
                    'amount': amount
                })
                print(f"  {month}/{day}: {amount:,}원")
                
            except Exception as e:
                print(f"  Error at row {row_idx}: {e}")
                continue
    
    print(f"\n총 {len(entries)}개 데이터 발견")
    
    # Insert into DB
    if entries:
        with Session(engine) as session:
            # Delete existing Coupang 2025 data
            from sqlmodel import select
            existing = session.exec(
                select(Revenue).where(
                    Revenue.channel == 'Coupang',
                    Revenue.date >= datetime.date(2025, 1, 1),
                    Revenue.date <= datetime.date(2025, 12, 31)
                )
            ).all()
            
            print(f"기존 데이터 {len(existing)}개 삭제 중...")
            for e in existing:
                session.delete(e)
            session.commit()
            
            # Insert new data
            print(f"새 데이터 {len(entries)}개 삽입 중...")
            for entry in entries:
                revenue = Revenue(
                    date=entry['date'],
                    channel=entry['channel'],
                    amount=entry['amount']
                )
                session.add(revenue)
            session.commit()
            print("완료!")
    
    return len(entries)

if __name__ == "__main__":
    count = import_coupang_data()
    print(f"\n=== 총 {count}개 쿠팡 정산 데이터 마이그레이션 완료 ===")
