"""Nexacro PlatformData SSV (Semicolon Separated Values v2) 파서.

이지포스(smart.easypos.net) 등 Nexacro 14 기반 사이트가 XHR 응답으로 사용하는
바이너리스러운 텍스트 포맷. JSON/XML 이 아니라 ASCII 제어문자로 구분된다.

포맷:
  \\x1e (RS, Record Separator) = 레코드/섹션 구분자
  \\x1f (US, Unit Separator)   = 필드/컬럼 구분자

구조 예:
  SSV:UTF-8 \\x1e
  ErrorCode:string=0 \\x1e
  ErrorMsg:string= \\x1e
  Dataset:dsName \\x1e
  _RowType_ \\x1f col1:type(size) \\x1f col2:type(size) \\x1e
  N \\x1f val1 \\x1f val2 \\x1e
  N \\x1f val1 \\x1f val2 \\x1e

행 prefix:
  N = Normal (조회 결과 기본)
  I = Insert / U = Update / D = Delete (입력 폼 전송 시)
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any, Optional

RS = "\x1e"  # Record Separator
US = "\x1f"  # Unit Separator


@dataclass
class SsvResponse:
    """파싱된 SSV 응답."""
    error_code: str = "0"
    error_msg: str = ""
    datasets: dict[str, list[dict[str, Any]]] = field(default_factory=dict)
    params: dict[str, str] = field(default_factory=dict)

    @property
    def ok(self) -> bool:
        return self.error_code in ("0", "")

    def first(self, dataset_name: str) -> Optional[dict[str, Any]]:
        rows = self.datasets.get(dataset_name) or []
        return rows[0] if rows else None


_COL_RE = re.compile(r"^([^:]+):(\w+)(?:\((\d+)\))?$")


def _coerce(value: str, col_type: str) -> Any:
    if value == "":
        return None
    t = col_type.lower()
    if t == "string":
        return value
    if t in ("int", "bigdecimal", "decimal", "long", "short"):
        try:
            if "." in value:
                return Decimal(value)
            return int(value)
        except (ValueError, InvalidOperation):
            return value
    if t == "float":
        try:
            return float(value)
        except ValueError:
            return value
    return value


def parse_ssv(text: str) -> SsvResponse:
    """SSV 텍스트를 파싱한다.

    빈 응답이면 error_code='ERR' 로 표시.
    파싱 중 실패하면 예외를 raise — 호출자가 처리.
    """
    if not text:
        return SsvResponse(error_code="ERR", error_msg="empty response")

    out = SsvResponse()
    records = text.split(RS)
    # 첫 줄이 SSV:UTF-8 시그너처
    if records and records[0].upper().startswith("SSV:"):
        records = records[1:]

    current_dataset: Optional[str] = None
    current_columns: Optional[list[tuple[str, str]]] = None

    for rec in records:
        if rec == "":
            current_dataset = None
            current_columns = None
            continue

        # 헤더: ErrorCode:string=0  / ErrorMsg:string=어쩌고
        if current_dataset is None and rec.startswith("ErrorCode:"):
            out.error_code = rec.split("=", 1)[1] if "=" in rec else ""
            continue
        if current_dataset is None and rec.startswith("ErrorMsg:"):
            out.error_msg = rec.split("=", 1)[1] if "=" in rec else ""
            continue

        # Dataset 선언: Dataset:dsName
        if rec.startswith("Dataset:"):
            current_dataset = rec[len("Dataset:"):]
            current_columns = None
            out.datasets.setdefault(current_dataset, [])
            continue

        # 컬럼 정의 행: _RowType_ \x1f col1:type(size) \x1f col2:...
        if current_dataset is not None and rec.startswith("_RowType_"):
            parts = rec.split(US)
            cols: list[tuple[str, str]] = []
            for p in parts[1:]:
                if not p:
                    continue
                m = _COL_RE.match(p)
                if m:
                    cols.append((m.group(1), m.group(2)))
                else:
                    cols.append((p, "string"))
            current_columns = cols
            continue

        # 데이터 행: N \x1f val1 \x1f val2 ...
        if current_dataset is not None and current_columns is not None:
            parts = rec.split(US)
            if not parts:
                continue
            row_type = parts[0]
            if row_type not in ("N", "I", "U", "D"):
                continue
            values = parts[1:]
            row: dict[str, Any] = {"_rowType": row_type}
            for i, (col_name, col_type) in enumerate(current_columns):
                raw = values[i] if i < len(values) else ""
                row[col_name] = _coerce(raw, col_type)
            out.datasets[current_dataset].append(row)
            continue

    return out


def build_ssv_request(params: dict[str, Any], datasets: Optional[dict[str, dict]] = None) -> str:
    """단순 요청 SSV 생성. 이지포스는 대부분 key=value 쌍만 쓰는 응용 — Dataset 인자는 선택.

    이지포스 패턴 예 (HAR 분석):
      SSV:utf-8\\x1eeasyposid=6391201514\\x1eshopNo=\\x1esaleDate=20260512\\x1eposNo=\\x1esaleFg=\\x1eCHK_ID=6391201514
    """
    parts: list[str] = ["SSV:utf-8"]
    for k, v in params.items():
        parts.append(f"{k}={v if v is not None else ''}")
    if datasets:
        for name, ds in datasets.items():
            parts.append(f"Dataset:{name}")
            cols = ds.get("columns", [])
            col_line = "_RowType_" + "".join(US + c for c in cols)
            parts.append(col_line)
            for row_type, values in ds.get("rows", []):
                row_line = row_type + "".join(US + str(v if v is not None else "") for v in values)
                parts.append(row_line)
    return RS.join(parts)
