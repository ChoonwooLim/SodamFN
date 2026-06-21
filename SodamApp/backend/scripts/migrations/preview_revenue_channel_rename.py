"""운영 적용 전 채널별 스냅샷 + 겹침 행 미리보기 (읽기 전용)."""
import sys
sys.path.insert(0, ".")
from sqlmodel import Session, select, func
from database import engine
from models import Revenue

if __name__ == "__main__":
    with Session(engine) as s:
        print("=== 채널별 현황 ===")
        for ch, cnt, mn, mx in s.exec(
            select(Revenue.channel, func.count(), func.min(Revenue.date), func.max(Revenue.date))
            .group_by(Revenue.channel)
        ):
            print(f"  {ch}: {cnt}건 {mn}~{mx}")
        print("=== 겹침(병합 대상) ===")
        for eng_name, kor in (("Store", "매장"), ("CoupangEats", "쿠팡이츠")):
            eng_rows = s.exec(select(Revenue).where(Revenue.channel == eng_name)).all()
            overlap = 0
            for er in eng_rows:
                if s.exec(select(Revenue).where(
                    Revenue.channel == kor, Revenue.business_id == er.business_id,
                    Revenue.date == er.date)).first():
                    overlap += 1
            print(f"  {eng_name}→{kor}: 영문 {len(eng_rows)}건 중 겹침 {overlap}건")
