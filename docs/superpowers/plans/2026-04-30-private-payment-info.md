# 사업주 전용 비공개 지급 정보 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Staff 의 비공개 지급 정보(현금/타인계좌/세금신고 제외)를 사업주만 관리·조회할 수 있게 하고, 명세서·산출 로직에 일관 반영한다.

**Architecture:** Staff 모델에 `private_*` prefix 6 필드 추가, 별도 GET/PUT API + admin/superadmin 권한 게이트, 직렬화 시 기본 응답에서 제외, `private_tax_unreported=True` 직원은 산출 시 모든 공제 0 분기, 인사기록카드 신규 탭 'PrivateTab', 명세서 '급여 수령 계좌' 행 케이스별 마스킹.

**Tech Stack:** SQLModel(Postgres) + FastAPI + React + Vite. 마이그레이션은 기존 `database._ensure_column()` idempotent 패턴 사용.

**Spec:** [docs/superpowers/specs/2026-04-30-private-payment-info-design.md](../specs/2026-04-30-private-payment-info-design.md)

---

## 파일 구조

| 파일 | 역할 |
|------|------|
| `SodamApp/backend/models.py` | Staff 클래스에 private_* 6 필드 추가 |
| `SodamApp/backend/database.py` | `_run_private_payment_migrations()` 신규 — `_ensure_column` 으로 6 컬럼 추가, startup에서 호출 |
| `SodamApp/backend/routers/hr/staff.py` | GET/PUT `/hr/staff/{id}/private` 엔드포인트 신규, 기본 GET 응답에서 private_* 제외 |
| `SodamApp/backend/routers/payroll.py` | `calculate_payroll` 의 공제 계산 직전에 `private_tax_unreported` 분기 추가 |
| `SodamApp/frontend/src/pages/StaffDetail/PrivateTab.jsx` | **신규** — 라디오·펼침·토글·메모·저장 |
| `SodamApp/frontend/src/pages/StaffDetail/index.jsx` | 탭 목록에 'PrivateTab' 추가, 권한별 노출 조건 |
| `SodamApp/frontend/src/components/PayrollStatement.jsx` | '급여 수령 계좌' 행 마스킹 분기 |

---

## Task 1: Staff 모델에 private_* 필드 추가

**Files:**
- Modify: `SodamApp/backend/models.py` (Staff 클래스)

- [ ] **Step 1: Staff 클래스 끝부분(Relationships 직전)에 private_* 6 필드 추가**

`models.py` 의 Staff 클래스에서 `# Document Checklist (Submitted?)` 블록과 `# Relationships` 사이에 다음 블록을 삽입:

```python
    # ── 사업주 전용 비공개 지급 정보 (외부 노출 금지) ──
    # `private_` prefix 일관 사용 → 직렬화 필터·외부 출력에서 단일 패턴으로 차단 가능
    private_payment_method: str = Field(default="transfer")
    # 'transfer' = 본인 계좌 이체 (기본) / 'cash' = 현금 / 'other_account' = 타인 명의 계좌
    private_actual_payee_name: Optional[str] = None
    private_actual_payee_relation: Optional[str] = None
    private_actual_payee_account: Optional[str] = None
    private_tax_unreported: bool = Field(default=False)
    private_owner_note: Optional[str] = None
```

- [ ] **Step 2: 모델 import smoke test**

Run: `cd SodamApp/backend && python -c "from models import Staff; print([f for f in Staff.__fields__ if f.startswith('private_')])"`
Expected: `['private_payment_method', 'private_actual_payee_name', 'private_actual_payee_relation', 'private_actual_payee_account', 'private_tax_unreported', 'private_owner_note']`

- [ ] **Step 3: 커밋 (마이그레이션과 함께 푸시 — Task 2 끝에 통합 커밋)**

이번 단계에서는 커밋하지 않음. Task 2 완료 후 한 커밋으로 묶음.

---

## Task 2: 마이그레이션 (DB 컬럼 추가)

**Files:**
- Modify: `SodamApp/backend/database.py`

- [ ] **Step 1: `_run_private_payment_migrations()` 함수 추가**

`database.py` 의 `_run_codef_phase1_migrations()` 함수 바로 아래에 추가:

```python
def _run_private_payment_migrations(engine_):
    """사업주 전용 비공개 지급 정보 마이그레이션 — idempotent.

    Staff 에 private_payment_method / private_actual_payee_* / private_tax_unreported /
    private_owner_note 컬럼을 안전하게 추가.
    """
    table = "staff"
    _ensure_column(engine_, table, "private_payment_method", "VARCHAR DEFAULT 'transfer'")
    _ensure_column(engine_, table, "private_actual_payee_name", "VARCHAR")
    _ensure_column(engine_, table, "private_actual_payee_relation", "VARCHAR")
    _ensure_column(engine_, table, "private_actual_payee_account", "VARCHAR")
    _ensure_column(engine_, table, "private_tax_unreported", "BOOLEAN DEFAULT FALSE")
    _ensure_column(engine_, table, "private_owner_note", "TEXT")
    with engine_.begin() as conn:
        conn.execute(text("UPDATE staff SET private_payment_method = 'transfer' WHERE private_payment_method IS NULL"))
        conn.execute(text("UPDATE staff SET private_tax_unreported = FALSE WHERE private_tax_unreported IS NULL"))
```

- [ ] **Step 2: startup 호출 지점 찾기**

Run: `grep -n "_run_codef_phase1_migrations" SodamApp/backend/*.py`
Expected: 호출되는 위치(start.py 또는 main.py 등) 식별.

- [ ] **Step 3: 동일 위치에 신규 함수 호출 추가**

`_run_codef_phase1_migrations(engine)` 호출 바로 아래에:

```python
    _run_private_payment_migrations(engine)
```

- [ ] **Step 4: 로컬 import smoke test**

Run: `cd SodamApp/backend && python -c "from database import _run_private_payment_migrations; print('OK')"`
Expected: `OK`

- [ ] **Step 5: 커밋 (Task 1 + Task 2 묶음)**

```bash
git add SodamApp/backend/models.py SodamApp/backend/database.py
git commit -m "feat(staff): private_* 비공개 지급 정보 필드 6개 + 마이그레이션 추가"
```

---

## Task 3: Staff 기본 GET 응답에서 private_* 필드 제외

**Files:**
- Modify: `SodamApp/backend/routers/hr/staff.py`

기본 `GET /hr/staff` 와 `GET /hr/staff/{id}` 응답에서 `private_*` 필드가 노출되면 안 됨. role=admin/superadmin 일 때도 별도 엔드포인트로만 조회하도록 통일.

- [ ] **Step 1: 헬퍼 함수 `_strip_private_fields(obj)` 작성**

`routers/hr/staff.py` 의 router 정의 직전에 추가:

```python
_PRIVATE_KEYS = {
    "private_payment_method",
    "private_actual_payee_name",
    "private_actual_payee_relation",
    "private_actual_payee_account",
    "private_tax_unreported",
    "private_owner_note",
}


def _strip_private(staff_obj):
    """Staff 객체를 dict 로 변환하면서 private_* 필드 제거."""
    if hasattr(staff_obj, "model_dump"):
        data = staff_obj.model_dump()
    elif hasattr(staff_obj, "dict"):
        data = staff_obj.dict()
    else:
        data = dict(staff_obj)
    for k in _PRIVATE_KEYS:
        data.pop(k, None)
    return data
```

- [ ] **Step 2: `get_all_staff` 응답 변환**

`get_all_staff` 의 `return {"status": "success", "data": staffs}` 를 다음으로 교체:

```python
    return {"status": "success", "data": [_strip_private(s) for s in staffs]}
```

- [ ] **Step 3: `get_staff_detail` 응답 변환**

`get_staff_detail` 의 `return` 구문에서 `"data": staff` 를 `"data": _strip_private(staff)` 로 교체.

- [ ] **Step 4: 수동 smoke test (배포 후)**

cURL: `GET /api/hr/staff/2` → 응답 JSON 에 `private_*` 키가 없는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/hr/staff.py
git commit -m "feat(staff): 기본 GET 응답에서 private_* 필드 제외 (직렬화 필터)"
```

---

## Task 4: 사업주 전용 GET/PUT 엔드포인트 추가

**Files:**
- Modify: `SodamApp/backend/routers/hr/staff.py`

- [ ] **Step 1: Pydantic 요청 모델 추가**

`StaffUpdate` 클래스 정의 바로 아래에 추가:

```python
class StaffPrivateUpdate(BaseModel):
    private_payment_method: Optional[str] = None  # 'transfer' / 'cash' / 'other_account'
    private_actual_payee_name: Optional[str] = None
    private_actual_payee_relation: Optional[str] = None
    private_actual_payee_account: Optional[str] = None
    private_tax_unreported: Optional[bool] = None
    private_owner_note: Optional[str] = None
```

- [ ] **Step 2: GET 엔드포인트 추가**

`get_staff_detail` 함수 끝의 `}` 바로 아래(다음 라우터 정의 전)에 추가:

```python
@router.get("/staff/{staff_id}/private")
def get_staff_private(
    staff_id: int,
    _admin: AuthUser = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """사업주 전용 비공개 지급 정보 조회 — admin/superadmin 만 접근."""
    if _admin.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    stmt = apply_bid_filter(select(Staff).where(Staff.id == staff_id), Staff, bid)
    staff = session.exec(stmt).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    return {
        "status": "success",
        "data": {
            "private_payment_method": staff.private_payment_method or "transfer",
            "private_actual_payee_name": staff.private_actual_payee_name or "",
            "private_actual_payee_relation": staff.private_actual_payee_relation or "",
            "private_actual_payee_account": staff.private_actual_payee_account or "",
            "private_tax_unreported": bool(staff.private_tax_unreported),
            "private_owner_note": staff.private_owner_note or "",
        },
    }
```

- [ ] **Step 3: PUT 엔드포인트 추가**

위 GET 바로 아래에:

```python
@router.put("/staff/{staff_id}/private")
def update_staff_private(
    staff_id: int,
    update_data: StaffPrivateUpdate,
    _admin: AuthUser = Depends(get_admin_user),
    bid = Depends(get_bid_from_token),
    session: Session = Depends(get_session),
):
    """사업주 전용 비공개 지급 정보 수정 — admin/superadmin 만 접근."""
    if _admin.role not in ("admin", "superadmin"):
        raise HTTPException(status_code=403, detail="권한이 없습니다.")
    stmt = apply_bid_filter(select(Staff).where(Staff.id == staff_id), Staff, bid)
    staff = session.exec(stmt).first()
    if not staff:
        raise HTTPException(status_code=404, detail="직원을 찾을 수 없습니다.")
    if update_data.private_payment_method is not None:
        if update_data.private_payment_method not in ("transfer", "cash", "other_account"):
            raise HTTPException(status_code=400, detail="payment_method 값이 올바르지 않습니다.")
        staff.private_payment_method = update_data.private_payment_method
    for field in (
        "private_actual_payee_name",
        "private_actual_payee_relation",
        "private_actual_payee_account",
        "private_owner_note",
    ):
        v = getattr(update_data, field)
        if v is not None:
            setattr(staff, field, v.strip()[:255] if isinstance(v, str) else v)
    if update_data.private_tax_unreported is not None:
        staff.private_tax_unreported = bool(update_data.private_tax_unreported)
    session.add(staff)
    session.commit()
    return {"status": "success", "message": "비공개 지급 정보가 저장되었습니다."}
```

- [ ] **Step 4: smoke test (배포 후)**

cURL: `GET /api/hr/staff/2/private` (admin 토큰) → 200, 6 필드 응답.
cURL: `GET /api/hr/staff/2/private` (staff 토큰) → 403.

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/hr/staff.py
git commit -m "feat(staff): 사업주 전용 private GET/PUT 엔드포인트 + role 권한 게이트"
```

---

## Task 5: 산출 로직 분기 — private_tax_unreported

**Files:**
- Modify: `SodamApp/backend/routers/payroll.py`

`calculate_payroll` 의 공제 계산 블록(`# 3. Deductions` 영역) 후, `total_deductions` 계산 직전에 분기를 삽입.

- [ ] **Step 1: 공제 강제 0 분기 추가**

`payroll.py` 의 `total_deductions = d_np + d_hi + d_ei + d_lti + d_it + d_lit` 라인 바로 위에 추가:

```python
        # ── 세금신고 제외 직원 (사업주 정책) — 모든 공제 강제 0 ──
        if getattr(staff, "private_tax_unreported", False):
            d_np = d_hi = d_lti = d_ei = d_it = d_lit = 0
```

- [ ] **Step 2: 분기 진입 시 work_breakdown 또는 holiday 계산엔 영향 없음 확인**

분기 진입 후 `total_deductions` 가 0 이고 `net_pay = gross_pay - total_deductions = gross_pay` 이므로 실수령액 = 지급총액. 추가 변경 불필요.

- [ ] **Step 3: 사용자에게 변경 전/후 비교 표 제시 (CLAUDE.md 규칙)**

급여 계산 변경 시 사용자에게 변경 전/후 금액을 비교해 보여주고 확인받는다. 예시 직원(가공) 비교 표를 PR 설명 또는 채팅으로 사용자에게 전달:

```
| 항목 | private_tax_unreported=False | private_tax_unreported=True |
|------|------------------------------|-----------------------------|
| 지급총액 | 1,000,000 | 1,000,000 |
| 4대보험 합계 | 88,500 | 0 |
| 소득세+지방소득세 | 12,540 | 0 |
| 공제 합계 | 101,040 | 0 |
| 실수령액 | 898,960 | 1,000,000 |
```

사용자 OK 받은 뒤 다음 단계 진행.

- [ ] **Step 4: 로컬 syntax 검증**

Run: `cd SodamApp/backend && python -m py_compile routers/payroll.py && echo OK`
Expected: `OK`

- [ ] **Step 5: 커밋**

```bash
git add SodamApp/backend/routers/payroll.py
git commit -m "feat(payroll): private_tax_unreported=True 직원 모든 공제 0 강제 분기"
```

---

## Task 6: 프론트 PrivateTab.jsx 신규 컴포넌트

**Files:**
- Create: `SodamApp/frontend/src/pages/StaffDetail/PrivateTab.jsx`

- [ ] **Step 1: 컴포넌트 파일 작성**

```jsx
import { useEffect, useState } from 'react';
import { Lock, Save } from 'lucide-react';
import api from '../../api';

export default function PrivateTab({ staffId }) {
    const [form, setForm] = useState({
        private_payment_method: 'transfer',
        private_actual_payee_name: '',
        private_actual_payee_relation: '',
        private_actual_payee_account: '',
        private_tax_unreported: false,
        private_owner_note: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [msg, setMsg] = useState(null);

    useEffect(() => {
        if (!staffId) return;
        (async () => {
            try {
                const res = await api.get(`/hr/staff/${staffId}/private`);
                if (res.data.status === 'success') setForm(res.data.data);
            } catch (e) {
                console.error('private load error', e);
            } finally {
                setLoading(false);
            }
        })();
    }, [staffId]);

    const save = async () => {
        setSaving(true);
        setMsg(null);
        try {
            await api.put(`/hr/staff/${staffId}/private`, form);
            setMsg({ type: 'ok', text: '저장되었습니다.' });
        } catch (e) {
            console.error(e);
            setMsg({ type: 'error', text: '저장 실패: ' + (e?.response?.data?.detail || e.message) });
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-8 text-slate-400">불러오는 중...</div>;

    return (
        <div className="space-y-6 max-w-3xl">
            <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
                <Lock size={16} className="mt-0.5 flex-shrink-0" />
                <div>
                    <div className="font-bold">사업주 전용 — 외부 노출 금지</div>
                    <div className="text-amber-700 mt-1">이 탭의 내용은 사업주(admin/superadmin)만 열람 가능하며, 명세서·인쇄·외부 전송에 노출되지 않습니다. 단, 직원 본인의 명세서에는 본인이 받는 계좌 정보만 표시됩니다.</div>
                </div>
            </div>

            <section>
                <h3 className="text-sm font-bold text-slate-700 mb-3">지급 방식</h3>
                <div className="space-y-2">
                    {[
                        { v: 'transfer', label: '본인 계좌 이체 (기본)' },
                        { v: 'cash', label: '현금 지급' },
                        { v: 'other_account', label: '타인 명의 계좌 입금' },
                    ].map(opt => (
                        <label key={opt.v} className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="radio"
                                name="private_payment_method"
                                value={opt.v}
                                checked={form.private_payment_method === opt.v}
                                onChange={e => setForm(f => ({ ...f, private_payment_method: e.target.value }))}
                            />
                            <span className="text-sm">{opt.label}</span>
                        </label>
                    ))}
                </div>
            </section>

            {form.private_payment_method === 'other_account' && (
                <section className="rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-3">
                    <h4 className="text-xs font-bold text-slate-600">타인 명의 계좌 정보</h4>
                    <input
                        type="text"
                        placeholder="실제 수령인 명 (예: 홍길동)"
                        value={form.private_actual_payee_name}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_name: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                        type="text"
                        placeholder="본인과의 관계 (예: 배우자, 자녀, 지인)"
                        value={form.private_actual_payee_relation}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_relation: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                    />
                    <input
                        type="text"
                        placeholder="계좌 정보 (은행 / 계좌번호 / 예금주)"
                        value={form.private_actual_payee_account}
                        onChange={e => setForm(f => ({ ...f, private_actual_payee_account: e.target.value }))}
                        className="w-full p-2 rounded-lg border border-slate-200 text-sm"
                    />
                </section>
            )}

            <section>
                <label className="flex items-center gap-2 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={form.private_tax_unreported}
                        onChange={e => setForm(f => ({ ...f, private_tax_unreported: e.target.checked }))}
                    />
                    <span className="text-sm font-bold text-slate-700">세금신고 제외</span>
                    <span className="text-xs text-slate-400">— 4대보험·원천징수 모두 미적용 (실수령 = 지급총액)</span>
                </label>
            </section>

            <section>
                <h3 className="text-sm font-bold text-slate-700 mb-2">사업주 비공개 메모</h3>
                <textarea
                    value={form.private_owner_note}
                    onChange={e => setForm(f => ({ ...f, private_owner_note: e.target.value }))}
                    placeholder="이 직원에 대한 사업주 비공개 메모..."
                    rows={4}
                    className="w-full p-3 rounded-lg border border-slate-200 text-sm"
                />
            </section>

            {msg && (
                <div className={`rounded-lg px-4 py-2 text-sm ${msg.type === 'ok' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                    {msg.text}
                </div>
            )}

            <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-800 disabled:opacity-50"
            >
                <Save size={16} /> {saving ? '저장 중...' : '저장'}
            </button>
        </div>
    );
}
```

- [ ] **Step 2: 빌드 / lint 확인 (있다면)**

Run: `cd SodamApp/frontend && npm run build`
Expected: 에러 없음. (lint 설정 따라 조정)

- [ ] **Step 3: 커밋**

```bash
git add SodamApp/frontend/src/pages/StaffDetail/PrivateTab.jsx
git commit -m "feat(staff-detail): PrivateTab 신규 — 비공개 지급 정보 입력 UI"
```

---

## Task 7: 인사기록카드 탭 등록 + 권한별 노출

**Files:**
- Modify: `SodamApp/frontend/src/pages/StaffDetail/index.jsx`

- [ ] **Step 1: 컴포넌트 import + Lock 아이콘 import**

`index.jsx` 상단 import 영역에 추가:

```jsx
import { ... , Lock } from 'lucide-react';   // 기존 lucide import 에 Lock 추가
import PrivateTab from './PrivateTab';
```

- [ ] **Step 2: 사용자 role 결정 helper 추가 (혹은 기존 활용)**

토큰에서 role 을 추출. 기존 패턴이 있으면 그것을 사용. 없으면 마운트 시 `localStorage.getItem('user_role')` 또는 토큰 디코드.

```jsx
const userRole = (() => {
    try {
        const t = localStorage.getItem('token');
        if (!t) return null;
        return JSON.parse(atob(t.split('.')[1])).role || null;
    } catch {
        return localStorage.getItem('user_role') || null;
    }
})();
const canSeePrivate = userRole === 'admin' || userRole === 'superadmin';
```

- [ ] **Step 3: 탭 목록 정의에 'private' 추가 (조건부)**

기존 탭 정의 배열에 다음을 조건부로 push (canSeePrivate 일 때만):

```jsx
...(canSeePrivate ? [{ id: 'private', label: '사업주 전용', icon: Lock }] : []),
```

- [ ] **Step 4: 탭 컨텐츠 분기에 PrivateTab 케이스 추가**

활성 탭 분기에 추가:

```jsx
{activeTab === 'private' && canSeePrivate && (
    <PrivateTab staffId={id} />
)}
```

- [ ] **Step 5: 권한 우회 방지 — canSeePrivate=false 인데 URL 등으로 activeTab='private' 인 경우 fallback**

탭 분기 직전에 안전장치:

```jsx
const safeActiveTab = (!canSeePrivate && activeTab === 'private') ? 'basic' : activeTab;
```

이후 `safeActiveTab` 으로 모든 탭 분기를 검사.

- [ ] **Step 6: 빌드 + 수동 확인 (배포 후)**

- admin 계정: 새 탭 자물쇠 아이콘 보이는지
- staff 계정: 탭 미노출

- [ ] **Step 7: 커밋**

```bash
git add SodamApp/frontend/src/pages/StaffDetail/index.jsx
git commit -m "feat(staff-detail): PrivateTab 권한별 탭 등록"
```

---

## Task 8: 명세서 마스킹 (PayrollStatement.jsx)

**Files:**
- Modify: `SodamApp/frontend/src/components/PayrollStatement.jsx`

- [ ] **Step 1: '급여 수령 계좌' 행 분기 로직 적용**

기존 코드(약 line 254-262):

```jsx
<td colSpan="3" className="px-8 border-2 border-slate-800 text-base font-black text-slate-800 tracking-wider">
    {staff.bank_name || staff.account_number
        ? `${staff.bank_name || ''} ${staff.account_number || ''} ${staff.account_holder || ''}`.trim()
        : (staff.bank_account || '기록 없음')
    }
</td>
```

다음으로 교체:

```jsx
<td colSpan="3" className="px-8 border-2 border-slate-800 text-base font-black text-slate-800 tracking-wider">
    {(() => {
        const method = staff.private_payment_method || 'transfer';
        if (method === 'cash') return '현금 지급';
        if (method === 'other_account') {
            const acc = staff.private_actual_payee_account;
            return acc && acc.trim() ? acc : '현금 지급';
        }
        if (staff.bank_name || staff.account_number) {
            return `${staff.bank_name || ''} ${staff.account_number || ''} ${staff.account_holder || ''}`.trim();
        }
        return staff.bank_account || '기록 없음';
    })()}
</td>
```

- [ ] **Step 2: staff 객체에 private_* 가 함께 흘러가는지 추적**

명세서가 호출되는 컴포넌트(예: `PayrollTab.jsx`)에서 `staff` 를 어떻게 넘기는지 확인. 일반 GET `/hr/staff/{id}` 응답을 그대로 쓴다면 Task 3 필터로 인해 `private_*` 가 없다.

→ **추가 변경 필요**: 명세서 표시용 staff 데이터를 별도 GET `/hr/staff/{id}/private` 와 합쳐서 넘기거나, 명세서 전용 GET 엔드포인트를 만들어 `private_payment_method` / `private_actual_payee_account` 만 응답에 포함.

가장 단순한 옵션: 명세서를 여는 컴포넌트에서 `staff` 외에 `private` 데이터도 같이 fetch 해서 props 로 합쳐 전달.

```jsx
// PayrollTab.jsx (혹은 명세서 호출하는 컴포넌트) 명세서 열기 직전에:
const privateRes = await api.get(`/hr/staff/${staffId}/private`).catch(() => ({ data: { data: {} } }));
const mergedStaff = { ...staffBase, ...privateRes.data.data };
// PayrollStatement 에 staff={mergedStaff} 로 전달
```

- [ ] **Step 3: 빌드 / 수동 확인**

배포 후:
- transfer 직원: 본인 계좌 그대로
- cash 직원: '현금 지급'
- other_account 직원: 타인 계좌 정보 노출

- [ ] **Step 4: 커밋**

```bash
git add SodamApp/frontend/src/components/PayrollStatement.jsx SodamApp/frontend/src/pages/StaffDetail/PayrollTab.jsx
git commit -m "feat(payroll-statement): 급여 수령 계좌 행 마스킹 분기 (cash/other_account)"
```

---

## Task 9: 통합 검증

**Files:** 없음 (배포 + 수동 검증)

- [ ] **Step 1: Orbitron 재배포 트리거**

사용자에게 안내: Orbitron 대시보드 → sodamfn 재배포.

- [ ] **Step 2: DB 마이그레이션 자동 적용 확인**

배포 로그에서 `Creating tables...` 다음에 `_run_private_payment_migrations` 가 idempotent 하게 실행되는지 확인.

cURL: `GET /api/hr/staff/2/private` (admin 토큰) → 200, 6 필드 default 값.

- [ ] **Step 3: 시나리오별 수동 검증**

1. **정상 직원 (transfer)** — 명세서: 본인 계좌 그대로. 산출: 변화 없음.
2. **현금 (cash) 직원** — 명세서 '급여 수령 계좌' = '현금 지급'.
3. **타인 계좌 (other_account) 직원** — 명세서에 입력한 타인 계좌 정보 그대로 노출.
4. **세금신고 제외 (private_tax_unreported=True)** — 명세서 4대보험·소득세·지방소득세 모두 0, 실수령액 = 지급총액.
5. **권한 — staff 토큰** — `GET /hr/staff/{id}/private` → 403. UI 탭 미노출.
6. **권한 — superadmin view-as** — 정상 접근. tenant 격리 정상.

- [ ] **Step 4: 사용자 보고**

위 시나리오별 결과 요약 + 발견된 이슈 정리.

---

## Self-Review

- [x] **Spec coverage**: 데이터 모델·UI·명세서 마스킹·산출 분기·권한 모두 task 로 매핑됨.
- [x] **Placeholder 없음**: 각 step 에 실제 코드/명령/예상 출력 명시.
- [x] **Type 일관성**: `_strip_private` 헬퍼·`StaffPrivateUpdate` 모델·`private_*` prefix 일관 사용.
- [x] **Scope check**: 단일 plan 으로 적합. audit log·외부 채널 마스킹은 spec 의 '범위 제외' 에 명시.
- [x] **Ambiguity check**: 명세서 staff 데이터에 private_* 합치는 방식(Task 8 Step 2)을 명시. 권한 우회 방지(Task 7 Step 5) 명시.

---

## 다음 세션 시작 가이드

1. 이 plan 을 열어 Task 1 부터 순서대로 실행.
2. 각 task 완료 후 `git push` 로 prod 안전.
3. Task 5 끝 (산출 분기) 에서 사용자에게 변경 전/후 비교 표 보여주고 OK 받기 (CLAUDE.md 규칙).
4. Task 9 통합 검증 후 사용자 보고.

권장: **superpowers:subagent-driven-development** 로 task 별 fresh 서브에이전트 + 리뷰 체크포인트.
