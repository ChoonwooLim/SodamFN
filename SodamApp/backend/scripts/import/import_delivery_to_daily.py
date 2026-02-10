"""
Import DeliveryRevenue settlement data into DailyExpense entries.
Each monthly record creates a DailyExpense on the 1st of that month.
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from database import engine
from sqlmodel import Session, select
from models import DeliveryRevenue, DailyExpense, Vendor
from datetime import date

# Mapping: DeliveryRevenue.channel → Vendor name
CHANNEL_VENDOR_MAP = {
    "쿠팡": "소담김밥 건대매장 쿠팡이츠",
    "배민": "소담김밥 건대매장 배달의민족",
    "요기요": "소담김밥 건대매장 요기요",
    "땡겨요": "소담김밥 건대매장 땡겨요",
}

def main():
    with Session(engine) as session:
        # Load vendors
        vendors = session.exec(
            select(Vendor).where(Vendor.category == "delivery")
        ).all()
        vendor_by_name = {v.name: v for v in vendors}

        # Load all DeliveryRevenue records
        records = session.exec(select(DeliveryRevenue)).all()

        created = 0
        skipped = 0
        updated = 0

        for rec in records:
            vendor_name = CHANNEL_VENDOR_MAP.get(rec.channel)
            if not vendor_name:
                print(f"⚠️  Unknown channel: {rec.channel}")
                continue

            vendor = vendor_by_name.get(vendor_name)
            if not vendor:
                print(f"⚠️  Vendor not found: {vendor_name}")
                continue

            # Use 1st of the month as the DailyExpense date
            expense_date = date(rec.year, rec.month, 1)

            # Check for existing entry (same date + vendor)
            existing = session.exec(
                select(DailyExpense).where(
                    DailyExpense.date == expense_date,
                    DailyExpense.vendor_id == vendor.id,
                )
            ).first()

            if existing:
                # Update if amount differs
                if existing.amount != rec.settlement_amount:
                    existing.amount = rec.settlement_amount
                    existing.note = f"매출:{rec.total_sales:,} / 수수료:{rec.total_fees:,} / 주문:{rec.order_count}건"
                    session.add(existing)
                    updated += 1
                    print(f"  🔄 Updated: {vendor_name} {rec.year}-{rec.month:02d} → settlement={rec.settlement_amount:,}")
                else:
                    skipped += 1
                continue

            expense = DailyExpense(
                date=expense_date,
                vendor_name=vendor.name,
                vendor_id=vendor.id,
                amount=rec.settlement_amount,
                category="delivery",
                note=f"매출:{rec.total_sales:,} / 수수료:{rec.total_fees:,} / 주문:{rec.order_count}건",
            )
            session.add(expense)
            created += 1
            print(f"  ✅ Created: {vendor_name} {rec.year}-{rec.month:02d} → settlement={rec.settlement_amount:,}")

        session.commit()
        print(f"\n완료: 생성 {created}건, 업데이트 {updated}건, 스킵 {skipped}건")

if __name__ == "__main__":
    main()
