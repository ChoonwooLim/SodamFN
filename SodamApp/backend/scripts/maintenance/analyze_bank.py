"""인건비 금액 재적용"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, text

with Session(engine) as s:
    # expense_labor 업데이트
    s.execute(text(
        "UPDATE monthlyprofitloss SET expense_labor = 17092070 "
        "WHERE year=2026 AND month=1"
    ))
    s.commit()
    
    r = s.exec(text(
        "SELECT expense_labor, expense_retirement FROM monthlyprofitloss "
        "WHERE year=2026 AND month=1"
    ))
    row = r.first()
    print(f"✅ expense_labor: {row[0]:,}원")
    print(f"   expense_retirement: {row[1]:,}원")
