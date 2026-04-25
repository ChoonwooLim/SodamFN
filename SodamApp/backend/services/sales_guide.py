"""영업관리 비즈니스 로직 — sync-status, stats."""
from sqlmodel import Session, select
from models import Business, Staff, ElectronicContract


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
