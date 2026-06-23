"""Auto-collection orchestrator — cron 진입점.

채널별 normalizer 호출 → SyncEvent → fan_out.apply.
등급 체크 단일 지점. spec § 7.1 참조.
"""
import datetime
import logging
from dataclasses import dataclass, field
from sqlmodel import Session, select
from models import Business, SubscriptionPlan
from .normalizers.easypos import normalize_easypos
from .normalizers.coupang_eats import normalize_coupang_eats
from .normalizers.baemin import normalize_baemin
from .normalizers.bank import normalize_bank
from .fan_out import apply as fan_out_apply

log = logging.getLogger("auto_collection.orchestrator")


@dataclass
class OrchestratorReport:
    business_id: int
    total_events: int = 0
    counts: dict = field(default_factory=dict)
    skipped_reason: str = ""


def _plan_enables_auto(session: Session, business_id: int) -> bool:
    biz = session.get(Business, business_id)
    if not biz or not biz.plan_id:
        return False
    plan = session.get(SubscriptionPlan, biz.plan_id)
    return bool(plan and plan.feature_auto_collection)


def run_one_business(session: Session, business_id: int,
                     period_start: datetime.date = None,
                     period_end: datetime.date = None) -> OrchestratorReport:
    if period_start is None:
        period_start = datetime.date.today() - datetime.timedelta(days=1)
    if period_end is None:
        period_end = datetime.date.today() - datetime.timedelta(days=1)

    if not _plan_enables_auto(session, business_id):
        return OrchestratorReport(business_id=business_id,
                                   skipped_reason="plan_disabled")

    events = []
    events.extend(normalize_easypos(session, business_id, period_start, period_end))
    events.extend(normalize_coupang_eats(session, business_id, period_start, period_end))
    events.extend(normalize_baemin(session, business_id, period_start, period_end))
    events.extend(normalize_bank(session, business_id, period_start, period_end))

    fan_out_report = fan_out_apply(session, business_id, events)

    return OrchestratorReport(
        business_id=business_id,
        total_events=fan_out_report.total_events,
        counts=fan_out_report.counts,
    )


def run_all_businesses(session: Session) -> list[OrchestratorReport]:
    bizs = session.exec(
        select(Business).where(Business.subscription_status == "active")
    ).all()
    return [run_one_business(session, b.id) for b in bizs]


def notify_summary(session: Session, reports: list[OrchestratorReport]):
    """일일 자동수집 알림 — 텔레그램. spec § 8.3 참조.

    telegram_service 가 없으면 print 로 대체.
    """
    lines = ["[소담 자동수집]"]
    for r in reports:
        if r.skipped_reason:
            continue
        biz = session.get(Business, r.business_id)
        lines.append(f"- {biz.name if biz else r.business_id}: {r.total_events}건 처리")
    if len(lines) == 1:
        lines.append("이상 없음.")
    message = "\n".join(lines)

    try:
        from services.telegram_service import send_message
        send_message(message)
    except ImportError:
        log.info("telegram_service unavailable, message=%s", message)
    except Exception as e:  # noqa: BLE001
        log.warning("telegram send failed: %s; message=%s", e, message)
