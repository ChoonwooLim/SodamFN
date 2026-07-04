"""가짜 28% 추정 DeliveryRevenue(영문 채널명) 정리 — 진짜 레코드 있는 슬롯만.

사용:
  python -m scripts.cleanup_fake_delivery_revenue            # dry-run (기본)
  python -m scripts.cleanup_fake_delivery_revenue --apply    # 실제 삭제
"""
import sys
from sqlmodel import Session, select

_ENGLISH = {"Coupang": "쿠팡", "Baemin": "배민", "Yogiyo": "요기요"}
_REAL_SRC = {"excel", "auto_coupang_excel", "manual"}
_REAL_NAME_TO_DISP = {
    "쿠팡이츠": "쿠팡", "쿠팡잇츠": "쿠팡", "쿠팡페이": "쿠팡",
    "배달의민족": "배민", "우아한형제들": "배민",
    "요기요": "요기요", "땡겨요": "땡겨요",
}


def find_fake_estimates(session, business_id=None):
    """(row, reason) 목록. 영문명 추정 레코드 중 같은 슬롯에 진짜 레코드가 있는 것만."""
    from models import DeliveryRevenue
    q = select(DeliveryRevenue)
    if business_id is not None:
        q = q.where(DeliveryRevenue.business_id == business_id)
    rows = session.exec(q).all()
    # 진짜 레코드가 있는 (bid, year, month, 표시채널) 집합
    real_slots = set()
    for r in rows:
        disp = _REAL_NAME_TO_DISP.get(r.channel)
        if disp and r.source in _REAL_SRC:
            real_slots.add((r.business_id, r.year, r.month, disp))
    out = []
    for r in rows:
        disp = _ENGLISH.get(r.channel)
        if not disp:
            continue
        if (r.business_id, r.year, r.month, disp) in real_slots:
            out.append((r, f"영문 추정({r.channel}) — 진짜 {disp} 레코드 존재"))
    return out


def apply_cleanup(session, candidates):
    for row, _ in candidates:
        session.delete(row)
    return len(candidates)


def main():
    sys.path.insert(0, ".")
    from database import engine
    apply = "--apply" in sys.argv
    with Session(engine) as s:
        cands = find_fake_estimates(s)
        total_sales = sum((r.total_sales or 0) for r, _ in cands)
        print(f"[{'APPLY' if apply else 'DRY-RUN'}] 삭제 후보 {len(cands)}건, 합계매출 {total_sales:,}원")
        for r, reason in cands:
            print(f"  bid={r.business_id} {r.year}-{r.month:02d} {r.channel} "
                  f"매출={r.total_sales:,} 정산={r.settlement_amount:,} — {reason}")
        if apply:
            n = apply_cleanup(s, cands); s.commit()
            print(f"삭제 완료: {n}건")
        else:
            print("dry-run — 실제 삭제하려면 --apply")


if __name__ == "__main__":
    main()
