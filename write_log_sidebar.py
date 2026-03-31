import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import DevWorkLog

with Session(engine) as session:
    existing = session.exec(
        select(DevWorkLog).where(
            DevWorkLog.date == date.today(),
            DevWorkLog.title == "직원 파트 통합 사이드바 개편"
        )
    ).first()
    if not existing:
        entry = DevWorkLog(
            date=date.today(),
            title="직원 파트 통합 사이드바 개편",
            content="""## 1. 사이드메뉴 논리적 그룹화 완료
- 메인에 노출되었던 기존 `직원 관리` 단일 메뉴 탭 삭제
- 대신 **"직원관리"** 이름의 접이식 통합 그룹(아코디언 형태)으로 상위 개념 생성
- 그룹 산하로 다음 세 가지 하위 메뉴를 소속시킴:
  - 인사기록관리 (`/staff`)
  - 퇴직금 지급관리 (`/hr/retirement`)
  - 퇴직금 산출 (`/retirement-calc`)

## 2. 모바일/데스크탑 뷰 스타일링 통합 수정
- 사이드바 변경 과정에서 데스크탑 UI 스타일에 모바일용 헤비 요소(패딩, background 색상)가 일시 적용됐던 스타일링 오류 해결
- 기존 데스크탑용 `isHrActive` 조건문 호환성 복구 (URL path matching을 정확히 `/staff` 등 하위 트리로 분기 처리 완료)""",
            category="refactor",
            files_changed="SodamApp/frontend/src/components/Sidebar.jsx",
            ai_summary="인사, 급여/퇴직에 관한 모든 서브 라우트들이 하나의 그룹 메뉴에 안정적으로 들어왔음. 다음 세션부터 관련 API를 추가하거나 HR 모듈을 고도화할 때 네비게이션 트리 변경 없이 해당 파일 내 하위 링크만 추가하면 됨.",
            status="completed",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        session.add(entry)
    session.commit()
