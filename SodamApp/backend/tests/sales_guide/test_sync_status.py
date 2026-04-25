"""sync-status 자동 카운트 계산 테스트.

3 카운트 (Task 2 범위, hr.contracts/hygiene 는 Task 3):
- hr.health_certificates: Staff.doc_health_cert == True 카운트
- hr.insurance_4major: Staff.insurance_4major == True 카운트
- business.business_number: Business.business_number 존재 여부
"""


def test_health_certificate_partial(session, sample_business, sample_staff_5):
    """5명 중 4명 보건증 등록 → 4/5"""
    from services.sales_guide import compute_sync_status
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.health_certificates"]["completed"] == 4
    assert result["hr.health_certificates"]["total"] == 5


def test_social_insurance_partial(session, sample_business, sample_staff_5):
    """5명 중 3명 4대보험 가입 → 3/5"""
    from services.sales_guide import compute_sync_status
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.insurance_4major"]["completed"] == 3
    assert result["hr.insurance_4major"]["total"] == 5


def test_business_registration_present(session, sample_business):
    """Business.business_number 존재 → 1/1"""
    from services.sales_guide import compute_sync_status
    result = compute_sync_status(session, sample_business.id)
    assert result["business.business_number"]["completed"] == 1
    assert result["business.business_number"]["total"] == 1


def test_business_registration_absent(session, sample_business_no_tax_id):
    """Business.business_number 없음 → 0/1"""
    from services.sales_guide import compute_sync_status
    result = compute_sync_status(session, sample_business_no_tax_id.id)
    assert result["business.business_number"]["completed"] == 0
    assert result["business.business_number"]["total"] == 1


def test_inactive_staff_excluded(session, sample_business, sample_staff_5, sample_staff_inactive):
    """퇴사 직원은 total 에 포함되지 않음 (5 + 1 inactive = 5 active)"""
    from services.sales_guide import compute_sync_status
    result = compute_sync_status(session, sample_business.id)
    assert result["hr.health_certificates"]["total"] == 5  # NOT 6
    assert result["hr.insurance_4major"]["total"] == 5
