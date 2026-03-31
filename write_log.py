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
            DevWorkLog.title == "퇴직금 명세서 및 3개월 산정 알고리즘 고도화"
        )
    ).first()
    if not existing:
        entry = DevWorkLog(
            date=date.today(),
            title="퇴직금 명세서 및 3개월 산정 알고리즘 고도화",
            content="""## 1. 전용 독립 명세서 메뉴 개설
- '퇴직금 정밀산출/명세서' 전용 URL 바인딩 (/retirement-calc)
- 기존 퇴직/급여 관리대장에서 서브 드롭다운 메뉴로 분기
- 퇴직자 포함 전체 직원 조회 가능하도록 필터 옵션(?status=all) 적용

## 2. 수동 조정 시뮬레이터 적용
- 입/퇴사일 및 직전 3개월 지급 기록을 자동으로 불러오는 폼 완성
- '연차수당' 및 '기타 미지급액' 등을 수동 기입/조정 가능하게 Input Box화
- 사용자가 데이터 조정 후 재계산을 눌러 동적 산출 결과를 확인하도록 클라이언트 로직 보완

## 3. 백엔드 산출 엔진(HR) 100% 실무 일치화
- **이중 일할 계산(Double Proration) 차단**: 퇴사 월의 데이터가 이미 시스템에서 부분 출근분으로 조정(Prorate)된 경우, 서버에서 또 다시 31일로 쪼개는 오류 수정
- **정확한 과거 90일 계산 기준 적용**: 3개월 역산 시, 월 기준이 아닌 정확도 높은 일자 기준 산입 (calc_end_date - 3개월 + 1일)
- **AttributeError 문제 해결**: DB에서 contract_end_date 속성 참조 오류로 인해 다른 직원에 대한 GET 연산이 터져 500에러를 뱉던 구문 예외 처리 완수""",
            category="feature",
            files_changed="SodamApp/backend/routers/hr.py\nSodamApp/frontend/src/App.jsx\nSodamApp/frontend/src/components/Sidebar.jsx\nSodamApp/frontend/src/pages/RetirementPayCalc.jsx",
            ai_summary="퇴직금 정밀 산출 프로세스를 세무상 실무 계산법과 100% 동일하게 일치시켰으며, 사용자 측에서 마지막 세부 조율이 가능하도록 편집/PDF 생성 폼의 상태 관리를 마쳤음. 백엔드는 안전하게 contract_end_date와 1일 가산(Tenure + 1)된 수치를 생성함.",
            status="completed",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        session.add(entry)
    session.commit()
