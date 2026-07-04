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


def test_extract_summary_daily_variant():
    """(일별) export 는 괄호 코드가 (A)/(B)/(C) + 보류/조정 컬럼이 추가된다."""
    from services.ddangyo_excel_parser import extract_summary
    rows = [
        ["2025년10월  정산 내역 ( 가게전체)"],
        [],
        ["정산내역 (요약)"],
        ["정산정보", "정산정보", "정산정보", "조정정보", "조정정보", "입금금액"],
        ["(A)주문결제", "(B)차감금액", "(C)정산금액", "(D)보류금액", "(E)정산조정", "입금금액"],
        [836000.0, -212399.0, 623601.0, 0.0, 0.0, 623601.0],
        [],
        ["용어설명"],
    ]
    p = extract_summary(rows)
    assert p.gross == 836000
    assert p.total_fees == 212399    # (B)차감금액 — (D)보류금액(0) 아님
    assert p.settlement == 623601    # (C)정산금액 — (E)정산조정(0) 아님


def test_missing_label_raises():
    from services.ddangyo_excel_parser import extract_summary, DdangyoExcelError
    with pytest.raises(DdangyoExcelError):
        extract_summary([["no", "summary", "here"]])
