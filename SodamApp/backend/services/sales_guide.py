"""영업관리 비즈니스 로직 — sync-status, stats."""
from datetime import date
from sqlmodel import Session, select
from models import Business, Staff, ElectronicContract, SalesGuideProgress


def compute_sync_status(session: Session, business_id: int) -> dict[str, dict]:
    """sync 카운트 계산 (4 개).

    Note: hr.hygiene_certificates 는 사업장 단위 위생교육 모델이 아직 없어 V1 에서 제외.
    데이터 파일 (kimbap.js) 의 permits.hygiene_education 항목은 syncWith 없이 수동 체크.

    응답 형태:
        { sync_key: { "completed": int, "total": int, "label": str } }

    카운트 규칙:
    - hr.health_certificates: 활성 직원 (status="재직") 중 doc_health_cert=True 수
    - hr.insurance_4major: 활성 직원 중 insurance_4major=True 수
    - hr.contracts: 활성 직원 중 signed ElectronicContract 보유자 수 (1+ 보유 시 카운트)
    - business.business_number: Business.business_number 존재 여부 (0/1 또는 1/1)
    """
    biz = session.get(Business, business_id)
    if not biz:
        return {}

    active_staff = session.exec(
        select(Staff).where(Staff.business_id == business_id, Staff.status == "재직")
    ).all()
    total_staff = len(active_staff)
    active_staff_ids = [s.id for s in active_staff]

    # Signed 계약 보유 직원 ID 집합
    if active_staff_ids:
        signed_contracts = session.exec(
            select(ElectronicContract).where(
                ElectronicContract.staff_id.in_(active_staff_ids),
                ElectronicContract.status == "signed",
            )
        ).all()
        contracted_staff_ids = {c.staff_id for c in signed_contracts}
    else:
        contracted_staff_ids = set()

    return {
        "hr.health_certificates": {
            "completed": sum(1 for s in active_staff if s.doc_health_cert),
            "total": total_staff,
            "label": "직원 보건증 등록",
        },
        "hr.insurance_4major": {
            "completed": sum(1 for s in active_staff if s.insurance_4major),
            "total": total_staff,
            "label": "직원 4대보험 가입",
        },
        "hr.contracts": {
            "completed": len(contracted_staff_ids),
            "total": total_staff,
            "label": "근로계약서 발효",
        },
        "business.business_number": {
            "completed": 1 if biz.business_number else 0,
            "total": 1,
            "label": "사업자등록번호",
        },
    }


def compute_stats(
    session: Session,
    business_id: int,
    catalog: dict,
    sync: dict,
) -> dict:
    """카테고리별·전체 진행률 계산.

    Args:
        session: SQLModel session
        business_id: 사업장 ID
        catalog: {category_key: {label: str, items: [{key, required, renewalCycle, syncWith?}, ...]}}
        sync: compute_sync_status() 결과

    Returns:
        {
            "overall": {"completed": int, "total": int, "percent": int},
            "categories": [
                {"key", "required_total", "required_completed", "percent", "alerts"},
                ...
            ],
        }

    완료 판정 우선순위:
        1. sync 100% → 자동 완료 (renewalCycle 무관)
        2. is_completed=True + (renewalCycle 없거나 expires_at > today) → 완료
        3. 그 외 → 미완료
        만료 30일 이내 → expiring_soon alert 추가 (완료 카운트는 유지)
    """
    progresses = session.exec(
        select(SalesGuideProgress).where(SalesGuideProgress.business_id == business_id)
    ).all()
    progress_by_key = {p.item_key: p for p in progresses}

    today = date.today()
    categories_out = []
    overall_completed = 0
    overall_total = 0

    for cat_key, cat in catalog.items():
        required_items = [i for i in cat["items"] if i.get("required")]
        completed_count = 0
        alerts = []

        for item in required_items:
            is_complete, alert = _evaluate_item(
                item,
                progress_by_key.get(item["key"]),
                sync,
                today,
            )
            if is_complete:
                completed_count += 1
            if alert:
                alerts.append(alert)

        total = len(required_items)
        percent = round(completed_count / total * 100) if total else 0
        categories_out.append({
            "key": cat_key,
            "required_total": total,
            "required_completed": completed_count,
            "percent": percent,
            "alerts": alerts,
        })
        overall_completed += completed_count
        overall_total += total

    overall_percent = round(overall_completed / overall_total * 100) if overall_total else 0

    return {
        "overall": {
            "completed": overall_completed,
            "total": overall_total,
            "percent": overall_percent,
        },
        "categories": categories_out,
    }


def _evaluate_item(item: dict, progress, sync: dict, today: date) -> tuple[bool, dict | None]:
    """단일 항목의 완료 여부 + alert 평가.

    Returns: (is_complete: bool, alert: dict | None)
    """
    # 1. sync 100% → 자동 완료
    sync_key = item.get("syncWith")
    if sync_key and sync_key in sync:
        s = sync[sync_key]
        if s["total"] > 0 and s["completed"] >= s["total"]:
            return True, None

    # 2. 명시적 완료 체크
    if not progress or not progress.is_completed:
        return False, None

    # 3. 갱신주기 처리
    if item.get("renewalCycle"):
        if not progress.expires_at:
            return False, None  # 만료일 미입력 → 미완료
        if progress.expires_at < today:
            return False, None  # 만료
        days_to_expire = (progress.expires_at - today).days
        if days_to_expire <= 30:
            return True, {
                "item_key": item["key"],
                "type": "expiring_soon",
                "days": days_to_expire,
            }

    return True, None
