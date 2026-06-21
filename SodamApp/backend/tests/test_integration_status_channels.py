import importlib, os, tempfile, datetime
import pytest
from sqlmodel import SQLModel, Session


@pytest.fixture
def db(monkeypatch):
    f = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
    f.close()
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{f.name}")
    import database
    importlib.reload(database)
    import models  # noqa: F401 — create_all 전 전체 테이블 등록 보장 (conftest.py 패턴)
    SQLModel.metadata.create_all(database.engine)
    yield database
    try:
        os.unlink(f.name)
    except (PermissionError, FileNotFoundError):
        pass


def test_status_includes_easypos_and_codef(db):
    """build_all_channels 가 5개 채널 키를 모두 포함."""
    from routers import external_integration_status as m
    now = datetime.datetime(2026, 6, 22, 0, 0)
    with Session(db.engine) as s:
        channels = m.build_all_channels(s, 1, now)
    keys = {c["channel_key"] for c in channels}
    assert {"coupang_eats", "baemin", "easypos", "codef_card", "codef_bank"} <= keys
