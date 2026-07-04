# 배달앱 매출 정합화 — 파트 1: 결정적 병합 + 가짜 추정 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/revenue/delivery-summary` 가 채널·월별로 **결정적**이고 **총비용(진짜 엑셀) 우선**인 단일 대표값을 내도록 병합 로직을 교체하고, 안전하게 가짜 28% 추정 레코드를 정리한다.

**Architecture:** 순수 함수 `_consolidate_delivery()` 로 (채널,월) 대표 레코드 선택 로직을 분리(테스트 가능)하고, 엔드포인트는 이를 호출만 한다. 별도 스크립트로 가짜 추정 레코드를 진짜 레코드가 존재하는 슬롯에서만 dry-run→apply 로 삭제한다.

**Tech Stack:** FastAPI, SQLModel, pytest. 파일: `SodamApp/backend/routers/revenue.py`, `SodamApp/backend/scripts/cleanup_fake_delivery_revenue.py`, `SodamApp/backend/tests/test_delivery_summary_consolidation.py`.

## Global Constraints

- 스펙: `docs/superpowers/specs/2026-07-04-delivery-revenue-consolidation-reconciliation-design.md`.
- 수수료 = **총비용** (진짜 엑셀 레코드의 total_fees). 28% 추정 우선 금지.
- source_rank: `auto_coupang_excel`=3, `excel`=3, `manual`=2, `bank_sync`=0, 기타=1.
- 채널 표시명 정규화는 기존 `LEGACY_CHANNEL_MAP` 재사용 (영문·한글 alias → 쿠팡/배민/요기요/땡겨요).
- 가짜 추정 = 영문 채널명(`Coupang`/`Baemin`/`Yogiyo`) 레코드. 삭제는 같은 (bid,year,month,표시채널)에 **진짜(한글명·source in excel/auto_coupang_excel) 레코드가 있을 때만**.
- 파괴적 삭제 전 반드시 dry-run 카운트·금액 출력. `--apply` 플래그로만 실제 삭제.
- 테스트는 in-memory sqlite + 엔드포인트 함수 직접 호출 (기존 `tests/test_coupang_eats_manual_cookies.py` 패턴).

---

### Task 1: `_consolidate_delivery` 순수 함수 + 테스트

**Files:**
- Modify: `SodamApp/backend/routers/revenue.py` (헬퍼 추가, `get_delivery_summary` 위)
- Test: `SodamApp/backend/tests/test_delivery_summary_consolidation.py` (신규)

**Interfaces:**
- Produces: `_consolidate_delivery(dr_rows: list[DeliveryRevenue], de_sales: dict[tuple[int,int,str], int]) -> dict[str, dict]`
  - 반환: `{ "YYYY-MM": {"year":int,"month":int,"channels":{채널:{total_sales,total_fees,settlement_amount,order_count,fee_rate,fee_breakdown,source}}, "total_sales":int,"total_fees":int,"total_settlement":int,"total_orders":int,"overall_fee_rate":float} }`
  - `de_sales` = (year, month, 표시채널) → DailyExpense delivery 합계.

- [ ] **Step 1: Write the failing test**

```python
# SodamApp/backend/tests/test_delivery_summary_consolidation.py
import datetime, json, types
import pytest
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine


def _engine(monkeypatch):
    import models  # noqa: F401
    from routers import revenue
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(eng)
    return eng


def _dr(**kw):
    from models import DeliveryRevenue
    base = dict(business_id=1, year=2026, month=1, total_sales=0, total_fees=0,
                settlement_amount=0, order_count=0, fee_breakdown=None, source="excel")
    base.update(kw)
    return DeliveryRevenue(**base)


def test_prefers_real_excel_over_english_estimate():
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="Coupang", total_sales=6_055_000, total_fees=1_695_400,
            settlement_amount=4_359_600, order_count=275, source="excel"),
        _dr(channel="쿠팡이츠", total_sales=15_126_500, total_fees=10_425_375,
            settlement_amount=5_576_282, order_count=761, source="auto_coupang_excel"),
    ]
    out = _consolidate_delivery(rows, de_sales={})
    ch = out["2026-01"]["channels"]["쿠팡"]
    assert ch["total_sales"] == 15_126_500      # 진짜 엑셀(총비용) 우선
    assert ch["total_fees"] == 10_425_375
    assert ch["fee_rate"] == 68.9


def test_deterministic_regardless_of_order():
    from routers.revenue import _consolidate_delivery
    a = _dr(channel="쿠팡이츠", total_sales=100, total_fees=58, source="auto_coupang_excel")
    b = _dr(channel="Coupang", total_sales=90, total_fees=25, source="excel")
    out1 = _consolidate_delivery([a, b], de_sales={})
    out2 = _consolidate_delivery([b, a], de_sales={})
    assert out1 == out2                          # 입력 순서 무관


def test_settlement_only_bank_sync_keeps_settlement():
    from routers.revenue import _consolidate_delivery
    rows = [
        _dr(channel="Yogiyo", total_sales=3_460_000, total_fees=968_800,
            settlement_amount=2_491_200, order_count=157, source="excel"),
        _dr(channel="요기요", total_sales=0, total_fees=0,
            settlement_amount=334_074, source="bank_sync"),
    ]
    out = _consolidate_delivery(rows, de_sales={})
    ch = out["2026-01"]["channels"]["요기요"]
    assert ch["total_sales"] == 3_460_000        # 매출 있는 레코드 대표
    assert ch["settlement_amount"] == 2_491_200  # 정산 non-zero 최댓값


def test_dailyexpense_fallback_when_no_dr_sales():
    from routers.revenue import _consolidate_delivery
    rows = [_dr(channel="쿠팡이츠", total_sales=0, total_fees=0,
                settlement_amount=500_000, source="bank_sync")]
    out = _consolidate_delivery(rows, de_sales={(2026, 1, "쿠팡"): 900_000})
    ch = out["2026-01"]["channels"]["쿠팡"]
    assert ch["total_sales"] == 900_000          # DR 매출 0 → DailyExpense fallback
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd SodamApp/backend && python -m pytest tests/test_delivery_summary_consolidation.py -q`
Expected: FAIL with `ImportError: cannot import name '_consolidate_delivery'`

- [ ] **Step 3: Write minimal implementation**

`revenue.py` 상단 `LEGACY_CHANNEL_MAP` 상수 + 헬퍼 추가 (기존 `get_delivery_summary` 함수 위):

```python
import json as _json

_LEGACY_CHANNEL_MAP = {
    "Coupang": "쿠팡", "쿠팡이츠": "쿠팡", "쿠팡잇츠": "쿠팡", "쿠팡페이": "쿠팡", "쿠팡": "쿠팡",
    "Baemin": "배민", "배달의민족": "배민", "우아한형제들": "배민", "음식배달": "배민", "배민": "배민",
    "Yogiyo": "요기요", "요기요": "요기요", "위대한상상": "요기요",
    "Ddangyo": "땡겨요", "땡겨요": "땡겨요",
}
_SRC_RANK = {"auto_coupang_excel": 3, "excel": 3, "manual": 2, "bank_sync": 0}
_DISPLAY_CHANNELS = ("쿠팡", "배민", "요기요", "땡겨요")


def _canon_channel(ch: str) -> str:
    return _LEGACY_CHANNEL_MAP.get(ch, ch)


def _consolidate_delivery(dr_rows, de_sales):
    """(채널,월) 별 대표 레코드를 결정적으로 선택해 월별 요약 dict 생성.

    대표 선택 키 = (매출>0, source_rank, total_fees) 최댓값. 동률이면
    channel 문자열로 tie-break (결정성 보장). 정산액은 그 슬롯 레코드들의
    settlement_amount non-zero 최댓값. 매출은 대표.total_sales(>0) else de_sales.
    """
    # 슬롯: (year, month, 표시채널) → [rows]
    slots = {}
    for r in dr_rows:
        ch = _canon_channel(r.channel)
        if ch not in _DISPLAY_CHANNELS:
            continue
        slots.setdefault((r.year, r.month, ch), []).append(r)

    monthly = {}
    for (y, m, ch), rows in slots.items():
        best = max(rows, key=lambda r: (
            1 if (r.total_sales or 0) > 0 else 0,
            _SRC_RANK.get(r.source, 1),
            r.total_fees or 0,
            r.channel,  # 결정적 tie-break
        ))
        settle = max((r.settlement_amount or 0) for r in rows)
        sales = best.total_sales if (best.total_sales or 0) > 0 else de_sales.get((y, m, ch), 0)
        fees = best.total_fees or 0
        try:
            fee_bd = _json.loads(best.fee_breakdown) if best.fee_breakdown else {}
        except Exception:
            fee_bd = {}
        mk = f"{y}-{m:02d}"
        mm = monthly.setdefault(mk, {"year": y, "month": m, "channels": {},
                                     "total_sales": 0, "total_fees": 0,
                                     "total_settlement": 0, "total_orders": 0})
        mm["channels"][ch] = {
            "total_sales": sales, "total_fees": fees, "settlement_amount": settle,
            "order_count": best.order_count or 0,
            "fee_rate": round(fees / sales * 100, 1) if sales > 0 else 0,
            "fee_breakdown": fee_bd, "source": best.source,
        }
        mm["total_sales"] += sales
        mm["total_fees"] += fees
        mm["total_settlement"] += settle
        mm["total_orders"] += (best.order_count or 0)

    for mm in monthly.values():
        ts = mm["total_sales"]
        mm["overall_fee_rate"] = round(mm["total_fees"] / ts * 100, 1) if ts > 0 else 0
    return monthly
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd SodamApp/backend && python -m pytest tests/test_delivery_summary_consolidation.py -q`
Expected: PASS (4 passed)

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/routers/revenue.py SodamApp/backend/tests/test_delivery_summary_consolidation.py
git commit -m "feat(revenue): 배달앱 요약 결정적 병합 헬퍼 _consolidate_delivery (총비용 우선)"
```

---

### Task 2: `get_delivery_summary` 엔드포인트를 결정적 병합으로 교체

**Files:**
- Modify: `SodamApp/backend/routers/revenue.py:310-463` (`get_delivery_summary` 본문)
- Test: `SodamApp/backend/tests/test_delivery_summary_consolidation.py` (엔드포인트 테스트 추가)

**Interfaces:**
- Consumes: `_consolidate_delivery` (Task 1)
- Produces: `get_delivery_summary` 응답 `{"monthly":[...], "channel_totals":{...}, "record_count":int}` (기존 형태 유지, 값만 결정적)

- [ ] **Step 1: Write the failing test**

```python
def test_endpoint_consistent_and_total_cost(monkeypatch):
    from routers import revenue
    from models import DeliveryRevenue
    eng = _engine(monkeypatch)
    monkeypatch.setattr(revenue, "get_session", lambda: iter([Session(eng)]))
    with Session(eng) as s:
        s.add(_dr(channel="Coupang", total_sales=6_528_000, total_fees=1_827_840,
                  settlement_amount=4_700_160, order_count=297, month=5, source="excel"))
        s.add(_dr(channel="쿠팡이츠", total_sales=9_343_800, total_fees=5_458_607,
                  settlement_amount=4_961_538, order_count=448, month=5,
                  source="auto_coupang_excel",
                  fee_breakdown='{"배달비":1523200,"멤버십":2596962}'))
        s.commit()
    admin = types.SimpleNamespace(business_id=1, role="admin")
    with Session(eng) as sess:
        res = revenue.get_delivery_summary(year=2026, _admin=admin, bid=1, session=sess)
    may = next(m for m in res["monthly"] if m["month"] == 5)
    coupang = may["channels"]["쿠팡"]
    assert coupang["total_sales"] == 9_343_800    # 진짜 엑셀
    assert coupang["fee_rate"] == 58.4            # 총비용
    assert "멤버십" in coupang["fee_breakdown"]
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd SodamApp/backend && python -m pytest tests/test_delivery_summary_consolidation.py::test_endpoint_consistent_and_total_cost -q`
Expected: FAIL (기존 엔드포인트가 비결정적/override 로 다른 값 반환)

- [ ] **Step 3: Rewrite the endpoint body**

`get_delivery_summary` 의 본문(라인 316~462)을 아래로 교체 (시그니처·데코레이터 유지):

```python
    # 1) DailyExpense delivery 매출 (fallback)
    de_q = apply_bid_filter(select(DailyExpense), DailyExpense, bid).where(DailyExpense.category == "delivery")
    if year > 0:
        de_q = de_q.where(DailyExpense.date >= date(year, 1, 1), DailyExpense.date < date(year + 1, 1, 1))
    de_sales = {}
    for r in session.exec(de_q).all():
        ch = _canon_channel(r.vendor_name or "")
        if ch in _DISPLAY_CHANNELS:
            de_sales[(r.date.year, r.date.month, ch)] = de_sales.get((r.date.year, r.date.month, ch), 0) + (r.amount or 0)

    # 2) DeliveryRevenue 로드
    dr_q = apply_bid_filter(select(DeliveryRevenue), DeliveryRevenue, bid)
    if year > 0:
        dr_q = dr_q.where(DeliveryRevenue.year == year)
    dr_rows = session.exec(dr_q).all()

    # 3) 결정적 병합
    monthly_map = _consolidate_delivery(dr_rows, de_sales)
    result = [monthly_map[k] for k in sorted(monthly_map.keys(), reverse=True)]

    # 4) 채널 총계
    channel_totals = {}
    for mm in monthly_map.values():
        for ch, cd in mm["channels"].items():
            ct = channel_totals.setdefault(ch, {"total_sales": 0, "total_fees": 0, "settlement_amount": 0, "order_count": 0})
            ct["total_sales"] += cd["total_sales"]
            ct["total_fees"] += cd["total_fees"]
            ct["settlement_amount"] += cd["settlement_amount"]
            ct["order_count"] += cd["order_count"]
    for ct in channel_totals.values():
        ct["fee_rate"] = round(ct["total_fees"] / ct["total_sales"] * 100, 1) if ct["total_sales"] > 0 else 0

    return {"monthly": result, "channel_totals": channel_totals, "record_count": len(result)}
```

기존 함수 내부의 `VENDOR_TO_CHANNEL`, `_match_channel`, `LEGACY_CHANNEL_MAP` 지역 정의와 병합 루프는 모두 삭제 (헬퍼로 대체).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd SodamApp/backend && python -m pytest tests/test_delivery_summary_consolidation.py -q`
Expected: PASS (5 passed)

- [ ] **Step 5: Commit**

```bash
git add SodamApp/backend/routers/revenue.py SodamApp/backend/tests/test_delivery_summary_consolidation.py
git commit -m "feat(revenue): delivery-summary 결정적 병합 적용 — 총비용 일관 표시"
```

---

### Task 3: 가짜 추정 레코드 정리 스크립트 (dry-run → apply)

**Files:**
- Create: `SodamApp/backend/scripts/cleanup_fake_delivery_revenue.py`
- Test: `SodamApp/backend/tests/test_cleanup_fake_delivery_revenue.py` (신규)

**Interfaces:**
- Produces: `find_fake_estimates(session, business_id=None) -> list[tuple[DeliveryRevenue, str]]`
  (삭제 후보 + 사유), `apply_cleanup(session, candidates) -> int`.
- 삭제 규칙: 영문 채널명(`Coupang`/`Baemin`/`Yogiyo`) 레코드이고, 같은
  (bid,year,month,표시채널)에 진짜 레코드(한글명 + source in {excel, auto_coupang_excel, manual})가 존재할 때만.

- [ ] **Step 1: Write the failing test**

```python
# SodamApp/backend/tests/test_cleanup_fake_delivery_revenue.py
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel, Session, create_engine, select


def _eng():
    import models  # noqa: F401
    e = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    SQLModel.metadata.create_all(e)
    return e


def _dr(s, **kw):
    from models import DeliveryRevenue
    base = dict(business_id=1, year=2026, month=1, total_sales=0, total_fees=0,
                settlement_amount=0, order_count=0, source="excel")
    base.update(kw)
    row = DeliveryRevenue(**base); s.add(row); return row


def test_deletes_english_only_when_real_exists():
    from scripts.cleanup_fake_delivery_revenue import find_fake_estimates, apply_cleanup
    from models import DeliveryRevenue
    e = _eng()
    with Session(e) as s:
        _dr(s, channel="Coupang", total_sales=6_055_000, total_fees=1_695_400)  # 가짜, 진짜 있음 → 삭제
        _dr(s, channel="쿠팡이츠", total_sales=15_126_500, total_fees=10_425_375, source="auto_coupang_excel")
        _dr(s, channel="Yogiyo", total_sales=3_460_000, total_fees=968_800)     # 가짜, 진짜 없음 → 보존
        s.commit()
        cands = find_fake_estimates(s)
        assert len(cands) == 1
        assert cands[0][0].channel == "Coupang"
        n = apply_cleanup(s, cands); s.commit()
        assert n == 1
        remaining = {r.channel for r in s.exec(select(DeliveryRevenue)).all()}
        assert remaining == {"쿠팡이츠", "Yogiyo"}    # 진짜 없는 Yogiyo 는 보존
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd SodamApp/backend && python -m pytest tests/test_cleanup_fake_delivery_revenue.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'scripts.cleanup_fake_delivery_revenue'`

- [ ] **Step 3: Write the script**

```python
# SodamApp/backend/scripts/cleanup_fake_delivery_revenue.py
"""가짜 28% 추정 DeliveryRevenue(영문 채널명) 정리 — 진짜 레코드 있는 슬롯만.

사용:
  python -m scripts.cleanup_fake_delivery_revenue            # dry-run (기본)
  python -m scripts.cleanup_fake_delivery_revenue --apply    # 실제 삭제
"""
import sys
from sqlmodel import Session, select

_ENGLISH = {"Coupang": "쿠팡", "Baemin": "배민", "Yogiyo": "요기요"}
_REAL_SRC = {"excel", "auto_coupang_excel", "manual"}
_REAL_NAME = {"쿠팡이츠", "쿠팡잇츠", "쿠팡페이", "배달의민족", "우아한형제들", "요기요", "땡겨요"}


def find_fake_estimates(session, business_id=None):
    from models import DeliveryRevenue
    q = select(DeliveryRevenue)
    if business_id is not None:
        q = q.where(DeliveryRevenue.business_id == business_id)
    rows = session.exec(q).all()
    # 진짜 레코드가 있는 (bid,year,month,표시채널) 집합
    real_slots = set()
    for r in rows:
        if r.channel in _REAL_NAME and r.source in _REAL_SRC:
            disp = _ENGLISH.get(r.channel) or {"쿠팡이츠": "쿠팡", "쿠팡잇츠": "쿠팡", "쿠팡페이": "쿠팡",
                    "배달의민족": "배민", "우아한형제들": "배민", "요기요": "요기요", "땡겨요": "땡겨요"}.get(r.channel, r.channel)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd SodamApp/backend && python -m pytest tests/test_cleanup_fake_delivery_revenue.py -q`
Expected: PASS (1 passed)

- [ ] **Step 5: Dry-run on production DB and capture before/after**

Run: `cd SodamApp/backend && python -m scripts.cleanup_fake_delivery_revenue`
Expected: 삭제 후보 목록 출력 (아직 삭제 안 함). **이 출력을 사장님께 전/후 비교로 보고 → 승인 후에만 `--apply`.**

- [ ] **Step 6: Commit (script only; --apply 는 승인 후 별도 실행)**

```bash
git add SodamApp/backend/scripts/cleanup_fake_delivery_revenue.py SodamApp/backend/tests/test_cleanup_fake_delivery_revenue.py
git commit -m "feat(revenue): 가짜 추정 DeliveryRevenue 정리 스크립트 (dry-run 기본)"
```

---

## Self-Review

- **Spec coverage (파트1)**: 결정적 병합(Task1·2) ✓, total_sales override 제거(Task2 재작성) ✓, 가짜 추정 정리(Task3) ✓, 전/후 비교 게이트(Task3 Step5) ✓, 총비용 우선(source_rank) ✓.
- **Placeholder scan**: 모든 스텝에 실제 코드·명령·기대출력 포함. 없음.
- **Type consistency**: `_consolidate_delivery`, `_canon_channel`, `_SRC_RANK`, `_DISPLAY_CHANNELS`, `find_fake_estimates`, `apply_cleanup` 이름·시그니처 Task 간 일치.
- 파트 2(4채널 파서)·파트 3(정산 대조)는 각자 별도 플랜으로 후속 (파트1 배포 후).
