"""
Backfill: Set payment_method='Cash' for DailyExpense records
from vendors whose name contains '현금'.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from database import engine
from sqlalchemy import text

def backfill():
    with engine.connect() as conn:
        # 1. Find cash vendor names
        result = conn.execute(text(
            "SELECT DISTINCT de.vendor_name, v.name, v.category "
            "FROM dailyexpense de "
            "LEFT JOIN vendor v ON de.vendor_id = v.id "
            "WHERE de.vendor_name LIKE '%현금%' OR v.name LIKE '%현금%'"
        ))
        cash_vendors = result.fetchall()
        print(f"Found {len(cash_vendors)} cash vendor name(s):")
        for row in cash_vendors:
            print(f"  - vendor_name={row[0]}, vendor.name={row[1]}, category={row[2]}")
        
        # 2. Update payment_method for cash vendors
        update_result = conn.execute(text(
            "UPDATE dailyexpense SET payment_method = 'Cash' "
            "WHERE vendor_name LIKE '%현금%'"
        ))
        print(f"\nUpdated {update_result.rowcount} records to payment_method='Cash'")
        
        # 3. Also check if any vendor_id maps to a vendor with '현금' in name
        update_result2 = conn.execute(text(
            "UPDATE dailyexpense SET payment_method = 'Cash' "
            "WHERE vendor_id IN (SELECT id FROM vendor WHERE name LIKE '%현금%') "
            "AND payment_method != 'Cash'"
        ))
        print(f"Updated {update_result2.rowcount} additional records via vendor.name match")
        
        conn.commit()
        
        # 4. Verify
        verify = conn.execute(text(
            "SELECT payment_method, COUNT(*) FROM dailyexpense "
            "WHERE vendor_id IN (SELECT id FROM vendor WHERE vendor_type = 'revenue') "
            "GROUP BY payment_method"
        ))
        print("\nPayment method distribution (revenue vendors):")
        for row in verify.fetchall():
            print(f"  {row[0]}: {row[1]} records")

if __name__ == "__main__":
    backfill()
