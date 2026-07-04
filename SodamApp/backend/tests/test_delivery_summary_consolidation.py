import datetime, json, types
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine


def _engine(monkeypatch):
    import models  # noqa: F401
    from routers import revenue
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(eng)
    return eng


def _dr(**kw):
    from models import DeliveryRevenue
    base = dict(business_id=1, year=2026, month=1, total_sales=0, total_fees=0,
                settlement_amount=0, order_count=0, fee_breakdown=None, source="excel")
    base.update(kw)
    return DeliveryRevenue(**base)


def test_prefers_real_excel_over_english_estimate():
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="Coupang", total_sales=6_055_000, total_fees=1_695_400,
            settlement_amount=4_359_600, order_count=275, source="excel"),
        _dr(channel="쿠팡이츠", total_sales=15_126_500, total_fees=10_425_375,
            settlement_amount=5_576_282, order_count=761, source="auto_coupang_excel"),
    ]
    out = _consolidate_delivery(rows, de_sales={})
    ch = out["2026-01"]["channels"]["쿠팡"]
    assert ch["total_sales"] == 15_126_500      # 진짜 엑셀(총비용) 우선
    assert ch["total_fees"] == 10_425_375
    assert ch["fee_rate"] == 68.9


def test_deterministic_regardless_of_order():
    from routers.revenue import _consolidate_delivery
    a = _dr(channel="쿠팡이츠", total_sales=100, total_fees=58, source="auto_coupang_excel")
    b = _dr(channel="Coupang", total_sales=90, total_fees=25, source="excel")
    out1 = _consolidate_delivery([a, b], de_sales={})
    out2 = _consolidate_delivery([b, a], de_sales={})
    assert out1 == out2                          # 입력 순서 무관


def test_settlement_only_bank_sync_keeps_settlement():
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="Yogiyo", total_sales=3_460_000, total_fees=968_800,
            settlement_amount=2_491_200, order_count=157, source="excel"),
        _dr(channel="요기요", total_sales=0, total_fees=0,
            settlement_amount=334_074, source="bank_sync"),
    ]
    out = _consolidate_delivery(rows, de_sales={})
    ch = out["2026-01"]["channels"]["요기요"]
    assert ch["total_sales"] == 3_460_000        # 매출 있는 레코드 대표
    assert ch["settlement_amount"] == 2_491_200  # 정산 non-zero 최댓값


def test_dailyexpense_fallback_when_no_dr_sales():
    from routers.revenue import _consolidate_delivery
    rows = [_dr(channel="쿠팡이츠", total_sales=0, total_fees=0,
                settlement_amount=500_000, source="bank_sync")]
    out = _consolidate_delivery(rows, de_sales={(2026, 1, "쿠팡"): 900_000})
    ch = out["2026-01"]["channels"]["쿠팡"]
    assert ch["total_sales"] == 900_000          # DR 매출 0 → DailyExpense fallback


def test_endpoint_consistent_and_total_cost(monkeypatch):
    from routers import revenue
    from models import DeliveryRevenue
    eng = _engine(monkeypatch)
    with Session(eng) as s:
        s.add(_dr(channel="Coupang", total_sales=6_528_000, total_fees=1_827_840,
                  settlement_amount=4_700_160, order_count=297, month=5, source="excel"))
        s.add(_dr(channel="쿠팡이츠", total_sales=9_343_800, total_fees=5_458_607,
                  settlement_amount=4_961_538, order_count=448, month=5,
                  source="auto_coupang_excel",
                  fee_breakdown='{"배달비":1523200,"멤버십":2596962}'))
        s.commit()
    admin = types.SimpleNamespace(business_id=1, role="admin")
    with Session(eng) as sess:
        res = revenue.get_delivery_summary(year=2026, _admin=admin, bid=1, session=sess)
    may = next(m for m in res["monthly"] if m["month"] == 5)
    coupang = may["channels"]["쿠팡"]
    assert coupang["total_sales"] == 9_343_800    # 진짜 엑셀
    assert coupang["fee_rate"] == 58.4            # 총비용
    assert "멤버십" in coupang["fee_breakdown"]


def test_settlement_prefers_excel_over_inflated_bank_sync():
    """bank_sync 정산액은 과거 중복적재 누적으로 부풀 수 있음 — 엑셀(명세서) 정산 우선."""
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="요기요", total_sales=1_386_000, total_fees=591_029,
            settlement_amount=794_971, source="excel", month=4),
        _dr(channel="요기요", total_sales=0, total_fees=0,
            settlement_amount=2_420_274, source="bank_sync", month=4),  # 3중 누적 부풀림
    ]
    out = _consolidate_delivery(rows, de_sales={})
    ch = out["2026-04"]["channels"]["요기요"]
    assert ch["settlement_amount"] == 794_971    # 명세서 정산이 진실


def test_settlement_falls_back_to_bank_sync_when_no_excel():
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="요기요", total_sales=0, total_fees=0,
            settlement_amount=590_518, source="bank_sync", month=6),
    ]
    out = _consolidate_delivery(rows, de_sales={})
    assert out["2026-06"]["channels"]["요기요"]["settlement_amount"] == 590_518
