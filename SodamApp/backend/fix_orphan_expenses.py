"""
Find and fix orphaned DailyExpense records (vendor_name exists but no Vendor record)
"""
import os
from sqlmodel import Session, create_engine, select, text

# Use environment variable if set, otherwise local SQLite
DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    connect_args = {}
else:
    DATABASE_URL = "sqlite:///sodam_database.db"
    connect_args = {"check_same_thread": False}

from database import engine
from models import Vendor, DailyExpense

def analyze_orphans():
    """Find DailyExpense records with no matching Vendor"""
    with Session(engine) as session:
        # Get all unique vendor names from DailyExpense
        expenses = session.exec(select(DailyExpense)).all()
        expense_vendors = set(e.vendor_name for e in expenses if e.vendor_name)
        
        # Get all vendor names from Vendor table
        vendors = session.exec(select(Vendor)).all()
        vendor_names = set(v.name for v in vendors)
        
        # Find orphaned vendor names
        orphaned = expense_vendors - vendor_names
        
        print(f"총 DailyExpense 레코드: {len(expenses)}")
        print(f"총 Vendor 레코드: {len(vendors)}")
        print(f"DailyExpense에 있는 거래처명 수: {len(expense_vendors)}")
        print(f"고아 거래처명 (Vendor 테이블에 없음): {len(orphaned)}")
        print()
        
        if orphaned:
            print("=== 고아 거래처 목록 ===")
            for name in sorted(orphaned):
                count = sum(1 for e in expenses if e.vendor_name == name)
                print(f"  - {name}: {count}건")
        
        return orphaned

def create_missing_vendors(dry_run=True):
    """Create Vendor records for orphaned expense vendor names"""
    with Session(engine) as session:
        expenses = session.exec(select(DailyExpense)).all()
        expense_vendors = set(e.vendor_name for e in expenses if e.vendor_name)
        
        vendors = session.exec(select(Vendor)).all()
        vendor_names = set(v.name for v in vendors)
        
        orphaned = expense_vendors - vendor_names
        
        if not orphaned:
            print("✓ 고아 거래처가 없습니다.")
            return
        
        print(f"\n{'[DRY RUN] ' if dry_run else ''}누락된 Vendor {len(orphaned)}개 생성 중...")
        
        for name in orphaned:
            new_vendor = Vendor(
                name=name,
                category="uncategorized",
                vendor_type="expense",
                order_index=999
            )
            if not dry_run:
                session.add(new_vendor)
            print(f"  {'[DRY]' if dry_run else '[CREATE]'} {name}")
        
        if not dry_run:
            session.commit()
            print(f"\n✅ {len(orphaned)}개 Vendor 레코드 생성 완료!")
        else:
            print(f"\n실제로 실행하려면 create_missing_vendors(dry_run=False)를 호출하세요.")

def link_expenses_to_vendors(dry_run=True):
    """Link DailyExpense records to their Vendor records by vendor_id"""
    with Session(engine) as session:
        # Get all expenses without vendor_id
        expenses = session.exec(
            select(DailyExpense).where(DailyExpense.vendor_id == None)
        ).all()
        
        if not expenses:
            print("✓ 모든 DailyExpense가 이미 vendor_id와 연결되어 있습니다.")
            return
        
        print(f"\n{'[DRY RUN] ' if dry_run else ''}vendor_id가 없는 DailyExpense {len(expenses)}건 연결 중...")
        
        # Get vendor name to ID mapping
        vendors = session.exec(select(Vendor)).all()
        vendor_map = {v.name: v.id for v in vendors}
        
        linked = 0
        for expense in expenses:
            if expense.vendor_name in vendor_map:
                if not dry_run:
                    expense.vendor_id = vendor_map[expense.vendor_name]
                    session.add(expense)
                linked += 1
        
        if not dry_run:
            session.commit()
            print(f"\n✅ {linked}건의 DailyExpense를 Vendor와 연결 완료!")
        else:
            print(f"\n{linked}건 연결 예정. 실제로 실행하려면 link_expenses_to_vendors(dry_run=False)를 호출하세요.")

if __name__ == "__main__":
    print("=== DailyExpense 고아 레코드 분석 ===\n")
    analyze_orphans()
    
    print("\n" + "="*50)
    print("옵션:")
    print("1. 누락된 Vendor 생성: create_missing_vendors(dry_run=False)")
    print("2. DailyExpense를 Vendor에 연결: link_expenses_to_vendors(dry_run=False)")
    
    # Auto-fix: Uncomment below to run automatically
    # create_missing_vendors(dry_run=False)
    # link_expenses_to_vendors(dry_run=False)
