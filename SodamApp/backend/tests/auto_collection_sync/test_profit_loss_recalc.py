"""Task 10 fix: recalc_all_businesses 실제 구현 검증.

stub 이 아닌 실제 per-business helper wrap 인지, 활성 사업장만 enumerate 하는지,
errors 가 발생해도 throw 없이 counts 에 누적되는지 확인.
"""
from models import Business


def test_recalc_all_businesses_returns_counts(session):
    """active 사업장만 enumerate. months_recomputed + errors == active × 2."""
    session.add(Business(id=1, name="X", subscription_status="active"))
    session.add(Business(id=2, name="Y", subscription_status="active"))
    session.add(Business(id=3, name="Z", subscription_status="cancelled"))  # skip
    session.commit()

    from services.profit_loss_service import recalc_all_businesses
    result = recalc_all_businesses(session)

    assert result["business_count"] == 2  # active 만
    # 2 사업장 × 2 개월 (이번달 + 지난달) = 4
    assert result["months_recomputed"] + result["errors"] == 4
    # status stub 가 아닌 실제 counts dict 인지 검증
    assert "status" not in result or result.get("status") != "stub"


def test_recalc_all_businesses_zero_active(session):
    """활성 사업장 없으면 business_count=0, months_recomputed=0."""
    session.add(Business(id=1, name="X", subscription_status="cancelled"))
    session.commit()

    from services.profit_loss_service import recalc_all_businesses
    result = recalc_all_businesses(session)

    assert result["business_count"] == 0
    assert result["months_recomputed"] == 0
    assert result["errors"] == 0


def test_delivery_zero_placeholder_does_not_override_dailyexpense(session):
    """DeliveryRevenue total_sales=0 placeholder 행이 DailyExpense 합계를 0 으로 덮으면 안 됨.

    재현: biz=1 의 2026-04 쿠팡 매출이 DailyExpense (auto_coupang vendor) 에 5.9M 인데,
    DeliveryRevenue 에 total_sales=0 placeholder 행이 있으면 sync_delivery_revenue_to_pl 가
    P/L revenue_coupang 을 0 으로 덮어쓰던 버그.
    """
    import datetime
    from models import Business, Vendor, DailyExpense, DeliveryRevenue, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_delivery_revenue_to_pl

    session.add(Business(id=1, name="X"))
    session.commit()
    vendor = Vendor(id=10, business_id=1, name="쿠팡이츠",
                    vendor_type="revenue", category="delivery")
    session.add(vendor)
    session.commit()

    # DailyExpense 자동수집 매출 (4월 5,900,000)
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=vendor.id, vendor_name="쿠팡이츠",
        amount=5_900_000, category="delivery", payment_method="Card",
        source="auto_coupang",
    ))
    # DeliveryRevenue placeholder (total_sales=0) — 자동수집/엑셀 업로드 안 한 상태
    session.add(DeliveryRevenue(
        business_id=1, year=2026, month=4, channel="쿠팡이츠",
        total_sales=0, total_fees=0, order_count=0,
    ))
    session.commit()

    sync_delivery_revenue_to_pl(2026, 4, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026,
            MonthlyProfitLoss.month == 4,
        )
    ).first()
    assert pl is not None
    assert pl.revenue_coupang == 5_900_000, "placeholder 가 DailyExpense 합계를 덮으면 안 됨"


def test_delivery_active_row_overrides_dailyexpense(session):
    """DeliveryRevenue.total_sales > 0 인 경우는 override 정상 동작 (회귀 방지)."""
    import datetime
    from models import Business, Vendor, DailyExpense, DeliveryRevenue, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_delivery_revenue_to_pl

    session.add(Business(id=1, name="X"))
    session.commit()
    vendor = Vendor(id=10, business_id=1, name="쿠팡이츠",
                    vendor_type="revenue", category="delivery")
    session.add(vendor)
    session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=vendor.id, vendor_name="쿠팡이츠",
        amount=5_900_000, category="delivery", payment_method="Card",
        source="auto_coupang",
    ))
    # 사장님이 실제 정산서 업로드 → total_sales 채워짐 → override 적용
    session.add(DeliveryRevenue(
        business_id=1, year=2026, month=4, channel="쿠팡이츠",
        total_sales=7_500_000, total_fees=900_000, order_count=300,
    ))
    session.commit()

    sync_delivery_revenue_to_pl(2026, 4, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026,
            MonthlyProfitLoss.month == 4,
        )
    ).first()
    assert pl.revenue_coupang == 7_500_000
    assert pl.expense_delivery_fee == 900_000


def test_accrual_year_month_rent_pushed_to_prev_when_last_day_is_holiday():
    """전월 말일이 토/일/공휴일이면 익월 1~4일 임차료 이체는 전월 귀속."""
    import datetime
    from services.profit_loss_service import _accrual_year_month
    # 2026-04-30 (목) 영업일 → 5/2 이체는 5월 귀속 (전월 영업일이므로)
    assert _accrual_year_month(datetime.date(2026, 5, 2), "임차료") == (2026, 5)
    # 2026-05-31 (일) 비영업일 → 6/1~6/4 이체는 5월 귀속
    assert _accrual_year_month(datetime.date(2026, 6, 1), "임차료") == (2026, 5)
    assert _accrual_year_month(datetime.date(2026, 6, 2), "임차료") == (2026, 5)
    assert _accrual_year_month(datetime.date(2026, 6, 4), "임차료") == (2026, 5)
    # 5일 이후는 발생월 귀속
    assert _accrual_year_month(datetime.date(2026, 6, 5), "임차료") == (2026, 6)


def test_accrual_year_month_non_accrual_category_unchanged():
    """ACCRUAL_CATEGORIES 외 카테고리는 발생주의 미적용."""
    import datetime
    from services.profit_loss_service import _accrual_year_month
    assert _accrual_year_month(datetime.date(2026, 6, 2), "원재료비") == (2026, 6)
    assert _accrual_year_month(datetime.date(2026, 6, 2), None) == (2026, 6)


def test_sync_all_expenses_accrual_rent_pulls_next_month_payment(session):
    """5월말 일요일 → 6/2 임차료 이체된 행이 5월 P/L 에 잡혀야 함."""
    import datetime
    from models import Business, Vendor, DailyExpense, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_all_expenses

    session.add(Business(id=1, name="X"))
    session.commit()
    vendor = Vendor(id=10, business_id=1, name="임대인",
                    vendor_type="expense", category="임차료")
    session.add(vendor)
    session.commit()
    # 6/2 (5/31 일요일이라 휴일 미뤄짐 케이스) 임차료 5,000,000 이체
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 6, 2),
        vendor_id=vendor.id, vendor_name="임대인",
        amount=5_000_000, category="임차료", payment_method="Card",
        source="manual",
    ))
    session.commit()

    sync_all_expenses(2026, 5, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026,
            MonthlyProfitLoss.month == 5,
        )
    ).first()
    assert pl is not None
    assert pl.expense_rent == 5_000_000


def test_sync_all_expenses_accrual_rent_excluded_from_actual_month(session):
    """위 케이스에서 6월 P/L 에는 임차료가 잡히지 않아야 함 (중복 방지)."""
    import datetime
    from models import Business, Vendor, DailyExpense, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_all_expenses

    session.add(Business(id=1, name="X"))
    session.commit()
    vendor = Vendor(id=10, business_id=1, name="임대인",
                    vendor_type="expense", category="임차료")
    session.add(vendor)
    session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 6, 2),
        vendor_id=vendor.id, vendor_name="임대인",
        amount=5_000_000, category="임차료", payment_method="Card",
        source="manual",
    ))
    session.commit()

    sync_all_expenses(2026, 6, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026,
            MonthlyProfitLoss.month == 6,
        )
    ).first()
    # 행이 생성되지 않거나, expense_rent=0
    assert pl is None or pl.expense_rent == 0


def test_sync_labor_only_counts_completed_transfers(session):
    """transfer_status='완료' 인 Payroll 만 인건비 카운트."""
    from models import Business, Payroll, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_labor_cost

    session.add(Business(id=1, name="X"))
    session.commit()
    # 완료된 직원 — 인건비에 포함
    session.add(Payroll(
        staff_id=1, business_id=1, month="2026-04",
        base_pay=3_000_000, bonus_holiday=0,
        deduction_np=135_000, deduction_hi=106_000, deduction_lti=13_500,
        deduction_ei=27_000, deduction_it=84_000, deduction_lit=8_400,
        transfer_status="완료",
    ))
    # 미지급 직원 — 제외
    session.add(Payroll(
        staff_id=2, business_id=1, month="2026-04",
        base_pay=2_000_000, bonus_holiday=0,
        transfer_status="대기",
    ))
    session.commit()
    sync_labor_cost(2026, 4, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026, MonthlyProfitLoss.month == 4,
        )
    ).first()
    # 직원 A 실수령액 = 3,000,000 - (135+106+13.5+27+84+8.4)k = 3,000,000 - 373,900 = 2,626,100
    assert pl.expense_labor == 2_626_100


def test_sync_labor_tax_support_employee_uses_gross(session):
    """세금대납 직원은 gross (공제 안 함) — 실제 통장 송금액과 일치."""
    from models import Business, Payroll, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_labor_cost

    session.add(Business(id=1, name="X"))
    session.commit()
    # 김금순 가정: gross 3.4M, 공제 391,950, bonus_tax_support 391,950
    session.add(Payroll(
        staff_id=1, business_id=1, month="2026-03",
        base_pay=3_400_000, bonus_holiday=0,
        deduction_np=153_000, deduction_hi=120_000, deduction_lti=15_000,
        deduction_ei=30_600, deduction_it=63_000, deduction_lit=6_300,
        bonus_tax_support=387_900,
        transfer_status="완료",
    ))
    session.commit()
    sync_labor_cost(2026, 3, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(MonthlyProfitLoss.business_id == 1,
                                         MonthlyProfitLoss.year == 2026,
                                         MonthlyProfitLoss.month == 3)
    ).first()
    # 세금대납 직원: 송금 = gross = 3,400,000 (공제 안 함)
    assert pl.expense_labor == 3_400_000
    # 사업주 부담 4대보험 (= 직원 공제 합) 은 별도 행
    assert pl.expense_insurance == 153_000 + 120_000 + 15_000 + 30_600
    # 직원 명의 세금 (= 회사가 대납) 은 별도 행
    assert pl.expense_tax_employee == 63_000 + 6_300


def test_delivery_revenue_other_business_does_not_leak(session):
    """다른 비즈의 DeliveryRevenue 가 내 P/L 을 덮어쓰면 안 됨 (business_id 필터)."""
    import datetime
    from models import Business, Vendor, DailyExpense, DeliveryRevenue, MonthlyProfitLoss
    from sqlmodel import select
    from services.profit_loss_service import sync_delivery_revenue_to_pl

    session.add(Business(id=1, name="A"))
    session.add(Business(id=2, name="B"))
    session.commit()
    vendor = Vendor(id=10, business_id=1, name="쿠팡이츠",
                    vendor_type="revenue", category="delivery")
    session.add(vendor)
    session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=vendor.id, vendor_name="쿠팡이츠",
        amount=5_900_000, category="delivery", payment_method="Card",
        source="auto_coupang",
    ))
    # biz=2 의 DeliveryRevenue (placeholder) — biz=1 P/L 에 영향 X
    session.add(DeliveryRevenue(
        business_id=2, year=2026, month=4, channel="쿠팡이츠",
        total_sales=0, total_fees=0, order_count=0,
    ))
    session.commit()

    sync_delivery_revenue_to_pl(2026, 4, session, business_id=1)
    pl = session.exec(
        select(MonthlyProfitLoss).where(
            MonthlyProfitLoss.business_id == 1,
            MonthlyProfitLoss.year == 2026,
            MonthlyProfitLoss.month == 4,
        )
    ).first()
    assert pl.revenue_coupang == 5_900_000
