"""영업관리 비즈니스 로직 — sync-status, stats."""
from sqlmodel import Session, select
from models import Business, Staff


def compute_sync_status(session: Session, business_id: int) -> dict[str, dict]:
    """5 개 핵심 sync 카운트 계산 (Task 2 단계: 3 개, Task 3 에서 2개 추가).

    응답 형태:
        { sync_key: { "completed": int, "total": int, "label": str } }

    카운트 규칙:
    - hr.health_certificates: 활성 직원 (status="재직") 중 doc_health_cert=True 수
    - hr.insurance_4major: 활성 직원 중 insurance_4major=True 수
    - business.business_number: Business.business_number 존재 여부 (0/1 또는 1/1)
    """
    biz = session.get(Business, business_id)
    if not biz:
        return {}

    active_staff = session.exec(
        select(Staff).where(Staff.business_id == business_id, Staff.status == "재직")
    ).all()
    total_staff = len(active_staff)

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
        "business.business_number": {
            "completed": 1 if biz.business_number else 0,
            "total": 1,
            "label": "사업자등록번호",
        },
    }
