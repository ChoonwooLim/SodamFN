"""입금 모니터링 — spec § 8.8~8.15 참조.

카드: 카드사별 D+N 영업일 + grace_days 후에도 매칭 안 되면 alert.
배달 (쿠팡이츠): settlement_date + grace 후에도 입금 없으면 alert.
"""
import datetime
import logging
from typing import Optional
from sqlmodel import Session, select
from models import (
    CardSalesApproval, BankTransaction, CardCorpSettlementProfile,
    CoupangEatsSettlement, SettlementWatchAlert,
)
from .calendar import add_business_days
from .fee_estimator import DEFAULT_FEE_RATE, _detect_card_corp

log = logging.getLogger("auto_collection.settlement_watch")


CARD_CORP_SETTLEMENT_DAYS_DEFAULT = {
    "BC": 3, "삼성": 2, "신한": 2, "롯데": 3, "현대": 2,
    "하나": 3, "우리": 3, "KB": 2, "NH농협": 3, "기타": 4,
}


def _settlement_days_for(session, business_id, card_corp):
    p = session.exec(
        select(CardCorpSettlementProfile).where(
            CardCorpSettlementProfile.business_id == business_id,
            CardCorpSettlementProfile.card_corp == card_corp,
        )
    ).first()
    if p:
        return p.settlement_days_learned, p.grace_days
    return CARD_CORP_SETTLEMENT_DAYS_DEFAULT.get(card_corp, 4), 3


def _has_recent_matched_deposit(session, business_id, card_corp,
                                  approval_date_end,
                                  expected_deposit_amount) -> bool:
    """승인 구간에 대응하는 입금이 이미 들어왔나? (Fuzzy)"""
    txs = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= approval_date_end,
            BankTransaction.trans_date <= approval_date_end + datetime.timedelta(days=10),
            BankTransaction.in_amount >= expected_deposit_amount * 0.95,
            BankTransaction.in_amount <= expected_deposit_amount * 1.05,
        )
    ).all()
    for tx in txs:
        if _detect_card_corp(tx.remark1 or "") == card_corp:
            return True
    return False


def run_for_business(session: Session, business_id: int,
                      today: Optional[datetime.date] = None):
    """카드 + 쿠팡 미입금 alert 생성. 멱등."""
    if today is None:
        today = datetime.date.today()
    _watch_card(session, business_id, today)
    _watch_coupang(session, business_id, today)
    session.commit()


def _watch_card(session, business_id, today: datetime.date):
    approvals = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == business_id,
            CardSalesApproval.approval_date >= today - datetime.timedelta(days=30),
            CardSalesApproval.status == "승인",
        )
    ).all()
    grouped = {}
    for a in approvals:
        key = (a.card_corp, a.approval_date)
        grouped.setdefault(key, []).append(a)

    for (corp, app_date), rows in grouped.items():
        sales = sum(r.amount or 0 for r in rows)
        if sales <= 0:
            continue
        n_days, grace = _settlement_days_for(session, business_id, corp)
        expected = add_business_days(app_date, n_days)
        deadline = expected + datetime.timedelta(days=grace)
        if today <= deadline:
            continue

        expected_amount = int(sales * (1 - DEFAULT_FEE_RATE))
        if _has_recent_matched_deposit(session, business_id, corp, app_date,
                                         expected_amount):
            continue

        existing = session.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == business_id,
                SettlementWatchAlert.alert_type == "card_overdue",
                SettlementWatchAlert.channel_or_corp == corp,
                SettlementWatchAlert.expected_date == expected,
            )
        ).first()
        if existing:
            continue

        session.add(SettlementWatchAlert(
            business_id=business_id, alert_type="card_overdue",
            channel_or_corp=corp, expected_date=expected,
            expected_amount=expected_amount, deadline=deadline,
            status="open", raw_ref=f"card_approval_group:{corp}:{app_date.isoformat()}",
            notified_at=datetime.datetime.now(),
        ))


def _watch_coupang(session, business_id, today: datetime.date):
    settlements = session.exec(
        select(CoupangEatsSettlement).where(
            CoupangEatsSettlement.business_id == business_id,
            CoupangEatsSettlement.settlement_date >= today - datetime.timedelta(days=30),
            CoupangEatsSettlement.settlement_type == "SETTLEMENT",
        )
    ).all()
    for st in settlements:
        expected = st.settlement_date
        deadline = expected + datetime.timedelta(days=3)
        if today <= deadline:
            continue

        matched = session.exec(
            select(BankTransaction).where(
                BankTransaction.business_id == business_id,
                BankTransaction.trans_date >= expected - datetime.timedelta(days=1),
                BankTransaction.trans_date <= deadline,
                BankTransaction.in_amount == st.amount,
            )
        ).all()
        matched = [t for t in matched if "쿠팡" in (t.remark1 or "")]
        if matched:
            continue

        existing = session.exec(
            select(SettlementWatchAlert).where(
                SettlementWatchAlert.business_id == business_id,
                SettlementWatchAlert.alert_type == "delivery_overdue",
                SettlementWatchAlert.channel_or_corp == "쿠팡이츠",
                SettlementWatchAlert.expected_date == expected,
            )
        ).first()
        if existing:
            continue

        session.add(SettlementWatchAlert(
            business_id=business_id, alert_type="delivery_overdue",
            channel_or_corp="쿠팡이츠", expected_date=expected,
            expected_amount=st.amount, deadline=deadline,
            status="open", raw_ref=f"coupang_settle:{st.id}",
            notified_at=datetime.datetime.now(),
        ))


def auto_close_received_alerts(session: Session, business_id: int):
    open_alerts = session.exec(
        select(SettlementWatchAlert).where(
            SettlementWatchAlert.business_id == business_id,
            SettlementWatchAlert.status == "open",
        )
    ).all()
    for alert in open_alerts:
        match = None
        if alert.alert_type == "card_overdue":
            txs = session.exec(
                select(BankTransaction).where(
                    BankTransaction.business_id == business_id,
                    BankTransaction.trans_date >= alert.expected_date,
                    BankTransaction.in_amount >= alert.expected_amount * 0.95,
                    BankTransaction.in_amount <= alert.expected_amount * 1.05,
                )
            ).all()
            for tx in txs:
                if _detect_card_corp(tx.remark1 or "") == alert.channel_or_corp:
                    match = tx; break
        elif alert.alert_type == "delivery_overdue":
            txs = session.exec(
                select(BankTransaction).where(
                    BankTransaction.business_id == business_id,
                    BankTransaction.trans_date >= alert.expected_date,
                    BankTransaction.in_amount == alert.expected_amount,
                )
            ).all()
            for tx in txs:
                if "쿠팡" in (tx.remark1 or ""):
                    match = tx; break

        if match:
            alert.status = "received"
            alert.received_amount = int(match.in_amount)
            alert.received_date = match.trans_date
            session.add(alert)
    session.commit()
