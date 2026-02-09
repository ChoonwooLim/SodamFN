"""
Import delivery revenue data as DAILY DailyExpense entries.
Parses Excel files from 배달앱매출 folder, aggregates per-order data by date,
and creates one DailyExpense per vendor per day.

Each DailyExpense.amount = 정산금 (settlement for that day)
Each DailyExpense.note = "매출:X / 수수료:Y / 주문:Z건"
"""
import sys, os, re, warnings, io
from datetime import date, datetime
from collections import defaultdict

import pandas as pd

warnings.filterwarnings("ignore")

sys.path.insert(0, os.path.dirname(__file__))
from database import engine
from sqlmodel import Session, select
from models import DailyExpense, Vendor

BASE_DIR = r"C:\WORK\SodamFN\2026소득분석\매출\배달앱매출"

# Vendor name mapping
VENDOR_NAMES = {
    "쿠팡": "소담김밥 건대매장 쿠팡이츠",
    "배민": "소담김밥 건대매장 배달의민족",
    "요기요": "소담김밥 건대매장 요기요",
    "땡겨요": "소담김밥 건대매장 땡겨요",
}

def safe_int(val):
    if val is None or val == '' or (isinstance(val, float) and pd.isna(val)):
        return 0
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return 0


# ═══════════════════════════════════════════════════════════════
#  쿠팡이츠 — per-order rows, aggregate by date
# ═══════════════════════════════════════════════════════════════
def parse_coupang_daily(filepath):
    """Returns dict: { date_obj: { sales, settlement, fees, orders } }"""
    df = pd.read_excel(filepath, header=None)
    daily = defaultdict(lambda: {"sales": 0, "settlement": 0, "fees": 0, "orders": 0})

    for idx in range(3, len(df)):
        row = df.iloc[idx]
        date_val = row.iloc[0]
        if pd.isna(date_val) or str(date_val).strip() == '':
            continue

        try:
            dt = pd.to_datetime(date_val).date()
        except:
            continue

        tx_type = str(row.iloc[8]) if len(row) > 8 and pd.notna(row.iloc[8]) else ''

        sales = safe_int(row.iloc[9]) if len(row) > 9 else 0
        # 정산금액: col 39 (산정후) or col 37
        if len(row) > 39:
            settlement = safe_int(row.iloc[39])
        elif len(row) > 37:
            settlement = safe_int(row.iloc[37])
        else:
            settlement = 0

        daily[dt]["sales"] += sales
        daily[dt]["settlement"] += settlement

        if tx_type == '결제':
            daily[dt]["orders"] += 1
        elif tx_type == '취소':
            daily[dt]["orders"] -= 1
        else:
            daily[dt]["orders"] += 1

    # Calculate fees
    for dt in daily:
        daily[dt]["fees"] = daily[dt]["sales"] - daily[dt]["settlement"]

    return dict(daily)


# ═══════════════════════════════════════════════════════════════
#  배민 — encrypted xlsx, detail sheet with daily settlement rows
# ═══════════════════════════════════════════════════════════════
def parse_baemin_daily(filepath, password="630730"):
    """Returns dict: { date_obj: { sales, settlement, fees, orders } }"""
    import msoffcrypto, openpyxl

    with open(filepath, 'rb') as f:
        ms = msoffcrypto.OfficeFile(f)
        if ms.is_encrypted():
            ms.load_key(password=password)
            dec = io.BytesIO()
            ms.decrypt(dec)
            dec.seek(0)
            wb = openpyxl.load_workbook(dec, data_only=True)
        else:
            wb = openpyxl.load_workbook(filepath, data_only=True)

    daily = defaultdict(lambda: {"sales": 0, "settlement": 0, "fees": 0, "orders": 0})

    # Find 상세 sheet
    detail_ws = None
    for sn in wb.sheetnames:
        if '상세' in sn:
            detail_ws = wb[sn]
            break

    if not detail_ws:
        return {}

    # Row 3 = category headers, Row 4/5 = sub-headers, Row 6+ = data
    # col 2 = 정산대상기간 (order date), col 3 = 입금금액, col 6 = (A) 주문중개
    for r in range(6, detail_ws.max_row + 1):
        order_date_val = detail_ws.cell(r, 2).value  # 정산대상기간 = order date
        if order_date_val is None:
            continue

        try:
            if isinstance(order_date_val, (datetime, date)):
                dt = order_date_val if isinstance(order_date_val, date) else order_date_val.date()
            else:
                dt_str = str(order_date_val).strip()
                if not re.match(r'\d{4}-\d{2}-\d{2}', dt_str):
                    continue
                dt = datetime.strptime(dt_str[:10], '%Y-%m-%d').date()
        except:
            continue

        sales = safe_int(detail_ws.cell(r, 6).value)       # (A) 주문중개
        settlement = safe_int(detail_ws.cell(r, 3).value)   # 입금금액

        daily[dt]["sales"] += sales
        daily[dt]["settlement"] += settlement
        daily[dt]["orders"] += 1  # each row = 1 settlement period

    for dt in daily:
        daily[dt]["fees"] = daily[dt]["sales"] - daily[dt]["settlement"]

    return dict(daily)


# ═══════════════════════════════════════════════════════════════
#  요기요 — detail sheet with per-order rows
# ═══════════════════════════════════════════════════════════════
def parse_yogiyo_daily(filepath):
    """Returns dict: { date_obj: { sales, settlement, fees, orders } }"""
    xls = pd.ExcelFile(filepath)
    daily = defaultdict(lambda: {"sales": 0, "settlement": 0, "fees": 0, "orders": 0})

    try:
        df = pd.read_excel(xls, sheet_name='상세 거래내역', header=None)
    except:
        return {}

    # Row 2 = headers, Row 3+ = data
    # col 3 = 주문일시, col 6 = 주문금액
    # Fees: cols 11-22 (all deductions)
    # Settlement = 주문금액 - sum(fees)

    for idx in range(3, len(df)):
        row = df.iloc[idx]
        no_val = row.iloc[0]
        if pd.isna(no_val) or str(no_val).strip() == '':
            break

        order_datetime = row.iloc[3]
        if pd.isna(order_datetime):
            continue

        try:
            dt = pd.to_datetime(order_datetime).date()
        except:
            continue

        order_amount = safe_int(row.iloc[6])  # 주문금액

        # Sum all fee columns (11-22): these are deductions
        total_deductions = 0
        for c in range(11, min(23, len(row))):
            val = safe_int(row.iloc[c])
            total_deductions += val  # negative values = deductions, positive = subsidies

        settlement = order_amount + total_deductions  # deductions are negative

        daily[dt]["sales"] += order_amount
        daily[dt]["settlement"] += settlement
        daily[dt]["orders"] += 1

    for dt in daily:
        daily[dt]["fees"] = daily[dt]["sales"] - daily[dt]["settlement"]

    return dict(daily)


# ═══════════════════════════════════════════════════════════════
#  땡겨요 — detail rows with 주문기간 date ranges
# ═══════════════════════════════════════════════════════════════
def parse_ddangyo_daily(filepath):
    """Returns dict: { date_obj: { sales, settlement, fees, orders } }"""
    df = pd.read_excel(filepath, header=None)
    daily = defaultdict(lambda: {"sales": 0, "settlement": 0, "fees": 0, "orders": 0})

    # Find data section (after row ~43 where header '입금(예정)일' appears)
    data_start = None
    for i in range(40, min(55, len(df))):
        cell = str(df.iloc[i, 0]) if i < len(df) and pd.notna(df.iloc[i, 0]) else ''
        if '입금' in cell and '예정' in cell:
            data_start = i + 1
            break

    if not data_start:
        return {}

    # col 5 = 주문기간 (e.g. "2025-12-29~2025-12-29")
    # col 7 = 주문금액(매출), col 15 = 정산금액
    for i in range(data_start, len(df)):
        first_cell = str(df.iloc[i, 0]) if pd.notna(df.iloc[i, 0]) else ''
        if first_cell == '합 계':
            break

        order_period = str(df.iloc[i, 5]) if pd.notna(df.iloc[i, 5]) else ''
        if '~' not in order_period:
            continue

        # Use the first date in the range as the order date
        date_str = order_period.split('~')[0].strip()
        try:
            dt = datetime.strptime(date_str, '%Y-%m-%d').date()
        except:
            continue

        sales = safe_int(df.iloc[i, 7])       # 주문금액
        settlement = safe_int(df.iloc[i, 15])  # 정산금액

        daily[dt]["sales"] += sales
        daily[dt]["settlement"] += settlement
        daily[dt]["orders"] += 1

    for dt in daily:
        daily[dt]["fees"] = daily[dt]["sales"] - daily[dt]["settlement"]

    return dict(daily)


# ═══════════════════════════════════════════════════════════════
#  Main: delete old entries and import daily data
# ═══════════════════════════════════════════════════════════════
def main():
    with Session(engine) as session:
        # Load delivery vendors
        vendors = session.exec(
            select(Vendor).where(Vendor.category == "delivery")
        ).all()
        vendor_by_name = {v.name: v for v in vendors}

        # Delete existing delivery DailyExpense entries
        for v in vendors:
            existing = session.exec(
                select(DailyExpense).where(DailyExpense.vendor_id == v.id)
            ).all()
            for e in existing:
                session.delete(e)
            if existing:
                print(f"🗑️  삭제: {v.name} — {len(existing)}건")
        session.commit()

        created_total = 0

        # ── 쿠팡이츠 ──
        coupang_dir = os.path.join(BASE_DIR, "쿠팡")
        if os.path.exists(coupang_dir):
            for fname in os.listdir(coupang_dir):
                if not fname.endswith(('.xlsx', '.xls')):
                    continue
                fpath = os.path.join(coupang_dir, fname)
                print(f"\n📦 쿠팡이츠: {fname}")
                daily = parse_coupang_daily(fpath)
                vendor = vendor_by_name.get(VENDOR_NAMES["쿠팡"])
                if vendor and daily:
                    count = _save_daily(session, vendor, daily)
                    created_total += count

        # ── 배민 ──
        baemin_dir = os.path.join(BASE_DIR, "배민")
        if os.path.exists(baemin_dir):
            for fname in sorted(os.listdir(baemin_dir)):
                if not fname.endswith(('.xlsx', '.xls')):
                    continue
                fpath = os.path.join(baemin_dir, fname)
                print(f"\n📦 배달의민족: {fname}")
                daily = parse_baemin_daily(fpath)
                vendor = vendor_by_name.get(VENDOR_NAMES["배민"])
                if vendor and daily:
                    count = _save_daily(session, vendor, daily)
                    created_total += count

        # ── 요기요 ──
        yogiyo_dir = os.path.join(BASE_DIR, "요기요")
        if os.path.exists(yogiyo_dir):
            for fname in sorted(os.listdir(yogiyo_dir)):
                if not fname.endswith(('.xlsx', '.xls')):
                    continue
                fpath = os.path.join(yogiyo_dir, fname)
                print(f"\n📦 요기요: {fname}")
                daily = parse_yogiyo_daily(fpath)
                vendor = vendor_by_name.get(VENDOR_NAMES["요기요"])
                if vendor and daily:
                    count = _save_daily(session, vendor, daily)
                    created_total += count

        # ── 땡겨요 ──
        ddangyo_dir = os.path.join(BASE_DIR, "땡겨요")
        if os.path.exists(ddangyo_dir):
            for fname in sorted(os.listdir(ddangyo_dir)):
                if not fname.endswith(('.xlsx', '.xls')):
                    continue
                fpath = os.path.join(ddangyo_dir, fname)
                print(f"\n📦 땡겨요: {fname}")
                daily = parse_ddangyo_daily(fpath)
                vendor = vendor_by_name.get(VENDOR_NAMES["땡겨요"])
                if vendor and daily:
                    count = _save_daily(session, vendor, daily)
                    created_total += count

        session.commit()
        print(f"\n✅ 완료: 총 {created_total}건 일별 데이터 생성")


def _save_daily(session, vendor, daily_data):
    """Save daily data as DailyExpense entries. Returns count created."""
    count = 0
    for dt in sorted(daily_data.keys()):
        d = daily_data[dt]
        if d["settlement"] == 0 and d["sales"] == 0:
            continue

        note = f"매출:{d['sales']:,} / 수수료:{d['fees']:,} / 주문:{max(0, d['orders'])}건"

        # Check for existing entry
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


if __name__ == "__main__":
    main()
