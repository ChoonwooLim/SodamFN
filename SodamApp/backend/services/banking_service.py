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
        Currently NOT connected to real banking API.
        This validates all required info to prepare for future real implementation.
        """
        service = DatabaseService()
        try:
            # 1. 급여 기록 확인
            payroll = service.session.get(Payroll, payroll_id)
            if not payroll:
                return {"status": "error", "message": "급여 기록을 찾을 수 없습니다."}
            
            # 2. 직원 정보 및 입금 계좌 확인
            staff = payroll.staff
            if not staff:
                return {"status": "error", "message": "직원 정보를 찾을 수 없습니다."}
            
            if not staff.bank_name or not staff.bank_account or not staff.bank_holder:
                return {
                    "status": "error", 
                    "message": f"{staff.name}님의 급여 입금 계좌가 설정되지 않았습니다. 직원 정보에서 계좌를 등록해주세요."
                }

            # 3. 출금 계좌(사업자 계좌) 확인
            biz_acc = cls.get_biz_account()
            if not biz_acc["bank"] or not biz_acc["number"] or not biz_acc["holder"]:
                return {
                    "status": "error", 
                    "message": "급여 출금 계좌가 설정되지 않았습니다. 환경설정 > 급여 출금계좌에서 등록해주세요."
                }

            # 4. 은행 API 미연동 상태 안내
            # TODO: 실제 은행 API 연동 시 이 부분을 수정
            # - 오픈뱅킹 API 또는 펌뱅킹 API 연동
            # - API 키 및 인증 정보 필요
            return {
                "status": "error",
                "message": "⚠️ 은행 API가 아직 연동되지 않았습니다. 실제 이체 기능은 추후 업데이트 예정입니다.",
                "details": {
                    "from_account": f"{biz_acc['bank']} {biz_acc['number']} ({biz_acc['holder']})",
                    "to_account": f"{staff.bank_name} {staff.bank_account} ({staff.bank_holder})",
                    "amount": payroll.total_pay,
                    "staff_name": staff.name
                }
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
