import hmac
import hashlib
import time
import uuid
import requests
from config import SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_PFID

class NotificationService:
    @staticmethod
    def get_auth_header():
        """Generates authentication header for Solapi API v4"""
        date = time.strftime('%Y-%m-%dT%H:%M:%S.000Z', time.gmtime())
        salt = str(uuid.uuid4().hex)
        data = date + salt
        signature = hmac.new(SOLAPI_API_SECRET.encode('utf-8'), data.encode('utf-8'), hashlib.sha256).hexdigest()
        return {
            'Authorization': f'HMAC-SHA256 apiKey={SOLAPI_API_KEY}, date={date}, salt={salt}, signature={signature}',
            'Content-Type': 'application/json; charset=utf-8'
        }

    @classmethod
    def send_alimtalk(cls, to: str, template_id: str, variables: dict):
        """
        Sends Kakao AlimTalk using Solapi.
        to: Recipient phone number (e.g., 01012345678)
        template_id: Pre-approved template ID from Solapi/Kakao
        variables: Dictionary of template variables to substitute
        """
        if SOLAPI_API_KEY == "ENTER_YOUR_API_KEY":
            print(f"DEBUG: Mock sending KakaoTalk to {to} with template {template_id}")
            return {"status": "mock_success"}

        url = "https://api.solapi.com/messages/v4/send"
        payload = {
            "message": {
                "to": to,
                "from": "ENTER_YOUR_SENDER_NUMBER", # Registered sender number in Solapi
                "type": "ATA", # AlimTalk
                "kakaoOptions": {
                    "pfId": SOLAPI_PFID,
                    "templateId": template_id,
                    "variables": variables
                }
            }
        }

        try:
            response = requests.post(url, headers=cls.get_auth_header(), json=payload)
            response.raise_for_status()
            return response.json()
        except Exception as e:
            print(f"Error sending AlimTalk: {e}")
            return {"status": "error", "message": str(e)}

    @classmethod
    def send_contract_link(cls, phone_num: str, staff_name: str, link: str):
        """Sends electronic contract signature link via KakaoTalk"""
        # Template variable names must match exactly what is approved in Kakao
        return cls.send_alimtalk(
            to=phone_num.replace("-", ""),
            template_id="CONTRACT_TEMP_01", # Example Template ID
            variables={
                "#{name}": staff_name,
                "#{link}": link
            }
        )

    @classmethod
    def send_attendance_request(cls, phone_num: str, staff_name: str, month: str, link: str):
        """Requests staff to input/verify their work hours for the month"""
        return cls.send_alimtalk(
            to=phone_num.replace("-", ""),
            template_id="ATTENDANCE_REQ_01",
            variables={
                "#{name}": staff_name,
                "#{month}": month,
                "#{link}": link
            }
        )

    @classmethod
    def send_payroll_statement(cls, phone_num: str, staff_name: str, month: str, link: str):
        """Sends payroll statement (payslip) link via KakaoTalk"""
        return cls.send_alimtalk(
            to=phone_num.replace("-", ""),
            template_id="PAYROLL_STAT_01",
            variables={
                "#{name}": staff_name,
                "#{month}": month,
                "#{link}": link
            }
        )
