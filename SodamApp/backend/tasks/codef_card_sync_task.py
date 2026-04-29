"""CODEF 카드 매출 자동 동기화 — cron + 사용자 수동 트리거 공통.

Orbitron cron 이 매일 23:30 KST 에 /api/codef/sync-cards/run 호출 →
이 모듈의 run_card_sync_for_all_businesses 실행.

수동 트리거(/api/codef/sync-cards/manual)는 단일 business_id 한정으로
sync_business_cards 호출.

알림 통합: NotificationService 재사용.
"""
import datetime
import logging
import os
from dataclasses import dataclass, field
from typing import Optional

from sqlmodel import Session, select

from database import engine
from models import CodefConnection
from services.codef.card_provider import CodefCardProvider, SyncResult
from services.codef.connection_service import CodefConnectionService
from services.codef.quota_service import CodefQuotaService

try:
    from services.notification_service import NotificationService
except ImportError:
    NotificationService = None  # type: ignore


log = logging.getLogger(__name__)


@dataclass
class BusinessSyncReport:
    business_id: int
    results: list[SyncResult] = field(default_factory=list)
    failed_count: int = 0
    total_new_approvals: int = 0
    total_new_payments: int = 0


@dataclass
class CronSummary:
    business_count: int = 0
    connection_count: int = 0
    total_new_approvals: int = 0
    total_new_payments: int = 0
    failed_business_ids: list[int] = field(default_factory=list)


def sync_business_cards(business_id: int, sync_modes: Optional[set[str]] = None,
                        triggered_by: str = "cron",
                        triggered_user_id: Optional[int] = None) -> BusinessSyncReport:
    """단일 business 의 모든 활성 카드 connection 동기화."""
    provider = CodefCardProvider(engine=engine)
    connections_svc = CodefConnectionService(engine=engine)
    conns = connections_svc.list_active(
        business_id=business_id, organization_type="card"
    )
    report = BusinessSyncReport(business_id=business_id)
    for conn in conns:
        result = provider.sync_one_connection(
            conn,
            sync_modes=sync_modes,
            triggered_by=triggered_by,
            triggered_user_id=triggered_user_id,
        )
        report.results.append(result)
        report.total_new_approvals += result.new_approvals
        report.total_new_payments += result.new_payments
        if result.error:
            report.failed_count += 1

    if report.failed_count > 0:
        _trigger_failure_notification(business_id, report)

    quota = CodefQuotaService(engine=engine)
    alert = quota.check_budget_alerts(business_id)
    if alert:
        _trigger_budget_alert(business_id, alert)

    return report


def run_card_sync_for_all_businesses() -> CronSummary:
    """cron 핸들러 — 전 사업장의 활성 카드 connection 순회."""
    summary = CronSummary()
    with Session(engine) as s:
        stmt = (
            select(CodefConnection.business_id)
            .where(
                CodefConnection.organization_type == "card",
                CodefConnection.status == "active",
            )
            .distinct()
        )
        biz_ids = [r for r in s.exec(stmt) if r is not None]

    summary.business_count = len(biz_ids)

    for biz_id in biz_ids:
        report = sync_business_cards(biz_id, triggered_by="cron")
        summary.connection_count += len(report.results)
        summary.total_new_approvals += report.total_new_approvals
        summary.total_new_payments += report.total_new_payments
        if report.failed_count > 0:
            summary.failed_business_ids.append(biz_id)

    return summary


def _trigger_failure_notification(business_id: int, report: BusinessSyncReport):
    """카드 동기화 실패 시 알림톡 — 사장님별 1건으로 합산.

    템플릿 미검수 시 graceful degradation (화면 배지만 동작).
    """
    template_code = os.getenv("NOTIFICATION_TEMPLATE_CODEF_EXPIRED", "").strip()
    if not template_code or NotificationService is None:
        log.info("[codef] failure notif skipped (template/notif service missing) "
                 "business_id=%s failed=%d", business_id, report.failed_count)
        return

    failed = [r for r in report.results if r.error]
    if not failed:
        return
    primary = failed[0]
    occurred = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")

    try:
        notif = NotificationService()
        send = getattr(notif, "send_alimtalk", None)
        if not callable(send):
            log.info("[codef] NotificationService.send_alimtalk missing — skip")
            return
        send(
            business_id=business_id,
            template_code=template_code,
            variables={
                "card_corp": primary.organization_label,
                "reason": primary.error or "인증 만료",
                "occurred_at": occurred,
            },
        )
    except Exception as exc:  # noqa: BLE001
        log.warning("[codef] failure notif send failed: %s", exc)


def _trigger_budget_alert(business_id: int, alert_kind: str):
    """월 예산 80%/100% 임계 알림 — PRODUCT 환경에서만 트리거됨.

    Phase 1 PoC 단계 (DEMO) 에선 호출되지 않음. PRODUCT 전환 시 별도 템플릿
    (codef_budget_warning / codef_budget_hardlimit) 등록 + env 추가 후 활성.
    """
    log.info("[codef] budget alert (%s) for business %s — PoC 단계 무발송",
             alert_kind, business_id)
