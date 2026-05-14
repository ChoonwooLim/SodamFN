"""
2026-04 잘못 삭제된 6명 Payroll 긴급 복구 스크립트

배경:
- adjust_apr_to_accountant.py 실행 시 사용자 분류 오류로 6명을 무관 처리하여 삭제
- 사용자 정정: 6명 모두 실제 소담김밥 직원
- 처음 DB 조회에서 캡처한 합계값으로 복원

복원 데이터 (조회 시점 보존):
- [13] 린:    base=176,000   hol=0       ded=1,580   total=174,420
- [14] 김다은: base=1,089,000 hol=198,000 ded=11,580  total=1,275,420
              (np=0 hi=0 ei=11,580 lti=0 it=0 lit=0)
- [16] 정수미: base=1,573,000 hol=290,400 ded=61,490  total=1,801,910
- [27] 반정옥: base=572,000   hol=88,000  ded=21,780  total=638,220
- [29] 황윤선: base=1,298,000 hol=108,900 ded=46,420  total=1,360,480
- [30] 고아라: base=198,000   hol=0       ded=6,530   total=191,470

주의: 항목별 deduction (np/hi/ei/lti/it/lit)은 김다은 외 5명은 분실됨 → 0으로 복원.
      별도로 시스템 재계산 또는 사장님 검토 필요.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from database import engine
from models import Staff, Payroll
from services.profit_loss_service import sync_labor_cost

# (staff_id, base_pay, bonus_holiday, deductions, total_pay, deduction_dict)
RESTORE_DATA = [
    (13, 176000,   0,      1580,  174420,   {}),
    (14, 1089000,  198000, 11580, 1275420,  {'np': 0, 'hi': 0, 'ei': 11580, 'lti': 0, 'it': 0, 'lit': 0}),
    (16, 1573000,  290400, 61490, 1801910,  {}),
    (27, 572000,   88000,  21780, 638220,   {}),
    (29, 1298000,  108900, 46420, 1360480,  {}),
    (30, 198000,   0,      6530,  191470,   {}),
]

with Session(engine) as session:
    print("=" * 60)
    print("2026-04 6명 Payroll 긴급 복구")
    print("=" * 60)

    restored = 0
    for sid, base, hol, ded, total, ded_dict in RESTORE_DATA:
        staff = session.get(Staff, sid)
        nm = staff.name if staff else f"ID={sid}"

        # 이미 복원되어 있는지 체크
        existing = session.exec(select(Payroll).where(
            Payroll.staff_id == sid,
            Payroll.month == '2026-04'
        )).first()
        if existing:
            print(f"  [SKIP] {nm} (id={sid}): 이미 4월 Payroll 존재 — 건드리지 않음")
            continue

        # business_id 필수 — staff.business_id 우선, 없으면 소담김밥(=1) 기본값.
        # Why: 멀티테넌트 P/L sync 시 business_id=NULL 인 Payroll 은 사업장 화면에서
        #      bid 필터에 걸려 인건비가 누락되는 버그가 있었음 (2026-04 사고).
        biz_id = (staff.business_id if staff and getattr(staff, 'business_id', None) else 1)
        p = Payroll(
            staff_id=sid,
            month='2026-04',
            business_id=biz_id,
            base_pay=base,
            bonus_holiday=hol,
            bonus_special=0,
            bonus_tax_support=0,
            deductions=ded,
            total_pay=total,
            deduction_np=ded_dict.get('np', 0),
            deduction_hi=ded_dict.get('hi', 0),
            deduction_ei=ded_dict.get('ei', 0),
            deduction_lti=ded_dict.get('lti', 0),
            deduction_it=ded_dict.get('it', 0),
            deduction_lit=ded_dict.get('lit', 0),
        )
        session.add(p)
        restored += 1
        gross = base + hol
        print(f"  [INS] {nm} (id={sid}): base={base:,} hol={hol:,} gross={gross:,} ded={ded:,} total={total:,}")

    session.commit()
    print(f"\n  → 총 {restored}건 복구")

    # P/L 재동기화
    print("\n[P/L 재동기화]")
    result = sync_labor_cost(2026, 4, session)
    print(f"  → labor_cost = {result:,}")

    # 검증
    print("\n[검증] 4월 Payroll 잔여 레코드")
    payrolls = session.exec(select(Payroll).where(Payroll.month == '2026-04').order_by(Payroll.staff_id)).all()
    print(f"  총 {len(payrolls)}건")
    for p in payrolls:
        st = session.get(Staff, p.staff_id)
        nm = st.name if st else f'ID={p.staff_id}'
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        ts = getattr(p, 'bonus_tax_support', 0) or 0
        flag = ' ★복구' if p.staff_id in [13, 14, 16, 27, 29, 30] else ''
        print(f"  [{p.staff_id}] {nm}: gross={gross:,} ded={p.deductions:,} ts={ts:,} total={p.total_pay:,}{flag}")

    print("\n" + "=" * 60)
    print("복구 완료")
    print("=" * 60)
