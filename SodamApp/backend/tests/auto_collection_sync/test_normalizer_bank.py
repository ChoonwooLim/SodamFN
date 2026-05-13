import datetime
from models import Business, BankTransaction, BankAccount

def _seed_bank_tx(session, business_id, account_id, trans_date, in_amount=0, out_amount=0,
                  classified_as=None, remark1="", tid=None, vendor_id=None):
    tx = BankTransaction(
        business_id=business_id, account_id=account_id,
        trans_date=trans_date, in_amount=in_amount, out_amount=out_amount,
        classified_as=classified_as, remark1=remark1,
        vendor_id=vendor_id,
        tid=tid or f"test:{trans_date}:{in_amount}:{out_amount}",
    )
    session.add(tx); session.commit(); return tx


def test_classified_revenue_emits_revenue_event(session):
    """은행에서 'revenue' 로 분류된 입금이 revenue SyncEvent 로 변환됨."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="110-***-1234")
    session.add(acc); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   in_amount=500_000, classified_as="revenue", remark1="개인")

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    rev_events = [e for e in events if e.event_type == "revenue"]
    assert len(rev_events) == 1
    assert rev_events[0].amount == 500_000
    assert rev_events[0].source == "auto_bank"
    assert rev_events[0].vendor_lookup_key == "store"
    assert rev_events[0].payment_method == "Bank"


def test_classified_cash_revenue_uses_cash_payment_method(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   in_amount=200_000, classified_as="cash_revenue", remark1="현금매출")

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 1
    assert events[0].payment_method == "Cash"


def test_classified_expense_with_vendor_id_emits_expense(session):
    from models import Vendor
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc)
    v = Vendor(id=99, business_id=1, name="농산물 매입", category="material", vendor_type="expense")
    session.add(v); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   out_amount=150_000, classified_as="expense", vendor_id=99)

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 1
    assert events[0].event_type == "expense"
    assert events[0].amount == -150_000
    assert events[0].vendor_lookup_key == "_existing_vendor:99"


def test_classified_expense_without_vendor_id_is_skipped(session):
    """vendor 매칭 안된 expense 는 emit 안 됨."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   out_amount=100_000, classified_as="expense", vendor_id=None)

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 0


def test_classified_card_pay_delivery_not_emitted(session):
    """card/pay/delivery 는 별도 테이블이 처리하므로 emit 안 됨."""
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    for cls in ("card", "pay", "delivery"):
        _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                       in_amount=100_000, classified_as=cls,
                       tid=f"t-{cls}")

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 0


def test_unclassified_tx_not_emitted(session):
    session.add(Business(id=1, name="X"))
    acc = BankAccount(id=10, business_id=1, bank_code="088", bank_name="신한",
                       account_number="x")
    session.add(acc); session.commit()
    _seed_bank_tx(session, 1, 10, datetime.date(2026, 5, 13),
                   in_amount=100_000, classified_as=None)

    from services.auto_collection_sync.normalizers.bank import normalize_bank
    events = list(normalize_bank(session, 1, datetime.date(2026, 5, 13), datetime.date(2026, 5, 13)))
    assert len(events) == 0
