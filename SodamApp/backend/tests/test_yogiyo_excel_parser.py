"""요기요 파서 테스트 — 합성 fixture(민감자료 미커밋)."""
import io
import openpyxl
import pytest


def _make_yogiyo_xlsx():
    """실제 요기요 요약/상세 구조를 축약한 합성 xlsx bytes."""
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "요약"
    ws.append(["정산내역"])
    ws.append([])
    ws.append(["A", "주문금액", None, 424500])
    ws.append(["B", "일회용컵보증금", None, 0])
    ws.append(["C", "차감금액", None, 215458])
    ws.append(["C-8", "주문중개 이용료", None, 43592])
    ws.append(["C-9", "배달대행 이용료", None, 76560])
    ws.append(["C-5", "쿠폰(가게부담)", None, 17000])
    ws.append(["C-6", "프로모션(가게부담)", None, 0])   # 0 → breakdown 제외
    ws.append(["D", "정산금액", None, 209042])
    ws.append(["F", "입금받으실 금액", None, 209042])
    ws2 = wb.create_sheet("상세 거래내역")
    ws2.append(["상세", "거래내역"])
    ws2.append(["상호명: 테스트"])
    ws2.append(["NO", "지급일", "주문번호", "주문금액"])
    ws2.append([1, "2026-01-09", "F1", 20000])
    ws2.append([2, "2026-01-12", "F2", 12000])
    ws2.append([3, "2026-01-13", "F3", 16500])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_parses_summary_and_breakdown():
    from services.yogiyo_excel_parser import parse_xlsx
    p = parse_xlsx(_make_yogiyo_xlsx())
    assert p.gross == 424500          # A 주문금액
    assert p.total_fees == 215458     # C 차감금액 (총비용)
    assert p.settlement == 209042     # D 정산금액
    assert p.fee_rate == 50.8         # 215458/424500
    assert p.order_count == 3         # 상세 3행
    assert p.fee_breakdown["주문중개 이용료"] == 43592
    assert p.fee_breakdown["배달대행 이용료"] == 76560
    assert p.fee_breakdown["쿠폰(가게부담)"] == 17000
    assert "프로모션(가게부담)" not in p.fee_breakdown   # 0 은 제외


def test_rejects_non_xlsx():
    from services.yogiyo_excel_parser import parse_xlsx, YogiyoExcelError
    with pytest.raises(YogiyoExcelError):
        parse_xlsx(b"not a zip")
