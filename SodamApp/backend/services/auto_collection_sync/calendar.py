"""한국 영업일 캘린더 — 주말 + 공휴일.

1차에서는 공휴일을 하드코딩 리스트로. 2차에서 holiday-kr 라이브러리 도입 검토.
"""
import datetime

# 2026년 공휴일 (운영 시 매년 갱신)
KOREAN_HOLIDAYS_2026 = {
    datetime.date(2026, 1, 1),
    datetime.date(2026, 2, 16),
    datetime.date(2026, 2, 17),
    datetime.date(2026, 2, 18),
    datetime.date(2026, 3, 1),
    datetime.date(2026, 5, 5),
    datetime.date(2026, 5, 24),
    datetime.date(2026, 6, 6),
    datetime.date(2026, 8, 15),
    datetime.date(2026, 9, 24),
    datetime.date(2026, 9, 25),
    datetime.date(2026, 9, 26),
    datetime.date(2026, 10, 3),
    datetime.date(2026, 10, 9),
    datetime.date(2026, 12, 25),
}


def is_business_day(d: datetime.date) -> bool:
    if d.weekday() >= 5:
        return False
    if d in KOREAN_HOLIDAYS_2026:
        return False
    return True


def add_business_days(start: datetime.date, n: int) -> datetime.date:
    """start 다음 n번째 영업일 반환. n=0 이면 start 가 영업일이 아닐 경우 다음 영업일."""
    d = start
    if n == 0:
        while not is_business_day(d):
            d += datetime.timedelta(days=1)
        return d
    remaining = n
    while remaining > 0:
        d += datetime.timedelta(days=1)
        if is_business_day(d):
            remaining -= 1
    return d
