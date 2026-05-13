"""마이그레이션 B 정책 — spec § 7.2 참조.

기존 수동 행을 'manual_overwritten' 으로 백업 → 자동수집으로 다시 가져옴.
"""
import datetime
import json
from dataclasses import dataclass, field
from sqlmodel import Session, select
from models import DailyExpense
from . import vendor_resolver
from .orchestrator import run_one_business


@dataclass
class MigrationReport:
    business_id: int
    period: tuple
    overwritten_count: int = 0
    new_auto_count: int = 0
    channels: dict = field(default_factory=dict)


def migrate_business(session: Session, business_id: int,
                     period_start: datetime.date, period_end: datetime.date,
                     backfill_channels: bool = True) -> MigrationReport:
    affected_vendor_ids = vendor_resolver.list_auto_covered(session, business_id)

    overwritten = 0
    rows = session.exec(
        select(DailyExpense).where(
            DailyExpense.business_id == business_id,
            DailyExpense.date >= period_start,
            DailyExpense.date <= period_end,
            DailyExpense.vendor_id.in_(affected_vendor_ids),
            DailyExpense.source == "manual",
        )
    ).all()
    for row in rows:
        row.source = "manual_overwritten"
        row.source_meta = json.dumps({"migrated_at": datetime.datetime.now().isoformat()})
        session.add(row)
        overwritten += 1
    session.commit()

    report = MigrationReport(business_id=business_id,
                              period=(period_start, period_end),
                              overwritten_count=overwritten)

    if backfill_channels:
        fan_out_report = run_one_business(session, business_id,
                                           period_start=period_start,
                                           period_end=period_end)
        report.new_auto_count = fan_out_report.total_events
        report.channels = fan_out_report.counts

    return report
