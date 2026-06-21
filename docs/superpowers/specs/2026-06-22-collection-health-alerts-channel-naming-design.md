# 수집 건강도 알림 + Revenue 채널명 한글 통일 — 설계

- **날짜**: 2026-06-22
- **상태**: 설계 승인됨 → 실행계획(writing-plans) 대기
- **출처**: 2026-06-22 종합 점검 (마지막 커밋 5/15 이후 5주 공백 운영 건강도 점검)

---

## 1. 배경

2026-06-22 종합 점검에서 다음을 발견했다.

- 마지막 커밋 2026-05-15 이후 5주간, **EasyPOS(매장 카드매출)만** 자동수집이 정상이었다.
- 쿠팡이츠 37일 중단(쿠키 만료 + Akamai 차단), 배민 미완성(HTTP 403, raw 0건), CODEF 카드매입 38일·은행 56일 정지(자동 cron 없음).
- **무음 skip(핵심)**: 쿠팡 credential이 `failed`가 되자 cron이 `status="active"` 대상 0건 → `business_count=0`으로 **에러 없이 빈손 실행**. SyncLog조차 남지 않아 5주간 아무도 몰랐다.
- Revenue 테이블 채널명 혼재: 영문 현행(`Store`/`CoupangEats`)과 2/28에 멈춘 구 한글 레거시(`매장`/`쿠팡이츠`/`배달의민족`)가 공존 → 매출 통계에서 같은 채널이 둘로 갈린다.
  - 단, 손익계산서는 `DeliveryRevenue`(월별·한글)만 읽으므로 **손익 숫자 자체는 정상**. 영향은 일별 `Revenue` 기반 통계에 한정.

## 2. 목표 / 비목표

**목표**
- A. 자동수집 채널이 멈추면 **사장님과 개발자에게 능동 푸시**로 즉시 알린다 (앱을 열지 않아도).
- B. Revenue 채널명을 한글로 통일해 통계 분리를 제거한다.

**비목표 (YAGNI)**
- 멈춘 채널의 자동 복구/재로그인 (쿠키는 사장님 직접 갱신).
- CODEF 자동 cron 등록 (별도 결정으로 보류).
- 카카오 알림톡 템플릿 (검수 후 SMS 대체 — 후속 작업).
- 배민 prod 검증 복구 (별도 작업).

---

## 3. Part A — 수집 건강도 알림

### 3.1 감지 (Watchdog cron)

신규 엔드포인트 `POST /api/auto-collection/cron/health-watch` (`X-Cron-Secret` 인증, 기존 cron 패턴 동일).
매일 1회(09:00 KST) Orbitron 호스트 cron이 호출한다. (호스트 crontab은 KST 기준 — 기존 EasyPOS `0 3`이 03:00에 실행됨을 로그로 확인.)

채널별 건강 판정 대상: **EasyPOS · 쿠팡이츠 · 배민 · CODEF카드 · CODEF은행**.

| 판정 | 조건 |
|------|------|
| `failed` | credential.status ∈ {failed, cookie_invalid, expired} **OR** consecutive_failures ≥ 3 |
| `stale` | 최근 `STALE_DAYS`(기본 2)일간 성공 데이터 0건 (raw 거래 테이블 `MAX(date)` 기준) |
| `expiring_soon` | 쿠키 만료까지 ≤ 12h (기존 `_classify_status` 재사용) |
| `skipping` | 채널은 구성됐는데 active credential 0건 → cron이 빈손 실행 중 |
| `healthy` | 위 어디에도 해당 없음 |

판정 로직은 `external_integration_status._classify_status`를 확장 재사용하고, **데이터 최신성(raw MAX date)** 판정을 추가한다.

> **채널별 필드 차이**: 쿠팡이츠·배민은 `consecutive_failures`/`cookies_expires_at` 기반(쿠키 만료가 핵심). EasyPOS·CODEF는 그 필드가 없으므로 `failed`는 `status` + `last_failed_at` 기준이고, 주 감지는 `stale`(raw 데이터 최신성)이다. CODEF는 자동 cron이 없어 항상 `stale`로 잡히는 게 정상 동작 — 이 경우 "수동 수집 필요" 안내 문구를 분리한다.

### 3.2 발송 (2채널, 역할 분담)

`healthy`가 아닌 채널이 하나라도 있으면:

- **사장님 → 팝빌 SMS** (`NotificationService.send_sms`, 완비됨)
  - 비즈니스 언어. 예: `"[소담] 쿠팡이츠 매출이 2일째 수집되지 않고 있어요. 어드민 → 외부연동에서 쿠키를 갱신해 주세요."`
  - 발신: `POPBILL_SENDER_NUMBER`(010-4173-6570), 수신: `OWNER_ALERT_PHONE`(신규).
- **개발자(Steven) → 텔레그램** (`telegram_service.send_message`, 신규 구현)
  - 기술 상세. 예: `"coupang_eats: failed (consec=3), last_success=2026-05-15, err=Akamai blocked"`.

### 3.3 중복 방지 + 복구 알림

신규 테이블 `CollectionHealthAlert`:

| 컬럼 | 용도 |
|------|------|
| business_id, channel_key | unique key |
| status | `open` / `resolved` |
| alert_type | failed / stale / skipping / expiring_soon |
| opened_at, last_notified_at, resolved_at | 타임스탬프 |
| detail | 마지막 발송 내용 요약 |

규칙:
- 신규 이상 → `open` 생성 + 즉시 발송.
- 이미 `open`이고 동일 alert_type → **재발송 안 함**. 단 `RENOTIFY_DAYS`(기본 3) 경과 시 1회 리마인드.
- 이상 해소 → `resolved` 전환 + "정상화" 메시지 1회 발송.

### 3.4 status API 확장

`/api/external-integration/status`에 EasyPOS·CODEF 채널을 추가한다 (현재는 쿠팡/배민만). 프론트 헤더 종 뱃지가 5개 채널을 모두 표시.

### 3.5 telegram_service 신규

`services/telegram_service.py`: `send_message(text)` — Telegram Bot API `sendMessage` 호출.
env `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 미설정 시 **no-op + 로그**(현재 `notify_summary`가 이미 import를 시도하므로 동작 호환 유지).

### 3.6 환경변수 (배포 4곳 동기화)

신규: `OWNER_ALERT_PHONE`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, (선택) `STALE_DAYS`·`RENOTIFY_DAYS`.
기존 재사용: `POPBILL_SENDER_NUMBER`.
→ `backend/.env` + `Orbitron.yaml` backend env + Orbitron secrets. **프론트 VITE 변수 불요.**

### 3.7 crontab (사장님이 Orbitron에서 직접 등록)

```
0 9 * * * curl -fsS -X POST -H "X-Cron-Secret: <CRON_SHARED_SECRET>" https://sodamfn.twinverse.org/api/auto-collection/cron/health-watch >> /tmp/cron-health-watch.log 2>&1
```

정확한 라인은 구현 후 제공한다.

---

## 4. Part B — Revenue 채널명 한글 통일

### 4.1 표준 상수

`constants.py`(없으면 신규)에 정의:
- `REVENUE_CHANNEL_STORE = "매장"`
- `REVENUE_CHANNEL_COUPANG = "쿠팡이츠"`

(배민은 일별 `Revenue`를 쓰지 않고 `DeliveryRevenue`만 사용 — 대상 아님.)

### 4.2 코드 치환 (백엔드 2파일)

- `easypos_service.py` (read 필터 :572, write :584): `"Store"` → 상수
- `coupang_eats_service.py` (read 필터 :1057, write :1069): `"CoupangEats"` → 상수

프론트엔드는 `"Store"`/`"CoupangEats"` 문자열 리터럴 0건 확인 — **수정 불요**.

### 4.3 데이터 마이그레이션 (idempotent)

`database.py` 마이그레이션 훅 + `init_db._run_migrations` 양쪽 갱신 (HEAD 규칙: ALTER/데이터 마이그레이션 두 곳).

1. **사전 스냅샷**: 채널별 `(channel, count, min_date, max_date)` 로그 출력.
2. **중복 점검**: 같은 `(business_id, date)`에 `Store`+`매장` 또는 `CoupangEats`+`쿠팡이츠`가 공존하는 행 수를 센다.
   - `> 0`: 병합(amount 합산) 후 영문 행 삭제.
   - `= 0`: 단순 `UPDATE`.
3. **UPDATE**: `Revenue.channel` `'Store'→'매장'`, `'CoupangEats'→'쿠팡이츠'`.
4. **사후 검증**: 영문 채널 잔여 0건 확인.

### 4.4 리스크 관리

운영 DB UPDATE이므로: 스냅샷 → (사장님 확인) → 실행 → 검증. 롤백은 스냅샷 기준 역-UPDATE로 가능.

---

## 5. 테스트

- `_classify` + 데이터 최신성 판정 단위테스트: failed / stale / skipping / expiring_soon / healthy.
- `CollectionHealthAlert` 상태전이: open → renotify → resolved.
- `telegram_service` no-op (env 미설정 시 예외 없이 로그).
- 채널명 마이그레이션: **비겹침**/**겹침** 두 fixture 케이스.

## 6. 구현 순서 (writing-plans 입력)

1. **Part B** (작고 독립, 즉효): 상수 + 치환 + 마이그레이션 + 검증.
2. **Part A-1**: `telegram_service` + SMS 발송 헬퍼.
3. **Part A-2**: `CollectionHealthAlert` 모델 + `health-watch` 엔드포인트 + 판정 로직.
4. **Part A-3**: status API 확장 (EasyPOS·CODEF).
5. **배포**: env / Orbitron.yaml / secrets / crontab 라인 + 검증.

## 7. 범위 외

CODEF 자동 cron, 알림톡 템플릿, 배민 prod 복구, 멈춘 채널 자동 재로그인.
