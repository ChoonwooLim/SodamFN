---
name: end
description: 작업 세션 종료 - 작업일지 기록, 커밋, 요약 보고
user-invocable: true
---

# 셈하나 프로젝트 - 작업 세션 종료

작업을 마무리할 때 아래 단계를 순서대로 수행하여 작업 내역을 기록하고 코드를 안전하게 보존합니다.

## 1단계: 변경사항 확인
// turbo
```
cd c:\WORK\SodamFN && git status --short
```
→ 커밋되지 않은 변경사항이 있는지 확인합니다. 변경사항이 없으면 "변경사항 없음"으로 보고하고 5단계로 건너뜁니다.

## 2단계: 오늘 커밋 이력 확인
// turbo
```
cd c:\WORK\SodamFN && git log --since="midnight" --format="%h %ai %s" --reverse
```
→ 오늘 세션에서 수행한 커밋들을 시간순으로 확인합니다.

## 3단계: DevWorkLog 작업일지 등록

오늘 작업한 커밋 이력 + 미커밋 변경사항을 분석하여 DevWorkLog에 등록합니다.

### 규칙:
1. **날짜+테마별 그룹핑**: 커밋 하나하나가 아닌, 관련 작업을 의미 있는 단위로 묶어 기록
2. **카테고리**: feature, bugfix, refactor, infra, design, other 중 선택
3. **필수 필드**: date, title, content(마크다운), category, files_changed, ai_summary
4. **ai_summary**: 다음 세션에서 이어받을 때 참고할 핵심 사항 (주의점, 미완료 작업, 다음 단계 등)
5. **중복 체크**: 같은 날짜+제목이 이미 존재하면 스킵

### 등록 방법:
아래 Python 패턴을 사용하여 DB에 직접 등록합니다:

```python
import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import DevWorkLog

with Session(engine) as session:
    # 중복 체크
    existing = session.exec(
        select(DevWorkLog).where(
            DevWorkLog.date == date.today(),
            DevWorkLog.title == "작업 제목"
        )
    ).first()
    if not existing:
        entry = DevWorkLog(
            date=date.today(),
            title="작업 제목",
            content="## 상세 내용 (마크다운)",
            category="feature",
            files_changed="파일1.py\n파일2.jsx",
            ai_summary="다음 세션 참고사항",
            status="completed",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        session.add(entry)
    session.commit()
```

## 4단계: Git 커밋 & 푸시

미커밋 변경사항이 있으면 스테이징 → 커밋 → 푸시합니다.

### 4-1. 스테이징
// turbo
```
cd c:\WORK\SodamFN && git add -A
```

### 4-2. 커밋
커밋 메시지 규칙:
- `feat:` 새 기능
- `fix:` 버그 수정
- `style:` UI/디자인 변경
- `refactor:` 코드 리팩토링
- `docs:` 문서 업데이트
- `infra:` 인프라/배포 관련

```
cd c:\WORK\SodamFN && git commit -m "커밋메시지"
```

### 4-3. 푸시
// turbo
```
cd c:\WORK\SodamFN && git push origin main
```

## 5단계: 세션 종료 보고

사용자에게 아래 형식으로 요약 보고합니다:

```
## 세션 종료 보고

### 오늘 작업 요약
| 카테고리 | 작업 내용 | 상태 |
|---|---|---|
| feature | ... | 완료 |
| bugfix | ... | 완료 |

### 작업일지
- N건 신규 등록

### Git 상태
- 커밋: N건
- 푸시: 완료 / 대기

### 다음 세션 참고사항
- 미완료 작업이나 주의점 기록

### 다음 세션 추천 작업
- 이어서 할 작업 제안
```
