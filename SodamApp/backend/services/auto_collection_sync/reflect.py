"""수집 직후 raw → DailyExpense 즉시 반영.

매출관리 화면(`/revenue/summary`, `/revenue/daily`)은 **DailyExpense** 를 단일
진실 원천으로 읽는다. 채널별 raw 테이블(EasyPosSaleReceipt / CoupangEatsOrder /
BaeminOrder ...)에 쌓인 데이터는 normalizer → fan_out 단계를 거쳐야 DailyExpense
로 반영된다.

기존에는 이 fan_out 이 `/cron/orchestrator`(03:30) 1곳에서만 수행됐다. 그 cron 이
멈추면 raw 수집은 계속돼도 매출관리 화면이 갱신되지 않는 무성(silent) 단절이
발생한다. 그래서 **각 채널 수집 함수가 수집 직후 이 헬퍼를 호출**해, 별도 cron
의존 없이 "수집되면 즉시 매출 반영, 항상 싱크" 를 보장한다.

idempotent — fan_out 은 (business_id, date, vendor_id, payment_method, source)
자연키로 upsert 하므로 같은 기간을 여러 번 반영해도 중복 없이 금액만 갱신된다.
"""
import datetime
import logging

from sqlmodel import Session

from .fan_out import apply as fan_out_apply

log = logging.getLogger("auto_collection.reflect")


def reflect_channel(session: Session, business_id: int, channel: str,
                    start: datetime.date, end: datetime.date):
    """채널 raw → SyncEvent → DailyExpense fan-out.

    channel: "easypos" | "coupang_eats" | "baemin" | "bank"
    반환: FanOutReport
    """
    if channel == "easypos":
        from .normalizers.easypos import normalize_easypos as _fn
    elif channel == "coupang_eats":
        from .normalizers.coupang_eats import normalize_coupang_eats as _fn
    elif channel == "baemin":
        from .normalizers.baemin import normalize_baemin as _fn
    elif channel == "bank":
        from .normalizers.bank import normalize_bank as _fn
    else:
        raise ValueError(f"unknown channel: {channel}")

    events = list(_fn(session, business_id, start, end))
    report = fan_out_apply(session, business_id, events)
    log.info("reflect %s bid=%s %s~%s: %d events → DailyExpense",
             channel, business_id, start, end, len(events))
    return report
