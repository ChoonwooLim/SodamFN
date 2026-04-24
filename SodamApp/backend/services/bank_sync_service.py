"""은행 계좌 거래내역 자동 수집 서비스 (팝빌 EasyFinBankService 래핑).

- 월정액 기반: 사전 등록된 계좌만 조회 가능 (팝빌 대시보드 또는 RegistAccount API)
- 주 사용처: revenue.py / expense.py 자동 수집 (기존 Excel 업로드 플로우와 병행)
- 건당 추가 포인트 소모는 없음 (정액제 내 무제한)

팝빌 은행코드 주요:
    0002 산업 · 0003 기업 · 0004 국민 · 0007 수협 · 0011 농협중앙 · 0020 우리
    0023 SC · 0027 씨티 · 0031 대구 · 0032 부산 · 0034 광주 · 0037 전북 · 0039 경남
    0045 새마을 · 0048 신협 · 0050 저축 · 0064 산림조합 · 0071 우체국
    0081 하나(외환) · 0088 신한 · 0089 케이뱅크 · 0090 카카오뱅크 · 0092 토스뱅크
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import List, Optional

logger = logging.getLogger("sodam.bank_sync")


BANK_NAMES = {
    "0002": "산업은행", "0003": "기업은행", "0004": "국민은행", "0007": "수협은행",
    "0011": "농협은행", "0020": "우리은행", "0023": "SC제일은행", "0027": "한국씨티은행",
    "0031": "대구은행", "0032": "부산은행", "0034": "광주은행", "0037": "전북은행",
    "0039": "경남은행", "0045": "새마을금고", "0048": "신협", "0050": "저축은행",
    "0064": "산림조합", "0071": "우체국", "0081": "하나은행", "0088": "신한은행",
    "0089": "케이뱅크", "0090": "카카오뱅크", "0092": "토스뱅크",
}


@dataclass
class BankAccountInfo:
    """팝빌에 등록된 계좌 정보."""
    bank_code: str
    account_number: str
    account_type: str = "P"               # 'P' 개인 / 'C' 법인
    alias: Optional[str] = None
    memo: Optional[str] = None
    state: Optional[str] = None           # 'active' 등
    regist_dt: Optional[str] = None
    use_period_start: Optional[str] = None  # YYYYMMDD
    use_period_end: Optional[str] = None    # YYYYMMDD
    next_billing_date: Optional[str] = None # YYYYMMDD

    @property
    def bank_name(self) -> str:
        return BANK_NAMES.get(self.bank_code, self.bank_code)


@dataclass
class BankTxRow:
    """단일 거래내역 레코드."""
    tid: str
    trans_date: str                       # YYYYMMDD
    trans_time: Optional[str] = None      # HHMMSS
    in_amount: int = 0
    out_amount: int = 0
    balance: Optional[int] = None
    remark1: Optional[str] = None
    remark2: Optional[str] = None
    remark3: Optional[str] = None
    remark4: Optional[str] = None
    raw: Optional[dict] = None

    def to_dict(self) -> dict:
        return {
            "tid": self.tid,
            "trans_date": self.trans_date,
            "trans_time": self.trans_time,
            "in_amount": self.in_amount,
            "out_amount": self.out_amount,
            "balance": self.balance,
            "remark1": self.remark1,
            "remark2": self.remark2,
            "remark3": self.remark3,
            "remark4": self.remark4,
        }


@dataclass
class BankSearchResult:
    ok: bool
    rows: List[BankTxRow] = field(default_factory=list)
    total: int = 0
    per_page: int = 0
    page: int = 1
    error: Optional[str] = None


def _normalize(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _ymd(d) -> str:
    if d is None:
        return ""
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y%m%d")
    s = str(d)
    return re.sub(r"\D", "", s)[:8]


# ============================================================
# Provider 추상
# ============================================================

class BaseBankProvider:
    name = "base"

    def list_accounts(self) -> List[BankAccountInfo]:
        raise NotImplementedError

    def get_balance(self) -> Optional[float]:
        """팝빌 포인트 잔액 (정액제와 별개)."""
        return None

    def check_account_validity(self, bank_code: str, account_number: str) -> dict:
        """계좌 유효성 (존재 확인). 일부 프로바이더는 미지원."""
        return {"ok": True, "note": "not-supported"}

    def search(
        self,
        bank_code: str,
        account_number: str,
        start_date,
        end_date,
        order: str = "D",          # 'D' 내림차순 / 'A' 오름차순
        page: int = 1,
        per_page: int = 500,
    ) -> BankSearchResult:
        raise NotImplementedError

    def get_mgt_url(self) -> Optional[str]:
        """계좌 관리 페이지 URL (팝빌 팝업). 로그인한 사업자용 임시 URL."""
        return None


# ============================================================
# Stub — 개발/테스트용 더미 데이터
# ============================================================

class DevStubProvider(BaseBankProvider):
    name = "stub"

    def list_accounts(self) -> List[BankAccountInfo]:
        return [
            BankAccountInfo(
                bank_code="0088",
                account_number="1103577XXXXXX",
                account_type="P",
                alias="소단신한은행 (STUB)",
                state="active",
                use_period_start="20260424",
                use_period_end="20260524",
                next_billing_date="20260525",
            )
        ]

    def get_balance(self) -> Optional[float]:
        return 0.0

    def check_account_validity(self, bank_code: str, account_number: str) -> dict:
        return {"ok": True, "note": "stub: always valid"}

    def search(
        self,
        bank_code: str,
        account_number: str,
        start_date,
        end_date,
        order: str = "D",
        page: int = 1,
        per_page: int = 500,
    ) -> BankSearchResult:
        s = _ymd(start_date)
        rows: List[BankTxRow] = [
            BankTxRow(
                tid=f"STUB-{s}-001",
                trans_date=s,
                trans_time="093215",
                in_amount=150000,
                out_amount=0,
                balance=2150000,
                remark1="쿠팡이츠",
                remark2="배달매출 정산",
            ),
            BankTxRow(
                tid=f"STUB-{s}-002",
                trans_date=s,
                trans_time="143022",
                in_amount=0,
                out_amount=85000,
                balance=2065000,
                remark1="주식회사마르스",
                remark2="식자재 결제",
            ),
        ]
        return BankSearchResult(ok=True, rows=rows, total=len(rows), per_page=per_page, page=page)

    def get_mgt_url(self) -> Optional[str]:
        return "https://stub.local/popbill/account-mgt"


# ============================================================
# Popbill EasyFinBank Provider — 실API
# ============================================================

class PopbillEasyFinBankProvider(BaseBankProvider):
    name = "popbill"

    def __init__(self):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = _normalize(os.getenv("POPBILL_CORP_NUM", ""))
        # 계좌조회는 실서비스 가입 완료된 상태이므로 기본 false
        # 단, biz_check 등이 test 로 돌아갈 수 있으므로 독립 스위치 허용
        bank_test = os.getenv("POPBILL_BANK_IS_TEST")
        if bank_test is not None:
            self.is_test = bank_test.strip().lower() in ("1", "true", "yes")
        else:
            self.is_test = False  # 계좌조회는 실서비스 기본
        self.user_id = os.getenv("POPBILL_USER_ID", "").strip() or None
        self._svc = None

    def _get_svc(self):
        if self._svc is not None:
            return self._svc
        if not self.link_id or not self.secret_key:
            raise RuntimeError("POPBILL_LINK_ID / POPBILL_SECRET_KEY 가 설정되지 않았습니다.")
        if not self.corp_num:
            raise RuntimeError("POPBILL_CORP_NUM 이 설정되지 않았습니다.")
        from popbill import EasyFinBankService  # type: ignore
        svc = EasyFinBankService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    @staticmethod
    def _popbill_exc():
        try:
            from popbill import PopbillException  # type: ignore
            return PopbillException
        except ImportError:
            return Exception

    # ---------- accounts ----------

    def list_accounts(self) -> List[BankAccountInfo]:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            # SDK 2.x: ListAccount(CorpNum, UserID=None) → [EasyFinBankAccount]
            rows = svc.ListAccount(self.corp_num, self.user_id) or []
        except PopbillException as pe:
            raise RuntimeError(f"Popbill[{getattr(pe, 'code', '')}] {getattr(pe, 'message', pe)}")

        out: List[BankAccountInfo] = []
        for r in rows:
            bank_code = getattr(r, "BankCode", None) or getattr(r, "bankCode", None) or ""
            acc = getattr(r, "AccountNumber", None) or getattr(r, "accountNumber", None) or ""
            out.append(BankAccountInfo(
                bank_code=str(bank_code),
                account_number=str(acc),
                account_type=str(getattr(r, "AccountType", "") or getattr(r, "accountType", "") or "P"),
                alias=getattr(r, "AccountName", None) or getattr(r, "accountName", None),
                memo=getattr(r, "Memo", None) or getattr(r, "memo", None),
                state=getattr(r, "State", None) or getattr(r, "state", None),
                regist_dt=getattr(r, "RegDT", None) or getattr(r, "regDT", None),
                use_period_start=getattr(r, "ContractStartDate", None) or getattr(r, "UsePeriodStart", None),
                use_period_end=getattr(r, "ContractEndDate", None) or getattr(r, "UsePeriodEnd", None),
                next_billing_date=getattr(r, "ContractEndDate", None) or getattr(r, "NextBillingDate", None),
            ))
        return out

    def get_balance(self) -> Optional[float]:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            v = svc.GetBalance(self.corp_num)
            return float(v) if v is not None else None
        except PopbillException as pe:
            logger.warning("GetBalance 실패: %s", pe)
            return None
        except Exception as e:
            logger.warning("GetBalance 예외: %s", e)
            return None

    def check_account_validity(self, bank_code: str, account_number: str) -> dict:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            # SDK 버전에 따라 CheckAccountValidity 존재 여부 분기
            if hasattr(svc, "CheckAccountValidity"):
                r = svc.CheckAccountValidity(self.corp_num, bank_code, _normalize(account_number), self.user_id)
                code = getattr(r, "code", None) or getattr(r, "Code", None)
                msg = getattr(r, "message", None) or getattr(r, "Message", None) or str(r)
                return {"ok": code in (1, "1", None), "code": code, "message": msg}
            return {"ok": True, "note": "SDK no-op"}
        except PopbillException as pe:
            return {"ok": False, "code": getattr(pe, "code", None), "message": getattr(pe, "message", str(pe))}
        except Exception as e:
            return {"ok": False, "message": f"{e}"}

    # ---------- search ----------

    def search(
        self,
        bank_code: str,
        account_number: str,
        start_date,
        end_date,
        order: str = "D",
        page: int = 1,
        per_page: int = 500,
    ) -> BankSearchResult:
        PopbillException = self._popbill_exc()
        s = _ymd(start_date)
        e = _ymd(end_date)
        if not s or not e:
            return BankSearchResult(ok=False, error="시작/종료일자 형식 오류")

        try:
            svc = self._get_svc()
            # Search(CorpNum, BankCode, AccountNumber, SDate, EDate, Order='D', Page=1, PerPage=500, UserID=None)
            resp = svc.Search(
                self.corp_num,
                bank_code,
                _normalize(account_number),
                s,
                e,
                order,
                page,
                per_page,
                self.user_id,
            )
        except PopbillException as pe:
            return BankSearchResult(ok=False, error=f"Popbill[{getattr(pe, 'code', '')}] {getattr(pe, 'message', pe)}")
        except Exception as e2:
            return BankSearchResult(ok=False, error=f"조회 오류: {e2}")

        rows_raw = getattr(resp, "list", None) or getattr(resp, "List", None) or []
        total = int(getattr(resp, "total", 0) or getattr(resp, "Total", 0) or 0)
        per = int(getattr(resp, "perPage", 0) or getattr(resp, "PerPage", per_page) or per_page)
        pg = int(getattr(resp, "page", page) or getattr(resp, "Page", page) or page)

        out: List[BankTxRow] = []
        for r in rows_raw:
            tid = getattr(r, "tid", None) or getattr(r, "TID", None) or ""
            trans_dt = getattr(r, "trdt", None) or getattr(r, "TrDT", None) or ""  # YYYYMMDDHHMMSS
            trans_date = (trans_dt or "")[:8]
            trans_time = (trans_dt or "")[8:14] if len(trans_dt or "") >= 14 else None
            in_amt = getattr(r, "accIn", None) or getattr(r, "AccIn", None) or 0
            out_amt = getattr(r, "accOut", None) or getattr(r, "AccOut", None) or 0
            balance = getattr(r, "balance", None) or getattr(r, "Balance", None)

            try:
                in_i = int(str(in_amt).replace(",", "") or 0)
            except (ValueError, TypeError):
                in_i = 0
            try:
                out_i = int(str(out_amt).replace(",", "") or 0)
            except (ValueError, TypeError):
                out_i = 0
            try:
                bal_i = int(str(balance).replace(",", "")) if balance is not None else None
            except (ValueError, TypeError):
                bal_i = None

            out.append(BankTxRow(
                tid=str(tid),
                trans_date=trans_date,
                trans_time=trans_time,
                in_amount=in_i,
                out_amount=out_i,
                balance=bal_i,
                remark1=getattr(r, "remark1", None) or getattr(r, "Remark1", None),
                remark2=getattr(r, "remark2", None) or getattr(r, "Remark2", None),
                remark3=getattr(r, "remark3", None) or getattr(r, "Remark3", None),
                remark4=getattr(r, "remark4", None) or getattr(r, "Remark4", None),
                raw={
                    "tid": tid, "trdt": trans_dt,
                    "accIn": in_amt, "accOut": out_amt, "balance": balance,
                },
            ))
        return BankSearchResult(ok=True, rows=out, total=total, per_page=per, page=pg)

    def get_mgt_url(self) -> Optional[str]:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            # TG = 계좌 관리 페이지
            if hasattr(svc, "GetAccountMgtURL"):
                return svc.GetAccountMgtURL(self.corp_num, self.user_id)
            return None
        except PopbillException as pe:
            logger.warning("GetAccountMgtURL 실패: %s", pe)
            return None
        except Exception as e:
            logger.warning("GetAccountMgtURL 예외: %s", e)
            return None


# ============================================================
# Provider 선택
# ============================================================

_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillEasyFinBankProvider,
}


def get_provider() -> BaseBankProvider:
    override = (os.getenv("BANK_SYNC_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillEasyFinBankProvider()
    return DevStubProvider()
