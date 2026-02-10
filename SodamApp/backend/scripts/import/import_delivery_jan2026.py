"""
Import delivery revenue data for 땡겨요, 배민, 요기요 into DB as DailyExpense entries.
"""
import sys, os, datetime, importlib.util
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense

# Load parsers from sibling script using importlib (can't use normal import due to 'import' dir name)
spec = importlib.util.spec_from_file_location(
    "import_delivery_daily",
    os.path.join(os.path.dirname(__file__), "import_delivery_daily.py")
)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

parse_baemin_daily = mod.parse_baemin_daily
parse_yogiyo_daily = mod.parse_yogiyo_daily
parse_ddangyo_daily = mod.parse_ddangyo_daily

BASE_DIR = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"

# Vendor IDs from current DB
VENDOR_MAP = {
    "배민": 1966,   # 소담김밥 건대본점 배달의민족
    "땡겨요": 1968, # 소담김밥 건대본점 땡겨요
    "요기요": 1969, # 소담김밥 건대본점 요기요
}

def save_daily(session, vendor, daily_data):
    count = 0
    for dt in sorted(daily_data.keys()):
        d = daily_data[dt]
        if d["settlement"] == 0 and d["sales"] == 0:
            continue
        note = f"매출:{d['sales']:,} / 수수료:{d['fees']:,} / 주문:{max(0, d['orders'])}건"
        existing = session.exec(
            select(DailyExpense).where(
                DailyExpense.date == dt,
                DailyExpense.vendor_id == vendor.id,
            )
        ).first()
        if existing:
            existing.amount = d["settlement"]
            existing.note = note
            session.add(existing)
        else:
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
    return count


def main():
    with Session(engine) as session:
        total = 0
        for channel, vid in VENDOR_MAP.items():
            vendor = session.get(Vendor, vid)
            if not vendor:
                print(f"❌ Vendor id={vid} ({channel}) not found!")
                continue
            print(f"\n{'='*60}")
            print(f"📦 {channel} (vendor: {vendor.name}, id={vendor.id})")
            print(f"{'='*60}")

            channel_dir = os.path.join(BASE_DIR, channel)
            if not os.path.exists(channel_dir):
                print(f"  ❌ Directory not found: {channel_dir}")
                continue

            for fname in sorted(os.listdir(channel_dir)):
                if not fname.endswith(('.xlsx', '.xls')):
                    continue
                fpath = os.path.join(channel_dir, fname)
                print(f"\n  📄 {fname}")
                try:
                    if channel == "배민":
                        daily = parse_baemin_daily(fpath)
                    elif channel == "요기요":
                        daily = parse_yogiyo_daily(fpath)
                    elif channel == "땡겨요":
                        daily = parse_ddangyo_daily(fpath)
                    else:
                        continue
                    if daily:
                        count = save_daily(session, vendor, daily)
                        total += count
                        print(f"  ✅ {count}건 저장")
                    else:
                        print(f"  ⚠️ No daily data parsed")
                except Exception as e:
                    print(f"  ❌ Error: {e}")
                    import traceback
                    traceback.print_exc()
        session.commit()
        print(f"\n🎉 완료: 총 {total}건 일별 데이터 생성/업데이트")


if __name__ == "__main__":
    main()
