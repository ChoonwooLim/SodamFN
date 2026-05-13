"""채널 vendor_lookup_key → Vendor.id 매핑 + 자동 생성.

신규 채널 추가 시 CHANNEL_VENDORS 에 row 추가만 하면 됨.
"""
from sqlmodel import Session, select
from models import Business, Vendor

# (vendor_name_template, category, vendor_type)
CHANNEL_VENDORS = {
    "store":                          ("매장 ({biz_name})", "store",        "revenue"),
    "coupang_eats":                   ("쿠팡이츠",          "delivery",     "revenue"),
    "coupang_eats_fee_brokerage":     ("쿠팡이츠 중개수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_payment":       ("쿠팡이츠 결제수수료", "delivery_fee", "expense"),
    "coupang_eats_fee_delivery":      ("쿠팡이츠 배달비",     "delivery_fee", "expense"),
    "coupang_eats_fee_advertising":   ("쿠팡이츠 광고비",     "advertising",  "expense"),
    "coupang_eats_fee_membership":    ("쿠팡이츠 멤버십",     "delivery_fee", "expense"),
    "coupang_eats_fee_other":         ("쿠팡이츠 기타",      "delivery_fee",  "expense"),
    # 추후: baemin / yogiyo / ddangyo 동일 패턴
}


def get_or_create(session: Session, business_id: int, lookup_key: str) -> Vendor:
    # 기존 vendor 직접 참조 (은행 normalizer 가 사용)
    if lookup_key.startswith("_existing_vendor:"):
        vid = int(lookup_key.split(":", 1)[1])
        v = session.get(Vendor, vid)
        if not v or v.business_id != business_id:
            raise ValueError(f"vendor {vid} not found for business {business_id}")
        return v

    # 카드사별 매장 매출 vendor — 'store_card:{corp}' (예: 'store_card:신한')
    # 매출관리 화면에서 카드사별로 매출이 분리되어 표시되도록 EasyPOS normalizer 가 사용.
    if lookup_key.startswith("store_card:"):
        corp = lookup_key.split(":", 1)[1].strip() or "기타"
        biz = session.get(Business, business_id)
        biz_name = biz.name if biz else f"#{business_id}"
        name = f"매장 ({biz_name}) - {corp}카드"
        return _upsert_vendor(session, business_id, name, "store", "revenue")

    if lookup_key not in CHANNEL_VENDORS:
        raise ValueError(f"unknown channel vendor lookup_key: {lookup_key}")

    name_tpl, category, vtype = CHANNEL_VENDORS[lookup_key]
    if "{biz_name}" in name_tpl:
        biz = session.get(Business, business_id)
        biz_name = biz.name if biz else f"#{business_id}"
        name = name_tpl.format(biz_name=biz_name)
    else:
        name = name_tpl

    return _upsert_vendor(session, business_id, name, category, vtype)


def _upsert_vendor(session: Session, business_id: int, name: str,
                   category: str, vtype: str) -> Vendor:
    vendor = session.exec(
        select(Vendor).where(
            Vendor.business_id == business_id,
            Vendor.name == name,
            Vendor.vendor_type == vtype,
        )
    ).first()
    if vendor:
        return vendor
    vendor = Vendor(
        business_id=business_id, name=name,
        category=category, vendor_type=vtype,
    )
    session.add(vendor)
    session.commit()
    session.refresh(vendor)
    return vendor


def list_auto_covered(session: Session, business_id: int) -> list[int]:
    """마이그레이션 B 정책에서 덮어쓰기 대상이 되는 vendor_id 리스트.

    카드사별 store_card:{corp} vendor 는 동적이라 여기서 열거 못함 —
    호출자가 별도로 'store' 카테고리 + 'revenue' vendor 를 추가로 수집해야 함.
    """
    vendor_ids = []
    for key in CHANNEL_VENDORS.keys():
        v = get_or_create(session, business_id, key)
        vendor_ids.append(v.id)
    return vendor_ids
