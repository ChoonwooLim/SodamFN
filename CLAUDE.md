# 셈하나(SEMHANA) 프로젝트 - AI 작업 지침

> 이 파일은 Claude Code가 프로젝트 작업 시 참조하는 핵심 지침입니다.

---

## AI 리소스 공유 규칙 (모든 프로젝트 공통)

> **반드시 `C:\WORK\infra-docs\ai-shared-registry.md`를 단일 진실 원천(SSOT)으로 참조할 것.**

- 오픈소스 AI(Ollama/Flux/Whisper 등)와 유료 API 키(OpenAI·Anthropic·Replicate·R2 등)는
  Steven의 모든 프로젝트(SodamFN · TwinverseAI · 이후 추가)가 **공동 사용**한다.
- AI 컴퓨트 전용 서버: **`twinverse-ai` (192.168.219.117)** — Threadripper 3970X + RTX 3090 24GB + Ollama.
  - 기존 GPU PC(`192.168.219.100`)에서 운영하던 `ai-image-service`는 이 서버로 **이관 예정**.
  - LLM이 필요하면 `http://192.168.219.117:11434` (OpenAI-compatible) 직접 호출 가능.
- AI 관련 `.env` / `Orbitron.yaml` / docs 변경 시 반드시 **레지스트리 먼저 업데이트 → 그다음 코드 반영**.
- 변수명은 레지스트리 섹션 5 네이밍 컨벤션을 그대로 사용 (`AI_GPU_SERVER_URL`, `OLLAMA_URL`, `{PROVIDER}_API_KEY` 등).
- 포트 할당은 레지스트리 섹션 2 포트 예약표를 먼저 확인. 충돌 방지.
- API 키 실제 값은 레지스트리에 기입 금지 — **Orbitron secrets만** 사용.
- 새 AI 키/모델/서비스 추가 시 양쪽(또는 모든) 프로젝트를 **동시에 동기화**. 한쪽만 업데이트 금지.
- `AI_GPU_SERVER_URL`을 `localhost`로 설정하는 것은 **금지** (다른 기기에서 호출 불가).
  반드시 `http://192.168.219.117:8100` 같은 LAN IP + 포트를 사용.

---

## 프로젝트 구조

```
c:\WORK\SodamFN\
├── SodamApp/
│   ├── backend/          # FastAPI 백엔드 (Python, PostgreSQL - Orbitron)
│   ├── frontend/         # 관리자 앱 (React + Vite, port 5173)
│   └── staff-app/        # 직원 PWA 앱 (React + Vite, port 5174)
├── Orbitron.yaml          # Orbitron 배포 설정 (3 서비스 통합)
└── .agents/workflows/     # AI 작업 워크플로우
```

---

## 세션 시작 (필수)

새로운 작업을 시작하기 전에 아래 단계를 반드시 수행하여 프로젝트의 현재 상태를 정확히 파악합니다.

### 0단계: 환경변수 확인 (.env)
// turbo
```
type c:\WORK\SodamFN\SodamApp\backend\.env
```
→ DB 연결 정보(DATABASE_URL), SuperAdmin 계정 등 핵심 환경변수를 인지합니다.

### 1단계: HEAD 콘텐츠 확인 (프로젝트 전체 구조)
// turbo
```
cd c:\WORK\SodamFN\SodamApp\backend && python -c "import sys; sys.path.insert(0,'.'); from sqlmodel import Session, select; from database import engine; from models import DevWorkLog; s=Session(engine); logs=s.exec(select(DevWorkLog).where(DevWorkLog.title.startswith('[HEAD]'))).all(); [print(f'=== {l.title} ===\n{l.content}\n\nAI참고: {l.ai_summary}\n') for l in logs]; s.close()"
```
→ 프로젝트의 기술 스택, RBAC, 라우터, 모델, UI 테마 규칙, 배포 환경 등 전체 구조를 파악합니다.

### 2단계: 당일 + 전일 작업일지 확인
// turbo
```
cd c:\WORK\SodamFN\SodamApp\backend && python -c "import sys; sys.path.insert(0,'.'); from datetime import date,timedelta; from sqlmodel import Session, select; from database import engine; from models import DevWorkLog; s=Session(engine); yesterday=date.today()-timedelta(days=1); logs=s.exec(select(DevWorkLog).where(DevWorkLog.date>=yesterday, ~DevWorkLog.title.startswith('[HEAD]')).order_by(DevWorkLog.date.desc())).all(); [print(f'[{l.date}] [{l.category}] {l.title}\n{l.ai_summary or \"\"}\n---') for l in logs]; print(f'총 {len(logs)}건'); s.close()"
```
→ 최근 작업 이력과 AI 참고사항을 확인하여, 이전 작업과 충돌하지 않는 정확한 작업을 수행합니다.

### 3단계: 사용자에게 보고

위 정보를 요약하여 사용자에게 간단히 보고합니다:
- 프로젝트 구조 확인 완료 여부
- 최근 작업 이력 요약 (당일/전일)
- 준비 완료 상태 알림

---

## 핵심 규칙

### 배포 아키텍처

- **배포는 사용자의 리눅스 컴퓨터에 설치된 Orbitron 배포 전용 서버에서 진행**
- Windows 로컬 환경에서는 개발 및 코드 수정만 수행
- 배포 트리거는 사용자가 직접 Orbitron에서 실행

| 서비스 | 타입 | 소스 디렉토리 | 배포 URL |
|--------|------|--------------|----------|
| **Backend** (FastAPI) | web | `SodamApp/backend` | `https://sodamfn.twinverse.org` (API) |
| **Admin Frontend** (React+Vite) | static | `SodamApp/frontend` | `https://sodamfn.twinverse.org` |
| **Staff App** (React PWA) | static | `SodamApp/staff-app` | `https://sodam-staff.pages.dev` |

### 환경변수 관리 (매우 중요)

새 기능에서 환경변수를 사용할 때 **반드시 아래 4곳을 모두 확인/업데이트**합니다:

| 파일 | 용도 | 비고 |
|------|------|------|
| `backend/.env` | 로컬 개발용 | 실제 값 직접 기입 |
| `Orbitron.yaml` → backend env | 배포 백엔드 | 비밀값은 Orbitron secrets로, 고정값은 직접 기입 |
| `Orbitron.yaml` → frontend env | 배포 프론트엔드 | `VITE_` 접두사 환경변수 |
| `Orbitron.yaml` → postDeploy env | 배포 Staff App | `VITE_` 접두사 환경변수 |

#### 절대 하면 안 되는 것
1. `.env`에만 값을 넣고 `Orbitron.yaml`을 빈 값(`""`)으로 방치 → **배포 시 장애 발생**
2. 프론트엔드/Staff App에서 사용하는 `VITE_*` 변수를 `Orbitron.yaml`에 누락

#### 작업 완료 시 체크리스트
새 환경변수가 추가된 작업을 완료하면 아래를 사용자에게 보고:
```
⚠️ 배포 환경변수 체크:
- [ ] Orbitron.yaml backend env 업데이트 완료
- [ ] Orbitron.yaml frontend env 업데이트 완료  
- [ ] Orbitron.yaml postDeploy env 업데이트 완료
- [ ] Orbitron secrets 설정 필요 여부 안내
```

### 파일 스토리지 (매우 중요)

- **모든 파일 업로드는 `services/storage_service.py` → `get_storage()`를 통해 처리**
- **Cloudflare R2** (primary): R2 환경변수 설정 시 → R2 public URL로 저장
- **로컬 디스크** (fallback): R2 미설정 시 → `uploads/` 디렉토리에 저장

#### 절대 하면 안 되는 것
1. `storage_service.py`를 우회하여 직접 `shutil.copyfileobj` 사용 금지
2. 파일 URL을 하드코딩하지 말 것 — `storage_service`가 반환하는 URL을 그대로 DB에 저장

#### 파일 업로드 사용처 (모두 `get_storage()` 사용)

| 라우터 | 용도 | Storage Key 패턴 |
|--------|------|-----------------|
| `hr.py` | 직원 서류 (보건증 등) | `staff_docs/{id}/{filename}` |
| `upload.py` | 비즈니스 로고 | `logos/{filename}` |
| `products.py` | 상품 이미지 | `product_images/{filename}` |

### 로컬 개발 포트

| 서비스 | 포트 |
|--------|------|
| Backend (uvicorn) | `localhost:8000` |
| Admin Frontend (Vite) | `localhost:5173` |
| Staff App (Vite) | `localhost:5174` |

### 로그인/라우팅

- Admin 앱 로그인 후: `admin` → `/dashboard`, 비관리자 → `/staff-dashboard`
- Staff 앱: 온보딩 → 로그인 → 홈 (토큰 기반 ProtectedRoute)
- Staff 앱 온보딩 완료 시 이전 세션 토큰 자동 제거

---

## 모바일 UI 디자인 시스템

- **디자인 철학**: Mobile-First, 프리미엄 단일 스크롤, 터치 최적화
- **색상 팔레트 (Slate 기반)**:
  - 다크 Hero: `#1e293b` → `#334155` (그라디언트)
  - 섹션 헤더: `#f1f5f9` → `#e2e8f0` (연한 그라디언트)
  - 다크 서브헤더: `#334155` → `#475569`
  - 차트 바: Teal 계열 (`#1e3a3a` / `#3d7b7b` / `#7fb5b5`)
- **공통 패턴**:
  - `card-animate` 클래스 → `fadeInUp` 순차 등장 (animationDelay 0.05s)
  - 아코디언: `useState` (`revOpen`, `expOpen`, `openMonths`)
  - 금액 포맷: `fmtShort(v)` → 만/억 축약 + `toLocaleString('ko-KR')` 쉼표

---

## 자동 커밋 규칙

**사용자의 작업 요청 하나를 완료할 때마다** 아래를 수행합니다:

// turbo
1. `git add -A` → 자동 실행
// turbo
2. `git commit -m "커밋메시지"` → 자동 실행
// turbo
3. `git push` → 자동 실행

### 커밋 메시지 규칙
- `feat:` 새 기능
- `fix:` 버그 수정
- `style:` UI/디자인 변경
- `refactor:` 코드 리팩토링
- `docs:` 문서 업데이트
- `infra:` 인프라/배포 관련

### 주의사항
- 작업이 의미 있는 단위로 완료되었을 때 수행
- 사용자가 "커밋하지 마"라고 하면 보류

---

## 세션 종료 (작업 마무리 시)

### 1단계: 변경사항 확인
// turbo
```
cd c:\WORK\SodamFN && git status --short
```

### 2단계: 오늘 커밋 이력 확인
// turbo
```
cd c:\WORK\SodamFN && git log --since="midnight" --format="%h %ai %s" --reverse
```

### 3단계: DevWorkLog 작업일지 등록

오늘 작업한 커밋 이력 + 미커밋 변경사항을 분석하여 DevWorkLog에 등록합니다.

**규칙:**
1. **날짜+테마별 그룹핑**: 커밋 하나하나가 아닌, 관련 작업을 의미 있는 단위로 묶어 기록
2. **카테고리**: feature, bugfix, refactor, infra, design, other 중 선택
3. **필수 필드**: date, title, content(마크다운), category, files_changed, ai_summary
4. **ai_summary**: 다음 세션에서 이어받을 때 참고할 핵심 사항
5. **중복 체크**: 같은 날짜+제목이 이미 존재하면 스킵

### 4단계: Git 커밋 & 푸시

미커밋 변경사항이 있으면 스테이징 → 커밋 → 푸시합니다.

### 5단계: 세션 종료 보고

```
## ✅ 세션 종료 보고

### 📋 오늘 작업 요약
| 카테고리 | 작업 내용 | 상태 |

### 📝 작업일지
- N건 신규 등록

### 🔄 Git 상태
- 커밋: N건
- 푸시: ✅ 완료 / ⏳ 대기

### ⚠️ 다음 세션 참고사항
- 미완료 작업이나 주의점 기록

### 🚀 다음 세션 추천 작업
- 이어서 할 작업 제안
```

---

## 급여 계산 규칙 (세금대납 포함)

> **이 규칙은 급여 산출, 명세서 생성, 계좌이체 등 모든 급여 관련 로직에 적용됩니다.**

### 기본 용어 및 필드 매핑

| 한국어 | DB 필드 | 설명 |
|--------|---------|------|
| 기본급 | `base_pay` | 월급 또는 시급 × 근무시간 |
| 특별수당 | `bonus_special` | 해당 월 특별 지급 수당 |
| 주휴수당 | `bonus_holiday` | 주휴 요건 충족 시 자동 계산 |
| 공제액 | `deductions` | 4대보험 + 소득세 + 지방소득세 합계 |
| 세금대납 | `bonus_tax_support` | 사업주가 직원 대신 납부하는 세금/보험 |
| 총 보상액 (세금대납 시) / 실수령액 (일반) | `total_pay` | 아래 공식에 따라 계산 |

### 세금대납 조건

- 직원별 `tax_support_enabled` 값이 `true`일 때만 세금대납 적용
- `false`인 직원에게는 세금대납 컬럼 자체가 표시되지 않음

### 계산 공식

#### 1. 총 보상액 / 실수령액 (total_pay) — 표시용

- **세금대납 직원**: "총 보상액"으로 표기. 사업주가 세금을 대신 납부해주는 혜택을 포함한 총 보상 가치.
- **일반 직원**: "실수령액"으로 표기. 공제 후 실제 수령 금액.

```
세금대납 있을 때 (총 보상액):
  total_pay = 기본급 + 특별수당 + 주휴수당 + 세금대납
  (공제를 차감하지 않음 — 사업주가 대신 납부하므로)

세금대납 없을 때 (실수령액):
  total_pay = 기본급 + 특별수당 + 주휴수당 - 공제액
```

#### 2. 계좌이체 금액 — 실제 송금액

세금대납 금액은 국가(국민연금, 건보 등)에 납부되는 돈이므로, 직원 계좌로 보내는 금액에서는 제외한다.

```
세금대납 있을 때:
  계좌이체 = 기본급 + 특별수당 + 주휴수당
  (= 실수령액 - 세금대납)

세금대납 없을 때:
  계좌이체 = 기본급 + 특별수당 + 주휴수당 - 공제액
  (= 실수령액과 동일)
```

#### 3. 급여명세서 표기

```
지급총액 (A) = 기본급 + 특별수당 + 주휴수당
공제총액 (B) = 4대보험 + 소득세 + 지방소득세
세금대납 (C) = 사업주 대납 금액 (있을 때만 표시)
계좌이체액   = A (세금대납 시) 또는 A-B (일반)
총 보상액    = A + C (세금대납 시, "총 보상액"으로 표기)
실수령액     = A - B (일반, "실수령액"으로 표기)
```

### 계산 예시 (김금순, 2026-03 기준)

| 항목 | 금액 | 비고 |
|------|------|------|
| 기본급 (A) | 3,400,000 | |
| 공제총액 (B) | 391,950 | 국민연금+건보+장기요양+고용+소득세+지방소득세 |
| 세금대납 (C) | +391,950 | 사업주가 B를 대신 납부 |
| **계좌이체** | **3,400,000** | A (세금대납이므로 공제 미차감) |
| **총 보상액** | **3,791,950** | A + C (세금대납 혜택 포함, "총 보상액"으로 표기) |

### 주의사항

1. **총 보상액 ≠ 계좌이체액** (세금대납 시): 총 보상액은 세금대납 혜택 포함, 계좌이체는 실제 송금액
2. **세금대납 금액은 이중 계산 절대 금지**: 공제와 세금대납을 동시에 더하거나 빼지 말 것
3. **급여명세서 검증**: 총 보상액 = 지급총액 + 세금대납 이 반드시 성립하는지 확인
4. **용어 구분**: 세금대납 직원 → "총 보상액", 일반 직원 → "실수령액" (UI 라벨 조건부 표시)
4. **계산 변경 시 반드시 사업주에게 설명**: 계산식을 변경하기 전에 변경 전/후 금액을 비교 표로 보여주고 확인받을 것

---

## 디자인 컨텍스트

UI/프론트엔드 작업 시 `.impeccable.md` 파일을 반드시 참조합니다.

**핵심 원칙:**
- **주 사용자**: 40~50대 자영업자, IT 비숙련 → 큰 글씨, 넓은 터치 영역, 익숙한 패턴
- **브랜드**: 신뢰감 + 심플 + 따뜻함
- **Admin**: Pretendard 폰트, Slate/Blue 팔레트, 프로페셔널 톤
- **Staff App**: Inter 폰트, 밝은 배경 + Teal 액센트, 친근한 모바일 UX
- **접근성**: WCAG 2.1 AA, 최소 14px, 대비 4.5:1 이상
- **Impeccable 스킬**: `/audit`, `/critique`, `/polish`, `/typeset` 등 20개 디자인 명령어 사용 가능

---

## 워크플로우 파일 참조

상세 지침이 필요한 경우 아래 파일들을 참조합니다:

| 파일 | 용도 |
|------|------|
| `.impeccable.md` | 디자인 컨텍스트 (사용자, 브랜드, 색상, 접근성) |
| `.agents/workflows/start.md` | 세션 시작 상세 지침 |
| `.agents/workflows/end.md` | 세션 종료 상세 지침 |
| `.agents/workflows/deployment.md` | 배포 아키텍처 상세 |
| `.agents/workflows/project-reference.md` | 프로젝트 구조 참조 |
