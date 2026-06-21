# SodamApp/backend/services/collection_health.py
"""자동수집 채널 건강 판정.

각 채널의 credential 상태 + raw 데이터 최신성으로 status 산출.
- easypos / coupang_eats / baemin: 쿠키·연속실패 + raw MAX(date)
- codef_card / codef_bank: CodefConnection.status + CodefCallLog 최신성
"""
from __future__ import annotations
import datetime
import logging
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select, func

log = logging.getLogger(__name__)


def _safe_send(fn, *args):
    try:
        fn(*args)
    except Exception as e:  # noqa: BLE001
        log.warning("alert send failed: %s", e)

STALE_DAYS = 2


@dataclass
class ChannelHealth:
    channel_key: str
    label: str
    status: str          # healthy / failed / stale / skipping / expiring_soon
    detail: str
    last_data_date: Optional[datetime.date] = None


def _max_date(session: Session, col, model, business_id: int) -> Optional[datetime.date]:
    v = session.exec(
        select(func.max(col)).where(model.business_id == business_id)
    ).first()
    if v is None:
        return None
    return v.date() if isinstance(v, datetime.datetime) else v


def _eval_cookie_channel(session, business_id, now, *, cred, label, key,
                          data_col, data_model) -> ChannelHealth:
    """쿠팡/배민 — 쿠키 기반.

    판정 순서: failed → expiring_soon → stale(데이터 최신성) → healthy
    """
    if cred is None:
        return ChannelHealth(key, label, "skipping", "자격증명 미등록")
    if cred.status in ("failed", "cookie_invalid", "expired") or \
            (cred.consecutive_failures or 0) >= 3:
        return ChannelHealth(key, label, "failed",
                             f"인증 실패 ({cred.status}, 연속 {cred.consecutive_failures})")
    # 쿠키 만료 임박 (≤12h)
    expires_at = getattr(cred, "cookies_expires_at", None)
    if expires_at is not None:
        hours_left = (expires_at - now).total_seconds() / 3600
        if 0 < hours_left <= 12:
            h = int(hours_left) or 1
            return ChannelHealth(key, label, "expiring_soon",
                                 f"쿠키 {h}시간 후 만료 — 갱신 필요")
    last = _max_date(session, data_col, data_model, business_id) if data_col is not None else None
    if last is None or (now.date() - last).days > STALE_DAYS:
        return ChannelHealth(key, label, "stale",
                             f"최근 {STALE_DAYS}일 데이터 없음 (최신 {last})", last)
    return ChannelHealth(key, label, "healthy", "정상", last)


def evaluate_channels(session: Session, business_id: int,
                      now: datetime.datetime) -> list[ChannelHealth]:
    from models import (
        EasyPosCredential, EasyPosSaleReceipt,
        CoupangEatsCredential, CoupangEatsOrder,
        BaeminCredential, BaeminOrder,
        CodefConnection, CodefCallLog,
    )
    out: list[ChannelHealth] = []

    # EasyPOS — active credential + raw 최신성
    ez = session.exec(select(EasyPosCredential).where(
        EasyPosCredential.business_id == business_id)).first()
    if ez is None:
        out.append(ChannelHealth("easypos", "EasyPOS", "skipping", "자격증명 미등록"))
    elif ez.status != "active":
        out.append(ChannelHealth("easypos", "EasyPOS", "failed", f"status={ez.status}"))
    else:
        last = _max_date(session, EasyPosSaleReceipt.sale_date, EasyPosSaleReceipt, business_id)
        if last is None or (now.date() - last).days > STALE_DAYS:
            out.append(ChannelHealth("easypos", "EasyPOS", "stale",
                                     f"최근 {STALE_DAYS}일 데이터 없음 (최신 {last})", last))
        else:
            out.append(ChannelHealth("easypos", "EasyPOS", "healthy", "정상", last))

    # 쿠팡이츠
    ce = session.exec(select(CoupangEatsCredential).where(
        CoupangEatsCredential.business_id == business_id)).first()
    out.append(_eval_cookie_channel(session, business_id, now, cred=ce,
                                    label="쿠팡이츠", key="coupang_eats",
                                    data_col=CoupangEatsOrder.ordered_at,
                                    data_model=CoupangEatsOrder))

    # 배민
    bm = session.exec(select(BaeminCredential).where(
        BaeminCredential.business_id == business_id)).first()
    out.append(_eval_cookie_channel(session, business_id, now, cred=bm,
                                    label="배민", key="baemin",
                                    data_col=BaeminOrder.ordered_at,
                                    data_model=BaeminOrder))

    # CODEF — 연결 status + 마지막 호출 최신성. 자동 cron 없어 stale 정상.
    conns = session.exec(select(CodefConnection).where(
        CodefConnection.business_id == business_id)).all()
    for conn_type, key, label in (("card_purchase", "codef_card", "CODEF 카드"),
                                  ("bank", "codef_bank", "CODEF 은행")):
        matching = [c for c in conns if c.connection_type == conn_type]
        if not matching:
            out.append(ChannelHealth(key, label, "skipping", "연결 미등록"))
            continue
        if any(c.status != "active" for c in matching):
            out.append(ChannelHealth(key, label, "failed", "연결 비활성"))
            continue
        last_call = session.exec(
            select(func.max(CodefCallLog.called_at)).where(
                CodefCallLog.business_id == business_id)
        ).first()
        last = last_call.date() if last_call else None
        if last is None or (now.date() - last).days > STALE_DAYS:
            out.append(ChannelHealth(key, label, "stale",
                                     f"수동 수집 필요 (최신 {last})", last))
        else:
            out.append(ChannelHealth(key, label, "healthy", "정상", last))

    return out


# ---------------------------------------------------------------------------
# Alert dispatch — open / resolve / renotify
# ---------------------------------------------------------------------------

RENOTIFY_DAYS = 3
ALERTABLE = {"failed", "stale", "expiring_soon"}


def dispatch_alerts(session, business_id, now, *, sms_send, tg_send,
                    owner_phone: str = "") -> dict:
    """채널 건강 평가 후 경보 open/resolve + 발송. 발송 함수는 주입."""
    from models import CollectionHealthAlert
    healths = evaluate_channels(session, business_id, now)
    opened, resolved, renotified = [], [], []

    for h in healths:
        alert = session.exec(select(CollectionHealthAlert).where(
            CollectionHealthAlert.business_id == business_id,
            CollectionHealthAlert.channel_key == h.channel_key)).first()
        is_bad = h.status in ALERTABLE

        if is_bad:
            if alert is None or alert.status == "resolved":
                # 신규 open
                if alert is None:
                    alert = CollectionHealthAlert(
                        business_id=business_id, channel_key=h.channel_key)
                alert.status = "open"
                alert.alert_type = h.status
                alert.opened_at = now
                alert.last_notified_at = now
                alert.resolved_at = None
                alert.detail = f"{h.label}: {h.detail}"
                session.add(alert)
                _send_owner_sms(sms_send, owner_phone, h)
                _safe_send(tg_send, f"{h.channel_key}: {h.status} — {h.detail}")
                opened.append(h.channel_key)
            else:
                # 이미 open — RENOTIFY_DAYS 경과 시만 리마인드
                if alert.last_notified_at and \
                        (now - alert.last_notified_at).days >= RENOTIFY_DAYS:
                    alert.last_notified_at = now
                    session.add(alert)
                    _send_owner_sms(sms_send, owner_phone, h)
                    _safe_send(tg_send, f"[리마인드] {h.channel_key}: {h.status} — {h.detail}")
                    renotified.append(h.channel_key)
        else:
            # healthy — open 이던 게 있으면 resolve
            if alert and alert.status == "open":
                alert.status = "resolved"
                alert.resolved_at = now
                session.add(alert)
                _safe_send(sms_send, owner_phone,
                           f"[소담] {h.label} 수집이 정상화되었습니다.")
                _safe_send(tg_send, f"{h.channel_key}: resolved (정상화)")
                resolved.append(h.channel_key)

    session.commit()
    return {"opened": opened, "resolved": resolved, "renotified": renotified}


def _send_owner_sms(sms_send, owner_phone, h):
    if h.status == "expiring_soon":
        msg = {
            "coupang_eats": "쿠팡이츠 쿠키가 곧 만료됩니다. 끊기기 전에 어드민 → 외부연동에서 미리 갱신해 주세요.",
            "baemin": "배민 쿠키가 곧 만료됩니다. 끊기기 전에 어드민 → 외부연동에서 미리 갱신해 주세요.",
        }.get(h.channel_key, f"{h.label} 쿠키가 곧 만료됩니다. 미리 갱신해 주세요.")
    else:
        msg = {
            "coupang_eats": "쿠팡이츠 매출이 수집되지 않고 있어요. 어드민 → 외부연동에서 쿠키를 갱신해 주세요.",
            "baemin": "배민 매출이 수집되지 않고 있어요. 어드민 → 외부연동에서 쿠키를 갱신해 주세요.",
            "easypos": "매장(POS) 매출 수집이 멈췄어요. 확인이 필요합니다.",
            "codef_card": "카드 매입내역 수집이 밀렸어요. 어드민에서 동기화해 주세요.",
            "codef_bank": "은행 거래내역 수집이 밀렸어요. 어드민에서 동기화해 주세요.",
        }.get(h.channel_key, f"{h.label} 수집에 문제가 있어요.")
    _safe_send(sms_send, owner_phone, f"[소담] {msg}")
