from sqlmodel import Session, select, func
from models import Vendor, Expense, Revenue, Product, Inventory, Staff, Attendance, Payroll
from database import engine
from datetime import date
import pandas as pd

class DatabaseService:
    def __init__(self):
        self.session = Session(engine)

    def get_monthly_summary(self, month: int, year: int = 2025):
        # Revenue
        start_date = date(year, month, 1)
        if month == 12:
            end_date = date(year + 1, 1, 1)
        else:
            end_date = date(year, month + 1, 1)
            
        rev_stmt = select(func.sum(Revenue.amount)).where(Revenue.date >= start_date, Revenue.date < end_date)
        total_revenue = self.session.exec(rev_stmt).one() or 0
        
        # Expenses
        exp_stmt = select(func.sum(Expense.amount)).where(Expense.date >= start_date, Expense.date < end_date)
        total_expense = self.session.exec(exp_stmt).one() or 0
        
        profit = total_revenue - total_expense
        margin = (profit / total_revenue * 100) if total_revenue > 0 else 0
        
        return {
            "revenue": int(total_revenue),
            "expense": int(total_expense),
            "profit": int(profit),
            "margin": round(margin, 1)
        }

    def get_revenue_breakdown(self, month: int, year: int = 2025):
        start_date = date(year, month, 1)
        if month == 12: end_date = date(year + 1, 1, 1)
        else: end_date = date(year, month + 1, 1)

        stmt = select(Revenue.channel, func.sum(Revenue.amount)).where(Revenue.date >= start_date, Revenue.date < end_date).group_by(Revenue.channel)
        results = self.session.exec(stmt).all()
        
        return [{"name": r[0], "value": r[1]} for r in results]

    def get_top_expenses(self, month: int, year: int = 2025):
        start_date = date(year, month, 1)
        if month == 12: end_date = date(year + 1, 1, 1)
        else: end_date = date(year, month + 1, 1)
        
        # Join Expense with Vendor
        # Group by Vendor Name, Sum Amount
        # Also need Item from Vendor info in DB?
        # Vendors in DB have 'category' but not specific 'item' field we added to Excel.
        # Let's check our model. Vendor has `category`. Product has `name`.
        # Migration script set Vendor category to "기타".
        # We might need to update Vendor model or usage.
        
        stmt = select(Vendor.name, func.sum(Expense.amount), Vendor.category).join(Vendor).where(Expense.date >= start_date, Expense.date < end_date).group_by(Vendor.id).order_by(func.sum(Expense.amount).desc()).limit(5)
        
        results = self.session.exec(stmt).all()
        return [{"vendor": r[0], "amount": r[1], "item": r[2]} for r in results]

    def get_vendors(self):
        stmt = select(Vendor)
        results = self.session.exec(stmt).all()
        return [{"id": v.id, "name": v.name, "item": v.category} for v in results]

    def update_vendor_item(self, vendor_name: str, item: str):
        stmt = select(Vendor).where(Vendor.name == vendor_name)
        vendor = self.session.exec(stmt).first()
        if vendor:
            vendor.category = item # Using category field as 'Item/Handling'
            self.session.add(vendor)
            self.session.commit()
            return True
        return False
        
    def export_to_excel(self, output_path: str):
        # Create Excel Writer
        with pd.ExcelWriter(output_path) as writer:
            # 1. Vendors
            vendors = self.session.exec(select(Vendor)).all()
            df_vendors = pd.DataFrame([v.model_dump() for v in vendors])
            if not df_vendors.empty:
                df_vendors.to_excel(writer, sheet_name='Vendors', index=False)
            
            # 2. Expenses
            expenses = self.session.exec(select(Expense)).all()
            df_exp = pd.DataFrame([e.model_dump() for e in expenses])
            if not df_exp.empty:
                df_exp.to_excel(writer, sheet_name='Expenses', index=False)
                
            # 3. Revenue
            revenues = self.session.exec(select(Revenue)).all()
            df_rev = pd.DataFrame([r.model_dump() for r in revenues])
            if not df_rev.empty:
                df_rev.to_excel(writer, sheet_name='Revenue', index=False)
                
        return output_path
        
    def close(self):
        self.session.close()
