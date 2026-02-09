# EasyPOS 공식 API 연동 가이드

> 매일 밤 10시 자동으로 매출 데이터를 SodamFN에 업로드하기 위한 계획

## 현황

- **사이트**: <https://smart.easypos.net>
- **운영사**: KICC (한국정보통신)
- **프레임워크**: Nexacro 14 (웹 스크래핑 매우 어려움)
- **계정 ID**: 6391201514

## 공식 API 신청 절차

### 1단계: 이지페이 개발자페이지 확인

- **URL**: <https://easypay.co.kr>
- 자료실에서 **"API 대사 가이드(거래/정산)"** 다운로드
- **"SFTP 대사 가이드(거래/정산)"** 도 함께 확인

### 2단계: SECRET KEY 발급 신청

- 개발자페이지 > 기술지원 메뉴에서 신청
- 또는 아래 고객센터로 직접 전화

### 3단계: 고객센터 문의

| 구분 | 전화번호 | 용도 |
|---|---|---|
| **KICC 고객센터** | 📞 1600-1234 | API 연동 계약/신청 |
| **이지포스 콜센터** | 📞 1599-9100 | 기존 사용자 기술 문의 |
| **이지샵 콜센터** | 📞 1644-0804 | 신규 구매 문의 |

> **전화 시 멘트**: "이지포스 가맹점인데, 매출 데이터를 자체 시스템으로 API 연동해서 받고 싶습니다. API 키나 SECRET KEY 발급이 가능한가요?"

## 연동 방식 (2가지)

### 방식 A: REST API 대사

```
SECRET KEY 인증 → REST API 호출 → 일별 매출/정산 JSON 수신
→ SodamFN parse_revenue_upload() 호출 → DB 저장
```

### 방식 B: SFTP 대사

```
SFTP 서버 접속 → 정산 파일(.csv/.xlsx) 자동 다운로드
→ SodamFN 파싱 → DB 저장
```

## 구현 계획 (API 키 발급 후)

1. `backend/services/easypos_service.py` 생성
   - API 인증 (SECRET KEY)
   - 일별 매출 데이터 조회
   - 카드사별, 결제수단별 분류
2. `backend/tasks/daily_revenue_sync.py` 생성
   - 매일 밤 10시 실행 (APScheduler 또는 Windows Task Scheduler)
   - 당일 매출 데이터 가져오기
   - DailyExpense 레코드 생성
   - P/L 동기화
3. `.env`에 SECRET KEY 보관 (절대 Git 커밋 금지)

## API 대비 스크래핑 비교

| 항목 | 공식 API ✅ | 웹 스크래핑 ❌ |
|---|---|---|
| 안정성 | 높음 | 매우 낮음 (Nexacro) |
| 합법성 | 합법 | 약관 위반 가능 |
| 보안 | SECRET KEY | 비밀번호 평문 저장 |
| 데이터 범위 | 정산+수수료 포함 | 화면 표시 데이터만 |
| 유지보수 | 거의 불필요 | 사이트 변경 시 수시 수정 |

## TODO

- [ ] KICC 고객센터 전화 (1600-1234)
- [ ] API 키 / SECRET KEY 발급 신청
- [ ] API 문서 수령 후 연동 개발 시작
