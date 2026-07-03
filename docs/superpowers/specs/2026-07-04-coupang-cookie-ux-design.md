# 쿠팡이츠 쿠키 재입력 UX 개선 — 설계 스펙

- 날짜: 2026-07-04
- 상태: 사용자 승인 완료
- 배경: 쿠팡이츠 세션 쿠키가 2026-06-21 만료되어 자동수집 중단. 쿠키 갱신은
  Steven(개발자)이 PC 크롬 F12로 수행. 현재 `POST /coupang-eats/manual-cookies`는
  쿠키를 검증 없이 저장만 하므로, 무효 쿠키를 넣어도 "등록 성공"이 뜨고
  다음날 새벽 cron 실패로만 문제를 발견한다.

## 목표

쿠키 재입력을 "붙여넣기 → 자동검증 → 자동백필" 3클릭 루틴으로 만든다.
쿠키 만료는 세션 TTL마다 반복되는 운영 작업이므로 매회 소요시간과 실수 여지를 제거한다.
검증된 패턴은 이후 배민(5/14 만료)에 이식한다 (이번 스코프 밖).

## 1. 백엔드 — manual-cookies 즉시 라이브 검증

`routers/coupang_eats.py` `submit_manual_cookies` 변경:

1. 쿠키 파싱 후 **저장 전에** `CoupangEatsClient(cookies)` → `whoami()` 실호출.
2. **인증 실패** (`CookieInvalidError` — 401/Akamai 차단):
   저장하지 않고 **422** 반환. detail: `"이 쿠키는 이미 무효입니다: {사유}"`.
   기존 쿠키(어차피 만료)를 무효 쿠키로 덮어쓰는 일과 거짓 성공 표시를 제거.
3. **통신 실패** (`CoupangEatsError` — 네트워크/타임아웃 등 비인증 오류):
   저장은 진행하되 응답에 `verified: false` + `verify_warning` 문구 포함.
4. **검증 성공** 시 `list_stores()` 호출:
   - body.store_id 미지정 + 매장 1개 → store_id/shop_name 자동 설정.
   - 응답에 `stores: [{store_id, store_name}, ...]` 포함 (복수 매장 선택용).
   - list_stores 실패는 치명적이지 않음 — 경고만 담고 저장 진행.
5. whoami/list_stores 호출 중 서버가 회전시킨 쿠키는 기존
   `_persist_client_cookies` 패턴으로 최신본 저장.
6. 응답에 `last_success_sync_date` 포함: 해당 사업장의 마지막 성공
   `CoupangEatsSyncLog`(status=success)의 `target_end` 날짜(KST date). 없으면 null.
7. 비상 탈출구: body `skip_verify: true`면 검증 전체 생략, 기존 동작(저장만).
   쿠팡 API 장애 시 사용.

응답 스키마(성공):

```json
{
  "ok": true,
  "verified": true,
  "verify_warning": null,
  "stores": [{"store_id": 823245, "store_name": "소담김밥"}],
  "last_success_sync_date": "2026-06-21",
  ...(_cred_dto 필드 전체)
}
```

## 2. 프론트 — cURL 붙여넣기 지원

`CookieInputModal.tryParse`(CoupangEatsModuleDetail.jsx)에 3번째 형식 추가:

- 입력이 `curl`로 시작하면 cURL 텍스트에서 cookie 값을 추출해
  기존 cookie 헤더 파서로 위임.
- 지원 형식 (best-effort):
  - bash: `-H 'cookie: ...'` / `-H "cookie: ..."` / `-b '...'`
  - cmd: `-H ^"cookie: ...^"` (캐럿 이스케이프 제거 후 동일 처리)
- 안내문에 "요청 우클릭 → Copy → Copy as cURL → 통째로 붙여넣기" 경로를
  1순위로 추가. 기존 cookie 헤더 드래그 방식도 유지.

## 3. 프론트 — 매장 ID 자동 감지

- 매장 ID 입력란을 선택사항으로 변경. placeholder: "비워두면 자동 감지".
- 등록 응답 `stores`가 1개면 자동 반영(서버가 이미 저장), 복수면 등록 후
  매장 선택 UI(간단한 버튼 목록)를 띄워 `store_id` 확정.
- 확정 방식: 모달이 state로 보유한 parsed 쿠키로 `manual-cookies`를
  store_id 포함해 재호출 (별도 업데이트 엔드포인트 불필요, 재검증 1회 허용).

## 4. 프론트 — 공백 기간 원클릭 백필

등록 성공 응답의 `last_success_sync_date` ~ 어제 사이에 공백(1일 이상)이 있으면
성공 메시지 아래 배너 표시:

> "6/22 ~ 7/3 수집 공백 감지 — [지금 백필]"

- 클릭 시 기존 `POST /coupang-eats/sync/manual` 호출 (주문+정산).
- 공백이 91일 초과면 91일 단위로 분할해 순차 호출.
- 진행 중 로딩 표시, 완료 후 동기화 이력 새로고침.
- `last_success_sync_date`가 null(성공 이력 없음)이면 배너 생략 —
  백필 시작점을 알 수 없으므로 기존 월별 백필 기능 사용.

## 5. 테스트

`tests/test_coupang_eats_cookie_refresh.py` 패턴(whoami/list_stores mock) 기반
라우터 테스트 추가:

- 검증 성공 → 저장 + verified=true + store 자동 감지
- 인증 실패(CookieInvalidError) → 422 + 미저장
- 통신 실패(CoupangEatsError) → 저장 + verified=false + 경고
- skip_verify=true → 검증 생략 저장 (기존 동작)
- last_success_sync_date 계산 (성공 로그 있음/없음)

cURL 파서는 프론트 로직 — 수동 검증(대표 bash/cmd 샘플 붙여넣기).

## 스코프 밖

- 배민 동일 패턴 이식 (후속 작업)
- 텔레그램 만료 알림 문구/링크 변경
- Playwright 자동 로그인 복구
- cron 로직 변경
