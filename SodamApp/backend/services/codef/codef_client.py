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
        # PoC 디버깅 — DEMO 환경 한정 raw response 로그
        if self.env in {"demo", "sandbox"}:
            import logging
            logging.getLogger("codef.client").info(
                "create_account response: env=%s payload_keys=%s response=%s",
                self.env,
                list((account_payload.get("accountList") or [{}])[0].keys()),
                str(data)[:1500],
            )
        self._maybe_raise(data)
        connected_id = data.get("data", {}).get("connectedId", "")
        if not connected_id:
            raise CodefAPIError(
                code="missing-connected-id",
                message=f"connectedId 없음 — raw: {str(data)[:500]}"
            )
        return CreateAccountResult(connected_id=connected_id, raw=data)

    def create_account_raw(self, account_payload: dict) -> dict:
        """create_account 와 동일하나 raw response (dict) 를 그대로 반환.

        간편인증 2-step 흐름에서 1단계 응답 (CF-03002 / CF-03012 등 추가인증 코드) 의
        ``data.extraInfo`` 를 꺼내야 하기 때문에 예외 변환을 거치지 않고 dict 으로
        반환한다. ``CF-00000`` 일 때도 dict 그대로 반환 — 호출자가 해석.

        성공/추가인증 외의 명확한 실패 코드 (인증 만료·rate limit·기타 API 에러) 는
        ``_maybe_raise`` 와 동일한 분기로 예외 발생시켜 일관성 유지.
        """
        raw_response = self._sdk.create_account(self.service_type, account_payload)
        data = self._parse(raw_response)
        if self.env in {"demo", "sandbox"}:
            import logging
            logging.getLogger("codef.client").info(
                "create_account_raw response: env=%s payload_keys=%s response=%s",
                self.env,
                list((account_payload.get("accountList") or [{}])[0].keys()),
                str(data)[:1500],
            )
        # 추가인증 코드는 raise 하지 않고 dict 반환 — 호출자가 처리
        result = data.get("result", {})
        code = result.get("code", "")
        if code in _ADDITIONAL_AUTH_CODES:
            return data
        if code in _SUCCESS_CODES or code == "":
            return data
        # 그 외 (만료 / rate limit / 기타) 는 _maybe_raise 가 표준 예외 변환
        self._maybe_raise(data)
        return data  # 이론상 도달 안 함

    def request_certification_raw(self, path: str, payload: dict) -> dict:
        """간편인증 2단계 호출 — ``twoWayInfo`` + ``is2Way=True`` 필수.

        SDK ``request_certification`` 은 ``_has_two_way_keyword`` 검사를 통과해야 함:
          * ``payload['is2Way']`` 가 Python bool (True)
          * ``payload['twoWayInfo']`` 가 dict 이고
            ``jobIndex / threadIndex / jti / twoWayTimestamp`` 4개 키 모두 존재

        반환은 raw response dict — 예외 변환을 호출자가 직접 처리.
        """
        raw_response = self._sdk.request_certification(path, self.service_type, payload)
        data = self._parse(raw_response)
        if self.env in {"demo", "sandbox"}:
            import logging
            logging.getLogger("codef.client").info(
                "request_certification_raw response: env=%s path=%s payload_keys=%s response=%s",
                self.env,
                path,
                list(payload.keys()),
                str(data)[:1500],
            )
        return data

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
        raise CodefAPIError(code=code, message=full_msg, raw=data)
