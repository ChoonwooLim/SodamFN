# 사업주 전용 비공개 지급 정보 — 설계

날짜: 2026-04-30
상태: 설계 확정 (사용자 승인 대기)

## 배경

소상공인 운영 현실 — 일부 직원은 개인 사정으로 다음 중 하나 이상을 사업주에게 요청한다.

1. 세금신고 제외 (4대보험·원천징수 모두 미가입, 지급총액 그대로 수령)
2. 현금 지급 (계좌이체 X)
3. 타인 명의 계좌 입금 (예: 가족 명의)

이 정보들은 **사업주만 파악**해야 하고 다른 직원/매니저/외부 시스템에 노출되면 안 된다. 단, 직원 본인의 명세서에는 본인이 어디로 받는지 알 수 있도록 노출되어야 한다.

## 범위 (오늘 구현)

- Staff 모델에 `private_*` 필드 6개 추가
- 인사기록카드 신규 탭 "사업주 전용" (admin/superadmin만 접근)
- 명세서 "급여 수령 계좌" 행 마스킹 정책 적용
- 세금신고 제외 토글 시 산출 로직 분기 (모든 공제 0)
- 백엔드 GET/PUT 엔드포인트 + role 권한 체크

## 범위 제외 (차후 작업)

- audit log (열람·수정 이력)
- PDF/이메일/팩스 외부 채널 자동 마스킹 (현재는 명세서 화면만)
- 권한 세분화 (부매니저 등)
- 자동 신고 통합 (홈택스/팝빌)

## 데이터 모델

`models.py` Staff 클래스에 추가:

```python
# 사업주 전용 비공개 지급 정보 — 외부 노출 금지
# `private_` prefix 일관 사용 → 향후 직렬화/외부 출력 필터의 단일 패턴
private_payment_method: str = Field(default="transfer")
    # 'transfer'      = 본인 계좌 이체 (기본)
    # 'cash'          = 현금 지급
    # 'other_account' = 타인 명의 계좌 입금
private_actual_payee_name: Optional[str] = None     # 타인 계좌 수령인 명
private_actual_payee_relation: Optional[str] = None # 본인과의 관계
private_actual_payee_account: Optional[str] = None  # 타인 계좌 (은행/번호/예금주)
private_tax_unreported: bool = Field(default=False) # 세금신고 제외
private_owner_note: Optional[str] = None            # 사업주 비공개 메모
```

마이그레이션: PostgreSQL `ALTER TABLE staff ADD COLUMN ...` 6개. 기본값 보장 (`DEFAULT 'transfer'`, `DEFAULT FALSE`).

## 백엔드 API

`routers/hr/staff.py` 신규 엔드포인트:

```
GET  /api/hr/staff/{staff_id}/private
PUT  /api/hr/staff/{staff_id}/private
```

- 권한: `_admin.role in ('admin', 'superadmin')` — 그 외 403
- view-as 헤더 처리 (`get_bid_from_token` 의존성, tenant 격리)
- 응답: 위 6개 필드만
- 기본 staff GET (`/api/hr/staff/{id}`) 응답에서는 `private_*` 필드를 **제외** (모델 직렬화 시 필터)

## UI

`StaffDetail/PrivateTab.jsx` 신규 컴포넌트.

**탭 노출 조건**: `userRole === 'admin' || userRole === 'superadmin'`. 일반 staff·매니저에게는 탭 자체 미렌더.

**구성**:
- 상단 amber 경고 박스: "이 탭의 내용은 사업주만 열람 가능합니다. 명세서·인쇄·외부 전송에 노출되지 않습니다."
- 지급 방식 라디오 (계좌이체 / 현금 / 타인 명의 계좌)
- 타인 명의 선택 시 펼침: 수령인 명, 관계, 계좌 정보
- 세금신고 제외 토글
- 사업주 비공개 메모 textarea
- 저장 버튼

**아이콘**: 자물쇠 (Lock)

## 명세서 마스킹 정책

`PayrollStatement.jsx` 의 "급여 수령 계좌" 행:

| `private_payment_method` | 표시 |
|--------------------------|------|
| `transfer` | 기존 본인 계좌 (`bank_name account_number account_holder`) |
| `cash` | `현금 지급` |
| `other_account` | `{actual_payee_account}` (직원 본인이 어디로 받는지 알아야 하므로 노출) |

## 산출 로직 분기 — 세금신고 제외

`routers/payroll.py` 의 `calculate_payroll`:

`staff.private_tax_unreported == True` 일 때:
- `d_np = d_hi = d_lti = d_ei = d_it = d_lit = 0` (모든 공제 강제 0)
- `total_deductions = 0`
- `net_pay = gross_pay`
- 명세서 공제 행 모두 0 또는 `-`
- 4대보험 가입 여부(`insurance_4major`)·`insurance_base_salary`·간이세액표 등 **무시**

**경고**: 사업주 책임 — 시스템은 단지 표시·계산만 지원, 합법성 판단·신고는 사업주 영역.

## 구현 순서

1. 모델 + 마이그레이션
2. 백엔드 GET/PUT 엔드포인트 + 권한
3. 산출 로직 분기 (`payroll.py` `private_tax_unreported`)
4. 프론트 신규 탭 + API 호출
5. 명세서 마스킹 (`PayrollStatement.jsx`)
6. staff 기본 응답에서 `private_*` 제외 (직렬화 필터)

## 자기 검토

- [x] 데이터 모델 명확 (6개 필드, prefix 일관)
- [x] 권한 단순 (admin/superadmin만)
- [x] 명세서 정책 케이스별 명시
- [x] 산출 로직 분기 조건 명확
- [x] 범위 제외 명시 (audit log, 외부 채널 마스킹 등은 차후)
- [x] 사용자 합의: "타인 명의는 직원 명세서에 노출", "세금신고 제외는 모든 공제 0"
