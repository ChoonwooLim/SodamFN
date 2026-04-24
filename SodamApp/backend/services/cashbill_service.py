"""현금영수증 서비스 (Popbill CashbillService 래핑).

- 매출 현금영수증 즉시 발행, 발행 이력 조회, 취소 발행
- 거래용도: 소득공제용(휴대폰/주민번호) / 지출증빙용(사업자번호)
- 건당 ~88원 (발행 시), 조회/취소는 무료

팝빌 API:
- RegistIssue(CorpNum, Cashbill)         → receiptNum, confirmNum, tradeDate
- GetInfo(CorpNum, MgtKey)               → 단건 상세
- Search(CorpNum, DType, SDate, EDate, ...) → 이력
- Cancel(CorpNum, MgtKey, Memo)          → 발행 후 취소 (24시간 내)
- RevokeRegistIssue(CorpNum, MgtKey, ...)→ 취소 거래로 새 발행
- GetPopbillURL(CorpNum, UserID, TOGO)   → 팝빌 페이지 (PBOX 발행함, WRITE 등)
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, asdict
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger("sodam.cashbill")


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


@dataclass
class CashbillDraft:
    mgt_key: str
    trade_date: str                          # YYYYMMDD
    trade_usage: str = "소득공제용"            # 소득공제용 / 지출증빙용
    trade_type: str = "승인거래"              # 승인거래 / 취소거래
    trade_opt: str = "일반"                  # 일반 / 도서공연 / 대중교통
    taxation_type: str = "과세"               # 과세 / 비과세
    # 식별번호 (소득공제용: 주민번호 또는 010xxx, 지출증빙용: 10자리 사업자번호 또는 010xxx)
    identity_num: str = ""
    # 가맹점 (공급자) 정보
    franchise_corp_num: str = ""             # 본인 사업자번호
    franchise_corp_name: str = ""
    franchise_ceo_name: str = ""
    franchise_addr: str = ""
    franchise_tel: str = ""
    # 고객 정보
    customer_name: str = ""
    item_name: str = ""
    order_number: str = ""
    email: str = ""                          # 알림 이메일
    hp: str = ""                             # 알림 휴대폰
    # 금액
    supply_cost: str = "0"
    tax: str = "0"
    service_fee: str = "0"
    total_amount: str = "0"
    smssend_yn: bool = False                  # 고객 휴대폰으로 발행알림 SMS


@dataclass
class CashbillResult:
    ok: bool
    mgt_key: Optional[str] = None
    confirm_num: Optional[str] = None
    trade_date: Optional[str] = None
    issue_dt: Optional[str] = None
    receipt_num: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class BaseCashbillProvider:
    name = "base"

    def issue(self, draft: CashbillDraft) -> CashbillResult:
        raise NotImplementedError

    def get_info(self, mgt_key: str) -> dict:
        raise NotImplementedError

    def search(self, *, s_date: str, e_date: str, d_type: str = "T",
               states: Optional[List[str]] = None, page: int = 1, per_page: int = 100) -> dict:
        raise NotImplementedError

    def cancel(self, mgt_key: str, memo: Optional[str] = None) -> CashbillResult:
        raise NotImplementedError

    def get_popbill_url(self, togo: str = "PBOX", user_id: Optional[str] = None) -> str:
        raise NotImplementedError


class DevStubProvider(BaseCashbillProvider):
    name = "stub"

    def issue(self, draft: CashbillDraft) -> CashbillResult:
        logger.info("[CB-STUB] issue mgt_key=%s amount=%s", draft.mgt_key, draft.total_amount)
        return CashbillResult(
            ok=True,
            mgt_key=draft.mgt_key,
            confirm_num=f"STUB{datetime.now().strftime('%Y%m%d%H%M%S')}",
            trade_date=draft.trade_date,
            issue_dt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            receipt_num=f"stub-{draft.mgt_key}",
        )

    def get_info(self, mgt_key: str) -> dict:
        return {"ok": False, "error": "STUB 모드는 단건 조회를 지원하지 않습니다."}

    def search(self, **kwargs) -> dict:
        return {"ok": True, "total": 0, "list": [], "note": "STUB 모드"}

    def cancel(self, mgt_key: str, memo: Optional[str] = None) -> CashbillResult:
        return CashbillResult(ok=True, mgt_key=mgt_key)

    def get_popbill_url(self, togo: str = "PBOX", user_id: Optional[str] = None) -> str:
        return "https://www.popbill.com/"


class PopbillCashbillProvider(BaseCashbillProvider):
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
        from popbill import CashbillService  # type: ignore
        svc = CashbillService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def _build_cashbill(self, draft: CashbillDraft):
        from popbill.cashbillService import Cashbill  # type: ignore
        return Cashbill(
            mgtKey=draft.mgt_key,
            tradeType=draft.trade_type,
            tradeDT=draft.trade_date + "000000" if len(draft.trade_date) == 8 else draft.trade_date,
            tradeUsage=draft.trade_usage,
            tradeOpt=draft.trade_opt,
            taxationType=draft.taxation_type,
            identityNum=re.sub(r"\D", "", draft.identity_num or ""),
            franchiseCorpNum=_normalize_corp_num(draft.franchise_corp_num),
            franchiseCorpName=draft.franchise_corp_name,
            franchiseCEOName=draft.franchise_ceo_name,
            franchiseAddr=draft.franchise_addr,
            franchiseTEL=draft.franchise_tel,
            customerName=draft.customer_name,
            itemName=draft.item_name,
            orderNumber=draft.order_number,
            email=draft.email,
            hp=re.sub(r"\D", "", draft.hp or ""),
            smssendYN=draft.smssend_yn,
            supplyCost=str(draft.supply_cost),
            tax=str(draft.tax),
            serviceFee=str(draft.service_fee),
            totalAmount=str(draft.total_amount),
        )

    def issue(self, draft: CashbillDraft) -> CashbillResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            svc = self._get_svc()
            cb = self._build_cashbill(draft)
            r = svc.registIssue(self.corp_num, cb, "셈하나 발행", self.user_id)
            ok = getattr(r, "code", None) in (1, "1") or getattr(r, "receiptNum", None) or getattr(r, "confirmNum", None)
            return CashbillResult(
                ok=bool(ok),
                mgt_key=draft.mgt_key,
                confirm_num=getattr(r, "confirmNum", None),
                trade_date=getattr(r, "tradeDate", None) or draft.trade_date,
                receipt_num=getattr(r, "receiptNum", None),
                issue_dt=getattr(r, "issueDT", None),
                error=None if ok else getattr(r, "message", None),
            )
        except PopbillException as pe:
            return CashbillResult(ok=False, mgt_key=draft.mgt_key,
                                  error=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return CashbillResult(ok=False, mgt_key=draft.mgt_key, error=f"발행 오류: {e}")

    def get_info(self, mgt_key: str) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            svc = self._get_svc()
            info = svc.getInfo(self.corp_num, mgt_key, self.user_id)
            return {"ok": True, "info": _row_to_dict(info)}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def search(self, *, s_date: str, e_date: str, d_type: str = "T",
               states: Optional[List[str]] = None, page: int = 1, per_page: int = 100) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            svc = self._get_svc()
            res = svc.search(
                self.corp_num,
                d_type,
                s_date,
                e_date,
                states or [],
                [],   # tradeType
                [],   # tradeUsage
                [],   # taxationType
                "",   # qString
                page,
                per_page,
                "D",
                self.user_id,
            )
            total = getattr(res, "total", 0) or 0
            items = []
            for row in (getattr(res, "list", None) or []):
                items.append(_row_to_dict(row))
            return {"ok": True, "total": total, "list": items, "page": page, "per_page": per_page}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def cancel(self, mgt_key: str, memo: Optional[str] = None) -> CashbillResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            svc = self._get_svc()
            new_mgt_key = f"{mgt_key}-CXL{datetime.now().strftime('%H%M%S')}"
            r = svc.revokeRegistIssue(
                self.corp_num,
                new_mgt_key,
                getattr(self, "_last_confirm", None) or "",
                "",  # orgTradeDate (필요시 조회 후 채움)
                False,  # smssendYN
                memo or "취소",
                self.user_id,
            )
            ok = getattr(r, "code", None) == 1 or getattr(r, "confirmNum", None)
            return CashbillResult(ok=bool(ok), mgt_key=new_mgt_key,
                                  confirm_num=getattr(r, "confirmNum", None),
                                  error=None if ok else getattr(r, "message", None))
        except PopbillException as pe:
            return CashbillResult(ok=False, mgt_key=mgt_key,
                                  error=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return CashbillResult(ok=False, mgt_key=mgt_key, error=f"취소 오류: {e}")

    def get_popbill_url(self, togo: str = "PBOX", user_id: Optional[str] = None) -> str:
        svc = self._get_svc()
        return svc.getPopbillURL(self.corp_num, user_id or self.user_id or "sodam", togo)


def _row_to_dict(obj) -> dict:
    if obj is None:
        return {}
    keys = [
        "itemKey", "mgtKey", "confirmNum", "tradeDate", "tradeDT",
        "tradeType", "tradeUsage", "tradeOpt", "taxationType",
        "identityNum", "customerName", "itemName", "orderNumber",
        "supplyCost", "tax", "serviceFee", "totalAmount",
        "stateCode", "stateMemo", "stateDT", "issueDT",
    ]
    out = {}
    for k in keys:
        v = getattr(obj, k, None)
        if v is not None:
            out[k] = str(v) if not isinstance(v, (int, float, bool, list)) else v
    return out


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillCashbillProvider,
}


def get_provider() -> BaseCashbillProvider:
    override = (os.getenv("CASHBILL_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillCashbillProvider()
    return DevStubProvider()
