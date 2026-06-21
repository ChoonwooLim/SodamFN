from constants import REVENUE_CHANNEL_STORE, REVENUE_CHANNEL_COUPANG


def test_channel_constants_are_korean():
    assert REVENUE_CHANNEL_STORE == "매장"
    assert REVENUE_CHANNEL_COUPANG == "쿠팡이츠"


def test_easypos_service_uses_constant():
    import services.easypos_service as m
    import inspect
    src = inspect.getsource(m.upsert_revenue_aggregate)
    assert '"Store"' not in src and "'Store'" not in src, "하드코딩 'Store' 잔존"


def test_coupang_service_uses_constant():
    import services.coupang_eats_service as m
    import inspect
    src = inspect.getsource(m.upsert_revenue_from_orders)
    assert '"CoupangEats"' not in src and "'CoupangEats'" not in src, "하드코딩 'CoupangEats' 잔존"
