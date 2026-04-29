import datetime
import pytest
from sqlmodel import SQLModel, Session, create_engine
from models import CodefConnection, CardMerchant, CodefCallLog, CodefBudgetSetting, Business


@pytest.fixture
def engine():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    return e


@pytest.fixture
def biz(engine):
    with Session(engine) as s:
        b = Business(name="테스트사업장", business_number="1234567890")
        s.add(b)
        s.commit()
        s.refresh(b)
        return b.id


def test_codef_connection_create(engine, biz):
    with Session(engine) as s:
        c = CodefConnection(
            business_id=biz,
            organization_type="card",
            organization_code="0306",
            organization_label="신한카드",
            connected_id="abc123",
            auth_method="simple_auth",
        )
        s.add(c)
        s.commit()
        s.refresh(c)
        assert c.id is not None
        assert c.status == "active"
        assert c.created_at is not None


def test_codef_connection_unique_per_business_org(engine, biz):
    """같은 business + organization_code + type 으로 중복 등록 금지"""
    with Session(engine) as s:
        c1 = CodefConnection(business_id=biz, organization_type="card",
                             organization_code="0306", organization_label="신한카드",
                             connected_id="x", auth_method="simple_auth")
        s.add(c1); s.commit()

        c2 = CodefConnection(business_id=biz, organization_type="card",
                             organization_code="0306", organization_label="신한카드",
                             connected_id="y", auth_method="id_pw")
        s.add(c2)
        with pytest.raises(Exception):
            s.commit()


def test_card_merchant_fee_rate(engine, biz):
    with Session(engine) as s:
        m = CardMerchant(business_id=biz, card_corp="신한카드",
                         merchant_id="MID001", fee_rate=0.018)
        s.add(m); s.commit(); s.refresh(m)
        assert m.fee_rate == 0.018
        assert m.source == "codef"
        assert m.status == "active"


def test_codef_call_log_record(engine, biz):
    with Session(engine) as s:
        log = CodefCallLog(
            business_id=biz,
            api_path="/v1/kr/card/common/b/approval",
            organization_code="0306",
            status="success",
            rows_returned=42,
            triggered_by="cron",
        )
        s.add(log); s.commit(); s.refresh(log)
        assert log.called_date == datetime.date.today()
        assert log.estimated_cost_krw is None  # DEMO


def test_codef_budget_setting_unique_per_business(engine, biz):
    with Session(engine) as s:
        b1 = CodefBudgetSetting(business_id=biz, monthly_budget_krw=50000)
        s.add(b1); s.commit()

        b2 = CodefBudgetSetting(business_id=biz, monthly_budget_krw=70000)
        s.add(b2)
        with pytest.raises(Exception):
            s.commit()


def test_card_sales_approval_default_source(engine, biz):
    """기존 row 호환 — source default = 'excel'"""
    from models import CardSalesApproval
    with Session(engine) as s:
        row = CardSalesApproval(
            business_id=biz,
            approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드",
            amount=15000,
        )
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "excel"
        assert row.connection_id is None
        assert row.synced_at is None
        assert row.source_meta is None


def test_card_sales_approval_codef_source(engine, biz):
    """신규 CODEF 행 — source='codef' + connection_id FK"""
    from models import CardSalesApproval
    with Session(engine) as s:
        c = CodefConnection(business_id=biz, organization_type="card",
                            organization_code="0306", organization_label="신한카드",
                            connected_id="x", auth_method="simple_auth")
        s.add(c); s.commit(); s.refresh(c)

        row = CardSalesApproval(
            business_id=biz,
            approval_date=datetime.date(2026, 4, 29),
            card_corp="신한카드",
            amount=15000,
            source="codef",
            connection_id=c.id,
            synced_at=datetime.datetime.utcnow(),
        )
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "codef"
        assert row.connection_id == c.id
        assert row.synced_at is not None


def test_card_payment_source_columns(engine, biz):
    """CardPayment 도 동일한 4컬럼"""
    from models import CardPayment
    with Session(engine) as s:
        row = CardPayment(business_id=biz, payment_date=datetime.date(2026, 4, 29),
                          card_corp="삼성카드", net_deposit=120000)
        s.add(row); s.commit(); s.refresh(row)
        assert row.source == "excel"
        assert row.connection_id is None
        assert row.synced_at is None
