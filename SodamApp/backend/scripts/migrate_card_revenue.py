"""
Migration script: Split card sales by card company and fix cash payment_method.

Steps:
1. Fix cash vendor DailyExpense: payment_method → 'Cash'
2. Delete '카드매출(통합)' DailyExpense records
3. Parse card detail Excel and insert per-card-company records
4. Sync P/L
"""
import sys
sys.path.insert(0, '.')

import pandas as pd
import datetime as dt
from sqlmodel import Session, select
from database import engine
from models import DailyExpense, Vendor

# --- Configuration ---
CARD_DETAIL_FILE = r'C:\WORK\SodamFN\2026소득분석\매출\1월_일자별_신용카드 매출내역_20260209.xlsx'

CARD_VENDOR_MAP = {
    '신한카드': '소담김밥 건대본점 신한카드',
    'KB카드': '소담김밥 건대본점 국민카드',
    'KB국민카드': '소담김밥 건대본점 국민카드',
    '비씨카드': '소담김밥 건대본점 BC카드',
    '현대카드': '소담김밥 건대본점 현대카드',
    '하나카드': '소담김밥 건대본점 하나카드',
    '하나구외환': '소담김밥 건대본점 하나카드',
    '삼성카드': '소담김밥 건대본점 삼성카드',
    '롯데카드': '소담김밥 건대본점 롯데카드',
    '신롯데카드': '소담김밥 건대본점 롯데카드',
    '우리카드': '소담김밥 건대본점 우리카드',
    '농협카드': '소담김밥 건대본점 농협카드',
    'NH카드': '소담김밥 건대본점 농협카드',
    'NH농협카드': '소담김밥 건대본점 농협카드',
    '카카오페이': '소담김밥 건대본점 카카오페이',
}

CASH_VENDOR_NAMES = ['소담김밥 건대매장 현금매출', '소담김밥 건대본점 현금매출']
CARD_COMBINED_NAME = '카드매출(통합)'


def main():
    with Session(engine) as session:
        # --- Step 0: Load vendor map ---
        vendors = session.exec(select(Vendor).where(Vendor.vendor_type == 'revenue')).all()
        vendor_by_name = {v.name: v for v in vendors}
        print(f"Loaded {len(vendors)} revenue vendors")

        # --- Step 1: Fix cash payment_method ---
        print("\n=== Step 1: Fix cash payment_method ===")
        cash_fixed = 0
        for cn in CASH_VENDOR_NAMES:
            cv = vendor_by_name.get(cn)
            if not cv:
                continue
            cash_exps = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == cv.id)
            ).all()
            for e in cash_exps:
                if e.payment_method != 'Cash':
                    e.payment_method = 'Cash'
                    session.add(e)
                    cash_fixed += 1
        print(f"  Fixed {cash_fixed} cash records → payment_method='Cash'")

        # Also rename '건대매장 현금매출' DailyExpense to use '건대본점' vendor
        old_cash = vendor_by_name.get('소담김밥 건대매장 현금매출')
        new_cash = vendor_by_name.get('소담김밥 건대본점 현금매출')
        if old_cash and new_cash:
            migrate_exps = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == old_cash.id)
            ).all()
            for e in migrate_exps:
                e.vendor_id = new_cash.id
                e.vendor_name = new_cash.name
                session.add(e)
            print(f"  Migrated {len(migrate_exps)} cash records from '{old_cash.name}' → '{new_cash.name}'")

        # --- Step 2: Delete '카드매출(통합)' records ---
        print("\n=== Step 2: Delete 카드매출(통합) records ===")
        combined_vendor = vendor_by_name.get(CARD_COMBINED_NAME)
        if combined_vendor:
            combined_exps = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == combined_vendor.id)
            ).all()
            deleted_count = len(combined_exps)
            deleted_total = sum(e.amount or 0 for e in combined_exps)
            for e in combined_exps:
                session.delete(e)
            print(f"  Deleted {deleted_count} records, total: {deleted_total:,}원")
        else:
            print(f"  No vendor '{CARD_COMBINED_NAME}' found!")

        # --- Step 3: Parse card detail Excel and insert per-card-company ---
        print("\n=== Step 3: Parse & insert card detail records ===")
        df = pd.read_excel(CARD_DETAIL_FILE)
        print(f"  Read {len(df)} card transactions")

        # Find columns
        date_col = '영업일자'
        card_col = '카드사명'
        amount_col = '승인금액'
        type_col = '구분'

        df[date_col] = pd.to_datetime(df[date_col])

        # Aggregate by date + card company
        daily_card = {}
        total_tx = 0
        cancel_tx = 0

        for _, row in df.iterrows():
            date_val = row[date_col]
            card_name = str(row[card_col]).strip() if pd.notna(row[card_col]) else '기타카드'
            tx_type = str(row[type_col]).strip() if pd.notna(row[type_col]) else '승인'
            amt = row[amount_col]

            if pd.isna(date_val) or pd.isna(amt):
                continue

            try:
                amt = int(float(str(amt).replace(',', '')))
            except (ValueError, TypeError):
                continue

            if tx_type == '취소':
                amt = -amt
                cancel_tx += 1
            else:
                total_tx += 1

            date_str = date_val.strftime('%Y-%m-%d')
            key = (date_str, card_name)
            daily_card[key] = daily_card.get(key, 0) + amt

        print(f"  Transactions: {total_tx} approved, {cancel_tx} cancelled")
        print(f"  Unique date+card combos: {len(daily_card)}")

        # Insert records
        inserted = 0
        skipped = 0
        unmapped_cards = set()

        for (date_str, card_name), amount in sorted(daily_card.items()):
            if amount <= 0:
                skipped += 1
                continue

            vendor_name = CARD_VENDOR_MAP.get(card_name)
            if not vendor_name:
                unmapped_cards.add(card_name)
                vendor_name = f'기타카드({card_name})'

            vendor = vendor_by_name.get(vendor_name)
            if not vendor:
                # Create new vendor
                vendor = Vendor(
                    name=vendor_name,
                    category='store',
                    item=f'소담김밥 건대본점:card',
                    vendor_type='revenue',
                )
                session.add(vendor)
                session.flush()
                vendor_by_name[vendor_name] = vendor
                print(f"  Created new vendor: {vendor_name}")

            date_obj = dt.datetime.strptime(date_str, '%Y-%m-%d').date()

            # Check for existing record (avoid duplicates)
            existing = session.exec(
                select(DailyExpense).where(
                    DailyExpense.date == date_obj,
                    DailyExpense.vendor_id == vendor.id,
                )
            ).first()

            if existing:
                skipped += 1
                continue

            expense = DailyExpense(
                date=date_obj,
                vendor_name=vendor.name,
                vendor_id=vendor.id,
                amount=amount,
                category='store',
                note=f'카드매출({card_name})',
                payment_method='Card',
            )
            session.add(expense)
            inserted += 1

        if unmapped_cards:
            print(f"  ⚠️ Unmapped card names: {unmapped_cards}")

        print(f"  Inserted: {inserted}, Skipped: {skipped}")

        # --- Commit ---
        session.commit()
        print("\n✅ Migration committed!")

    # --- Step 4: Verify & Sync P/L ---
    print("\n=== Step 4: Verify & Sync P/L ===")
    with Session(engine) as session:
        # Verify - count per card company vendor
        for vname in sorted(set(CARD_VENDOR_MAP.values())):
            v = session.exec(select(Vendor).where(Vendor.name == vname)).first()
            if v:
                cnt = len(session.exec(
                    select(DailyExpense).where(DailyExpense.vendor_id == v.id)
                ).all())
                total = sum(e.amount or 0 for e in session.exec(
                    select(DailyExpense).where(DailyExpense.vendor_id == v.id)
                ).all())
                print(f"  {vname}: {cnt} records, {total:,}원")

        # Sync P/L
        from services.profit_loss_service import sync_revenue_to_pl
        for year, month in [(2026, 1)]:
            sync_revenue_to_pl(year, month, session)
        session.commit()
        print("\n✅ P/L synced!")


if __name__ == '__main__':
    main()
