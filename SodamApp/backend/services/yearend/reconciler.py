"""Reconciler: 자체 집계 vs 업로드본 정본 대조 검증."""
from __future__ import annotations
from typing import Optional


# 임계값 (원). 변경 시 spec § 3.1 도 함께 업데이트.
THRESHOLD_OK = 1_000
THRESHOLD_WARNING = 10_000


def classify_diff(self_total: int, confirmed: Optional[int]) -> tuple[str, int]:
    """(status, diff) 반환.
    - confirmed=None → ("pending", 0)
    - |diff| ≤ 1,000 → "ok"
    - |diff| ≤ 10,000 → "warning"
    - 그 외 → "mismatch"
    diff = confirmed - self_total (양수 = 업로드본이 더 큼)
    """
    if confirmed is None:
        return ("pending", 0)
    diff = confirmed - self_total
    abs_diff = abs(diff)
    if abs_diff <= THRESHOLD_OK:
        return ("ok", diff)
    if abs_diff <= THRESHOLD_WARNING:
        return ("warning", diff)
    return ("mismatch", diff)


def reconcile(report) -> tuple[str, int]:
    """YearEndReport → (status, diff). report 자체는 변경 안 함; 호출 측이 저장."""
    return classify_diff(
        report.taxes_withheld_total,
        report.confirmed_taxes_paid,
    )
