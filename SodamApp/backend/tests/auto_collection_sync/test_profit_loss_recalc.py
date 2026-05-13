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
