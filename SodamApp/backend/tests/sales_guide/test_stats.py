"""compute_stats 카테고리 진행률 계산 테스트.

규칙:
- 필수 항목만 진행률에 반영
- sync 100% → 자동 완료 (renewalCycle 무관)
- 만료된 항목 → 미완료로 다운그레이드
- 갱신주기 항목은 expires_at 미입력 시 미완료
"""
import datetime
from datetime import date, timedelta


# 테스트용 더미 카탈로그 (실제 production catalog 는 router 에 정의)
SAMPLE_CATALOG = {
    "permits": {
        "label": "인허가",
        "items": [
            {"key": "permits.business_registration", "required": True, "renewalCycle": None,
             "syncWith": "business.business_number"},
            {"key": "permits.health_certificate", "required": True,
             "renewalCycle": {"months": 12}, "syncWith": "hr.health_certificates"},
            {"key": "permits.lpg_report", "required": False, "renewalCycle": None},
        ],
    },
}


def test_required_only_counted_in_percent(session, sample_business):
    """LPG (required=False) 는 진행률에서 제외, 필수 2개 중 1개만 sync 완료 → 50%"""
    from services.sales_guide import compute_stats
    sync = {
        "business.business_number": {"completed": 1, "total": 1},
        "hr.health_certificates": {"completed": 0, "total": 0},  # 직원 없음 → 분모 0
    }
    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    cat = stats["categories"][0]
    assert cat["required_total"] == 2  # business_reg + health_cert (lpg 제외)
    assert cat["required_completed"] == 1  # business_reg sync 1/1, health_cert 분모 0이라 미완료
    assert cat["percent"] == 50


def test_sync_100_auto_complete(session, sample_business):
    """sync 100% (직원 5/5 보건증) → renewalCycle 있어도 완료 판정"""
    from services.sales_guide import compute_stats
    sync = {
        "business.business_number": {"completed": 1, "total": 1},
        "hr.health_certificates": {"completed": 5, "total": 5},
    }
    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    cat = stats["categories"][0]
    assert cat["required_completed"] == 2  # 모두 완료
    assert cat["percent"] == 100


def test_expired_item_downgrade(session, sample_business):
    """is_completed=True 라도 expires_at 만료 → 미완료"""
    from models import SalesGuideProgress
    from services.sales_guide import compute_stats
    yesterday = date.today() - timedelta(days=1)
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.health_certificate",
        is_completed=True,
        completed_at=yesterday - timedelta(days=365),
        expires_at=yesterday,  # 어제 만료
    )
    session.add(progress)
    session.commit()

    sync = {
        "business.business_number": {"completed": 0, "total": 1},  # 미등록
        "hr.health_certificates": {"completed": 0, "total": 0},
    }
    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    cat = stats["categories"][0]
    assert cat["required_completed"] == 0  # 보건증 만료 + 사업자 등록 미완료


def test_expiring_soon_alert(session, sample_business):
    """만료 30일 이내 → expiring_soon alert 등록 (여전히 완료 카운트는 됨)"""
    from models import SalesGuideProgress
    from services.sales_guide import compute_stats
    in_15_days = date.today() + timedelta(days=15)
    progress = SalesGuideProgress(
        business_id=sample_business.id,
        item_key="permits.health_certificate",
        is_completed=True,
        completed_at=date.today(),
        expires_at=in_15_days,
    )
    session.add(progress)
    session.commit()

    sync = {
        "business.business_number": {"completed": 0, "total": 1},
        "hr.health_certificates": {"completed": 0, "total": 0},
    }
    stats = compute_stats(session, sample_business.id, SAMPLE_CATALOG, sync)
    cat = stats["categories"][0]
    alerts = cat["alerts"]
    assert len(alerts) == 1
    assert alerts[0]["item_key"] == "permits.health_certificate"
    assert alerts[0]["type"] == "expiring_soon"
    assert alerts[0]["days"] == 15
    assert cat["required_completed"] == 1  # 보건증은 완료 (만료 안 됨)
