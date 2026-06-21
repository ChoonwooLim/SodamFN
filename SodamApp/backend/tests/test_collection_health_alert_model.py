import importlib, os, tempfile, datetime
import pytest
from sqlmodel import SQLModel, Session, select


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


def test_create_and_query(db):
    from models import CollectionHealthAlert
    with Session(db.engine) as s:
        s.add(CollectionHealthAlert(
            business_id=1, channel_key="coupang_eats",
            status="open", alert_type="failed",
            opened_at=datetime.datetime.utcnow(), detail="쿠키 만료",
        ))
        s.commit()
        row = s.exec(select(CollectionHealthAlert).where(
            CollectionHealthAlert.channel_key == "coupang_eats")).first()
    assert row.status == "open" and row.alert_type == "failed"
