"""카드/배달 수수료 자동 추정 — spec § 6 참조.

우선순위:
  1) CODEF 명세서 (CardPayment.source=='codef' + fees>0)
  2) 입금 ↔ 승인 매칭 실측 역산 (CardFeeMatchLog 참조)
  3) 학습된 카드사별 평균 수수료율 (CardFeeRateLearned)
  4) 산정 불가
"""
import calendar
import datetime
import math
from dataclasses import dataclass
from typing import Literal, Optional
from sqlmodel import Session, select
from models import (
    CardPayment, CardSalesApproval, CardFeeRateLearned, CardFeeMatchLog,
    BankTransaction, DeliveryFeeRate,
)


CardFeeSource = Literal[
    "codef_settlement", "deposit_match", "learned_rate", "unavailable"
]


@dataclass
class CardFeeEstimate:
    amount: int
    source: CardFeeSource
    confidence: float
    basis_count: int = 0


def _month_range(year: int, month: int) -> tuple[datetime.date, datetime.date]:
    start = datetime.date(year, month, 1)
    last = calendar.monthrange(year, month)[1]
    end = datetime.date(year, month, last)
    return start, end


def estimate_card_fee(session: Session, business_id: int, card_corp: str,
                      year: int, month: int) -> CardFeeEstimate:
    start, end = _month_range(year, month)

    # 1순위 — CODEF 명세서
    codef_payments = session.exec(
        select(CardPayment).where(
            CardPayment.business_id == business_id,
            CardPayment.card_corp == card_corp,
            CardPayment.payment_date >= start,
            CardPayment.payment_date <= end,
            CardPayment.source == "codef",
        )
    ).all()
    codef_with_fee = [p for p in codef_payments if (p.fees or 0) > 0]
    if codef_with_fee:
        return CardFeeEstimate(
            amount=sum(p.fees for p in codef_with_fee),
            source="codef_settlement", confidence=1.0,
            basis_count=len(codef_with_fee),
        )

    # 2순위 — 입금↔승인 매칭 실측 역산
    fee, samples = _match_deposits_to_approvals(session, business_id, card_corp, year, month)
    if fee is not None and samples >= 5:
        return CardFeeEstimate(
            amount=fee, source="deposit_match",
            confidence=min(0.95, samples / 30.0),
            basis_count=samples,
        )

    # 3순위 — 학습값
    rate_row = session.exec(
        select(CardFeeRateLearned).where(
            CardFeeRateLearned.business_id == business_id,
            CardFeeRateLearned.card_corp == card_corp,
        )
    ).first()
    if rate_row and rate_row.confidence >= 0.5:
        sales = sum(
            (a.amount or 0)
            for a in session.exec(
                select(CardSalesApproval).where(
                    CardSalesApproval.business_id == business_id,
                    CardSalesApproval.card_corp == card_corp,
                    CardSalesApproval.approval_date >= start,
                    CardSalesApproval.approval_date <= end,
                    CardSalesApproval.status == "승인",
                )
            ).all()
        )
        return CardFeeEstimate(
            amount=int(sales * rate_row.learned_rate),
            source="learned_rate",
            confidence=rate_row.confidence * 0.8,
            basis_count=rate_row.sample_size,
        )

    # 4순위 — 산정 불가
    return CardFeeEstimate(amount=0, source="unavailable", confidence=0.0)


def _match_deposits_to_approvals(session: Session, business_id: int, card_corp: str,
                                  year: int, month: int) -> tuple[Optional[int], int]:
    """이 달의 매칭 로그 합산. 본격 매칭 알고리즘은 run_deposit_match 가 별도 cron 으로 실행."""
    start, end = _month_range(year, month)
    logs = session.exec(
        select(CardFeeMatchLog).where(
            CardFeeMatchLog.business_id == business_id,
            CardFeeMatchLog.card_corp == card_corp,
            CardFeeMatchLog.deposit_date >= start,
            CardFeeMatchLog.deposit_date <= end,
        )
    ).all()
    if not logs:
        return None, 0
    return sum(l.effective_fee for l in logs), len(logs)


# ========== Step 6.3: 입금↔승인 매칭 알고리즘 ==========

CARD_CORP_KEYWORDS = {
    "삼성": ["삼성카드", "삼성"],
    "신한": ["신한카드", "신한"],
    "BC":   ["비씨카드", "BC카드", "bc"],
    "현대": ["현대카드", "현대"],
    "롯데": ["롯데카드", "롯데"],
    "KB":   ["KB국민", "국민카드", "KB"],
    "NH농협": ["농협카드", "NH"],
    "하나": ["하나카드", "하나"],
    "우리": ["우리카드", "우리"],
}

DEFAULT_FEE_RATE = 0.022   # 2.2% 가정 (학습 전)
# 매칭 시 허용하는 실효 수수료율 범위 (DEFAULT 기준 -0.5% ~ +4.0%):
# 실효 수수료율이 [DEFAULT_FEE_RATE - TOLERANCE_LOWER, DEFAULT_FEE_RATE + TOLERANCE_UPPER]
# 안에 들어오면 매칭 성공. 매출 합 환산하면
# [deposit/(1-(DEFAULT+TOLERANCE_UPPER)), deposit/(1-(DEFAULT-TOLERANCE_LOWER))].
TOLERANCE_LOWER = 0.005    # 수수료율 하한: DEFAULT - 0.5%
TOLERANCE_UPPER = 0.040    # 수수료율 상한: DEFAULT + 4.0%


def _detect_card_corp(remark1: str) -> Optional[str]:
    if not remark1:
        return None
    r = remark1.lower()
    for corp, keywords in CARD_CORP_KEYWORDS.items():
        for kw in keywords:
            if kw.lower() in r:
                return corp
    return None


def _find_approval_window(session: Session, business_id: int, card_corp: str,
                           deposit_date: datetime.date, deposit_amount: int,
                           lookback_days: int = 7) -> Optional[CardFeeMatchLog]:
    """deposit_date 이전 lookback_days 일자 묶음에서 입금과 매칭되는 승인 합 찾기."""
    candidates = session.exec(
        select(CardSalesApproval).where(
            CardSalesApproval.business_id == business_id,
            CardSalesApproval.card_corp == card_corp,
            CardSalesApproval.approval_date >= deposit_date - datetime.timedelta(days=lookback_days),
            CardSalesApproval.approval_date < deposit_date,
            CardSalesApproval.status == "승인",
        ).order_by(CardSalesApproval.approval_date)
    ).all()
    if not candidates:
        return None

    daily_totals = {}
    for a in candidates:
        daily_totals[a.approval_date] = daily_totals.get(a.approval_date, 0) + (a.amount or 0)
    sorted_dates = sorted(daily_totals.keys())

    # 매출 합이 들어와야 하는 범위: 수수료율이 [DEFAULT-LOWER, DEFAULT+UPPER] 일 때의 sales 환산값.
    # rate 낮음 → sales 낮음, rate 높음 → sales 높음.
    expected_sales_low = deposit_amount / (1 - max(DEFAULT_FEE_RATE - TOLERANCE_LOWER, 0.0))
    expected_sales_high = deposit_amount / (1 - min(DEFAULT_FEE_RATE + TOLERANCE_UPPER, 0.5))

    for start_idx in range(len(sorted_dates)):
        cumulative = 0
        for end_idx in range(start_idx, len(sorted_dates)):
            cumulative += daily_totals[sorted_dates[end_idx]]
            if expected_sales_low <= cumulative <= expected_sales_high:
                return CardFeeMatchLog(
                    business_id=business_id, card_corp=card_corp,
                    deposit_date=deposit_date,
                    approval_dates_start=sorted_dates[start_idx],
                    approval_dates_end=sorted_dates[end_idx],
                    sales_amount=cumulative,
                    deposit_amount=deposit_amount,
                    effective_fee=cumulative - deposit_amount,
                    effective_rate=(cumulative - deposit_amount) / cumulative,
                )
    return None


def run_deposit_match(session: Session, business_id: int,
                       period_days: int = 90) -> int:
    """최근 period_days 일 은행 입금 중 미매칭 카드 입금을 식별 → CardFeeMatchLog 생성."""
    cutoff = datetime.date.today() - datetime.timedelta(days=period_days)
    txs = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.trans_date >= cutoff,
            BankTransaction.in_amount > 0,
        )
    ).all()

    created = 0
    for tx in txs:
        corp = _detect_card_corp(tx.remark1 or "")
        if not corp:
            continue
        existing = session.exec(
            select(CardFeeMatchLog).where(
                CardFeeMatchLog.business_id == business_id,
                CardFeeMatchLog.card_corp == corp,
                CardFeeMatchLog.deposit_date == tx.trans_date,
                CardFeeMatchLog.deposit_amount == int(tx.in_amount),
            )
        ).first()
        if existing:
            continue
        match = _find_approval_window(session, business_id, corp,
                                       tx.trans_date, int(tx.in_amount))
        if match:
            session.add(match)
            created += 1
    session.commit()
    return created


# ========== Step 6.4: 학습 알고리즘 ==========

def update_learned_rate(session: Session, business_id: int, card_corp: str,
                         period_days: int = 90, min_samples: int = 10):
    """최근 period_days 매칭 표본으로 학습값 갱신."""
    cutoff = datetime.date.today() - datetime.timedelta(days=period_days)
    samples = session.exec(
        select(CardFeeMatchLog).where(
            CardFeeMatchLog.business_id == business_id,
            CardFeeMatchLog.card_corp == card_corp,
            CardFeeMatchLog.matched_at >= datetime.datetime.combine(cutoff, datetime.time.min),
        )
    ).all()
    if len(samples) < min_samples:
        return

    def weight(d: datetime.date) -> float:
        days_ago = (datetime.date.today() - d).days
        return 0.5 ** (max(days_ago, 0) / 30)

    sum_w = sum(weight(s.matched_at.date()) for s in samples)
    weighted_rate = sum(s.effective_rate * weight(s.matched_at.date()) for s in samples) / sum_w
    variance = sum((s.effective_rate - weighted_rate) ** 2 * weight(s.matched_at.date()) for s in samples) / sum_w
    std_dev = math.sqrt(variance)

    confidence = min(1.0,
        (min(len(samples), 30) / 30) * 0.5 +
        (1.0 - min(1.0, std_dev * 100)) * 0.5
    )

    existing = session.exec(
        select(CardFeeRateLearned).where(
            CardFeeRateLearned.business_id == business_id,
            CardFeeRateLearned.card_corp == card_corp,
        )
    ).first()
    period_start = min(s.matched_at.date() for s in samples)
    period_end = max(s.matched_at.date() for s in samples)
    if existing:
        existing.learned_rate = weighted_rate
        existing.sample_size = len(samples)
        existing.confidence = confidence
        existing.last_updated_at = datetime.datetime.now()
        existing.sample_period_start = period_start
        existing.sample_period_end = period_end
        session.add(existing)
    else:
        session.add(CardFeeRateLearned(
            business_id=business_id, card_corp=card_corp,
            learned_rate=weighted_rate, sample_size=len(samples),
            confidence=confidence, sample_period_start=period_start,
            sample_period_end=period_end,
        ))
    session.commit()


# ========== Step 6.5: 배달 수수료 ==========

@dataclass
class DeliveryFeeEstimate:
    amount: int
    source: Literal["coupang_direct", "owner_input_rate", "unavailable"]
    confidence: float


def estimate_delivery_fee(session: Session, business_id: int, channel: str,
                           settlement_date: datetime.date,
                           settlement_amount: int) -> DeliveryFeeEstimate:
    if channel == "쿠팡이츠":
        # 쿠팡이츠는 normalize_coupang_eats 가 이미 항목별 분해로 처리.
        return DeliveryFeeEstimate(amount=0, source="coupang_direct", confidence=1.0)

    rate_row = _active_delivery_rate(session, business_id, channel, settlement_date)
    if not rate_row:
        return DeliveryFeeEstimate(amount=0, source="unavailable", confidence=0.0)

    estimated_sales = int(settlement_amount / (1 - rate_row.rate))
    estimated_fee = estimated_sales - settlement_amount
    return DeliveryFeeEstimate(
        amount=estimated_fee, source="owner_input_rate", confidence=0.7,
    )


def _active_delivery_rate(session: Session, business_id: int, channel: str,
                           on_date: datetime.date) -> Optional[DeliveryFeeRate]:
    return session.exec(
        select(DeliveryFeeRate).where(
            DeliveryFeeRate.business_id == business_id,
            DeliveryFeeRate.channel == channel,
            DeliveryFeeRate.effective_from <= on_date,
        ).order_by(DeliveryFeeRate.effective_from.desc())
    ).first()
