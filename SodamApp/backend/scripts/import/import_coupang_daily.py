"""
Import 쿠팡이츠 delivery revenue as DailyExpense entries and remove Revenue table duplicates.
This ensures the note field contains gross sales data for the grid's 매출액 row.
"""
import sys, os, importlib.util
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense, Revenue

# Load coupang parser
spec = importlib.util.spec_from_file_location(
    "import_delivery_daily",
    os.path.join(os.path.dirname(__file__), "import_delivery_daily.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
parse_coupang_daily = mod.parse_coupang_daily

BASE_DIR = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"
COUPANG_VENDOR_ID = 1967  # 소담김밥 건대본점 쿠팡이츠


def main():
    with Session(engine) as session:
        vendor = session.get(Vendor, COUPANG_VENDOR_ID)
        if not vendor:
            print(f"❌ Vendor id={COUPANG_VENDOR_ID} not found!")
            return
        print(f"📦 쿠팡이츠 (vendor: {vendor.name}, id={vendor.id})")

        # Delete existing CoupangDailyExpense entries to avoid duplicates
        existing_de = session.exec(
            select(DailyExpense).where(DailyExpense.vendor_id == COUPANG_VENDOR_ID)
        ).all()
        if existing_de:
            for e in existing_de:
                session.delete(e)
            print(f"🗑️  기존 DailyExpense 삭제: {len(existing_de)}건")
            session.commit()

        # Parse and import
        coupang_dir = os.path.join(BASE_DIR, "쿠팡")
        if not os.path.exists(coupang_dir):
            print(f"❌ Directory not found: {coupang_dir}")
            return

        total = 0
        for fname in sorted(os.listdir(coupang_dir)):
            if not fname.endswith(('.xlsx', '.xls')):
                continue
            fpath = os.path.join(coupang_dir, fname)
            print(f"\n  📄 {fname}")
            try:
                daily = parse_coupang_daily(fpath)
                if daily:
                    count = 0
                    for dt in sorted(daily.keys()):
                        d = daily[dt]
                        if d["settlement"] == 0 and d["sales"] == 0:
                            continue
                        note = f"매출:{d['sales']:,} / 수수료:{d['fees']:,} / 주문:{max(0, d['orders'])}건"
                        expense = DailyExpense(
                            date=dt,
                            vendor_name=vendor.name,
                            vendor_id=vendor.id,
                            amount=d["settlement"],
                            category="delivery",
                            note=note,
                        )
                        session.add(expense)
                        count += 1
                        print(f"  {dt}: 매출 {d['sales']:>10,} / 정산 {d['settlement']:>10,} / 주문 {d['orders']}건")
                    total += count
                    print(f"  ✅ {count}건 저장")
                else:
                    print(f"  ⚠️ No daily data parsed")
            except Exception as e:
                print(f"  ❌ Error: {e}")
                import traceback
                traceback.print_exc()

        session.commit()

        # Now remove Revenue table entries for Coupang to avoid duplication
        coupang_revs = session.exec(
            select(Revenue).where(Revenue.channel == "Coupang")
        ).all()
        if coupang_revs:
            for r in coupang_revs:
                session.delete(r)
            session.commit()
            print(f"\n🗑️  Revenue 테이블에서 Coupang 항목 삭제: {len(coupang_revs)}건")

        print(f"\n🎉 완료: 총 {total}건 쿠팡이츠 일별 데이터 생성")


if __name__ == "__main__":
    main()
