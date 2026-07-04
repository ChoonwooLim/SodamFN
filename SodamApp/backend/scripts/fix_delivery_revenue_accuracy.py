# -*- coding: utf-8 -*-
"""배달앱 수치 정확성 일괄 수정 (2026-07-04 전수 감사 후속).

감사에서 확정된 문제와 수정:
  1. bid=2(장인김밥) 영문 채널(Coupang/Baemin/Yogiyo) 가짜 28% 추정 18행 → 삭제
  2. 배민 2026-05 부분값 / 2025-09~12·2026-06·07 누락 → 정산명세서 11개월 재임포트
  3. 요기요(2025-06~2026-05)·땡겨요(2025-06~2026-07) 엑셀 정산 레코드 없음
     → 파싱 정답지(JSON)에서 upsert (bank_sync 행을 excel 로 전환, 슬롯당 1행)
     ⚠️ bank_sync 정산액은 과거 CODEF+팝빌 중복적재 시대 누적치(2~3배 부풀림) —
        전환으로 제거되고 실입금은 BankTransaction(팝빌)에서 파트3 대조 시 재계산
  4. 배민 DailyExpense(manual) 부분/누락 → BaeminSettlementDetail 입금일별 재생성
  5. 영향 월 전체 P/L 재동기화

사용:
  python scripts/fix_delivery_revenue_accuracy.py           # dry-run (계획만 출력)
  BAEMIN_XLSX_PW=... python scripts/fix_delivery_revenue_accuracy.py --apply

백업: 실행 전 대상 행 전체를 JSON 으로 저장 (기본: 2026소득분석 폴더, git 제외).
"""
import sys, os, re, json, datetime, argparse
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlmodel import Session, select
from database import engine
from models import DeliveryRevenue, DailyExpense, BankTransaction, Vendor

TRUTH_JSON = r"c:\WORK\SodamFN\2026소득분석\파싱결과_배달앱_정산.json"
# 정본 폴더 먼저 — 같은 (연,월) 파일이 겹치면 정본만 사용 (1월 폴더의 2026-02는 월중 부분파일)
BAEMIN_DIRS = [
    r"c:\WORK\SodamFN\2026소득분석\매출\배민",
    r"c:\WORK\SodamFN\2026소득분석\매출\1월\배달앱매출\배민",
]
BACKUP_DIR = r"c:\WORK\SodamFN\2026소득분석"

FAKE_CHANNELS = ("Coupang", "Baemin", "Yogiyo", "Ddangyo")
YOGIYO_ALIASES = ["요기요", "위대한상상", "Yogiyo"]
DDANGYO_ALIASES = ["땡겨요", "Ddangyo"]


def dr_dict(r):
    return {c: getattr(r, c) for c in ("id", "business_id", "channel", "year", "month",
                                       "total_sales", "total_fees", "settlement_amount",
                                       "order_count", "fee_breakdown", "source")}


def de_dict(r):
    return {"id": r.id, "business_id": r.business_id, "date": r.date.isoformat(),
            "vendor_name": r.vendor_name, "amount": r.amount, "category": r.category,
            "payment_method": r.payment_method, "note": r.note, "vendor_id": r.vendor_id,
            "source": r.source}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="실제 적용 (기본 dry-run)")
    args = ap.parse_args()
    apply = args.apply

    truth = json.load(open(TRUTH_JSON, encoding="utf-8"))["delivery"]
    s = Session(engine)
    report = {"mode": "apply" if apply else "dry-run", "steps": []}
    backup = {"backed_up_at": datetime.datetime.now().isoformat(timespec="seconds"),
              "delivery_revenue": [], "daily_expense_baemin": []}

    # ── 백업: DeliveryRevenue 전체 + 배민 DailyExpense(manual) ──────────
    all_dr = s.exec(select(DeliveryRevenue)).all()
    backup["delivery_revenue"] = [dr_dict(r) for r in all_dr]
    de_baemin = s.exec(select(DailyExpense).where(
        DailyExpense.business_id == 1, DailyExpense.category == "delivery",
        DailyExpense.vendor_name == "배달의민족", DailyExpense.source == "manual")).all()
    backup["daily_expense_baemin"] = [de_dict(r) for r in de_baemin]

    # ── 1) bid=2 영문 가짜 삭제 ─────────────────────────────────────────
    fakes = s.exec(select(DeliveryRevenue).where(
        DeliveryRevenue.business_id == 2,
        DeliveryRevenue.channel.in_(FAKE_CHANNELS))).all()
    report["steps"].append({
        "step": "1_delete_bid2_fakes", "rows": len(fakes),
        "detail": [f"id={r.id} {r.channel} {r.year}-{r.month:02d} 매출 {r.total_sales:,}" for r in fakes],
    })
    if apply:
        for r in fakes:
            s.delete(r)
        s.commit()

    # ── 2) 배민 정산명세서 재임포트 (정본 폴더 전체) ────────────────────
    pw = os.environ.get("BAEMIN_XLSX_PW") or None
    seen_ym = set()
    baemin_files = []
    for d in BAEMIN_DIRS:
        for fn in sorted(os.listdir(d)):
            m = re.search(r"(\d{4})년\s*(\d{1,2})월", fn)
            if not (m and fn.endswith(".xlsx")):
                continue
            ym = (int(m.group(1)), int(m.group(2)))
            if ym in seen_ym:
                continue
            seen_ym.add(ym)
            baemin_files.append((ym[0], ym[1], os.path.join(d, fn)))
    baemin_files.sort()
    step2 = {"step": "2_baemin_reimport", "files": len(baemin_files), "results": []}
    if apply:
        if not pw:
            print("!! BAEMIN_XLSX_PW 환경변수 필요 (배민 엑셀 복호화)")
            sys.exit(1)
        from services import baemin_excel_parser as bp
        from services.baemin_service import upsert_excel_settlement
        for y, mo, path in baemin_files:
            with open(path, "rb") as f:
                parsed = bp.parse_xlsx(f.read(), password=pw, file_name=os.path.basename(path))
            r = upsert_excel_settlement(s, 1, y, mo, parsed)
            step2["results"].append({"ym": f"{y}-{mo:02d}", **{k: v for k, v in r.items()}})
    else:
        step2["results"] = [f"{y}-{mo:02d}: {os.path.basename(p)}" for y, mo, p in baemin_files]
    report["steps"].append(step2)

    # ── 3) 요기요/땡겨요 DR upsert (정답지 기준, 슬롯당 1행) ───────────
    step3 = {"step": "3_yogiyo_ddangyo_upsert", "upserts": []}
    for t in truth:
        ch = t["channel"]
        if ch not in ("요기요", "땡겨요") or t["total_fees"] is None:
            continue
        aliases = YOGIYO_ALIASES if ch == "요기요" else DDANGYO_ALIASES
        rows = s.exec(select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == 1,
            DeliveryRevenue.channel.in_(aliases),
            DeliveryRevenue.year == t["year"],
            DeliveryRevenue.month == t["month"])).all()
        action = "update" if rows else "insert"
        old = dr_dict(rows[0]) if rows else None
        step3["upserts"].append({
            "ym": f"{t['year']}-{t['month']:02d}", "channel": ch, "action": action,
            "old_settlement": old["settlement_amount"] if old else None,
            "new": {"sales": t["gross"], "fees": t["total_fees"], "settle": t["settlement"]},
            "extra_deleted": max(0, len(rows) - 1),
        })
        if not apply:
            continue
        fields = dict(total_sales=t["gross"], total_fees=t["total_fees"],
                      settlement_amount=t["settlement"], order_count=t.get("order_count") or 0,
                      fee_breakdown=json.dumps(t.get("fee_breakdown") or {}, ensure_ascii=False),
                      source="excel", channel=ch)
        if rows:
            primary = rows[0]
            for k, v in fields.items():
                setattr(primary, k, v)
            s.add(primary)
            for extra in rows[1:]:
                for tx in s.exec(select(BankTransaction).where(
                        BankTransaction.linked_delivery_revenue_id == extra.id)).all():
                    tx.linked_delivery_revenue_id = primary.id
                    s.add(tx)
                s.delete(extra)
        else:
            s.add(DeliveryRevenue(business_id=1, year=t["year"], month=t["month"], **fields))
    if apply:
        s.commit()
    report["steps"].append(step3)

    # ── 4) 배민 DailyExpense 재생성 (입금일별, 입금완료만) ──────────────
    step4 = {"step": "4_baemin_dailyexpense_rebuild"}
    step4["old_rows"] = len(de_baemin)
    step4["old_sum"] = sum(r.amount for r in de_baemin)
    if apply:
        from models import BaeminSettlementDetail
        vendor_id = de_baemin[0].vendor_id if de_baemin else None
        if vendor_id is None:
            v = s.exec(select(Vendor).where(Vendor.business_id == 1,
                                            Vendor.name == "배달의민족")).first()
            vendor_id = v.id if v else None
        for r in de_baemin:
            s.delete(r)
        s.commit()
        details = s.exec(select(BaeminSettlementDetail).where(
            BaeminSettlementDetail.business_id == 1,
            BaeminSettlementDetail.status == "입금완료")).all()
        by_day = defaultdict(int)
        for d in details:
            if d.deposit_date:
                by_day[d.deposit_date] += d.order_amount or 0
        new_rows = 0
        for day, amt in sorted(by_day.items()):
            if amt <= 0:
                continue
            s.add(DailyExpense(business_id=1, date=day, vendor_name="배달의민족",
                               amount=amt, category="delivery", payment_method="Delivery",
                               note="배민 정산명세서 (입금일별 주문금액)", vendor_id=vendor_id,
                               source="manual"))
            new_rows += 1
        s.commit()
        step4["new_rows"] = new_rows
        step4["new_sum"] = sum(v for v in by_day.values() if v > 0)
    report["steps"].append(step4)

    # ── 5) P/L 재동기화 ────────────────────────────────────────────────
    months_b1 = [(2025, m) for m in range(6, 13)] + [(2026, m) for m in range(1, 8)]
    months_b2 = [(2026, m) for m in range(1, 7)]
    step5 = {"step": "5_pl_resync",
             "bid1_months": [f"{y}-{m:02d}" for y, m in months_b1],
             "bid2_months": [f"{y}-{m:02d}" for y, m in months_b2]}
    if apply:
        from services.profit_loss_service import sync_delivery_revenue_to_pl
        for y, m in months_b1:
            sync_delivery_revenue_to_pl(y, m, s, business_id=1)
        for y, m in months_b2:
            sync_delivery_revenue_to_pl(y, m, s, business_id=2)
    report["steps"].append(step5)

    s.close()

    # 백업 저장 (apply 때만 — dry-run 은 계획 출력만)
    if apply:
        bpath = os.path.join(BACKUP_DIR, "백업_배달매출정확성수정_2026-07-04.json")
        with open(bpath, "w", encoding="utf-8") as f:
            json.dump(backup, f, ensure_ascii=False, indent=2, default=str)
        report["backup_file"] = bpath

    print(json.dumps(report, ensure_ascii=False, indent=2, default=str))


if __name__ == "__main__":
    main()
