"""Tax calculator adapter: Phase C uses StubTaxCalculator (no calculation)."""


def test_stub_returns_confirmed_when_available():
    from services.yearend.tax_calculator import StubTaxCalculator, CalculationResult

    class FakeReport:
        confirmed_total_pay = 33_600_000
        confirmed_taxes_paid = 477_300
        decided_tax = 386_900
        refund_amount = -45_200
        taxes_withheld_total = 477_300

    calc = StubTaxCalculator()
    result: CalculationResult = calc.calculate(FakeReport(), simplified=None)
    assert result.decided_tax == 386_900
    assert result.refund_amount == -45_200
    assert result.source == "uploaded"


def test_stub_returns_self_aggregated_when_confirmed_missing():
    from services.yearend.tax_calculator import StubTaxCalculator

    class FakeReport:
        confirmed_total_pay = None
        confirmed_taxes_paid = None
        decided_tax = None
        refund_amount = None
        taxes_withheld_total = 477_300

    calc = StubTaxCalculator()
    result = calc.calculate(FakeReport(), simplified=None)
    assert result.decided_tax is None
    assert result.taxes_paid == 477_300
    assert result.source == "self_aggregated"


def test_get_calculator_returns_stub_by_default(monkeypatch):
    from services.yearend.tax_calculator import get_calculator, StubTaxCalculator
    monkeypatch.delenv("YEAR_END_TAX_CALCULATOR", raising=False)
    calc = get_calculator()
    assert isinstance(calc, StubTaxCalculator)
