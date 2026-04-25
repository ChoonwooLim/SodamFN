"""Tax calculator adapter.

Phase C (현재): StubTaxCalculator — 계산하지 않고 confirmed 값을 그대로 반환.
Phase A (향후): StandardKoreanTaxCalculator — 한국 세법 풀 계산. 미구현.

전환 방법: env YEAR_END_TAX_CALCULATOR=standard 또는 settings 값으로 분기.
"""
from __future__ import annotations
import os
from dataclasses import dataclass
from typing import Optional, Protocol


@dataclass
class CalculationResult:
    decided_tax: Optional[int]      # 결정세액
    taxes_paid: Optional[int]       # 기납부세액
    refund_amount: Optional[int]    # 차감징수세액 (음수=환급)
    source: str                     # "uploaded" / "self_aggregated" / "computed"


class TaxCalculator(Protocol):
    def calculate(self, report, simplified) -> CalculationResult: ...


class StubTaxCalculator:
    """계산하지 않음. 업로드본 우선, 없으면 자체 집계 그대로."""

    def calculate(self, report, simplified=None) -> CalculationResult:
        if report.confirmed_taxes_paid is not None:
            return CalculationResult(
                decided_tax=report.decided_tax,
                taxes_paid=report.confirmed_taxes_paid,
                refund_amount=report.refund_amount,
                source="uploaded",
            )
        return CalculationResult(
            decided_tax=None,
            taxes_paid=report.taxes_withheld_total,
            refund_amount=None,
            source="self_aggregated",
        )


class StandardKoreanTaxCalculator:
    """Phase A 자리표시자. 호출 시 NotImplementedError."""

    def calculate(self, report, simplified=None) -> CalculationResult:
        raise NotImplementedError(
            "Phase A 한국 세법 풀 계산은 아직 미구현. tax_calculator.py 참조."
        )


def get_calculator() -> TaxCalculator:
    kind = os.getenv("YEAR_END_TAX_CALCULATOR", "stub").lower()
    if kind == "standard":
        return StandardKoreanTaxCalculator()
    return StubTaxCalculator()
