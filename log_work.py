import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import DevWorkLog

def add_log():
    try:
        with Session(engine) as session:
            existing = session.exec(
                select(DevWorkLog).where(
                    DevWorkLog.date == date.today(),
                    DevWorkLog.title == "세무대행(Accountant) 정산 덮어쓰기 기능 및 중도퇴직자 급여/퇴직금 산출 고도화"
                )
            ).first()
            if not existing:
                entry = DevWorkLog(
                    date=date.today(),
                    title="세무대행(Accountant) 정산 덮어쓰기 기능 및 중도퇴직자 급여/퇴직금 산출 고도화",
                    content="""## 상세 내용
1. **세무대행(연말정산 등) 덮어쓰기 기능 추가 (`AttendanceInput.jsx`, `payroll.py`)** 
   - 세무사에서 전달된 명세서(연말정산 환급 등 마이너스 금액 포함)의 수치를 급여 산출 시 직접 입력하여 100% 동일하게 산출되도록 오버라이드 기능 구현 및 DB 저장처리
2. **중도퇴사자 마지막 달 급여 일할계산 로직 추가 (`payroll.py`)**
   - 사직일(end_date)이 당월인 정규직 직원의 경우 기본급 대상을 (월급 / 당월 총일수 * 근무일수) 방식으로 자동 Prorating 하도록 개선
3. **법정 퇴직금 산출(평균임금 방식) 및 명세서 UI 고도화 (`RetirementPay.jsx`, `hr.py`)**
   - 최근 3개월간의 정확한 일급여액 총계를 90여일로 나눈 [1일 평균임금 x 30일 x 근속일수/365] 공식을 새로 적용
   - \`RetirementPay\` 내에서 단순 누적적립액이 아닌, 실시간 3개월 단위의 퇴직금 정확한 산정식/명세 내역(Breakdown)을 즉시 조회하여 지급내역을 확정할 수 있도록 인터페이스 개편""",
                    category="feature",
                    files_changed="routers/hr.py\nrouters/payroll.py\nAttendanceInput.jsx\nRetirementPay.jsx",
                    ai_summary="차후 연말정산 전용 페이지나 업로드 기능도 추가를 고려해 볼 수 있음. 현재는 수동입력으로 완전히 문제해결됨.",
                    status="completed",
                    created_at=datetime.now(),
                    updated_at=datetime.now(),
                )
                session.add(entry)
                session.commit()
                print("DevWorkLog successfully added.")
            else:
                print("DevWorkLog already exists.")
    except Exception as e:
        print(f"Error adding log: {e}")

if __name__ == "__main__":
    add_log()
