from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select


def _eng():
    import models  # noqa: F401
    e = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(e)
    return e


def _dr(s, **kw):
    from models import DeliveryRevenue
    base = dict(business_id=1, year=2026, month=1, total_sales=0, total_fees=0,
                settlement_amount=0, order_count=0, source="excel")
    base.update(kw)
    row = DeliveryRevenue(**base); s.add(row); return row


def test_deletes_english_only_when_real_exists():
    from scripts.cleanup_fake_delivery_revenue import find_fake_estimates, apply_cleanup
    from models import DeliveryRevenue
    e = _eng()
    with Session(e) as s:
        _dr(s, channel="Coupang", total_sales=6_055_000, total_fees=1_695_400)  # 가짜, 진짜 있음 → 삭제
        _dr(s, channel="쿠팡이츠", total_sales=15_126_500, total_fees=10_425_375, source="auto_coupang_excel")
        _dr(s, channel="Yogiyo", total_sales=3_460_000, total_fees=968_800)     # 가짜, 진짜 없음 → 보존
        s.commit()
        cands = find_fake_estimates(s)
        assert len(cands) == 1
        assert cands[0][0].channel == "Coupang"
        n = apply_cleanup(s, cands); s.commit()
        assert n == 1
        remaining = {r.channel for r in s.exec(select(DeliveryRevenue)).all()}
        assert remaining == {"쿠팡이츠", "Yogiyo"}    # 진짜 없는 Yogiyo 는 보존
