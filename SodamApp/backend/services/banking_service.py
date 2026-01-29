from typing import List, Optional
from datetime import datetime
from sqlmodel import select
from models import Payroll, GlobalSetting, Staff
from services.database_service import DatabaseService

class BankingService:
    @staticmethod
    def get_biz_account():
        """Retrieves the representative's business account info from settings"""
        service = DatabaseService()
        try:
            bank = service.session.get(GlobalSetting, "biz_account_bank")
            number = service.session.get(GlobalSetting, "biz_account_number")
            holder = service.session.get(GlobalSetting, "biz_account_holder")
            
            return {
                "bank": bank.value if bank else "",
                "number": number.value if number else "",
                "holder": holder.value if holder else ""
            }
        finally:
            service.close()

    @staticmethod
    def update_biz_account(bank: str, number: str, holder: str):
        """Updates the representative's business account info"""
        service = DatabaseService()
        try:
            for key, val in [("biz_account_bank", bank), ("biz_account_number", number), ("biz_account_holder", holder)]:
                setting = service.session.get(GlobalSetting, key)
                if setting:
                    setting.value = val
                else:
                    setting = GlobalSetting(key=key, value=val)
                service.session.add(setting)
            service.session.commit()
            return True
        finally:
            service.close()

    @classmethod
    def execute_payroll_transfer(cls, payroll_id: int):
        """
        Executes a payroll transfer.
        In this implementation, it validates the info and updates the status to 'Completed'.
        Integration with real banking APIs would happen here.
        """
        service = DatabaseService()
        try:
            payroll = service.session.get(Payroll, payroll_id)
            if not payroll:
                return {"status": "error", "message": "Payroll record not found"}
            
            staff = payroll.staff
            if not staff or not staff.bank_account:
                return {"status": "error", "message": "Staff bank account info missing"}

            # Simulated Transfer Logic
            # 1. Check if biz account is set
            biz_acc = cls.get_biz_account()
            if not biz_acc["number"]:
                return {"status": "error", "message": "Representative business account not configured"}

            # 2. Update status
            payroll.transfer_status = "완료"
            payroll.transferred_at = datetime.now()
            service.session.add(payroll)
            service.session.commit()
            
            return {
                "status": "success", 
                "message": f"{staff.name}님에게 {payroll.total_pay:,}원 이체 완료",
                "transferred_at": payroll.transferred_at.isoformat()
            }
        finally:
            service.close()

    @staticmethod
    def get_bulk_transfer_data(payroll_ids: List[int]):
        """
        Prepares data for bulk transfer (e.g., for Excel export).
        Returns a list of dictionaries with required banking fields.
        """
        service = DatabaseService()
        try:
            stmt = select(Payroll).where(Payroll.id.in_(payroll_ids))
            payrolls = service.session.exec(stmt).all()
            
            data = []
            for p in payrolls:
                staff = p.staff
                if staff and staff.bank_account:
                    # Parse bank account: "KB국민 123-456-78901 홍길동"
                    parts = staff.bank_account.split()
                    bank = parts[0] if len(parts) > 0 else ""
                    acc_num = parts[1] if len(parts) > 1 else ""
                    holder = parts[2] if len(parts) > 2 else staff.name
                    
                    data.append({
                        "staff_name": staff.name,
                        "bank": bank,
                        "account_number": acc_num,
                        "holder": holder,
                        "amount": p.total_pay,
                        "month": p.month
                    })
            return data
        finally:
            service.close()
