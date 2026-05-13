"""SyncEvent → DailyExpense / 채널별 보조 테이블 upsert.

자세한 정책은 spec § 5.6 참조.
"""
from collections import defaultdict
from dataclasses import dataclass, field
import json
from sqlmodel import Session, select
from models import DailyExpense
from .sync_event import SyncEvent
from . import vendor_resolver


@dataclass
class FanOutReport:
    counts: dict = field(default_factory=dict)
    total_events: int = 0


def apply(session: Session, business_id: int, events: list[SyncEvent]) -> FanOutReport:
    report = FanOutReport()
    counts = defaultdict(int)
    for ev in events:
        if ev.event_type in ("revenue", "expense"):
            _upsert_daily_expense(session, ev)
        # card_settlement / delivery_settlement 은 기존 흐름 유지 (Task 5에서 다룸)
        counts[f"{ev.event_type}:{ev.source}"] += 1
        report.total_events += 1
    session.commit()
    report.counts = dict(counts)
    return report


def _upsert_daily_expense(session: Session, ev: SyncEvent):
    vendor = vendor_resolver.get_or_create(session, ev.business_id, ev.vendor_lookup_key)
    existing = session.exec(
        select(DailyExpense).where(
            DailyExpense.business_id == ev.business_id,
            DailyExpense.date == ev.date,
            DailyExpense.vendor_id == vendor.id,
            DailyExpense.payment_method == ev.payment_method,
            DailyExpense.source == ev.source,
        )
    ).first()
    payload_json = json.dumps(ev.raw_payload, ensure_ascii=False) if ev.raw_payload else None
    if existing:
        existing.amount = ev.amount
        existing.source_meta = payload_json
        session.add(existing)
    else:
        session.add(DailyExpense(
            business_id=ev.business_id, date=ev.date,
            vendor_id=vendor.id, vendor_name=vendor.name,
            amount=ev.amount, category=vendor.category,
            payment_method=ev.payment_method,
            source=ev.source, source_meta=payload_json,
        ))
