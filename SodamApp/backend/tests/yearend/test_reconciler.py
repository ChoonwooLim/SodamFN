"""Reconciler: 자체 집계 vs 업로드본 정본 대조."""
import pytest


@pytest.mark.parametrize("self_total,confirmed,expected_status,expected_diff", [
    (1_000_000, 1_000_000, "ok",       0),
    (1_000_000, 1_000_500, "ok",       500),
    (1_000_000, 1_005_000, "warning",  5_000),
    (1_000_000, 1_015_000, "mismatch", 15_000),
    (1_000_000, 985_000,   "mismatch", -15_000),
    (1_000_000, 992_000,   "warning",  -8_000),
    (1_000_000, 999_000,   "ok",       -1_000),
])
def test_reconcile_thresholds(self_total, confirmed, expected_status, expected_diff):
    from services.yearend.reconciler import classify_diff
    status, diff = classify_diff(self_total, confirmed)
    assert status == expected_status
    assert diff == expected_diff


def test_reconcile_with_none_confirmed_returns_pending():
    from services.yearend.reconciler import classify_diff
    status, diff = classify_diff(1_000_000, None)
    assert status == "pending"
    assert diff == 0


def test_reconcile_warning_at_boundary_10k():
    """exact 10000 → warning, 10001 → mismatch."""
    from services.yearend.reconciler import classify_diff
    s10k, _ = classify_diff(0, 10_000)
    s10k1, _ = classify_diff(0, 10_001)
    assert s10k == "warning"
    assert s10k1 == "mismatch"
