"""자동수집 파이프라인 라우터.

cron + 대시보드 + 마이그레이션 + 백업 복구. 8개 cron 은 Task 10 에서 추가.
"""
from datetime import date
from typing import Optional
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlmodel import Session, select
from database import engine
from models import User, DailyExpense
from routers.auth import get_admin_user

router = APIRouter(prefix="/auto-collection", tags=["auto-collection"])


def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(
            status_code=400,
            detail="사업장 정보가 없습니다. (SuperAdmin은 먼저 대상 사업장을 선택하세요.)",
        )
    return bid


class MigrationRequest(BaseModel):
    period_start: date
    period_end: date


@router.post("/migrate")
def trigger_migration(
    req: MigrationRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """마이그레이션 B 실행."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from services.auto_collection_sync.migration import migrate_business
        report = migrate_business(s, bid, req.period_start, req.period_end)
        return {
            "overwritten_count": report.overwritten_count,
            "new_auto_count": report.new_auto_count,
            "channels": report.channels,
        }


@router.post("/dailyexpense/{row_id}/restore")
def restore_manual_row(
    row_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """백업된 manual_overwritten 행을 manual 로 복구."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        row = s.get(DailyExpense, row_id)
        if not row or row.business_id != bid:
            raise HTTPException(404, "행을 찾을 수 없습니다.")
        if row.source != "manual_overwritten":
            raise HTTPException(400, "이 행은 백업 행이 아닙니다.")
        row.source = "manual"
        s.add(row); s.commit()
        return {"ok": True, "id": row.id}


def _log_dto(log_row):
    """SyncLog → 대시보드 응답 DTO. 채널별 필드명 차이 흡수."""
    if not log_row:
        return {"status": "no_data"}
    # EasyPosSyncLog 는 receipts_*, CoupangEatsSyncLog 는 orders_* 를 사용.
    inserted = (
        getattr(log_row, "inserted_count", None)
        or getattr(log_row, "receipts_inserted", None)
        or getattr(log_row, "orders_inserted", None)
        or 0
    )
    updated = (
        getattr(log_row, "updated_count", None)
        or getattr(log_row, "receipts_updated", None)
        or getattr(log_row, "orders_updated", None)
        or 0
    )
    return {
        "started_at": log_row.started_at.isoformat() if log_row.started_at else None,
        "status": log_row.status,
        "inserted": inserted,
        "updated": updated,
    }


@router.get("/status")
def get_status(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """자동수집 대시보드용 상태 요약."""
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import (
            EasyPosSyncLog, CoupangEatsSyncLog,
            CardFeeRateLearned, SettlementWatchAlert,
        )
        easypos_last = s.exec(
            select(EasyPosSyncLog).where(EasyPosSyncLog.business_id == bid)
            .order_by(EasyPosSyncLog.started_at.desc()).limit(1)
        ).first()
        coupang_last = s.exec(
            select(CoupangEatsSyncLog).where(CoupangEatsSyncLog.business_id == bid)
            .order_by(CoupangEatsSyncLog.started_at.desc()).limit(1)
        ).first()
        learned = s.exec(
            select(CardFeeRateLearned).where(CardFeeRateLearned.business_id == bid)
        ).all()
        open_alerts = s.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == bid,
                SettlementWatchAlert.status == "open",
            )
        ).all()
        avg_conf = (
            sum(r.confidence for r in learned) / len(learned) if learned else 0.0
        )
        return {
            "channels": {
                "easypos": _log_dto(easypos_last),
                "coupang_eats": _log_dto(coupang_last),
            },
            "fee_estimator": {
                "card_corps_learned": len(learned),
                "avg_confidence": round(avg_conf, 2),
            },
            "settlement_watch": {
                "open_alert_count": len(open_alerts),
            },
        }


# ---------------------------------------------------------------------------
# Settlement Watch — Alert CRUD (Task 9)
# ---------------------------------------------------------------------------

class AlertActionRequest(BaseModel):
    notes: Optional[str] = None


def _alert_dto(a):
    return {
        "id": a.id, "alert_type": a.alert_type,
        "channel_or_corp": a.channel_or_corp,
        "expected_date": a.expected_date.isoformat(),
        "expected_amount": a.expected_amount,
        "deadline": a.deadline.isoformat(),
        "status": a.status,
        "received_amount": a.received_amount,
        "received_date": a.received_date.isoformat() if a.received_date else None,
        "notes": a.notes,
    }


@router.get("/settlement-watch/alerts")
def list_alerts(
    status: str = "open",
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert
        rows = s.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == bid,
                SettlementWatchAlert.status == status,
            ).order_by(SettlementWatchAlert.deadline)
        ).all()
        return [_alert_dto(r) for r in rows]


@router.post("/settlement-watch/alerts/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int, body: AlertActionRequest,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    import datetime
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert
        a = s.get(SettlementWatchAlert, alert_id)
        if not a or a.business_id != bid:
            raise HTTPException(404, "alert not found")
        a.status = "acknowledged"
        a.acknowledged_at = datetime.datetime.now()
        a.acknowledged_by = admin.id
        a.notes = body.notes
        s.add(a); s.commit()
        s.refresh(a)
        return _alert_dto(a)


@router.post("/settlement-watch/alerts/{alert_id}/false-positive")
def mark_false_positive(
    alert_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    import datetime
    bid = _resolve_bid(admin, x_view_as_business)
    with Session(engine) as s:
        from models import SettlementWatchAlert, CardCorpSettlementProfile
        a = s.get(SettlementWatchAlert, alert_id)
        if not a or a.business_id != bid:
            raise HTTPException(404, "alert not found")
        a.status = "false_positive"
        a.acknowledged_at = datetime.datetime.now()
        a.acknowledged_by = admin.id
        s.add(a)
        # 학습 — grace_days +1
        if a.alert_type == "card_overdue":
            profile = s.exec(
                select(CardCorpSettlementProfile).where(
                    CardCorpSettlementProfile.business_id == bid,
                    CardCorpSettlementProfile.card_corp == a.channel_or_corp,
                )
            ).first()
            if profile:
                profile.grace_days += 1
            else:
                profile = CardCorpSettlementProfile(
                    business_id=bid, card_corp=a.channel_or_corp,
                    grace_days=4,
                )
            s.add(profile)
        s.commit()
        s.refresh(a)
        return _alert_dto(a)


# ========== Cron Endpoints (Task 10) ==========
# superadmin 토큰으로 Orbitron cron 워커가 호출. 각 endpoint 는 사업장 화이트리스트가 아닌
# 전사업장 처리 (active subscription 한정 / plan 체크는 orchestrator 가 담당).
#
# get_superadmin_user 가 auth.py 에 없으므로 inline 체크 헬퍼 사용.

import logging as _logging
_cron_log = _logging.getLogger("auto_collection.cron")


def _superadmin_only(admin: User = Depends(get_admin_user)) -> User:
    if admin.role != "superadmin":
        raise HTTPException(403, "superadmin only")
    return admin


def _verify_cron_secret(
    x_cron_secret: Optional[str] = Header(None, alias="X-Cron-Secret"),
) -> None:
    """Orbitron cron 워커 인증 — CRON_SHARED_SECRET 헤더 일치.

    JWT 만료(24h) 회전 부담을 제거. 기존 easypos/coupang_eats cron 과 동일 패턴.
    """
    import os
    expected = os.getenv("CRON_SHARED_SECRET", "").strip()
    if not expected:
        raise HTTPException(503, "CRON_SHARED_SECRET 미설정 — cron 차단")
    if x_cron_secret != expected:
        raise HTTPException(401, "invalid cron secret")


@router.post("/cron/easypos")
def cron_easypos(_: None = Depends(_verify_cron_secret)):
    """03:00 — EasyPOS 채널 수집 (전 사업장).

    services.easypos_service.sync_all_businesses 가 존재하지 않으므로
    routers.easypos._run_sync 를 직접 호출하여 fan-out.
    """
    import datetime as _dt
    from models import EasyPosCredential
    from routers.easypos import _run_sync as _easypos_run_sync

    yesterday = _dt.date.today() - _dt.timedelta(days=1)
    with Session(engine) as s:
        bids = [r for r in s.exec(
            select(EasyPosCredential.business_id).where(
                EasyPosCredential.status == "active"
            )
        )]

    results = []
    for bid in bids:
        try:
            r = _easypos_run_sync(bid, [yesterday], triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:  # noqa: BLE001
            _cron_log.error("easypos cron failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})
    return {
        "ok": True,
        "target_date": yesterday.isoformat(),
        "business_count": len(bids),
        "results": results,
    }


@router.post("/cron/coupang-eats")
def cron_coupang(_: None = Depends(_verify_cron_secret)):
    """03:10 — 쿠팡이츠 채널 수집.

    services.coupang_eats_service.sync_all_businesses 가 존재하지 않으므로
    routers.coupang_eats._run_sync 를 직접 호출하여 fan-out.
    """
    import datetime as _dt
    from models import CoupangEatsCredential
    from routers.coupang_eats import _run_sync as _coupang_run_sync

    yesterday = _dt.date.today() - _dt.timedelta(days=1)
    with Session(engine) as s:
        bids = [r for r in s.exec(
            select(CoupangEatsCredential.business_id).where(
                CoupangEatsCredential.status.in_(["active"])
            )
        )]

    results = []
    for bid in bids:
        try:
            r = _coupang_run_sync(bid, yesterday, yesterday,
                                   sync_orders=True, sync_settlements=True,
                                   triggered_by="cron")
            results.append({"business_id": bid, **r})
        except Exception as e:  # noqa: BLE001
            _cron_log.error("coupang cron failed bid=%s: %s", bid, e, exc_info=True)
            results.append({"business_id": bid, "error": str(e)})
    return {
        "ok": True,
        "target_date": yesterday.isoformat(),
        "business_count": len(bids),
        "results": results,
    }


@router.post("/cron/coupang-eats-monthly-excel")
def cron_coupang_monthly_excel(_: None = Depends(_verify_cron_secret)):
    """매월 6일 03:30 — 쿠팡이츠 전월 매출내역서(엑셀) 자동 다운로드.

    fee breakdown 의 유일한 소스. 엑셀 = 43컬럼 (중개수수료/배달비/광고비/멤버십...).
    routers.coupang_eats.sync_monthly_excel_cron 을 직접 호출 (시크릿은 동일).
    """
    import os, datetime as _dt
    from sqlmodel import select as _select
    from models import CoupangEatsCredential as _CEC
    from services.coupang_eats_service import sync_monthly_excel as _sync_excel
    from routers.coupang_eats import _execute_with_refresh as _exec
    from services.coupang_eats_service import CoupangEatsClient as _Client

    today = _dt.date.today()
    first_of_this_month = today.replace(day=1)
    prev_month_end = first_of_this_month - _dt.timedelta(days=1)
    prev_prev_month_end = prev_month_end.replace(day=1) - _dt.timedelta(days=1)
    targets = [
        prev_month_end.strftime("%Y-%m"),
        prev_prev_month_end.strftime("%Y-%m"),
    ]

    with Session(engine) as s:
        creds_rows = s.exec(
            _select(_CEC).where(_CEC.status.in_(["active"]))
        ).all()
        cred_map = {c.business_id: c.store_id for c in creds_rows if c.store_id}

    results = []
    for bid, store_id in cred_map.items():
        for ym in targets:
            try:
                def _action(client: _Client, _sid=store_id, _ym=ym):
                    return client.download_sales_order_excel(_sid, _ym)
                (excel_bytes, refreshed) = _exec(bid, _action)
                with Session(engine) as s:
                    r = _sync_excel(s, bid, store_id, ym, excel_bytes,
                                     triggered_by="cron")
                results.append({"business_id": bid, "year_month": ym,
                                "auth_refreshed": refreshed, **r})
            except Exception as e:  # noqa: BLE001
                _cron_log.error("coupang monthly excel cron failed bid=%s ym=%s: %s",
                                bid, ym, e, exc_info=True)
                results.append({"business_id": bid, "year_month": ym, "error": str(e)})

    return {
        "ok": True, "today": today.isoformat(),
        "targets": targets, "business_count": len(cred_map),
        "results": results,
    }


@router.post("/cron/bank-sync")
def cron_bank(_: None = Depends(_verify_cron_secret)):
    """03:20 — 은행 거래 수집.

    routers.bank_sync.cron_pull_all 이 존재하지 않으므로 활성 BankAccount 별
    routers.bank_sync._do_pull 을 직접 호출.
    """
    from datetime import date as _date, timedelta as _td
    from models import BankAccount
    from services.database_service import DatabaseService
    from routers.bank_sync import _do_pull

    end_d = _date.today()
    start_d = end_d - _td(days=7)

    service = DatabaseService()
    results = []
    try:
        accs = service.session.exec(
            select(BankAccount).where(BankAccount.is_active == True)  # noqa: E712
        ).all()
        for acc in accs:
            try:
                r = _do_pull(service, acc, acc.business_id, start_d, end_d, 500)
                service.session.commit()
                results.append({"account_id": acc.id, "business_id": acc.business_id,
                                "status": "ok", **r})
            except Exception as e:  # noqa: BLE001
                service.session.rollback()
                _cron_log.error("bank cron failed acc=%s: %s", acc.id, e, exc_info=True)
                results.append({"account_id": acc.id, "business_id": acc.business_id,
                                "status": "failed", "error": str(e)})
        return {
            "ok": True,
            "account_count": len(accs),
            "ok_count": sum(1 for r in results if r.get("status") == "ok"),
            "failed_count": sum(1 for r in results if r.get("status") == "failed"),
        }
    finally:
        service.close()


@router.post("/cron/orchestrator")
def cron_orchestrator(_: None = Depends(_verify_cron_secret)):
    """03:30 — 분류·동기화 fan-out (모든 사업장)."""
    with Session(engine) as s:
        from services.auto_collection_sync.orchestrator import run_all_businesses
        reports = run_all_businesses(s)
        return {
            "business_count": len(reports),
            "total_events": sum(r.total_events for r in reports),
            "skipped_count": sum(1 for r in reports if r.skipped_reason),
        }


@router.post("/cron/profit-loss")
def cron_profit_loss(_: None = Depends(_verify_cron_secret)):
    """03:40 — 손익 재계산 (이번달 + 지난달). 현재 stub."""
    with Session(engine) as s:
        from services.profit_loss_service import recalc_all_businesses
        return recalc_all_businesses(s)


@router.post("/cron/notify")
def cron_notify(_: None = Depends(_verify_cron_secret)):
    """03:45 — 사장님 일일 알림."""
    with Session(engine) as s:
        from services.auto_collection_sync.orchestrator import (
            notify_summary, run_all_businesses,
        )
        # 03:30 에서 동기화 끝났으니, 다시 한 번 dry summary 로 알림 보냄.
        # 추후 별도 sync_log 기반 요약으로 정교화 가능.
        reports = run_all_businesses(s)
        notify_summary(s, reports)
        return {"sent": True, "business_count": len(reports)}


@router.post("/cron/settlement-watch")
def cron_settlement_watch(_: None = Depends(_verify_cron_secret)):
    """04:00 — 입금 모니터링 + 자동 close + 알림."""
    with Session(engine) as s:
        from services.auto_collection_sync import settlement_watch
        from models import Business
        bizs = s.exec(
            select(Business).where(Business.subscription_status == "active")
        ).all()
        for biz in bizs:
            settlement_watch.run_for_business(s, biz.id)
            settlement_watch.auto_close_received_alerts(s, biz.id)
        return {"business_count": len(bizs)}


@router.post("/cron/learn-fee-rates")
def cron_learn_fee_rates(_: None = Depends(_verify_cron_secret)):
    """일요일 04:30 — 카드사별 수수료율 학습 갱신."""
    with Session(engine) as s:
        from services.auto_collection_sync.fee_estimator import update_learned_rate
        from models import Business, CardSalesApproval
        bizs = s.exec(
            select(Business).where(Business.subscription_status == "active")
        ).all()
        total_updates = 0
        for biz in bizs:
            corps_rows = s.exec(
                select(CardSalesApproval.card_corp).where(
                    CardSalesApproval.business_id == biz.id
                ).distinct()
            ).all()
            for corp in corps_rows:
                update_learned_rate(s, biz.id, corp)
                total_updates += 1
        return {"business_count": len(bizs), "card_corp_updates": total_updates}
