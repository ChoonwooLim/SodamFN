def test_sync_event_revenue_positive():
    from services.auto_collection_sync.sync_event import SyncEvent
    import datetime
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="revenue", vendor_lookup_key="store",
        payment_method="Card", amount=2_100_000,
        source="auto_easypos", source_ref="easypos:1:2026-05-13",
        raw_payload={"receipt_count": 312},
    )
    assert ev.amount > 0
    assert ev.event_type == "revenue"

def test_sync_event_expense_negative():
    from services.auto_collection_sync.sync_event import SyncEvent
    import datetime
    ev = SyncEvent(
        business_id=1, date=datetime.date(2026, 5, 13),
        event_type="expense", vendor_lookup_key="coupang_eats_fee_brokerage",
        payment_method="Delivery", amount=-44_000,
        source="auto_coupang", source_ref="coupang_settle:99:fee_brokerage",
        raw_payload={"settlement_id": 99},
    )
    assert ev.amount < 0
