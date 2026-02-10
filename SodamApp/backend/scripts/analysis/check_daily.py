"""Quick check of daily delivery data."""
from database import engine
from sqlmodel import Session, text

with Session(engine) as s:
    result = s.exec(text(
        "SELECT date, vendor_name, amount, note FROM dailyexpense "
        "WHERE category='delivery' AND date BETWEEN '2026-01-01' AND '2026-01-31' "
        "ORDER BY vendor_name, date LIMIT 15"
    )).all()
    print("Jan 2026 delivery entries (first 15):")
    for r in result:
        note_short = str(r[3])[:40] if r[3] else ''
        print(f"  {r[0]}  {r[1]:35s}  {int(r[2]):>10,}  {note_short}")
    
    cnt = s.exec(text(
        "SELECT count(*) FROM dailyexpense "
        "WHERE category='delivery' AND date BETWEEN '2026-01-01' AND '2026-01-31'"
    )).one()
    print(f"\nTotal Jan 2026 delivery entries: {cnt}")

    # Also check total amounts by vendor for Jan 2026
    result2 = s.exec(text(
        "SELECT vendor_name, count(*), sum(amount) FROM dailyexpense "
        "WHERE category='delivery' AND date BETWEEN '2026-01-01' AND '2026-01-31' "
        "GROUP BY vendor_name ORDER BY vendor_name"
    )).all()
    print("\nJan 2026 by vendor:")
    for r in result2:
        print(f"  {r[0]:35s}  {int(r[1]):3d}건  {int(r[2]):>12,}원")
