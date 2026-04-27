"""예금주조회 서비스 (Popbill AccountCheckService 래핑).

- 은행코드 + 계좌번호로 예금주명 즉시 조회 (주민번호 없이 V1 API 사용)
- 급여 이체 전 오입금 방지, 거래처 계좌 검증 등에 사용
- 건당 ~30원 (팝빌 포인트)

팝빌 AccountCheckService API:
- CheckAccountInfo(CorpNum, BankCode, AccountNumber, UserID=None) → AccountCheckInfo
    - AccountName: 예금주명
    - BankName: 은행명
    - BankCode/AccountNumber: 에코
    - CheckDate: 조회일시
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

from services.bank_sync_service import BANK_NAMES

logger = logging.getLogger("sodam.account_check")


# 은행명 → 팝빌 은행코드 역매핑 (사용자 입력 은행명에서 code 추정)
BANK_NAME_TO_CODE = {v: k for k, v in BANK_NAMES.items()}
# 흔한 별칭 추가
_ALIASES = {
    "신한": "0088", "국민": "0004", "KB": "0004", "기업": "0003", "IBK": "0003",
    "농협": "0011", "NH": "0011", "우리": "0020", "하나": "0081", "KEB": "0081",
    "외환": "0081", "SC": "0023", "씨티": "0027", "산업": "0002", "KDB": "0002",
    "수협": "0007", "대구": "0031", "부산": "0032", "광주": "0034", "전북": "0037",
    "경남": "0039", "제주": "0035", "새마을": "0045", "신협": "0048", "우체국": "0071",
    "케이뱅크": "0089", "카카오": "0090", "카카오뱅크": "0090", "토스": "0092",
    "토스뱅크": "0092",
}
BANK_NAME_TO_CODE.update(_ALIASES)


@dataclass
class AccountCheckResult:
    ok: bool
    bank_code: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None       # 마스킹 X, 원본
    account_holder: Optional[str] = None       # 팝빌 응답 예금주명
    check_date: Optional[str] = None           # YYYYMMDDHHMMSS
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "bank_code": self.bank_code,
            "bank_name": self.bank_name,
            "account_number": self.account_number,
            "account_holder": self.account_holder,
            "check_date": self.check_date,
            "error": self.error,
        }


def _normalize_account(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def resolve_bank_code(bank_input: str) -> Optional[str]:
    """은행코드(0088) 또는 은행명('신한은행', '신한') → 4자리 코드 정규화."""
    s = (bank_input or "").strip()
    if not s:
        return None
    # 이미 4자리 코드
    if re.fullmatch(r"\d{4}", s):
        return s
    # 정식명 (신한은행 등)
    if s in BANK_NAME_TO_CODE:
        return BANK_NAME_TO_CODE[s]
    # 부분 일치 (신한, 국민 등)
    for name, code in BANK_NAME_TO_CODE.items():
        if name in s or s in name:
            return code
    return None


class BaseAccountCheckProvider:
    name = "base"

    def check(self, bank_code: str, account_number: str) -> AccountCheckResult:
        raise NotImplementedError


class DevStubProvider(BaseAccountCheckProvider):
    name = "stub"

    def check(self, bank_code: str, account_number: str) -> AccountCheckResult:
        acc = _normalize_account(account_number)
        code = resolve_bank_code(bank_code)
        if not code:
            return AccountCheckResult(ok=False, error="은행명/코드를 인식할 수 없습니다.")
        if len(acc) < 6:
            return AccountCheckResult(ok=False, bank_code=code, error="계좌번호가 너무 짧습니다.")
        logger.info("[ACCT-STUB] check %s %s → 홍길동 반환 (stub)", code, acc)
        return AccountCheckResult(
            ok=True,
            bank_code=code,
            bank_name=BANK_NAMES.get(code, code),
            account_number=acc,
            account_holder="홍길동(STUB)",
            check_date=None,
        )


class PopbillAccountCheckProvider(BaseAccountCheckProvider):
    name = "popbill"

    def __init__(self):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = _normalize_corp_num(os.getenv("POPBILL_CORP_NUM", ""))
        self.is_test = (os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes"))
        self.user_id = os.getenv("POPBILL_USER_ID", "").strip() or None
        self._svc = None

    def _get_svc(self):
        if self._svc is not None:
            return self._svc
        if not self.link_id or not self.secret_key:
            raise RuntimeError("POPBILL_LINK_ID / POPBILL_SECRET_KEY 가 설정되지 않았습니다.")
        from popbill import AccountCheckService  # type: ignore
        svc = AccountCheckService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def check(self, bank_code: str, account_number: str) -> AccountCheckResult:
        acc = _normalize_account(account_number)
        code = resolve_bank_code(bank_code)
        if not code:
            return AccountCheckResult(ok=False, error="은행명/코드를 인식할 수 없습니다.")
        if len(acc) < 6:
            return AccountCheckResult(ok=False, bank_code=code, error="계좌번호가 너무 짧습니다.")
        if not self.corp_num:
            return AccountCheckResult(ok=False, bank_code=code, error="POPBILL_CORP_NUM 이 설정되지 않았습니다.")

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            r = svc.checkAccountInfo(self.corp_num, code, acc, self.user_id)
            holder = (
                getattr(r, "accountName", None)
                or getattr(r, "AccountName", None)
                or getattr(r, "accountHolder", None)
            )
            bank_name = (
                getattr(r, "bankName", None)
                or getattr(r, "BankName", None)
                or BANK_NAMES.get(code, code)
            )
            check_date = (
                getattr(r, "checkDate", None)
                or getattr(r, "CheckDate", None)
            )
            return AccountCheckResult(
                ok=True,
                bank_code=code,
                bank_name=str(bank_name),
                account_number=acc,
                account_holder=str(holder) if holder else None,
                check_date=check_date,
            )
        except PopbillException as pe:
            code_err = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return AccountCheckResult(
                ok=False, bank_code=code, account_number=acc,
                error=f"Popbill[{code_err}] {msg}",
            )
        except Exception as e:
            return AccountCheckResult(
                ok=False, bank_code=code, account_number=acc,
                error=f"조회 오류: {e}",
            )


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillAccountCheckProvider,
}


def get_provider() -> BaseAccountCheckProvider:
    override = (os.getenv("ACCOUNT_CHECK_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillAccountCheckProvider()
    return DevStubProvider()
