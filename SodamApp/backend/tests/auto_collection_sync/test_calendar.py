"""Task 9 TDD — 한국 영업일 캘린더."""
import datetime


def test_add_business_days_skips_weekends():
    from services.auto_collection_sync.calendar import add_business_days
    # 2026-05-08 (금) + 2 영업일 = 2026-05-12 (화)
    assert add_business_days(datetime.date(2026, 5, 8), 2) == datetime.date(2026, 5, 12)


def test_add_business_days_skips_korean_holidays():
    from services.auto_collection_sync.calendar import add_business_days
    # 2025-12-31 (수) + 1 영업일 = 2026-01-02 (금, 신정 건너뜀)
    assert add_business_days(datetime.date(2025, 12, 31), 1) == datetime.date(2026, 1, 2)
