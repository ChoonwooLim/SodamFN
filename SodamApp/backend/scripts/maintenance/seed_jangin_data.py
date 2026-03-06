"""
장인김밥 (business_id=2) 샘플 데이터 생성 스크립트
- 직원 4명
- 거래처 (매입처)
- 2026년 1~2월 매입/매출 데이터
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlmodel import Session, select
from models import Business, Staff, User, Vendor, Expense, Revenue, Announcement, EmergencyContact
from datetime import date, timedelta
import random
import bcrypt

BID = 2  # 장인김밥

def get_password_hash(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def seed():
    with Session(engine) as s:
        biz = s.get(Business, BID)
        if not biz:
            print(f"❌ Business ID {BID} not found!")
            return
        print(f"📍 대상 매장: {biz.name} (BID={BID})")

        # Check if already seeded
        existing = s.exec(select(Staff).where(Staff.business_id == BID)).all()
        if existing:
            print(f"⚠️  이미 직원 {len(existing)}명 존재. 스킵하시겠습니까? (n=추가 진행)")
            # Continue anyway for idempotency check on other data

        # =====================
        # 1. STAFF (4명)
        # =====================
        staff_data = [
            {"name": "박준혁", "role": "주방장", "contract_type": "정규직", "hourly_wage": 10030,
             "start_date": date(2025, 3, 1), "phone": "010-1234-5678",
             "bank_name": "국민은행", "account_number": "123-456-789012", "account_holder": "박준혁",
             "work_start_time": "09:00", "work_end_time": "18:00", "rest_start_time": "12:00", "rest_end_time": "13:00",
             "contract_start_date": date(2025, 3, 1), "job_description": "주방 총괄, 김밥 제조",
             "dependents_count": 3, "status": "재직"},
            {"name": "이서연", "role": "홀서빙", "contract_type": "아르바이트", "hourly_wage": 10030,
             "start_date": date(2025, 9, 15), "phone": "010-2345-6789",
             "bank_name": "신한은행", "account_number": "234-567-890123", "account_holder": "이서연",
             "work_start_time": "10:00", "work_end_time": "16:00",
             "contract_start_date": date(2025, 9, 15), "job_description": "홀 서빙, 계산",
             "dependents_count": 1, "status": "재직"},
            {"name": "김태호", "role": "저녁서빙", "contract_type": "아르바이트", "hourly_wage": 10030,
             "start_date": date(2025, 11, 1), "phone": "010-3456-7890",
             "bank_name": "하나은행", "account_number": "345-678-901234", "account_holder": "김태호",
             "work_start_time": "17:00", "work_end_time": "22:00",
             "contract_start_date": date(2025, 11, 1), "job_description": "저녁 홀 서빙",
             "dependents_count": 1, "status": "재직"},
            {"name": "최민지", "role": "주방보조", "contract_type": "아르바이트", "hourly_wage": 10030,
             "start_date": date(2026, 1, 5), "phone": "010-4567-8901",
             "bank_name": "우리은행", "account_number": "456-789-012345", "account_holder": "최민지",
             "work_start_time": "08:00", "work_end_time": "14:00",
             "contract_start_date": date(2026, 1, 5), "job_description": "아침 오픈, 주방 보조",
             "dependents_count": 1, "status": "재직"},
        ]

        created_staff = []
        for sd in staff_data:
            exists = s.exec(select(Staff).where(Staff.name == sd["name"], Staff.business_id == BID)).first()
            if exists:
                print(f"  ✓ 직원 '{sd['name']}' 이미 존재 (ID={exists.id})")
                created_staff.append(exists)
                continue
            staff = Staff(business_id=BID, **sd)
            s.add(staff)
            s.flush()
            created_staff.append(staff)
            print(f"  + 직원 '{sd['name']}' 생성 (ID={staff.id})")

        # =====================
        # 2. USER ACCOUNTS for staff
        # =====================
        usernames = ["jangin001", "jangin002", "jangin003", "jangin004"]
        for i, (uname, staff) in enumerate(zip(usernames, created_staff)):
            exists = s.exec(select(User).where(User.username == uname)).first()
            if exists:
                print(f"  ✓ 계정 '{uname}' 이미 존재")
                continue
            user = User(
                username=uname,
                hashed_password=get_password_hash("1234"),
                role="staff",
                grade="staff",
                staff_id=staff.id,
                real_name=staff.name,
                business_id=BID,
            )
            s.add(user)
            print(f"  + 계정 '{uname}' 생성 (staff: {staff.name})")

        # =====================
        # 3. VENDORS (매입거래처)
        # =====================
        vendor_data = [
            {"name": "대한식재료", "category": "식자재", "vendor_type": "expense"},
            {"name": "신선유통", "category": "식자재", "vendor_type": "expense"},
            {"name": "김밥천국재료", "category": "식자재", "vendor_type": "expense"},
            {"name": "세종가스", "category": "가스/전기", "vendor_type": "expense"},
            {"name": "그린세제", "category": "소모품", "vendor_type": "expense"},
            {"name": "미래부동산", "category": "임대료", "vendor_type": "expense"},
        ]

        created_vendors = {}
        for vd in vendor_data:
            exists = s.exec(select(Vendor).where(Vendor.name == vd["name"], Vendor.business_id == BID)).first()
            if exists:
                created_vendors[vd["name"]] = exists
                continue
            v = Vendor(business_id=BID, **vd)
            s.add(v)
            s.flush()
            created_vendors[vd["name"]] = v
            print(f"  + 거래처 '{vd['name']}' 생성")

        # =====================
        # 4. EXPENSES (매입) — 1월, 2월
        # =====================
        existing_expenses = s.exec(
            select(Expense).where(Expense.business_id == BID)
        ).all()
        if existing_expenses:
            print(f"  ✓ 매입 데이터 이미 {len(existing_expenses)}건 존재, 스킵")
        else:
            expense_templates = [
                ("대한식재료", "식자재", 150000, 280000),
                ("신선유통", "식자재", 80000, 200000),
                ("김밥천국재료", "식자재", 100000, 250000),
                ("세종가스", "가스/전기", 150000, 200000),
                ("그린세제", "소모품", 30000, 60000),
            ]

            expense_count = 0
            for month in [1, 2]:
                # 월세 (월 1회)
                rent_vendor = created_vendors["미래부동산"]
                exp = Expense(
                    business_id=BID, date=date(2026, month, 1),
                    amount=1500000, category="임대료",
                    payment_method="이체", description="월세",
                    vendor_id=rent_vendor.id,
                )
                s.add(exp)
                expense_count += 1

                # 식자재/소모품 (주 2~3회)
                for week in range(4):
                    for vendor_name, category, min_amt, max_amt in expense_templates:
                        if random.random() < 0.3:
                            continue  # some weeks skip some vendors
                        day = min(week * 7 + random.randint(1, 5), 28)
                        amt = random.randrange(min_amt, max_amt, 10000)
                        vendor = created_vendors[vendor_name]
                        exp = Expense(
                            business_id=BID, date=date(2026, month, day),
                            amount=amt, category=category,
                            payment_method=random.choice(["카드", "현금", "이체"]),
                            description=f"{vendor_name} {category}",
                            vendor_id=vendor.id,
                        )
                        s.add(exp)
                        expense_count += 1

            print(f"  + 매입 {expense_count}건 생성 (1~2월)")

        # =====================
        # 5. REVENUE (매출) — 1월, 2월
        # =====================
        existing_revenue = s.exec(
            select(Revenue).where(Revenue.business_id == BID)
        ).all()
        if existing_revenue:
            print(f"  ✓ 매출 데이터 이미 {len(existing_revenue)}건 존재, 스킵")
        else:
            revenue_count = 0
            channels = {
                "매장": (300000, 700000),
                "배달의민족": (100000, 300000),
                "쿠팡이츠": (50000, 200000),
            }
            for month in [1, 2]:
                days_in_month = 31 if month == 1 else 28
                for day in range(1, days_in_month + 1):
                    for channel, (min_r, max_r) in channels.items():
                        # 주말은 매출 높게
                        d = date(2026, month, day)
                        weekday = d.weekday()
                        multiplier = 1.3 if weekday >= 5 else 1.0

                        # 가끔 배달 없는 날
                        if channel != "매장" and random.random() < 0.15:
                            continue

                        amt = int(random.randrange(min_r, max_r, 10000) * multiplier)
                        rev = Revenue(
                            business_id=BID, date=d,
                            channel=channel, amount=amt,
                            description=f"{channel} 매출",
                        )
                        s.add(rev)
                        revenue_count += 1

            print(f"  + 매출 {revenue_count}건 생성 (1~2월)")

        # =====================
        # 6. ANNOUNCEMENTS
        # =====================
        existing_ann = s.exec(
            select(Announcement).where(Announcement.business_id == BID)
        ).all()
        if not existing_ann:
            anns = [
                Announcement(business_id=BID, title="장인김밥 오픈 안내", content="2025년 3월 1일 장인김밥이 새롭게 오픈합니다!", pinned=True),
                Announcement(business_id=BID, title="설 연휴 근무 안내", content="1월 28일~30일 설 연휴 정상영업합니다. 근무표 확인 바랍니다."),
                Announcement(business_id=BID, title="2월 위생교육 공지", content="2월 15일(토) 전직원 위생교육 진행 예정입니다."),
            ]
            for a in anns:
                s.add(a)
            print(f"  + 공지사항 {len(anns)}건 생성")

        # =====================
        # 7. EMERGENCY CONTACTS
        # =====================
        existing_ec = s.exec(
            select(EmergencyContact).where(EmergencyContact.business_id == BID)
        ).all()
        if not existing_ec:
            ecs = [
                EmergencyContact(business_id=BID, name="장인김밥 본사", phone="02-1234-5678", relationship="본사", staff_id=created_staff[0].id),
                EmergencyContact(business_id=BID, name="소방서", phone="119", relationship="비상", staff_id=created_staff[0].id),
            ]
            for ec in ecs:
                s.add(ec)
            print(f"  + 비상연락처 {len(ecs)}건 생성")

        s.commit()
        print(f"\n✅ 장인김밥 샘플 데이터 생성 완료!")
        print(f"   직원 계정: jangin001~jangin004 / 비밀번호: 1234")

if __name__ == "__main__":
    seed()
