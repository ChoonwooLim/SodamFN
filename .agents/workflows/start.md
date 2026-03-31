---
description: 새 작업 세션 시작 시 프로젝트 컨텍스트 자동 로드 - 매 세션 시작시 반드시 실행
---

# 셈하나 프로젝트 - 작업 세션 시작

새로운 작업을 시작하기 전에 아래 단계를 반드시 수행하여 프로젝트의 현재 상태를 정확히 파악합니다.

## 0단계: 환경변수 확인 (.env)
// turbo
```
type c:\WORK\SodamFN\SodamApp\backend\.env
```
→ DB 연결 정보(DATABASE_URL), SuperAdmin 계정(SUPERADMIN_USERNAME/PASSWORD) 등 핵심 환경변수를 인지합니다.
→ 이 정보를 기반으로 DB 접속, 계정 관리, 배포 환경 판단을 수행합니다.

## 1단계: HEAD 콘텐츠 확인 (프로젝트 전체 구조)
// turbo
```
cd c:\WORK\SodamFN\SodamApp\backend && python -c "import sys; sys.path.insert(0,'.'); from sqlmodel import Session, select; from database import engine; from models import DevWorkLog; s=Session(engine); logs=s.exec(select(DevWorkLog).where(DevWorkLog.title.startswith('[HEAD]'))).all(); [print(f'=== {l.title} ===\n{l.content}\n\nAI참고: {l.ai_summary}\n') for l in logs]; s.close()"
```
→ 이 출력으로 프로젝트의 기술 스택, RBAC, 라우터, 모델, UI 테마 규칙, 배포 환경 등 전체 구조를 파악합니다.

## 2단계: 당일 + 전일 작업일지 확인
// turbo
```
cd c:\WORK\SodamFN\SodamApp\backend && python -c "import sys; sys.path.insert(0,'.'); from datetime import date,timedelta; from sqlmodel import Session, select; from database import engine; from models import DevWorkLog; s=Session(engine); yesterday=date.today()-timedelta(days=1); logs=s.exec(select(DevWorkLog).where(DevWorkLog.date>=yesterday, ~DevWorkLog.title.startswith('[HEAD]')).order_by(DevWorkLog.date.desc())).all(); [print(f'[{l.date}] [{l.category}] {l.title}\n{l.ai_summary or \"\"}\n---') for l in logs]; print(f'총 {len(logs)}건'); s.close()"
```
→ 최근 작업 이력과 AI 참고사항을 확인하여, 이전 작업과 충돌하지 않는 정확한 작업을 수행합니다.

## 3단계: 사용자에게 보고

위 정보를 요약하여 사용자에게 간단히 보고합니다:
- 프로젝트 구조 확인 완료 여부
- 최근 작업 이력 요약 (당일/전일)
- 준비 완료 상태 알림

그 후 사용자의 작업 요청을 수행합니다.

## ⚡ 세션 중 자동 커밋 규칙

**사용자의 작업 요청 하나를 완료할 때마다** 아래를 수행합니다:

// turbo
1. `git add -A` → 자동 실행
// turbo
2. `git commit -m "커밋메시지"` → 자동 실행
// turbo
3. `git push` → 자동 실행 (작업 완료 후 즉시 배포 가능하도록)

### 커밋 메시지 규칙
- `feat:` 새 기능 / `fix:` 버그 수정 / `style:` UI / `refactor:` 리팩토링 / `docs:` 문서 / `infra:` 인프라

### 주의사항
- 작업이 의미 있는 단위로 완료되었을 때 수행
- 사용자가 "커밋하지 마"라고 하면 보류

