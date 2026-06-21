# -*- coding: utf-8 -*-
"""운영 건강도 점검 — 외부연동 채널별 sync/쿠키/연결/데이터 최신성.
원본 backend 디렉토리를 cwd 로 실행해야 .env + DB 연결됨.
"""
import sys, datetime
sys.path.insert(0, '.')
from sqlmodel import Session, select, func
from database import engine
from models import (
    Revenue, EasyPosSyncLog, CoupangEatsSyncLog, BaeminSyncLog,
    EasyPosCredential, CoupangEatsCredential, BaeminCredential,
    CodefConnection, EasyPosSaleReceipt, CoupangEatsOrder, BaeminOrder,
    HometaxSyncCursor, HometaxRecord, Business,
)

today = datetime.date.today()
now = datetime.datetime.utcnow()
s = Session(engine)


def fmt(dt):
    if dt is None:
        return "-"
    if isinstance(dt, datetime.datetime):
        return dt.strftime("%m-%d %H:%M")
    return str(dt)


def ago(dt):
    if dt is None:
        return ""
    base = now if isinstance(dt, datetime.datetime) else today
    d = base - dt
    days = d.days if hasattr(d, "days") else 0
    return f"(D-{days})" if days >= 0 else f"(미래{-days}d)"


print(f"=== 점검 기준일: {today} (UTC now {now:%H:%M}) ===\n")

# ── 사업장
bizs = s.exec(select(Business)).all()
print(f"### 사업장 {len(bizs)}개")
for b in bizs:
    nm = getattr(b, "name", None) or getattr(b, "business_name", None) or "?"
    print(f"  id={b.id}  {nm}")
print()

# ── SyncLog (각 채널 최근 6건)
for name, M in [("EasyPOS(POS)", EasyPosSyncLog),
                ("쿠팡이츠", CoupangEatsSyncLog),
                ("배민", BaeminSyncLog)]:
    print("-" * 72)
    print(f"### {name} SyncLog 최근 6건")
    rows = s.exec(select(M).order_by(M.started_at.desc()).limit(6)).all()
    if not rows:
        print("  (이력 없음)")
        continue
    for r in rows:
        print(f"  [{fmt(r.started_at)} {ago(r.started_at)}] biz={r.business_id} "
              f"{r.status:8s} mode={r.sync_mode} sales={getattr(r,'total_sales',0):,} "
              f"by={r.triggered_by}"
              + (f"  ERR={r.error_message[:70]}" if r.error_message else ""))
print()

# ── 자격증명 / 쿠키 만료
print("-" * 72)
print("### 자격증명 / 쿠키 상태")
for name, M in [("EasyPOS", EasyPosCredential),
                ("쿠팡이츠", CoupangEatsCredential),
                ("배민", BaeminCredential)]:
    for r in s.exec(select(M)).all():
        exp = getattr(r, "cookies_expires_at", None)
        expstr = f" 쿠키만료={fmt(exp)}{ago(exp)}" if exp else ""
        print(f"  {name:8s} biz={r.business_id} status={getattr(r,'status','?'):12s} "
              f"연속실패={getattr(r,'consecutive_failures','-')} "
              f"verified={fmt(getattr(r,'last_verified_at',None))} "
              f"failed={fmt(getattr(r,'last_failed_at',None))}{expstr}"
              + (f"  ERR={getattr(r,'last_error_message')[:50]}"
                 if getattr(r, "last_error_message", None) else ""))
print()

# ── CODEF 연결
print("-" * 72)
print("### CODEF 연결 상태")
rows = s.exec(select(CodefConnection).order_by(CodefConnection.business_id,
                                               CodefConnection.connection_type)).all()
if not rows:
    print("  (연결 없음)")
for r in rows:
    print(f"  biz={r.business_id} {r.organization_label}/{r.connection_type} "
          f"status={r.status:10s} verified={fmt(r.last_verified_at)}{ago(r.last_verified_at)} "
          f"failed={fmt(r.last_failed_at)}"
          + (f"  [{r.last_error_code}] {(r.last_error_message or '')[:45]}"
             if r.last_failed_at else ""))
print()

# ── 데이터 최신성 (raw 거래 테이블)
print("-" * 72)
print("### 실제 데이터 최신성 (raw 거래)")
for name, M, col in [("EasyPOS영수증", EasyPosSaleReceipt, EasyPosSaleReceipt.sale_date),
                     ("쿠팡이츠주문", CoupangEatsOrder, CoupangEatsOrder.ordered_at),
                     ("배민주문", BaeminOrder, BaeminOrder.ordered_at)]:
    mx = s.exec(select(func.max(col))).first()
    total = s.exec(select(func.count()).select_from(M)).first()
    print(f"  {name:14s} 최신={fmt(mx)}{ago(mx)}  총건수={total:,}")

# Revenue 채널별
print("\n  [Revenue 집계 테이블 채널별 최신]")
chans = s.exec(select(Revenue.channel, func.max(Revenue.date), func.count())
               .group_by(Revenue.channel)).all()
for ch, mx, cnt in chans:
    print(f"    {ch:12s} 최신={fmt(mx)}{ago(mx)} 건수={cnt:,}")

# 홈택스
print("\n  [홈택스 수집]")
hcnt = s.exec(select(func.count()).select_from(HometaxRecord)).first()
hcur = s.exec(select(HometaxSyncCursor)).all()
print(f"    HometaxRecord 총={hcnt:,}  cursor {len(hcur)}건")
for c in hcur:
    print(f"      biz={c.business_id} {c.record_type} last={fmt(c.last_synced_at)}"
          f"{ago(c.last_synced_at)} status={c.last_status} rows={c.rows_total}")

s.close()
print("\n=== 점검 완료 ===")
