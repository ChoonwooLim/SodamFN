"""
2026년 4월 급여 정합성 조정 스크립트

처리 내역:
1. 소담김밥과 무관한 6명(퇴사/타매장)의 4월 Payroll 레코드 삭제
2. 세무사 PDF 4명(김금순/정명주/정수현/김순복)의 공제 항목을 세무사 수치로 덮어쓰기
3. CLAUDE.md 급여 규칙 준수:
   - 세금대납 직원(김금순): total_pay = gross + bonus_tax_support (총 보상액)
   - 일반 직원: total_pay = gross - deductions (실수령액)
4. P/L 4월 재동기화

실행: python scripts/maintenance/adjust_apr_to_accountant.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from sqlmodel import Session, select
from database import engine
from models import Staff, Payroll
from services.profit_loss_service import sync_labor_cost

# 세무사 4월 수치: name -> (np, hi, ei, lti, it, lit)
TAX_ACCOUNTANT_APR = {
    '김금순':  (142500, 131040, 0,     17170, 114990, 11490),
    '정명주':  (13300,  111220, 17920, 14530, 12220,  1220),
    '정수현':  (17740,  67140,  3370,  8820,  37650,  3760),
    '김순복':  (0,      60260,  3020,  7910,  17390,  1730),
    '김다은':  (0,      0,      11440, 0,     0,      0),      # 일용직 (PDF 4월 김다은)
}

# 분류 변경 시 staff_id 명시 (현재는 비어있음 — 6명 모두 직원으로 확인됨)
UNRELATED_IDS = []

with Session(engine) as session:
    print("=" * 60)
    print("2026년 4월 급여 정합성 조정")
    print("=" * 60)

    # 1. 무관 6명 Payroll 삭제
    print("\n[1단계] 무관 6명 4월 Payroll 레코드 삭제")
    deleted_count = 0
    for sid in UNRELATED_IDS:
        staff = session.get(Staff, sid)
        nm = staff.name if staff else f"ID={sid}"
        if not staff:
            print(f"  [SKIP] id={sid}: Staff 없음")
            continue
        p = session.exec(select(Payroll).where(
            Payroll.staff_id == sid,
            Payroll.month == '2026-04'
        )).first()
        if not p:
            print(f"  [SKIP] {nm} (id={sid}): 4월 Payroll 없음")
            continue
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        session.delete(p)
        deleted_count += 1
        print(f"  [DEL] {nm} (id={sid}): gross={gross:,} 삭제")
    print(f"  → 총 {deleted_count}건 삭제")

    # 2. 세무사 PDF 4명 공제 조정
    print("\n[2단계] 세무사 4명 공제 항목 조정")
    for name, (np, hi, ei, lti, it, lit) in TAX_ACCOUNTANT_APR.items():
        staff = session.exec(select(Staff).where(Staff.name == name)).first()
        if not staff:
            print(f"  [SKIP] {name}: Staff 없음")
            continue
        p = session.exec(select(Payroll).where(
            Payroll.staff_id == staff.id,
            Payroll.month == '2026-04'
        )).first()
        if not p:
            print(f"  [SKIP] {name}: 4월 Payroll 없음")
            continue

        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)

        # 공제 6종 덮어쓰기
        p.deduction_np = np
        p.deduction_hi = hi
        p.deduction_ei = ei
        p.deduction_lti = lti
        p.deduction_it = it
        p.deduction_lit = lit
        total_ded = np + hi + ei + lti + it + lit
        p.deductions = total_ded

        # CLAUDE.md 규칙 적용
        is_tax_support = getattr(staff, 'tax_support_enabled', False)
        if is_tax_support:
            p.bonus_tax_support = total_ded
            p.total_pay = gross + total_ded  # 총 보상액
            label = "총보상액"
        else:
            p.bonus_tax_support = 0
            p.total_pay = gross - total_ded  # 실수령액
            label = "실수령액"

        session.add(p)
        ins = np + hi + ei + lti
        tax = it + lit
        print(f"  [SET] {name} (id={staff.id}, 세금대납={is_tax_support})")
        print(f"        gross={gross:,} | 보험={ins:,} 세금={tax:,} | 공제계={total_ded:,} | {label}={p.total_pay:,}")

    session.commit()

    # 3. P/L 재동기화
    print("\n[3단계] P/L 4월 재동기화")
    result = sync_labor_cost(2026, 4, session)
    print(f"  → labor_cost = {result:,}")

    # 4. 최종 상태 검증
    print("\n[4단계] 최종 4월 Payroll 상태")
    payrolls = session.exec(select(Payroll).where(Payroll.month == '2026-04').order_by(Payroll.staff_id)).all()
    print(f"  잔여 레코드: {len(payrolls)}건")
    for p in payrolls:
        st = session.get(Staff, p.staff_id)
        nm = st.name if st else f'ID={p.staff_id}'
        gross = (p.base_pay or 0) + (p.bonus_holiday or 0)
        ts = getattr(p, 'bonus_tax_support', 0) or 0
        print(f"  [{p.staff_id}] {nm}: gross={gross:,} ded={p.deductions:,} ts={ts:,} total={p.total_pay:,}")

    print("\n" + "=" * 60)
    print("완료")
    print("=" * 60)
