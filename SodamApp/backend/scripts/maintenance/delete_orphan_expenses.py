"""
Delete orphaned DailyExpense records - keep only those with matching Vendor
"""
from sqlmodel import Session, select
from database import engine
from models import Vendor, DailyExpense

def delete_orphan_expenses(dry_run=True):
    """Delete DailyExpense records that don't have a matching Vendor"""
    with Session(engine) as session:
        # Get all vendor names from Vendor table
        vendors = session.exec(select(Vendor)).all()
        vendor_names = set(v.name for v in vendors)
        
        # Get all DailyExpense records
        expenses = session.exec(select(DailyExpense)).all()
        
        # Find orphaned expenses
        orphaned = [e for e in expenses if e.vendor_name not in vendor_names]
        
        print(f"총 DailyExpense 레코드: {len(expenses)}")
        print(f"Vendor 테이블에 있는 거래처 수: {len(vendor_names)}")
        print(f"삭제 대상 (고아 레코드): {len(orphaned)}")
        print(f"보존 대상: {len(expenses) - len(orphaned)}")
        print()
        
        if not orphaned:
            print("✓ 삭제할 고아 레코드가 없습니다.")
            return
        
        if dry_run:
            print("[DRY RUN] 실제로 삭제하지 않습니다.")
            print(f"\n삭제 예정 레코드 샘플 (처음 10개):")
            for e in orphaned[:10]:
                print(f"  - ID:{e.id}, {e.vendor_name}, {e.date}, {e.amount:,}원")
            print(f"\n실제로 삭제하려면: python delete_orphan_expenses.py --execute")
        else:
            print(f"[EXECUTE] {len(orphaned)}건의 고아 레코드 삭제 중...")
            for expense in orphaned:
                session.delete(expense)
            session.commit()
            print(f"\n✅ {len(orphaned)}건 삭제 완료!")
            print(f"남은 DailyExpense 레코드: {len(expenses) - len(orphaned)}")

if __name__ == "__main__":
    import sys
    dry_run = "--execute" not in sys.argv
    delete_orphan_expenses(dry_run=dry_run)
