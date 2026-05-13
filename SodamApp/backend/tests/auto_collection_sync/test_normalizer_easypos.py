import datetime
from models import Business, EasyPosSaleReceipt, CardSalesApproval


def _seed_receipt(session, business_id, sale_date, cash=0, card=0, point=0):
    r = EasyPosSaleReceipt(
        business_id=business_id, sale_date=sale_date,
        pos_no="1", receipt_no="R1",
        total_amount=cash + card + point, net_amount=cash + card + point,
        cash_amount=cash, card_amount=card, point_amount=point,
    )
    session.add(r)
    session.commit()
    return r


def _seed_card_approval(session, business_id, day, corp, amount,
                       approval_no, status="승인"):
    session.add(CardSalesApproval(
        business_id=business_id, approval_date=day,
        card_corp=corp, approval_number=approval_no,
        amount=amount, status=status, source="easypos",
    ))
    session.commit()


def test_normalizer_splits_payment_methods(session):
    """CardSalesApproval 미존재 — Card 는 receipts 합계 단일 행 (fallback)."""
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000, point=42_000)
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    by_pm: dict[str, list] = {}
    for e in events:
        by_pm.setdefault(e.payment_method, []).append(e)
    assert sum(e.amount for e in by_pm["Cash"]) == 350_000
    assert sum(e.amount for e in by_pm["Card"]) == 2_100_000
    assert sum(e.amount for e in by_pm["Point"]) == 42_000
    assert all(e.event_type == "revenue" and e.source == "auto_easypos" for e in events)


def test_normalizer_skips_zero_methods(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000)  # only cash
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    pms = {e.payment_method for e in events}
    assert pms == {"Cash"}


def test_easypos_to_dailyexpense_end_to_end(session):
    """normalize_easypos → fan_out.apply → DailyExpense 행 생성."""
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense
    from sqlmodel import select
    session.add(Business(id=1, name="X"))
    session.commit()
    _seed_receipt(session, 1, datetime.date(2026, 5, 13), cash=350_000, card=2_100_000)
    events = list(normalize_easypos(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    apply(session, 1, events)
    rows = session.exec(select(DailyExpense)).all()
    by_pm = {r.payment_method: r for r in rows}
    assert by_pm["Cash"].amount == 350_000
    assert by_pm["Card"].amount == 2_100_000


def test_card_splits_per_corp_when_approvals_present(session):
    """CardSalesApproval 이 있는 일자는 카드사별로 SyncEvent 가 emit."""
    session.add(Business(id=1, name="X"))
    session.commit()
    day = datetime.date(2026, 5, 13)
    _seed_receipt(session, 1, day, cash=0, card=10_000)  # 카드 receipts (fallback 차단용)
    _seed_card_approval(session, 1, day, "신한", 3_000, "A1")
    _seed_card_approval(session, 1, day, "신한", 2_500, "A2")
    _seed_card_approval(session, 1, day, "KB국민", 4_500, "B1")

    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = [e for e in normalize_easypos(session, 1, day, day)
              if e.payment_method == "Card"]
    by_key = {e.vendor_lookup_key: e for e in events}
    assert by_key["store_card:신한"].amount == 5_500
    assert by_key["store_card:KB국민"].amount == 4_500
    # 단일 fallback "store" 행은 없어야 함
    assert "store" not in by_key


def test_card_falls_back_to_receipts_when_no_approvals(session):
    """CardSalesApproval 미수집 일자 — 기존 단일 행 fallback 유지."""
    session.add(Business(id=1, name="X"))
    session.commit()
    day = datetime.date(2026, 5, 13)
    _seed_receipt(session, 1, day, card=1_234_000)

    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = [e for e in normalize_easypos(session, 1, day, day)
              if e.payment_method == "Card"]
    assert len(events) == 1
    assert events[0].vendor_lookup_key == "store"
    assert events[0].amount == 1_234_000


def test_card_cancellation_nets_out(session):
    """취소 (status='취소') 행은 net 에서 차감."""
    session.add(Business(id=1, name="X"))
    session.commit()
    day = datetime.date(2026, 5, 13)
    _seed_receipt(session, 1, day, card=10_000)
    _seed_card_approval(session, 1, day, "신한", 10_000, "A1", status="승인")
    _seed_card_approval(session, 1, day, "신한", 3_000, "A2", status="취소")

    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    events = [e for e in normalize_easypos(session, 1, day, day)
              if e.payment_method == "Card"]
    by_key = {e.vendor_lookup_key: e for e in events}
    assert by_key["store_card:신한"].amount == 7_000


def test_card_per_corp_end_to_end_creates_separate_vendors(session):
    """fan_out 까지 거치면 카드사별 Vendor / DailyExpense 가 생성."""
    from services.auto_collection_sync.normalizers.easypos import normalize_easypos
    from services.auto_collection_sync.fan_out import apply
    from models import DailyExpense, Vendor
    from sqlmodel import select

    session.add(Business(id=1, name="소담김밥"))
    session.commit()
    day = datetime.date(2026, 5, 13)
    _seed_receipt(session, 1, day, cash=100, card=10_000)
    _seed_card_approval(session, 1, day, "신한", 5_500, "A1")
    _seed_card_approval(session, 1, day, "BC", 4_500, "B1")

    events = list(normalize_easypos(session, 1, day, day))
    apply(session, 1, events)

    rows = session.exec(
        select(DailyExpense).where(DailyExpense.payment_method == "Card")
    ).all()
    by_vendor = {r.vendor_name: r.amount for r in rows}
    assert by_vendor["매장 (소담김밥) - 신한카드"] == 5_500
    assert by_vendor["매장 (소담김밥) - BC카드"] == 4_500

    vendors = session.exec(
        select(Vendor).where(Vendor.name.like("매장 (소담김밥) - %카드"))
    ).all()
    assert {v.name for v in vendors} == {
        "매장 (소담김밥) - 신한카드",
        "매장 (소담김밥) - BC카드",
    }
