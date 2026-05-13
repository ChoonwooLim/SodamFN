def test_get_or_create_store_vendor_attaches_business_name(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥 건대본점")
    session.add(biz); session.commit()
    v = get_or_create(session, business_id=1, lookup_key="store")
    assert v.name == "매장 (소담김밥 건대본점)"
    assert v.vendor_type == "revenue"
    assert v.category == "store"

def test_get_or_create_is_idempotent(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥 건대본점")
    session.add(biz); session.commit()
    v1 = get_or_create(session, business_id=1, lookup_key="store")
    v2 = get_or_create(session, business_id=1, lookup_key="store")
    assert v1.id == v2.id

def test_get_or_create_coupang_fee_vendors(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="X"); session.add(biz); session.commit()
    v = get_or_create(session, business_id=1, lookup_key="coupang_eats_fee_brokerage")
    assert v.name == "쿠팡이츠 중개수수료"
    assert v.vendor_type == "expense"
    assert v.category == "delivery_fee"


def test_get_or_create_store_card_per_corp(session):
    """카드사별 매장 vendor — store_card:신한 → '매장 (X) - 신한카드'."""
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥"); session.add(biz); session.commit()
    v = get_or_create(session, business_id=1, lookup_key="store_card:신한")
    assert v.name == "매장 (소담김밥) - 신한카드"
    assert v.vendor_type == "revenue"
    assert v.category == "store"
    # idempotent
    v2 = get_or_create(session, business_id=1, lookup_key="store_card:신한")
    assert v.id == v2.id


def test_get_or_create_store_card_distinct_corps(session):
    from models import Business
    from services.auto_collection_sync.vendor_resolver import get_or_create
    biz = Business(id=1, name="소담김밥"); session.add(biz); session.commit()
    a = get_or_create(session, business_id=1, lookup_key="store_card:신한")
    b = get_or_create(session, business_id=1, lookup_key="store_card:KB국민")
    assert a.id != b.id
    assert a.name == "매장 (소담김밥) - 신한카드"
    assert b.name == "매장 (소담김밥) - KB국민카드"
