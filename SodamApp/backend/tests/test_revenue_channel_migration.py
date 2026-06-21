"""Revenue 채널명 마이그레이션 — idempotent + 중복 병합."""
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


def _add(db, channel, biz, d, amount):
    from models import Revenue
    with Session(db.engine) as s:
        s.add(Revenue(business_id=biz, date=d, channel=channel, amount=amount))
        s.commit()


def test_simple_rename_no_overlap(db):
    """겹치지 않는 영문 행은 한글로 rename."""
    from models import Revenue
    d = datetime.date(2026, 6, 20)
    _add(db, "Store", 1, d, 1000)
    _add(db, "CoupangEats", 1, d, 500)

    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        chans = {r.channel: r.amount for r in s.exec(select(Revenue)).all()}
    assert chans == {"매장": 1000, "쿠팡이츠": 500}


def test_merge_on_overlap(db):
    """같은 (biz,date)에 영문+한글 공존 → 한글에 합산, 영문 삭제."""
    from models import Revenue
    d = datetime.date(2026, 2, 28)
    _add(db, "매장", 1, d, 700)      # 구 레거시
    _add(db, "Store", 1, d, 300)     # 신규 영문

    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        rows = s.exec(select(Revenue).where(Revenue.channel == "매장")).all()
        eng = s.exec(select(Revenue).where(Revenue.channel == "Store")).all()
    assert len(rows) == 1 and rows[0].amount == 1000
    assert len(eng) == 0


def test_idempotent_rename(db):
    """2회 호출해도 안전 (두 번째는 no-op)."""
    from models import Revenue
    d = datetime.date(2026, 6, 20)
    _add(db, "Store", 1, d, 1000)

    db._run_revenue_channel_migration(db.engine)
    db._run_revenue_channel_migration(db.engine)

    with Session(db.engine) as s:
        rows = s.exec(select(Revenue).where(Revenue.channel == "매장")).all()
    assert len(rows) == 1 and rows[0].amount == 1000


def test_idempotent_after_merge(db):
    """병합 후 2회 호출 — 금액 중복 없음 (1700 아님)."""
    from models import Revenue
    d = datetime.date(2026, 2, 28)
    _add(db, "매장", 1, d, 700)
    _add(db, "Store", 1, d, 300)
    db._run_revenue_channel_migration(db.engine)
    db._run_revenue_channel_migration(db.engine)  # 두 번째 호출
    with Session(db.engine) as s:
        rows = s.exec(select(Revenue).where(Revenue.channel == "매장")).all()
    assert len(rows) == 1 and rows[0].amount == 1000  # 1700 아님
