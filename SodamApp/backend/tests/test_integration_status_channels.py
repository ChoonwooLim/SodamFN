import datetime
from types import SimpleNamespace

import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine


@pytest.fixture
def db():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    import models  # noqa: F401 — create_all 전 전체 테이블 등록 보장 (conftest.py 패턴)
    SQLModel.metadata.create_all(engine)
    yield SimpleNamespace(engine=engine)


def test_status_includes_easypos_and_codef(db):
    """build_all_channels 가 5개 채널 키를 모두 포함."""
    from routers import external_integration_status as m
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        channels = m.build_all_channels(s, 1, now)
    keys = {c["channel_key"] for c in channels}
    assert {"coupang_eats", "baemin", "easypos", "codef_card", "codef_bank"} <= keys


def test_alert_count_zero_when_all_unconfigured(db):
    """미등록 채널만 있으면 배지 alert_count == 0 (skipping 은 alertable 아님)."""
    import datetime
    from routers import external_integration_status as m
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        channels = m.build_all_channels(s, 1, now)
    alert_count = sum(1 for c in channels if c["status"] in m.ALERTABLE_STATUSES)
    assert alert_count == 0
