"""CODEF SDK 저수준 래퍼.

책임:
- easycodefpy.Codef 인스턴스 관리
- 환경변수 → ServiceType 매핑 (SANDBOX/DEMO/PRODUCT)
- RSA 비번 암호화 (SDK 헬퍼 encrypt_rsa 재사용)
- result.code → 표준 예외 매핑
- create_account / request_product 메서드 노출

SDK 응답은 JSON 문자열. 본 모듈에서 파싱 + 예외 변환.
"""
import json
import os
from dataclasses import dataclass

from easycodefpy import Codef, ServiceType, encrypt_rsa

from .exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefRateLimited,
    CodefAPIError,
)


@dataclass
class CreateAccountResult:
    connected_id: str
    raw: dict


@dataclass
class RequestProductResult:
    rows: list
    raw: dict
    result_code: str
    rows_count: int


# result.code → 예외 매핑 (PoC Task 29 단계에서 실제 코드 패턴 확인 후 보강)
_AUTH_EXPIRED_CODES = {"CF-12100", "CF-12101", "CF-12102", "CF-12410"}
_ADDITIONAL_AUTH_CODES = {"CF-03002", "CF-03012", "CF-03013"}
_RATE_LIMITED_CODES = {"CF-00100", "CF-09001"}
_SUCCESS_CODES = {"CF-00000"}  # 정확히 성공만


class CodefClient:
    def __init__(self):
        self.client_id = os.getenv("CODEF_CLIENT_ID", "")
        self.client_secret = os.getenv("CODEF_CLIENT_SECRET", "")
        self.public_key = os.getenv("CODEF_PUBLIC_KEY", "")
        self.env = os.getenv("CODEF_ENV", "demo")
        self._sdk = Codef()
        # SDK 는 PRODUCT/DEMO/SANDBOX 환경별로 클라이언트 정보를 따로 보관.
        # DEMO 환경에서도 set_demo_client_info 호출이 필요 — 같은 키 사용.
        self._sdk.set_client_info(self.client_id, self.client_secret)
        self._sdk.set_demo_client_info(self.client_id, self.client_secret)
        self._sdk.public_key = self.public_key

    @property
    def service_type(self) -> ServiceType:
        return {
            "sandbox": ServiceType.SANDBOX,
            "demo": ServiceType.DEMO,
            "production": ServiceType.PRODUCT,
        }[self.env]

    def encrypt_password(self, plain: str) -> str:
        """SDK encrypt_rsa 헬퍼 재사용 — RSA 공개키로 암호화."""
        return encrypt_rsa(plain, self.public_key)

    def create_account(self, account_payload: dict) -> CreateAccountResult:
        """connectedId 발급. 추가본인확인이면 CodefAdditionalAuth."""
        raw_response = self._sdk.create_account(self.service_type, account_payload)
        data = self._parse(raw_response)
        self._maybe_raise(data)
        connected_id = data.get("data", {}).get("connectedId", "")
        if not connected_id:
            raise CodefAPIError(code="missing-connected-id", message="connectedId 없음")
        return CreateAccountResult(connected_id=connected_id, raw=data)

    def request_product(self, url: str, params: dict) -> RequestProductResult:
        raw_response = self._sdk.request_product(url, self.service_type, params)
        data = self._parse(raw_response)
        self._maybe_raise(data)
        rows = data.get("data", [])
        if isinstance(rows, dict):
            rows = [rows]
        return RequestProductResult(
            rows=rows,
            raw=data,
            result_code=data.get("result", {}).get("code", ""),
            rows_count=len(rows),
        )

    @staticmethod
    def _parse(raw_response) -> dict:
        if isinstance(raw_response, str):
            return json.loads(raw_response)
        return raw_response or {}

    @staticmethod
    def _maybe_raise(data: dict) -> None:
        result = data.get("result", {})
        code = result.get("code", "")
        message = result.get("message", "")
        extra_message = result.get("extraMessage", "")

        if code == "" or code in _SUCCESS_CODES:
            return
        if code in _AUTH_EXPIRED_CODES:
            raise CodefAuthExpired(code=code, message=message)
        if code in _ADDITIONAL_AUTH_CODES:
            extra = result.get("extraInfo", {})
            method = "sms" if "sms" in str(extra).lower() else "captcha"
            raise CodefAdditionalAuth(method=method, extra_info=extra)
        if code in _RATE_LIMITED_CODES:
            raise CodefRateLimited(message)
        # 기타 — 메시지에 extraMessage 합쳐 사용자에게 의미있는 정보 노출
        full_msg = f"{message} {extra_message}".strip()
        raise CodefAPIError(code=code, message=full_msg)
