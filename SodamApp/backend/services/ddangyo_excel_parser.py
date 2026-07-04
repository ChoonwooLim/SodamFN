"""땡겨요 정산내역 엑셀(.xls) 파서.

구조 (실제 샘플 기준, xlrd):
  요약: 라벨 행 "(A)주문결제 | (D)차감금액 | (E)정산금액", 다음 행에 값.
  ⚠️ export 종류에 따라 괄호 문자가 다름 — (건별)=(A)/(D)/(E), (일별)=(A)/(B)/(C).
  따라서 문자 코드가 아닌 **라벨명**(주문결제/차감금액/정산금액)으로 컬럼을 찾는다.
    주문결제  (= 매출 gross)
    차감금액  (= 총비용, 음수로 표기)
    정산금액  (= 정산)

주의: 땡겨요 정산내역도 정산 기준이므로 화면 매출은 결정 A(주문 기준)를 쓰고
여기서는 수수료율 산출용 gross/총비용/정산만 제공한다.
"""
from __future__ import annotations

from dataclasses import dataclass


class DdangyoExcelError(Exception):
    pass


@dataclass
class ParsedDdangyoMonth:
    gross: int = 0
    total_fees: int = 0
    settlement: int = 0

    @property
    def fee_rate(self) -> float:
        return round(self.total_fees / self.gross * 100, 1) if self.gross > 0 else 0.0


def _to_int(v) -> int:
    try:
        return int(round(abs(float(v))))
    except (TypeError, ValueError):
        return 0


def extract_summary(rows: list[list]) -> ParsedDdangyoMonth:
    """행 리스트(list-of-lists)에서 주문결제/차감금액/정산금액 요약 추출 — 순수 함수(테스트용).

    괄호 코드는 export 종류마다 달라((건별) A/D/E vs (일별) A/B/C) 라벨명으로 찾는다.
    """
    for i, row in enumerate(rows):
        joined = " ".join("" if c is None else str(c) for c in row)
        if "주문결제" in joined:
            # 같은 행에서 라벨명으로 컬럼 인덱스, 값은 다음 행 같은 인덱스
            labels = ["" if c is None else str(c) for c in row]
            def _col(tag):
                for j, lab in enumerate(labels):
                    if tag in lab:
                        return j
                return None
            ai, di, ei = _col("주문결제"), _col("차감금액"), _col("정산금액")
            if i + 1 >= len(rows) or ai is None or di is None or ei is None:
                raise DdangyoExcelError("요약 값 행을 찾지 못했습니다.")
            vals = rows[i + 1]
            return ParsedDdangyoMonth(
                gross=_to_int(vals[ai] if ai < len(vals) else 0),
                total_fees=_to_int(vals[di] if di < len(vals) else 0),
                settlement=_to_int(vals[ei] if ei < len(vals) else 0),
            )
    raise DdangyoExcelError("요약 라벨 '주문결제' 를 찾지 못했습니다.")


def parse_xls(file_bytes: bytes) -> ParsedDdangyoMonth:
    """땡겨요 .xls bytes → ParsedDdangyoMonth."""
    if not file_bytes:
        raise DdangyoExcelError("빈 파일")
    import xlrd
    wb = xlrd.open_workbook(file_contents=file_bytes)
    sh = wb.sheets()[0]
    rows = [[sh.cell_value(i, j) for j in range(sh.ncols)] for i in range(sh.nrows)]
    return extract_summary(rows)
