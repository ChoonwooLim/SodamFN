import datetime
from sqlmodel import select
from models import Business, Vendor, DailyExpense


def test_migration_marks_existing_manual_as_overwritten(session):
    session.add(Business(id=1, name="X")); session.commit()
    v = Vendor(business_id=1, name="매장 (X)", category="store", vendor_type="revenue")
    session.add(v); session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=v.id, vendor_name=v.name,
        amount=500_000, payment_method="Cash", source="manual",
    ))
    session.commit()

    from services.auto_collection_sync.migration import migrate_business
    report = migrate_business(session, business_id=1,
                              period_start=datetime.date(2026, 4, 1),
                              period_end=datetime.date(2026, 4, 30),
                              backfill_channels=False)
    row = session.exec(
        select(DailyExpense).where(DailyExpense.date == datetime.date(2026, 4, 15))
    ).first()
    assert row.source == "manual_overwritten"
    assert report.overwritten_count == 1


def test_migration_protects_non_auto_vendors(session):
    """매입/원가/인건비 vendor 의 수동 행은 건드리지 않음."""
    session.add(Business(id=1, name="X")); session.commit()
    v = Vendor(business_id=1, name="농산물 매입", category="material",
               vendor_type="expense")
    session.add(v); session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=v.id, vendor_name=v.name,
        amount=-200_000, payment_method="Cash", source="manual",
    ))
    session.commit()

    from services.auto_collection_sync.migration import migrate_business
    migrate_business(session, business_id=1,
                     period_start=datetime.date(2026, 4, 1),
                     period_end=datetime.date(2026, 4, 30),
                     backfill_channels=False)
    row = session.exec(
        select(DailyExpense).where(DailyExpense.vendor_id == v.id)
    ).first()
    assert row.source == "manual"  # 그대로


def test_migration_preserves_already_overwritten(session):
    """이미 manual_overwritten 인 행은 다시 처리되지 않음 (멱등성)."""
    session.add(Business(id=1, name="X")); session.commit()
    v = Vendor(business_id=1, name="매장 (X)", category="store", vendor_type="revenue")
    session.add(v); session.commit()
    session.add(DailyExpense(
        business_id=1, date=datetime.date(2026, 4, 15),
        vendor_id=v.id, vendor_name=v.name,
        amount=500_000, payment_method="Cash", source="manual_overwritten",
    ))
    session.commit()

    from services.auto_collection_sync.migration import migrate_business
    report = migrate_business(session, business_id=1,
                              period_start=datetime.date(2026, 4, 1),
                              period_end=datetime.date(2026, 4, 30),
                              backfill_channels=False)
    assert report.overwritten_count == 0  # 이미 백업된 행은 카운트 안 됨
