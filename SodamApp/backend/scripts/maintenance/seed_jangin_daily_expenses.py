"""
장인김밥 (business_id=2) DailyExpense 샘플 데이터 생성
- 매입거래처별 DailyExpense (식자재, 소모품, 임차료 등)
- 매출거래처별 DailyExpense (매장매출, 배달매출)
- 2026년 1~2월
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, select
from models import Vendor, DailyExpense
from datetime import date
import random

BID = 2  # 장인김밥

def seed():
    with Session(engine) as s:
        # Check existing
        existing = s.exec(select(DailyExpense).where(DailyExpense.business_id == BID)).all()
        if existing:
            print(f"⚠️  DailyExpense 이미 {len(existing)}건 존재 — 삭제 후 재생성합니다.")
            for e in existing:
                s.delete(e)
            s.commit()

        # =====================
        # 1. 매입 거래처 (expense vendors) for BID=2
        # =====================
        expense_vendors = [
            {"name": "대한식재료", "category": "원재료비", "vendor_type": "expense"},
            {"name": "신선유통", "category": "원재료비", "vendor_type": "expense"},
            {"name": "김밥천국재료", "category": "원재료비", "vendor_type": "expense"},
            {"name": "세종가스", "category": "수도광열비", "vendor_type": "expense"},
            {"name": "그린세제", "category": "소모품비", "vendor_type": "expense"},
            {"name": "미래부동산", "category": "임차료", "vendor_type": "expense"},
            {"name": "대성물류", "category": "원재료비", "vendor_type": "expense"},
            {"name": "장인식자재마트", "category": "원재료비", "vendor_type": "expense"},
        ]

        # 매출 거래처 (revenue vendors)
        revenue_vendors = [
            {"name": "매장매출", "category": "store", "vendor_type": "revenue"},
            {"name": "배달의민족", "category": "delivery", "vendor_type": "revenue"},
            {"name": "쿠팡이츠", "category": "delivery", "vendor_type": "revenue"},
            {"name": "요기요", "category": "delivery", "vendor_type": "revenue"},
        ]

        # Create/get vendors
        all_vendor_defs = expense_vendors + revenue_vendors
        vendor_map = {}
        for vd in all_vendor_defs:
            existing_v = s.exec(
                select(Vendor).where(Vendor.name == vd["name"], Vendor.business_id == BID)
            ).first()
            if existing_v:
                vendor_map[vd["name"]] = existing_v
            else:
                v = Vendor(business_id=BID, **vd)
                s.add(v)
                s.flush()
                vendor_map[vd["name"]] = v
                print(f"  + 거래처 '{vd['name']}' ({vd['vendor_type']}) 생성")

        # =====================
        # 2. DailyExpense — 매입 (1~2월)
        # =====================
        expense_templates = [
            # (vendor_name, min_amount, max_amount, frequency_per_month)
            ("대한식재료", 80000, 350000, 8),
            ("신선유통", 50000, 250000, 6),
            ("김밥천국재료", 100000, 400000, 7),
            ("대성물류", 60000, 200000, 5),
            ("장인식자재마트", 40000, 180000, 6),
            ("세종가스", 180000, 250000, 1),
            ("그린세제", 20000, 80000, 2),
            ("미래부동산", 1200000, 1200000, 1),  # 월세 고정
        ]

        expense_count = 0
        for month in [1, 2]:
            days_in_month = 31 if month == 1 else 28
            for vendor_name, min_amt, max_amt, freq in expense_templates:
                vendor = vendor_map[vendor_name]
                # Generate freq entries spread across the month
                used_days = set()
                for _ in range(freq):
                    day = random.randint(1, days_in_month)
                    while day in used_days and len(used_days) < days_in_month:
                        day = random.randint(1, days_in_month)
                    used_days.add(day)

                    amt = random.randrange(min_amt, max_amt + 1, 10000) if min_amt != max_amt else min_amt
                    payment = "이체" if vendor_name == "미래부동산" else random.choice(["카드", "카드", "카드", "현금"])

                    de = DailyExpense(
                        business_id=BID,
                        date=date(2026, month, day),
                        vendor_name=vendor_name,
                        amount=amt,
                        category=vendor.category,
                        payment_method=payment.capitalize() if payment == "카드" else payment,
                        vendor_id=vendor.id,
                    )
                    s.add(de)
                    expense_count += 1

        print(f"  + 매입 DailyExpense {expense_count}건 생성")

        # =====================
        # 3. DailyExpense — 매출 (1~2월)
        # =====================
        revenue_templates = [
            # (vendor_name, min_daily, max_daily, skip_chance)
            ("매장매출", 350000, 800000, 0.03),     # 거의 매일
            ("배달의민족", 80000, 350000, 0.10),     # 가끔 쉬는 날
            ("쿠팡이츠", 50000, 250000, 0.15),
            ("요기요", 30000, 150000, 0.25),         # 가끔
        ]

        revenue_count = 0
        for month in [1, 2]:
            days_in_month = 31 if month == 1 else 28
            for day in range(1, days_in_month + 1):
                d = date(2026, month, day)
                weekday = d.weekday()
                weekend_mult = 1.3 if weekday >= 5 else 1.0  # 주말 매출 증가

                for vendor_name, min_amt, max_amt, skip_chance in revenue_templates:
                    if random.random() < skip_chance:
                        continue

                    vendor = vendor_map[vendor_name]
                    base_amt = random.randrange(min_amt, max_amt + 1, 10000)
                    amt = int(base_amt * weekend_mult)

                    de = DailyExpense(
                        business_id=BID,
                        date=d,
                        vendor_name=vendor_name,
                        amount=amt,
                        category=vendor.category,
                        payment_method="Card",
                        vendor_id=vendor.id,
                    )
                    s.add(de)
                    revenue_count += 1

        print(f"  + 매출 DailyExpense {revenue_count}건 생성")

        s.commit()

        total = expense_count + revenue_count
        print(f"\n✅ 장인김밥 DailyExpense 총 {total}건 생성 완료! (매입 {expense_count} + 매출 {revenue_count})")

if __name__ == "__main__":
    seed()
