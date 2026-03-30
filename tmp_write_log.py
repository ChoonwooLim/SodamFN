import sys
sys.path.insert(0, r'c:\WORK\SodamFN\SodamApp\backend')
from datetime import date, datetime
from sqlmodel import Session, select
from database import engine
from models import DevWorkLog

with Session(engine) as session:
    # 중복 체크
    title = "매출 관리 대시보드 리스트 및 그리드 무채색/지브라 프리미엄 고도화"
    existing = session.exec(
        select(DevWorkLog).where(
            DevWorkLog.date == date.today(),
            DevWorkLog.title == title
        )
    ).first()
    if not existing:
        entry = DevWorkLog(
            date=date.today(),
            title=title,
            content="""## 매출 관리 테이블 프리미엄 고도화
1. **리스트 뷰 콜랩스 토글 확장 및 라운드 최적화**:
   - 현금매출에 대해서도 'N건' 기준으로 접고 펼 수 있도록 콜랩스 로직 통일
   - 탭 메뉴와 본문의 연결 부분 라운드 제거로 일체감 조성
2. **카테고리 뱃지 여백 및 줄바꿈 해결**:
   - 폰트 상향에 따른 갇힘 현상을 해결하기 위해 뱃지 너비 상향 
   - `white-space: nowrap` 적용으로 찌그러짐 방지
3. **월별 상세내역 및 리스트 디자인 무채색 통일 (지브라 패턴)**:
   - 과도한 형광톤(`background: #fffbeb`, `#fde68a` 등) 제거
   - `white` / `#f8fafc` 교차(Zebra) 패턴 및 굵은 외곽선 처리로 모노톤 프리미엄 가독성 부여""",
            category="style",
            files_changed="RevenueManagement.css\nRevenueManagement.jsx",
            ai_summary="테이블의 가짜 컬러(배경 틴트)를 빼고 테두리+폰트위주로 무채색 고도화를 마무리함. 추후 카드매출, 지출 관리 등에도 동일 지브라 테마 적용 여부 검토 필요.",
            status="completed",
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        session.add(entry)
        session.commit()
    print("Log saved")
