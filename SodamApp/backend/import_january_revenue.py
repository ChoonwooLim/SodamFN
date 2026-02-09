"""
PRECISE Import: January 2026 Revenue Data
Sources:
  - File A: 1월_일자별_신용카드 매출내역 (5,896 card transactions → aggregated by day+매입사명)
  - File B: 소담김밥매장 일자별 매출내역 (POS daily summary → cash revenue per day)

Steps:
  1. Delete ALL existing Jan 2026 store category DailyExpense records
  2. Import card revenue from File A (by day+매입사명 → vendor)
  3. Import cash revenue from File B (by day → 현금매출 vendor)
  4. Cross-check totals
"""
import pandas as pd
import datetime
import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from database import engine
from sqlmodel import Session, select
from models import DailyExpense, Vendor

FILE_A = r'C:\WORK\SodamFN\2026소득분석\매출\1월_일자별_신용카드 매출내역_20260209.xlsx'
FILE_B = r'C:\WORK\SodamFN\2026소득분석\매출\소담김밥매장 일자별 매출내역_20260209.xlsx'

# --- 매입사명 → Vendor name mapping ---
BUYER_VENDOR_MAP = {
    '신한카드': '소담김밥 건대매장 신한카드',
    'KB국민카드': '소담김밥 건대매장 국민카드',
    '비씨카드': '소담김밥 건대매장 BC카드',
    '현대카드': '소담김밥 건대매장 현대카드',
    '하나구외환': '소담김밥 건대매장 하나카드',
    '삼성카드': '소담김밥 건대매장 삼성카드',
    'NH카드': '소담김밥 건대매장 농협카드',
    '롯데카드': '소담김밥 건대매장 롯데카드',
    '우리카드': '소담김밥 건대매장 우리카드',
    '카카오페이': '소담김밥 건대매장 카카오페이',
}
CASH_VENDOR_NAME = '소담김밥 건대매장 현금매출'


def main():
    print("=" * 60)
    print("PRECISE Revenue Import: January 2026")
    print("=" * 60)

    # ========================================
    # STEP 1: Delete existing Jan 2026 store data
    # ========================================
    print("\n[STEP 1] Deleting existing Jan 2026 store revenue...")
    with Session(engine) as session:
        existing = session.exec(
            select(DailyExpense).where(
                DailyExpense.date >= datetime.date(2026, 1, 1),
                DailyExpense.date <= datetime.date(2026, 1, 31),
                DailyExpense.category == 'store',
            )
        ).all()
        
        del_count = len(existing)
        for e in existing:
            session.delete(e)
        session.commit()
        print(f"  Deleted {del_count} existing records")

    # ========================================
    # STEP 2: Parse File A (card detail) → aggregate by day + 매입사명
    # ========================================
    print("\n[STEP 2] Parsing File A: 신용카드 매출내역...")
    df_a = pd.read_excel(FILE_A, header=0)
    
    daily_card = {}
    tx_count = 0
    cancel_count = 0
    
    for _, row in df_a.iterrows():
        buyer = str(row['매입사명']).strip() if pd.notna(row['매입사명']) else None
        if buyer is None or buyer == 'nan':
            continue
        
        date_val = row['영업일자']
        if pd.isna(date_val):
            continue
        
        if isinstance(date_val, datetime.datetime):
            date_str = date_val.strftime('%Y-%m-%d')
        else:
            date_str = str(date_val)[:10]
        
        amt_raw = row['승인금액']
        if pd.isna(amt_raw):
            continue
        try:
            amt = int(float(str(amt_raw).replace(',', '')))
        except:
            continue
        
        tx_type = str(row['구분']).strip()
        if tx_type == '취소':
            amt = -amt
            cancel_count += 1
        else:
            tx_count += 1
        
        key = (date_str, buyer)
        daily_card[key] = daily_card.get(key, 0) + amt
    
    print(f"  Transactions: {tx_count} approved, {cancel_count} cancelled")
    print(f"  Aggregated: {len(daily_card)} day×buyer combinations")

    # ========================================
    # STEP 3: Parse File B (POS daily) → cash per day
    # ========================================
    print("\n[STEP 3] Parsing File B: POS 일자별 매출내역...")
    df_b = pd.read_excel(FILE_B, header=None)
    
    daily_cash = {}
    for i in range(2, 33):
        row = df_b.iloc[i]
        date_val = row.iloc[0]
        cash = int(row.iloc[14]) if pd.notna(row.iloc[14]) and row.iloc[14] != 0 else 0
        
        if pd.isna(date_val) or cash == 0:
            continue
        
        if isinstance(date_val, datetime.datetime):
            date_str = date_val.strftime('%Y-%m-%d')
        else:
            date_str = str(date_val)[:10]
        
        daily_cash[date_str] = cash
    
    print(f"  Cash days: {len(daily_cash)}")

    # ========================================
    # STEP 4: Insert into database
    # ========================================
    print("\n[STEP 4] Inserting records...")
    
    with Session(engine) as session:
        # Build vendor lookup
        vendors = session.exec(select(Vendor)).all()
        vendor_by_name = {v.name: v for v in vendors}
        
        # Ensure cash vendor exists
        if CASH_VENDOR_NAME not in vendor_by_name:
            cash_v = Vendor(name=CASH_VENDOR_NAME, category='store', item='소담김밥 건대매장:cash', vendor_type='revenue')
            session.add(cash_v)
            session.flush()
            vendor_by_name[CASH_VENDOR_NAME] = cash_v
            print(f"  Created vendor: {CASH_VENDOR_NAME}")
        
        card_count = 0
        card_total = 0
        unmapped = set()
        
        # Insert card records
        for (date_str, buyer), amount in sorted(daily_card.items()):
            if amount <= 0:
                continue
            
            vendor_name = BUYER_VENDOR_MAP.get(buyer)
            if not vendor_name:
                unmapped.add(buyer)
                continue
            
            vendor = vendor_by_name.get(vendor_name)
            if not vendor:
                print(f"  ⚠ Vendor not found in DB: {vendor_name}")
                continue
            
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            
            expense = DailyExpense(
                date=date_obj,
                vendor_name=vendor.name,
                vendor_id=vendor.id,
                amount=amount,
                category='store',
                note=f'카드매출({buyer})',
            )
            session.add(expense)
            card_count += 1
            card_total += amount
        
        if unmapped:
            print(f"  ⚠ Unmapped buyers: {unmapped}")
        
        # Insert cash records
        cash_count = 0
        cash_total = 0
        cash_vendor = vendor_by_name[CASH_VENDOR_NAME]
        
        for date_str, amount in sorted(daily_cash.items()):
            date_obj = datetime.datetime.strptime(date_str, '%Y-%m-%d').date()
            
            expense = DailyExpense(
                date=date_obj,
                vendor_name=cash_vendor.name,
                vendor_id=cash_vendor.id,
                amount=amount,
                category='store',
                note='현금매출',
            )
            session.add(expense)
            cash_count += 1
            cash_total += amount
        
        session.commit()
    
    # ========================================
    # VERIFICATION
    # ========================================
    print("\n" + "=" * 60)
    print("IMPORT COMPLETE - VERIFICATION")
    print("=" * 60)
    print(f"  Card records:  {card_count} ({card_total:,}원)")
    print(f"  Cash records:  {cash_count} ({cash_total:,}원)")
    print(f"  Total records: {card_count + cash_count}")
    print(f"  Total amount:  {card_total + cash_total:,}원")
    print()
    print("  Cross-check with File B:")
    print(f"    File B 카드매출: 45,641,000원  vs  Import 카드: {card_total:,}원  {'✅' if card_total == 45641000 else '❌ MISMATCH'}")
    print(f"    File B 현금매출:  2,662,500원  vs  Import 현금: {cash_total:,}원  {'✅' if cash_total == 2662500 else '❌ MISMATCH'}")
    print(f"    File B 총매출:  48,303,500원  vs  Import 합계: {card_total + cash_total:,}원  {'✅' if card_total + cash_total == 48303500 else '❌ MISMATCH'}")
    print()


if __name__ == '__main__':
    main()
