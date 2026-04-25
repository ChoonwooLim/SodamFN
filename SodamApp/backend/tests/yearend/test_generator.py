"""Generator: HTML 렌더 + WeasyPrint 변환 (HTML만 검증)."""


def _make_report():
    class R:
        year = 2025
        total_pay_year = 33_600_000
        nontaxable_pay = 2_400_000
        taxable_pay = 31_200_000
        taxes_withheld_total = 477_300
        insurance_4major_total = 3_124_800
        decided_tax = 386_900
        confirmed_taxes_paid = 477_300
        refund_amount = -90_400
    return R()


def _make_staff():
    class S:
        name = "김금순"
        resident_number = "850101-2345678"
        address = "서울시 종로구 ..."
        dependents_count = 2
        children_count = 1
        contract_type = "정규직"
    return S()


def _make_business():
    class B:
        name = "소담김밥"
        business_number = "123-45-67890"
        owner_name = "김대표"
    return B()


def test_render_withholding_html_contains_key_strings():
    from services.yearend.generator import render_withholding_html

    html = render_withholding_html(
        report=_make_report(),
        staff=_make_staff(),
        business=_make_business(),
        simplified=None,
        is_draft=True,
        mask_resident_number=False,
    )
    assert "근로소득원천징수영수증" in html
    assert "[초안]" in html
    assert "김금순" in html
    assert "850101-2345678" in html
    assert "33,600,000" in html
    assert "(환급)" in html


def test_render_withholding_html_masks_resident_number():
    from services.yearend.generator import render_withholding_html
    html = render_withholding_html(
        report=_make_report(), staff=_make_staff(), business=_make_business(),
        simplified=None, is_draft=False, mask_resident_number=True,
    )
    assert "850101-1******" in html or "850101-2******" in html
    assert "850101-2345678" not in html


def test_render_business_income_html():
    from services.yearend.generator import render_business_income_html
    s = _make_staff()
    s.contract_type = "사업소득자"
    html = render_business_income_html(
        report=_make_report(), staff=s, business=_make_business(),
        is_draft=True, mask_resident_number=False,
    )
    assert "사업소득원천징수영수증" in html
    assert "3.3%" in html or "3%" in html
