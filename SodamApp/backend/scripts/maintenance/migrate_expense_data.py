"""
기존 DailyExpense + Vendor 레코드의 카테고리를 신규 체계로 마이그레이션.
실행: python scripts/maintenance/migrate_expense_data.py
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'sodam_database.db')

# 옛 카테고리 → 새 카테고리 매핑
CATEGORY_MAP = {
    # 한글 레거시
    '식자재':      '원재료비',
    '재료비':      '원재료비',
    '임대료':      '임차료',
    '임대료(월세)': '임차료',
    '임대관리비':   '임차료',
    '제세공과금':   '수도광열비',
    '부가가치세':   '세금과공과',
    '사업소득세':   '세금과공과',
    '근로소득세':   '세금과공과',
    '기타비용':     '기타경비',
    '개인생활비':   '개인가계부',
    # 영문 레거시
    'food':        '원재료비',
    'delivery':    '기타경비',
    'equipment':   '감가상각비',
    'utility':     '수도광열비',
    'other':       '기타경비',
    # 미분류 / NULL → 기타경비
    '미분류':      '기타경비',
}

def migrate():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()

    print("=" * 50)
    print("카테고리 데이터 마이그레이션 시작")
    print("=" * 50)

    # 1) DailyExpense 마이그레이션
    print("\n[DailyExpense] 변경 전:")
    cur.execute("SELECT category, COUNT(*) FROM dailyexpense GROUP BY category ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(f"  {row[0]!r}: {row[1]}건")

    total_expense = 0
    for old_cat, new_cat in CATEGORY_MAP.items():
        cur.execute("UPDATE dailyexpense SET category = ? WHERE category = ?", (new_cat, old_cat))
        cnt = cur.rowcount
        if cnt > 0:
            print(f"  ✅ DailyExpense: '{old_cat}' → '{new_cat}' ({cnt}건)")
            total_expense += cnt

    # NULL → 기타경비
    cur.execute("UPDATE dailyexpense SET category = '기타경비' WHERE category IS NULL OR category = ''")
    cnt = cur.rowcount
    if cnt > 0:
        print(f"  ✅ DailyExpense: NULL/빈값 → '기타경비' ({cnt}건)")
        total_expense += cnt

    print(f"\n  총 {total_expense}건 변환 완료")

    # 2) Vendor 마이그레이션
    print("\n[Vendor] 변경 전:")
    cur.execute("SELECT category, COUNT(*) FROM vendor GROUP BY category ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(f"  {row[0]!r}: {row[1]}건")

    total_vendor = 0
    for old_cat, new_cat in CATEGORY_MAP.items():
        cur.execute("UPDATE vendor SET category = ? WHERE category = ?", (new_cat, old_cat))
        cnt = cur.rowcount
        if cnt > 0:
            print(f"  ✅ Vendor: '{old_cat}' → '{new_cat}' ({cnt}건)")
            total_vendor += cnt

    # NULL → 기타경비
    cur.execute("UPDATE vendor SET category = '기타경비' WHERE category IS NULL OR category = ''")
    cnt = cur.rowcount
    if cnt > 0:
        print(f"  ✅ Vendor: NULL/빈값 → '기타경비' ({cnt}건)")
        total_vendor += cnt

    print(f"\n  총 {total_vendor}건 변환 완료")

    conn.commit()

    # 3) 결과 확인
    print("\n" + "=" * 50)
    print("마이그레이션 완료 — 변경 후 현황:")
    print("=" * 50)

    print("\n[DailyExpense]")
    cur.execute("SELECT category, COUNT(*) FROM dailyexpense GROUP BY category ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}건")

    print("\n[Vendor]")
    cur.execute("SELECT category, COUNT(*) FROM vendor GROUP BY category ORDER BY COUNT(*) DESC")
    for row in cur.fetchall():
        print(f"  {row[0]}: {row[1]}건")

    conn.close()
    print("\n✅ 마이그레이션 성공!")

if __name__ == '__main__':
    migrate()
