"""배민 정산명세서 파서 — 1·2·3월 실제 파일 검증."""
from pathlib import Path

import pytest

from services.baemin_excel_parser import (
    parse_xlsx, aggregate_completed, BaeminExcelError,
)

JAN_PATH = Path(
    "c:/WORK/SodamFN/2026소득분석/매출/1월/[배달의민족] HONG JI YEON 파트너님 2026년 1월 정산명세서 .xlsx"
)
FEB_PATH = Path(
    "c:/WORK/SodamFN/2026소득분석/매출/2월/배달의민족_2026년 2월 정산명세서.xlsx"
)
MAR_PATH = Path(
    "c:/WORK/SodamFN/2026소득분석/매출/3월/[배달의민족] HONG JI YEON 파트너님 2026년 3월 정산명세서.xlsx"
)


def test_parse_jan_2026_encrypted():
    if not JAN_PATH.exists():
        pytest.skip(f"실제 파일 없음: {JAN_PATH}")
    parsed = parse_xlsx(JAN_PATH.read_bytes(), password="630730",
                        file_name=JAN_PATH.name)
    assert parsed.summary["deposit_total"] == 3000331
    assert parsed.summary["order_brokerage_total"] == 4300507
    assert parsed.summary["delivery_total"] == -1044054
    assert parsed.summary["vat_total"] == -151248
    # 1월: 광고 없음
    assert parsed.summary["ad_total"] == 0
    assert len(parsed.detail_rows) > 0
    # 27 컬럼 — '부분환불금액' 있음, 우리가게클릭 단일컬럼
    assert parsed.detail_columns == 27
    # refund_amount 매핑 확인
    assert "refund_amount" in parsed.column_index_map
    # ad_vat 는 1월 엔 없음
    assert "ad_vat" not in parsed.column_index_map
    # 거래기간 검증
    assert parsed.period_text is not None and "2025-12-29" in parsed.period_text


def test_parse_feb_2026_unencrypted():
    """2월 파일은 평문 — 비번 잘못 줘도 fallback 동작."""
    if not FEB_PATH.exists():
        pytest.skip(f"실제 파일 없음: {FEB_PATH}")
    parsed = parse_xlsx(FEB_PATH.read_bytes(), password="wrong",
                        file_name=FEB_PATH.name)
    assert parsed.summary["deposit_total"] == 2098468
    assert parsed.summary["order_brokerage_total"] == 2909188
    assert parsed.summary["misc_total"] == 8286
    assert parsed.summary["vat_total"] == -96755
    assert len(parsed.detail_rows) > 0
    # 26 컬럼 — '부분환불금액' 없음, 조정금액 있음
    assert parsed.detail_columns == 26
    assert "refund_amount" not in parsed.column_index_map
    assert "adjustment_amount" in parsed.column_index_map


def test_parse_mar_2026_with_ad_vat():
    if not MAR_PATH.exists():
        pytest.skip(f"실제 파일 없음: {MAR_PATH}")
    parsed = parse_xlsx(MAR_PATH.read_bytes(), password="630730",
                        file_name=MAR_PATH.name)
    assert parsed.summary["deposit_total"] == 1966703
    assert parsed.summary["order_brokerage_total"] == 3224266
    # 3월은 ad_total 있음 (우리가게클릭)
    assert parsed.summary["ad_total"] == -316470
    assert len(parsed.detail_rows) > 0
    # 28 컬럼 — '부분환불금액' + 우리가게클릭 2컬럼 (요금+부가세)
    assert parsed.detail_columns == 28
    assert "refund_amount" in parsed.column_index_map
    assert "ad_amount" in parsed.column_index_map
    assert "ad_vat" in parsed.column_index_map


def test_parse_mar_2026_password_then_plaintext_fallback():
    """3월 파일은 암호화. 비번 없이는 실패해야 한다."""
    if not MAR_PATH.exists():
        pytest.skip(f"실제 파일 없음: {MAR_PATH}")
    with pytest.raises(BaeminExcelError):
        # 빈 비번 → 복호화 skip → 평문 시도 → PK 시그너처 없음 → 에러
        parse_xlsx(MAR_PATH.read_bytes(), password=None)


def test_aggregate_completed_jan():
    """입금완료 row 합계가 [요약] R6 값과 정합 검증.

    [요약].deposit_total 는 입금완료 row 의 deposit_final 합이어야 한다.
    """
    if not JAN_PATH.exists():
        pytest.skip(f"실제 파일 없음: {JAN_PATH}")
    parsed = parse_xlsx(JAN_PATH.read_bytes(), password="630730")
    agg = aggregate_completed(parsed.detail_rows)
    # row_count > 0
    assert agg.row_count > 0
    # 합계 = [요약].deposit_total (배민이 같은 로직 사용)
    assert agg.total_deposit == parsed.summary["deposit_total"]


def test_aggregate_completed_feb():
    if not FEB_PATH.exists():
        pytest.skip(f"실제 파일 없음: {FEB_PATH}")
    parsed = parse_xlsx(FEB_PATH.read_bytes())
    agg = aggregate_completed(parsed.detail_rows)
    assert agg.row_count > 0
    assert agg.total_deposit == parsed.summary["deposit_total"]


def test_aggregate_completed_mar():
    if not MAR_PATH.exists():
        pytest.skip(f"실제 파일 없음: {MAR_PATH}")
    parsed = parse_xlsx(MAR_PATH.read_bytes(), password="630730")
    agg = aggregate_completed(parsed.detail_rows)
    assert agg.row_count > 0
    assert agg.total_deposit == parsed.summary["deposit_total"]


def test_upsert_excel_settlement_idempotent():
    """upsert_excel_settlement — DB 적재 + 재 import 시 truncate 동작 검증."""
    if not FEB_PATH.exists():
        pytest.skip(f"실제 파일 없음: {FEB_PATH}")

    from sqlmodel import Session, SQLModel, create_engine, select
    from models import (
        Business, BaeminSettlementDetail, BaeminMonthlySummary, DeliveryRevenue,
    )
    from services.baemin_service import upsert_excel_settlement

    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as s:
        s.add(Business(id=1, name="test", subscription_status="active"))
        s.commit()

    parsed = parse_xlsx(FEB_PATH.read_bytes(), file_name=FEB_PATH.name)
    with Session(eng) as s:
        r1 = upsert_excel_settlement(s, 1, 2026, 2, parsed)
        first_count = r1["detail_rows_inserted"]
        assert first_count > 0
        assert r1["delivery_revenue_settlement"] == parsed.summary["deposit_total"]

        # 재 import — truncate 후 재삽입
        r2 = upsert_excel_settlement(s, 1, 2026, 2, parsed)
        assert r2["detail_rows_inserted"] == first_count
        # 행 수 일치 확인
        rows = s.exec(select(BaeminSettlementDetail).where(
            BaeminSettlementDetail.business_id == 1,
            BaeminSettlementDetail.year == 2026,
            BaeminSettlementDetail.month == 2,
        )).all()
        assert len(rows) == first_count
        # 요약 1행만 존재
        summaries = s.exec(select(BaeminMonthlySummary).where(
            BaeminMonthlySummary.business_id == 1,
        )).all()
        assert len(summaries) == 1
        # DeliveryRevenue 1행만 존재 — source='excel'
        drs = s.exec(select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == 1,
            DeliveryRevenue.channel == "배달의민족",
            DeliveryRevenue.year == 2026,
            DeliveryRevenue.month == 2,
        )).all()
        assert len(drs) == 1
        assert drs[0].source == "excel"
        assert drs[0].settlement_amount == parsed.summary["deposit_total"]
