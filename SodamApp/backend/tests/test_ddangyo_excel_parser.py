"""땡겨요 파서 테스트 — 순수 추출함수(합성 rows)."""
import pytest


def test_extract_summary_from_rows():
    from services.ddangyo_excel_parser import extract_summary
    rows = [
        ["2026년01월  정산 내역"],
        [],
        ["정산내역 (요약)"],
        ["정산정보", "정산정보", "정산정보"],
        ["(A)주문결제", "(D)차감금액", "(E)정산금액"],
        [27500.0, -1052.0, 26448.0],
        [],
        ["용어설명"],
    ]
    p = extract_summary(rows)
    assert p.gross == 27500          # A 주문결제
    assert p.total_fees == 1052      # D 차감금액 (절댓값)
    assert p.settlement == 26448     # E 정산금액
    assert p.fee_rate == 3.8         # 1052/27500


def test_missing_label_raises():
    from services.ddangyo_excel_parser import extract_summary, DdangyoExcelError
    with pytest.raises(DdangyoExcelError):
        extract_summary([["no", "summary", "here"]])
