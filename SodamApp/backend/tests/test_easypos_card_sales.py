"""EasyPOS 카드 매출 sync 테스트."""
import datetime

from sqlmodel import select

from models import Business, CardSalesApproval


def test_normalize_card_corp():
    from services.easypos_service import _normalize_card_corp
    assert _normalize_card_corp("KB국민카드") == "KB국민"
    assert _normalize_card_corp("신한카드") == "신한"
    assert _normalize_card_corp("BC카드") == "BC"
    assert _normalize_card_corp("비씨카드") == "BC"
    assert _normalize_card_corp("롯데카드") == "롯데"
    assert _normalize_card_corp("하나구외환") == "하나"   # EasyPOS 매입사 표기
    assert _normalize_card_corp("NH카드") == "NH농협"     # EasyPOS 매입사 표기
    assert _normalize_card_corp("새로운카드") == "새로운카드"  # 미매칭 → 원본
    assert _normalize_card_corp("") == ""


def test_upsert_card_sales_inserts(session):
    session.add(Business(id=1, name="X"))
    session.commit()
    from services.easypos_service import upsert_card_sales

    # 실제 EasyPOS dsOutCardSaleList 응답 형식 (사장님 검증 2026-05-13)
    fake_result = {
        "rows": [
            {
                "영업일자": "20260513",
                "매장코드": "103381",
                "포스번호": "01",
                "영수증번호": "000001",
                "거래일자": "2026-05-13",
                "거래시간": "05:12:58",
                "승인구분": "POS승인",
                "승인번호": "30063526",
                "카드번호": "4673-0952-****-507",
                "카드사": "KB국민카드",
                "매입사": "KB국민카드",
                "승인금액": "3500",
                "할부개월수": "일시불",
                "매출구분": "승인",
                "부가세": "318",
                "메세지": "KICC로제출",
            },
            {
                "영업일자": "20260513",
                "영수증번호": "000007",
                "거래시간": "06:30:38",
                "승인구분": "POS승인",
                "승인번호": "49446124",
                "카드사": "신롯데카드",
                "매입사": "롯데카드",       # 발급(신롯데) ≠ 매입(롯데)
                "승인금액": "3000",
                "할부개월수": "일시불",
                "매출구분": "승인",
            },
        ],
        "total_amount": 6500,
        "row_count": 2,
    }
    summary = upsert_card_sales(session, 1, fake_result)
    assert summary["inserted"] == 2
    assert summary["updated"] == 0

    rows = session.exec(select(CardSalesApproval)).all()
    assert len(rows) == 2
    by_corp = {r.card_corp: r for r in rows}
    assert by_corp["KB국민"].amount == 3500
    # 신롯데카드 발급 → 매입사 '롯데카드' 기준으로 정규화
    assert by_corp["롯데"].amount == 3000
    assert by_corp["롯데"].shop_name == "신롯데카드"  # 발급사명 보존
    assert all(r.source == "easypos" for r in rows)


def test_upsert_card_sales_idempotent(session):
    """두 번 호출해도 중복 안 생기고 update 만."""
    session.add(Business(id=1, name="X"))
    session.commit()
    from services.easypos_service import upsert_card_sales

    fake_result = {
        "rows": [{
            "영업일자": "20260513",
            "거래시간": "12:34",
            "승인번호": "12345678",
            "카드사": "신한카드",
            "매입사": "신한카드",
            "승인금액": "10000",
            "매출구분": "승인",
        }],
        "total_amount": 10000,
        "row_count": 1,
    }
    s1 = upsert_card_sales(session, 1, fake_result)
    s2 = upsert_card_sales(session, 1, fake_result)
    assert s1["inserted"] == 1 and s2["inserted"] == 0
    assert s2["updated"] == 1
    rows = session.exec(select(CardSalesApproval)).all()
    assert len(rows) == 1


def test_cancel_status_classified(session):
    """매출구분 '취소' 인 행은 status='취소' 로 저장.

    승인구분('POS승인') 은 채널 표시고, status 는 매출구분(승인/취소) 으로 결정.
    """
    session.add(Business(id=1, name="X"))
    session.commit()
    from services.easypos_service import upsert_card_sales

    fake_result = {
        "rows": [{
            "영업일자": "20260513",
            "승인번호": "9999",
            "카드사": "비씨카드",
            "매입사": "비씨카드",
            "승인금액": "12000",
            "승인구분": "POS승인",   # 채널 (취소도 POS 채널에서 발생)
            "매출구분": "취소",      # 실제 status
        }],
        "total_amount": 12000,
        "row_count": 1,
    }
    upsert_card_sales(session, 1, fake_result)
    row = session.exec(select(CardSalesApproval)).first()
    assert row.status == "취소"


def test_skipped_when_missing_required_fields(session):
    """영업일자 또는 승인번호 없으면 skip."""
    session.add(Business(id=1, name="X"))
    session.commit()
    from services.easypos_service import upsert_card_sales

    fake_result = {
        "rows": [
            {"카드사": "신한카드", "매입사": "신한카드", "승인금액": "5000"},
            {"영업일자": "20260513", "승인번호": "111", "카드사": "삼성카드",
             "매입사": "삼성카드", "승인금액": "8000"},
        ],
        "total_amount": 13000,
        "row_count": 2,
    }
    summary = upsert_card_sales(session, 1, fake_result)
    assert summary["inserted"] == 1
    assert summary["skipped"] == 1


def test_acquirer_priority_over_issuer(session):
    """발급사(카드사) ≠ 매입사 인 경우 매입사 우선으로 card_corp 결정.

    CODEF 카드 정산 명세와 동일 식별자 유지 — 사장님 P/L 합산 일관성.
    예: 발급='신세계백화점카드' / 매입='비씨카드' → card_corp='BC'.
    """
    session.add(Business(id=1, name="X"))
    session.commit()
    from services.easypos_service import upsert_card_sales

    fake_result = {
        "rows": [{
            "영업일자": "20260513",
            "승인번호": "71847694",
            "카드사": "신세계백화점카드",
            "매입사": "비씨카드",
            "승인금액": "12000",
            "매출구분": "승인",
        }],
        "total_amount": 12000,
        "row_count": 1,
    }
    upsert_card_sales(session, 1, fake_result)
    row = session.exec(select(CardSalesApproval)).first()
    assert row.card_corp == "BC"
    assert row.shop_name == "신세계백화점카드"
