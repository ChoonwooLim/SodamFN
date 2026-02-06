"""
Find and clean up orphan vendors in DailyExpense that don't exist in Vendor table.
Run this against the production PostgreSQL database.
"""
import os
from sqlmodel import Session, create_engine, select, text

# Use Render PostgreSQL External URL
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://sodamfn_user:AZpKIEO9MxmPCCvkjRqsJqr4NBInwDw7@dpg-d62p07m3jp1c738r0cdg-a.singapore-postgres.render.com/sodamfn"
)

engine = create_engine(DATABASE_URL)

def find_orphan_vendors():
    """Find vendor_names in DailyExpense that don't have matching Vendor records."""
    with Session(engine) as session:
        # Get all unique vendor_names from DailyExpense
        result = session.exec(text("""
            SELECT DISTINCT de.vendor_name, COUNT(*) as count
            FROM dailyexpense de
            LEFT JOIN vendor v ON de.vendor_name = v.name
            WHERE v.id IS NULL
            GROUP BY de.vendor_name
            ORDER BY count DESC
        """))
        
        orphans = result.fetchall()
        
        print(f"\n=== 고아 업체 목록 (Vendor 테이블에 없음) ===")
        print(f"총 {len(orphans)}개 업체\n")
        
        for vendor_name, count in orphans:
            print(f"  - {vendor_name}: {count}건의 비용 레코드")
        
        return orphans

def delete_orphan_expenses():
    """Delete DailyExpense records that don't have matching Vendor records."""
    with Session(engine) as session:
        # First count
        count_result = session.exec(text("""
            SELECT COUNT(*) FROM dailyexpense de
            LEFT JOIN vendor v ON de.vendor_name = v.name
            WHERE v.id IS NULL
        """))
        count = count_result.fetchone()[0]
        
        print(f"\n삭제할 고아 DailyExpense 레코드: {count}건")
        
        if count > 0:
            confirm = input("정말 삭제하시겠습니까? (yes/no): ")
            if confirm.lower() == 'yes':
                session.exec(text("""
                    DELETE FROM dailyexpense
                    WHERE id IN (
                        SELECT de.id FROM dailyexpense de
                        LEFT JOIN vendor v ON de.vendor_name = v.name
                        WHERE v.id IS NULL
                    )
                """))
                session.commit()
                print(f"✓ {count}건의 고아 레코드 삭제 완료")
            else:
                print("삭제 취소됨")

def create_missing_vendors():
    """Create Vendor records for orphan vendors in DailyExpense."""
    with Session(engine) as session:
        # Get orphan vendor names with their category from DailyExpense
        result = session.exec(text("""
            SELECT DISTINCT de.vendor_name, de.category
            FROM dailyexpense de
            LEFT JOIN vendor v ON de.vendor_name = v.name
            WHERE v.id IS NULL
        """))
        
        orphans = result.fetchall()
        
        print(f"\n=== 생성할 Vendor 레코드 ===")
        for vendor_name, category in orphans:
            print(f"  - {vendor_name} (카테고리: {category})")
        
        if orphans:
            confirm = input(f"\n{len(orphans)}개의 Vendor 레코드를 생성하시겠습니까? (yes/no): ")
            if confirm.lower() == 'yes':
                for vendor_name, category in orphans:
                    # Get max order_index for this category
                    max_order = session.exec(text(f"""
                        SELECT COALESCE(MAX(order_index), 0) FROM vendor 
                        WHERE category = :category AND vendor_type = 'expense'
                    """), {"category": category}).fetchone()[0]
                    
                    session.exec(text("""
                        INSERT INTO vendor (name, category, vendor_type, order_index)
                        VALUES (:name, :category, 'expense', :order_index)
                    """), {
                        "name": vendor_name,
                        "category": category or '기타비용',
                        "order_index": max_order + 1
                    })
                
                session.commit()
                print(f"✓ {len(orphans)}개의 Vendor 레코드 생성 완료")
            else:
                print("생성 취소됨")

if __name__ == "__main__":
    print("=== 고아 업체 정리 도구 ===")
    print("1. 고아 업체 조회만")
    print("2. 고아 비용 레코드 삭제")
    print("3. 누락된 Vendor 레코드 생성")
    
    choice = input("\n선택하세요 (1/2/3): ")
    
    if choice == "1":
        find_orphan_vendors()
    elif choice == "2":
        find_orphan_vendors()
        delete_orphan_expenses()
    elif choice == "3":
        find_orphan_vendors()
        create_missing_vendors()
    else:
        print("잘못된 선택입니다.")
