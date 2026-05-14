"""BaeminCredential / Order / Settlement / SyncLog 모델 검증."""
import datetime
import pytest
from sqlmodel import SQLModel, Session, create_engine, select
from models import (
    BaeminCredential, BaeminOrder, BaeminSettlement, BaeminSyncLog, Business,
)


@pytest.fixture
def s():
    eng = create_engine("sqlite://")
    SQLModel.metadata.create_all(eng)
    with Session(eng) as sess:
        biz = Business(id=1, name="test", subscription_status="active")
        sess.add(biz)
        sess.commit()
        yield sess


def test_credential_unique_per_business(s):
    s.add(BaeminCredential(business_id=1, login_id="boss@example.com"))
    s.commit()
    s.add(BaeminCredential(business_id=1, login_id="other"))
    with pytest.raises(Exception):
        s.commit()


def test_order_unique_per_business_order_id(s):
    s.add(BaeminOrder(business_id=1, store_id="A1", order_id="O1",
                     ordered_at=datetime.datetime(2026, 5, 1, 12, 0)))
    s.commit()
    s.add(BaeminOrder(business_id=1, store_id="A1", order_id="O1"))
    with pytest.raises(Exception):
        s.commit()


def test_settlement_unique_key(s):
    s.add(BaeminSettlement(
        business_id=1, store_id="A1",
        settlement_date=datetime.date(2026, 5, 1),
        settlement_type="SETTLEMENT",
        seller_transfer_id="T1", amount=100000))
    s.commit()
    s.add(BaeminSettlement(
        business_id=1, store_id="A1",
        settlement_date=datetime.date(2026, 5, 1),
        settlement_type="SETTLEMENT",
        seller_transfer_id="T1", amount=100000))
    with pytest.raises(Exception):
        s.commit()


def test_synclog_defaults(s):
    log = BaeminSyncLog(business_id=1)
    s.add(log)
    s.commit()
    s.refresh(log)
    assert log.status == "running"
    assert log.orders_fetched == 0
