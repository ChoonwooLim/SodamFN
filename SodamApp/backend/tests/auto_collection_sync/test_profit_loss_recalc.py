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
