import datetime
import json
import pytest
from sqlmodel import Session, SQLModel, create_engine, select

from services.codef.quota_service import CodefQuotaService
from services.codef.exceptions import CodefQuotaExceeded
from models import CodefCallLog, CodefBudgetSetting, Business


@pytest.fixture
def db_engine():
    e = create_engine("sqlite:///:memory:")
    SQLModel.metadata.create_all(e)
    yield e


@pytest.fixture
def biz_id(db_engine):
    with Session(db_engine) as s:
        b = Business(name="t", business_number="1")
        s.add(b); s.commit(); s.refresh(b)
        return b.id


@pytest.fixture
def svc_demo(db_engine, monkeypatch):
    monkeypatch.setenv("CODEF_DEMO_DAILY_LIMIT", "100")
    monkeypatch.setenv("CODEF_PRICE_TABLE", json.dumps({
        "/v1/kr/card/common/b/approval": 50,
        "/v1/kr/card/common/b/billing": 100,
    }))
    monkeypatch.setenv("CODEF_ENV", "demo")
    return CodefQuotaService(engine=db_engine)


@pytest.fixture
def svc_prod(db_engine, monkeypatch):
    monkeypatch.setenv("CODEF_DEMO_DAILY_LIMIT", "100")
    monkeypatch.setenv("CODEF_PRICE_TABLE", json.dumps({
        "/v1/kr/card/common/b/approval": 50,
    }))
    monkeypatch.setenv("CODEF_ENV", "production")
    return CodefQuotaService(engine=db_engine)


def test_record_call_inserts_log_demo(svc_demo, db_engine, biz_id):
    svc_demo.record_call(business_id=biz_id, connection_id=None,
                          api_path="/v1/kr/card/common/b/approval",
                          organization_code="0306",
                          status="success", rows=10, result_code="CF-00000",
                          triggered_by="cron")
    with Session(db_engine) as s:
        logs = list(s.exec(select(CodefCallLog)))
        assert len(logs) == 1
        assert logs[0].rows_returned == 10
        assert logs[0].estimated_cost_krw == 0  # DEMO


def test_record_call_production_uses_price(svc_prod, db_engine, biz_id):
    svc_prod.record_call(business_id=biz_id, connection_id=None,
                          api_path="/v1/kr/card/common/b/approval",
                          organization_code="0306",
                          status="success", rows=5, result_code="CF-00000",
                          triggered_by="cron")
    with Session(db_engine) as s:
        log = s.exec(select(CodefCallLog)).first()
        assert log.estimated_cost_krw == 50


def test_check_before_call_demo_under_limit_passes(svc_demo, biz_id):
    for _ in range(50):
        svc_demo.record_call(business_id=biz_id, connection_id=None,
                              api_path="/v1/kr/card/common/b/approval",
                              organization_code="0306", status="success",
                              rows=1, result_code="CF-00000", triggered_by="cron")
    svc_demo.check_before_call(business_id=biz_id,
                                 api_path="/v1/kr/card/common/b/approval")


def test_check_before_call_demo_at_limit_raises(svc_demo, biz_id):
    for _ in range(100):
        svc_demo.record_call(business_id=biz_id, connection_id=None,
                              api_path="/v1/kr/card/common/b/approval",
                              organization_code="0306", status="success",
                              rows=1, result_code="CF-00000", triggered_by="cron")
    with pytest.raises(CodefQuotaExceeded) as exc:
        svc_demo.check_before_call(business_id=biz_id,
                                     api_path="/v1/kr/card/common/b/approval")
    assert exc.value.scope == "daily"
    assert exc.value.current == 100


def test_check_cooldown_enforces_5min(svc_demo, biz_id):
    svc_demo.record_call(business_id=biz_id, connection_id=None,
                          api_path="/v1/kr/card/common/b/approval",
                          organization_code="0306", status="success",
                          rows=1, result_code="CF-00000", triggered_by="user_button")
    with pytest.raises(CodefQuotaExceeded) as exc:
        svc_demo.check_cooldown(business_id=biz_id, organization_code="0306",
                                 api_path="/v1/kr/card/common/b/approval")
    assert exc.value.scope == "cooldown"


def test_check_cooldown_different_org_passes(svc_demo, biz_id):
    """카드사가 다르면 쿨다운 별개"""
    svc_demo.record_call(business_id=biz_id, connection_id=None,
                          api_path="/v1/kr/card/common/b/approval",
                          organization_code="0306", status="success",
                          rows=1, result_code="CF-00000", triggered_by="user_button")
    svc_demo.check_cooldown(business_id=biz_id, organization_code="0303",
                             api_path="/v1/kr/card/common/b/approval")


def test_check_monthly_budget_at_hardlimit_raises(svc_prod, db_engine, biz_id):
    with Session(db_engine) as s:
        setting = CodefBudgetSetting(business_id=biz_id, monthly_budget_krw=100,
                                       warning_threshold_pct=80, hard_limit_pct=100)
        s.add(setting); s.commit()

    # 100원 도달 (cost 50 × 2)
    for _ in range(2):
        svc_prod.record_call(business_id=biz_id, connection_id=None,
                              api_path="/v1/kr/card/common/b/approval",
                              organization_code="0306", status="success",
                              rows=1, result_code="CF-00000", triggered_by="cron")

    with pytest.raises(CodefQuotaExceeded) as exc:
        svc_prod.check_before_call(business_id=biz_id,
                                     api_path="/v1/kr/card/common/b/approval")
    assert exc.value.scope == "monthly_budget"


def test_check_budget_alerts_warning_then_hardlimit(svc_prod, db_engine, biz_id):
    with Session(db_engine) as s:
        setting = CodefBudgetSetting(business_id=biz_id, monthly_budget_krw=100,
                                       warning_threshold_pct=80, hard_limit_pct=100)
        s.add(setting); s.commit()

    # 80원 도달 → warning
    for _ in range(int(80 / 50) + 1):  # 100원 (over 80)
        svc_prod.record_call(business_id=biz_id, connection_id=None,
                              api_path="/v1/kr/card/common/b/approval",
                              organization_code="0306", status="success",
                              rows=1, result_code="CF-00000", triggered_by="cron")
    # 100원 이상 → hardlimit 우선 발송 (warning skip)
    alert = svc_prod.check_budget_alerts(business_id=biz_id)
    assert alert == "hardlimit"

    # 두 번째 호출은 None (이미 발송)
    assert svc_prod.check_budget_alerts(business_id=biz_id) is None


def test_check_budget_alerts_demo_returns_none(svc_demo, db_engine, biz_id):
    """DEMO 환경은 예산 알림 트리거 안 함"""
    with Session(db_engine) as s:
        s.add(CodefBudgetSetting(business_id=biz_id, monthly_budget_krw=100))
        s.commit()
    assert svc_demo.check_budget_alerts(business_id=biz_id) is None


def test_current_month_summary_breakdown(svc_demo, biz_id):
    for path, org in [
        ("/v1/kr/card/common/b/approval", "0306"),
        ("/v1/kr/card/common/b/approval", "0306"),
        ("/v1/kr/card/common/b/billing", "0307"),
    ]:
        svc_demo.record_call(business_id=biz_id, connection_id=None, api_path=path,
                              organization_code=org, status="success", rows=5,
                              result_code="CF-00000", triggered_by="cron")
    summary = svc_demo.current_month_summary(business_id=biz_id)
    assert summary["total_calls"] == 3
    assert summary["env"] == "demo"
    assert summary["demo_daily_limit"] == 100
    by_org = {row["organization_code"]: row["calls"] for row in summary["by_organization"]}
    assert by_org == {"0306": 2, "0307": 1}
