"""전자세금계산서 서비스 (Popbill TaxinvoiceService 래핑).

- 매출 세금계산서 즉시 발행, 발행 이력 조회, 팝빌 작성함 바로가기
- KeyType 'SELL' 매출 기본 (매입 'BUY'도 지원)
- 건당 ~88원 (발행 시), 조회는 무료

팝빌 API:
- RegistIssue(CorpNum, Taxinvoice)         → receiptNum, invoiceNum
- GetInfo(CorpNum, KeyType, MgtKey)        → 단건 상세
- Search(CorpNum, KeyType, DType, SDate, EDate, ...)  → 발행 이력
- GetPopbillURL(CorpNum, UserID, TOGO)     → 팝빌 페이지 URL
  TOGO: TBOX(매출발행함), SBOX(매출임시저장함), WRITE(작성), CERT(인증서등록)
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field, asdict
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger("sodam.taxinvoice")


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


@dataclass
class TaxinvoiceDetail:
    """세금계산서 품목 한 줄."""
    purchaseDT: str          # YYYYMMDD
    itemName: str
    qty: str = "1"
    unitCost: str = "0"
    supplyCost: str = "0"    # 공급가액
    tax: str = "0"           # 세액
    spec: str = ""
    remark: str = ""

    def to_popbill_dict(self) -> dict:
        return {
            "purchaseDT": self.purchaseDT,
            "itemName": self.itemName,
            "spec": self.spec,
            "qty": str(self.qty),
            "unitCost": str(self.unitCost),
            "supplyCost": str(self.supplyCost),
            "tax": str(self.tax),
            "remark": self.remark,
        }


@dataclass
class TaxinvoiceDraft:
    """발행 요청 페이로드."""
    mgt_key: str                            # 문서관리번호 (본인관리, 유니크)
    write_date: str                         # YYYYMMDD
    # 공급자
    invoicer_corp_num: str                  # 10자리
    invoicer_corp_name: str
    invoicer_ceo_name: str = ""
    invoicer_addr: str = ""
    invoicer_biz_class: str = ""            # 업태
    invoicer_biz_type: str = ""             # 종목
    invoicer_contact_name: str = ""
    invoicer_email: str = ""
    invoicer_tel: str = ""
    # 공급받는자
    invoicee_corp_num: str = ""             # 10자리
    invoicee_corp_name: str = ""
    invoicee_ceo_name: str = ""
    invoicee_addr: str = ""
    invoicee_email1: str = ""
    invoicee_tel: str = ""
    invoicee_type: str = "사업자"            # 사업자 / 개인 / 외국인
    # 금액 (문자열로 보내야 함)
    supply_cost_total: str = "0"
    tax_total: str = "0"
    total_amount: str = "0"
    # 기타
    tax_type: str = "과세"                   # 과세 / 영세 / 면세
    purpose_type: str = "청구"               # 청구 / 영수
    charge_direction: str = "정과금"
    remark1: str = ""
    detail_list: List[TaxinvoiceDetail] = field(default_factory=list)


@dataclass
class TaxinvoiceResult:
    ok: bool
    mgt_key: Optional[str] = None
    invoice_num: Optional[str] = None
    issue_dt: Optional[str] = None
    receipt_num: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class BaseTaxinvoiceProvider:
    name = "base"

    def issue(self, draft: TaxinvoiceDraft) -> TaxinvoiceResult:
        raise NotImplementedError

    def get_info(self, mgt_key: str, key_type: str = "SELL") -> dict:
        raise NotImplementedError

    def search(self, *, s_date: str, e_date: str, key_type: str = "SELL",
               d_type: str = "W", state: Optional[list] = None,
               page: int = 1, per_page: int = 100) -> dict:
        raise NotImplementedError

    def get_popbill_url(self, togo: str = "TBOX", user_id: Optional[str] = None) -> str:
        raise NotImplementedError


class DevStubProvider(BaseTaxinvoiceProvider):
    name = "stub"

    def issue(self, draft: TaxinvoiceDraft) -> TaxinvoiceResult:
        logger.info("[TI-STUB] issue mgt_key=%s total=%s", draft.mgt_key, draft.total_amount)
        return TaxinvoiceResult(
            ok=True,
            mgt_key=draft.mgt_key,
            invoice_num=f"STUB{datetime.now().strftime('%Y%m%d%H%M%S')}",
            issue_dt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            receipt_num=f"stub-receipt-{draft.mgt_key}",
        )

    def get_info(self, mgt_key: str, key_type: str = "SELL") -> dict:
        return {"ok": False, "error": "STUB 모드에서는 상세 조회를 지원하지 않습니다."}

    def search(self, **kwargs) -> dict:
        return {"ok": True, "total": 0, "list": [], "note": "STUB 모드: 빈 이력 반환"}

    def get_popbill_url(self, togo: str = "TBOX", user_id: Optional[str] = None) -> str:
        return "https://www.popbill.com/"


class PopbillTaxinvoiceProvider(BaseTaxinvoiceProvider):
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
        from popbill import TaxinvoiceService  # type: ignore
        svc = TaxinvoiceService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def _build_tax(self, draft: TaxinvoiceDraft):
        from popbill.taxinvoiceService import Taxinvoice, TaxinvoiceDetail as SDKDetail  # type: ignore

        details = []
        for i, d in enumerate(draft.detail_list, start=1):
            details.append(SDKDetail(
                serialNum=i,
                purchaseDT=d.purchaseDT,
                itemName=d.itemName,
                spec=d.spec,
                qty=str(d.qty),
                unitCost=str(d.unitCost),
                supplyCost=str(d.supplyCost),
                tax=str(d.tax),
                remark=d.remark,
            ))

        return Taxinvoice(
            writeDate=draft.write_date,
            chargeDirection=draft.charge_direction,
            taxType=draft.tax_type,
            purposeType=draft.purpose_type,
            issueType="정발행",
            # 공급자
            invoicerCorpNum=_normalize_corp_num(draft.invoicer_corp_num),
            invoicerMgtKey=draft.mgt_key,
            invoicerCorpName=draft.invoicer_corp_name,
            invoicerCEOName=draft.invoicer_ceo_name,
            invoicerAddr=draft.invoicer_addr,
            invoicerBizClass=draft.invoicer_biz_class,
            invoicerBizType=draft.invoicer_biz_type,
            invoicerContactName=draft.invoicer_contact_name,
            invoicerEmail=draft.invoicer_email,
            invoicerTEL=draft.invoicer_tel,
            # 공급받는자
            invoiceeType=draft.invoicee_type,
            invoiceeCorpNum=_normalize_corp_num(draft.invoicee_corp_num),
            invoiceeCorpName=draft.invoicee_corp_name,
            invoiceeCEOName=draft.invoicee_ceo_name,
            invoiceeAddr=draft.invoicee_addr,
            invoiceeEmail1=draft.invoicee_email1,
            invoiceeTEL1=draft.invoicee_tel,
            # 금액
            supplyCostTotal=str(draft.supply_cost_total),
            taxTotal=str(draft.tax_total),
            totalAmount=str(draft.total_amount),
            # 기타
            remark1=draft.remark1,
            detailList=details,
        )

    def issue(self, draft: TaxinvoiceDraft) -> TaxinvoiceResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            tax = self._build_tax(draft)
            r = svc.registIssue(self.corp_num, tax, Memo=draft.remark1 or "셈하나 발행", UserID=self.user_id)
            # Response: {code, message, receiptNum, ntsconfirmNum, ntsSendDT, issueDT}
            ok = getattr(r, "code", None) in (1, "1") or getattr(r, "receiptNum", None)
            return TaxinvoiceResult(
                ok=bool(ok),
                mgt_key=draft.mgt_key,
                invoice_num=getattr(r, "ntsconfirmNum", None) or getattr(r, "invoiceNum", None),
                issue_dt=getattr(r, "issueDT", None),
                receipt_num=getattr(r, "receiptNum", None),
                error=None if ok else getattr(r, "message", None),
            )
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return TaxinvoiceResult(ok=False, mgt_key=draft.mgt_key, error=f"Popbill[{code}] {msg}")
        except Exception as e:
            return TaxinvoiceResult(ok=False, mgt_key=draft.mgt_key, error=f"발행 오류: {e}")

    def get_info(self, mgt_key: str, key_type: str = "SELL") -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            info = svc.getInfo(self.corp_num, key_type, mgt_key, self.user_id)
            return {"ok": True, "info": _info_to_dict(info)}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def search(self, *, s_date: str, e_date: str, key_type: str = "SELL",
               d_type: str = "W", state: Optional[list] = None,
               page: int = 1, per_page: int = 100) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            result = svc.search(
                self.corp_num, key_type, d_type, s_date, e_date,
                state or [], [], [], "", "", "", "", page, per_page, "D", self.user_id,
            )
            total = getattr(result, "total", 0)
            items = []
            for row in (getattr(result, "list", None) or []):
                items.append(_info_to_dict(row))
            return {"ok": True, "total": total, "list": items, "page": page, "per_page": per_page}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def get_popbill_url(self, togo: str = "TBOX", user_id: Optional[str] = None) -> str:
        svc = self._get_svc()
        return svc.getPopbillURL(self.corp_num, user_id or self.user_id or "sodam", togo)


def _info_to_dict(obj) -> dict:
    """팝빌 응답 객체를 dict로 안전하게 변환."""
    if obj is None:
        return {}
    keys = [
        "itemKey", "taxType", "writeDate", "issueDT",
        "invoicerCorpNum", "invoicerCorpName", "invoicerMgtKey",
        "invoiceeCorpNum", "invoiceeCorpName", "invoiceeMgtKey",
        "supplyCostTotal", "taxTotal", "totalAmount",
        "purposeType", "stateMemo", "stateCode", "stateDT",
        "ntsconfirmNum", "ntsResult", "ntsSendDT",
    ]
    out = {}
    for k in keys:
        v = getattr(obj, k, None)
        if v is not None:
            out[k] = str(v) if not isinstance(v, (int, float, bool, list)) else v
    return out


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillTaxinvoiceProvider,
}


def get_provider() -> BaseTaxinvoiceProvider:
    override = (os.getenv("TAXINVOICE_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillTaxinvoiceProvider()
    return DevStubProvider()
