# SodamApp/backend/services/collection_health.py
"""자동수집 채널 건강 판정.

각 채널의 credential 상태 + raw 데이터 최신성으로 status 산출.
- easypos / coupang_eats / baemin: 쿠키·연속실패 + raw MAX(date)
- codef_card / codef_bank: CodefConnection.status + CodefCallLog 최신성
"""
from __future__ import annotations
import datetime
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select, func

STALE_DAYS = 2


@dataclass
class ChannelHealth:
    channel_key: str
    label: str
    status: str          # healthy / failed / stale / skipping / expiring_soon
    detail: str
    last_data_date: Optional[datetime.date] = None


def _max_date(session: Session, col) -> Optional[datetime.date]:
    v = session.exec(select(func.max(col))).first()
    if v is None:
        return None
    return v.date() if isinstance(v, datetime.datetime) else v


def _eval_cookie_channel(session, business_id, now, *, cred, label, key,
                          data_col) -> ChannelHealth:
    """쿠팡/배민 — 쿠키 기반."""
    if cred is None:
        return ChannelHealth(key, label, "skipping", "자격증명 미등록")
    if cred.status in ("failed", "cookie_invalid", "expired") or \
            (cred.consecutive_failures or 0) >= 3:
        return ChannelHealth(key, label, "failed",
                             f"인증 실패 ({cred.status}, 연속 {cred.consecutive_failures})")
    last = _max_date(session, data_col) if data_col is not None else None
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
        last = _max_date(session, EasyPosSaleReceipt.sale_date)
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
                                    data_col=CoupangEatsOrder.ordered_at))

    # 배민
    bm = session.exec(select(BaeminCredential).where(
        BaeminCredential.business_id == business_id)).first()
    out.append(_eval_cookie_channel(session, business_id, now, cred=bm,
                                    label="배민", key="baemin",
                                    data_col=BaeminOrder.ordered_at))

    # CODEF — 연결 status + 마지막 호출 최신성. 자동 cron 없어 stale 정상.
    conns = session.exec(select(CodefConnection).where(
        CodefConnection.business_id == business_id)).all()
    for conn_type, key, label in (("card_purchase", "codef_card", "CODEF 카드"),
                                  ("bank", "codef_bank", "CODEF 은행")):
        matching = [c for c in conns if c.connection_type == conn_type]
        if not matching:
            continue
        if any(c.status != "active" for c in matching):
            out.append(ChannelHealth(key, label, "failed", "연결 비활성"))
            continue
        last_call = session.exec(select(func.max(CodefCallLog.called_at))).first()
        last = last_call.date() if last_call else None
        if last is None or (now.date() - last).days > STALE_DAYS:
            out.append(ChannelHealth(key, label, "stale",
                                     f"수동 수집 필요 (최신 {last})", last))
        else:
            out.append(ChannelHealth(key, label, "healthy", "정상", last))

    return out
