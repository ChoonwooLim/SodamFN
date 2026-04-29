"""전자명세서 서비스 (Popbill StatementService 래핑).

6종 양식 발행/조회/추가발송 통합:
- 121=거래명세서 122=청구서 123=견적서 124=발주서 125=입금표 126=영수증
- 또는 사업장 등록 양식코드(form_code)

건당 ~50원 (발행 시), 조회/단가 무료.
공급받는자 이메일 + EmailSubject 채워지면 팝빌이 자동 메일 발송.

팝빌 API:
- registIssue(CorpNum, statement, Memo, UserID, EmailSubject)  → receiptNum
- getInfo(CorpNum, ItemCode, MgtKey)                            → 단건 상세
- search(CorpNum, DType, SDate, EDate, State, ItemCode, ...)    → 발행 이력
- sendFAX(CorpNum, ItemCode, MgtKey, Sender, Receiver, UserID)  → 팩스 발송
- sendSMS(CorpNum, ItemCode, MgtKey, Sender, Receiver, Content) → SMS 발송
- getPopbillURL(CorpNum, UserID, TOGO)                          → 콘솔 URL
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import List, Optional

logger = logging.getLogger("sodam.statement")


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


# 양식 메타 — frontend conditional 필드 동적 렌더링용
FORM_CODES: List[dict] = [
    {
        "code": "121",
        "name": "거래명세서",
        "default_tax_type": "과세",
        "default_purpose_type": "영수",
        "extra_fields": [],
    },
    {
        "code": "122",
        "name": "청구서",
        "default_tax_type": "과세",
        "default_purpose_type": "청구",
        "extra_fields": [
            {"key": "deadline_date", "label": "납기일", "type": "date"},
            {"key": "deposit_account", "label": "입금계좌", "type": "text"},
        ],
    },
    {
        "code": "123",
        "name": "견적서",
        "default_tax_type": "과세",
        "default_purpose_type": "청구",
        "extra_fields": [
            {"key": "validity_date", "label": "견적유효기간", "type": "date"},
        ],
    },
    {
        "code": "124",
        "name": "발주서",
        "default_tax_type": "과세",
        "default_purpose_type": "청구",
        "extra_fields": [
            {"key": "delivery_date", "label": "납기일", "type": "date"},
            {"key": "delivery_place", "label": "납품장소", "type": "text"},
        ],
    },
    {
        "code": "125",
        "name": "입금표",
        "default_tax_type": "면세",
        "default_purpose_type": "영수",
        "extra_fields": [
            {"key": "deposit_date", "label": "입금일", "type": "date"},
            {"key": "depositor", "label": "입금자", "type": "text"},
        ],
    },
    {
        "code": "126",
        "name": "영수증",
        "default_tax_type": "면세",
        "default_purpose_type": "영수",
        "extra_fields": [
            {"key": "receiver_name", "label": "영수자", "type": "text"},
        ],
    },
]


@dataclass
class StatementDetail:
    """명세서 품목 한 줄."""
    serialNum: int
    purchaseDT: str          # YYYYMMDD
    itemName: str
    qty: str = "1"
    unitCost: str = "0"
    supplyCost: str = "0"
    tax: str = "0"
    spec: str = ""
    remark: str = ""

    def to_popbill_dict(self) -> dict:
        return {
            "serialNum": self.serialNum,
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
class StatementDraft:
    """발행 요청 페이로드."""
    item_code: str           # "121" ~ "126" 또는 사업장 등록 코드
    mgt_key: str
    write_date: str          # YYYYMMDD
    form_code: str = ""      # 사업장 등록 양식코드 (선택)
    tax_type: str = "과세"   # 과세 / 영세 / 면세
    purpose_type: str = "영수"  # 영수 / 청구
    # 공급자
    sender_corp_num: str = ""
    sender_corp_name: str = ""
    sender_ceo_name: str = ""
    sender_addr: str = ""
    sender_biz_class: str = ""
    sender_biz_type: str = ""
    sender_contact_name: str = ""
    sender_email: str = ""
    sender_tel: str = ""
    # 공급받는자
    receiver_corp_num: str = ""
    receiver_corp_name: str = ""
    receiver_ceo_name: str = ""
    receiver_addr: str = ""
    receiver_email: str = ""
    receiver_tel: str = ""
    # 금액
    supply_cost_total: str = "0"
    tax_total: str = "0"
    total_amount: str = "0"
    # 양식별 특수 필드 (Q2-B)
    property_bag: dict = field(default_factory=dict)
    remark1: str = ""
    remark2: str = ""
    remark3: str = ""
    detail_list: List[StatementDetail] = field(default_factory=list)
    # 자동 이메일 발송 (Q3-B)
    email_subject: str = ""


@dataclass
class StatementResult:
    ok: bool
    item_code: Optional[str] = None
    mgt_key: Optional[str] = None
    receipt_num: Optional[str] = None
    issue_dt: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


class BaseStatementProvider:
    name = "base"

    def issue(self, draft: StatementDraft) -> StatementResult:
        raise NotImplementedError

    def get_info(self, item_code: str, mgt_key: str) -> dict:
        raise NotImplementedError

    def search(self, *, item_code: str, s_date: str, e_date: str,
               state: Optional[list] = None,
               page: int = 1, per_page: int = 100) -> dict:
        raise NotImplementedError

    def send_fax(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str) -> dict:
        raise NotImplementedError

    def send_sms(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str, content: str) -> dict:
        raise NotImplementedError

    def get_popbill_url(self, togo: str = "BOX",
                        user_id: Optional[str] = None) -> str:
        raise NotImplementedError


class DevStubProvider(BaseStatementProvider):
    name = "stub"

    def issue(self, draft: StatementDraft) -> StatementResult:
        logger.info("[STMT-STUB] issue item=%s mgt=%s total=%s",
                    draft.item_code, draft.mgt_key, draft.total_amount)
        return StatementResult(
            ok=True,
            item_code=draft.item_code,
            mgt_key=draft.mgt_key,
            receipt_num=f"stub-stmt-{draft.mgt_key}",
            issue_dt=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        )

    def get_info(self, item_code: str, mgt_key: str) -> dict:
        return {"ok": False, "error": "STUB 모드에서는 상세 조회를 지원하지 않습니다."}

    def search(self, **kwargs) -> dict:
        return {"ok": True, "total": 0, "list": [], "note": "STUB 모드: 빈 이력 반환"}

    def send_fax(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str) -> dict:
        return {"ok": True, "receipt_num": f"stub-fax-{mgt_key}", "note": "STUB"}

    def send_sms(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str, content: str) -> dict:
        return {"ok": True, "receipt_num": f"stub-sms-{mgt_key}", "note": "STUB"}

    def get_popbill_url(self, togo: str = "BOX",
                        user_id: Optional[str] = None) -> str:
        return "https://www.popbill.com/"


class PopbillStatementProvider(BaseStatementProvider):
    name = "popbill"

    def __init__(self):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = _normalize_corp_num(os.getenv("POPBILL_CORP_NUM", ""))
        self.is_test = (
            os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes")
        )
        self.user_id = os.getenv("POPBILL_USER_ID", "").strip() or None
        self._svc = None

    def _get_svc(self):
        if self._svc is not None:
            return self._svc
        if not self.link_id or not self.secret_key:
            raise RuntimeError("POPBILL_LINK_ID / POPBILL_SECRET_KEY 가 설정되지 않았습니다.")
        from popbill import StatementService  # type: ignore
        svc = StatementService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def _build_statement(self, draft: StatementDraft):
        from popbill.statementService import Statement, StatementDetail as SDKDetail  # type: ignore

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

        s = Statement(
            writeDate=draft.write_date,
            itemCode=draft.item_code,
            taxType=draft.tax_type,
            purposeType=draft.purpose_type,
            formCode=draft.form_code or "",
            mgtKey=draft.mgt_key,
            # 공급자
            senderCorpNum=_normalize_corp_num(draft.sender_corp_num),
            senderCorpName=draft.sender_corp_name,
            senderCEOName=draft.sender_ceo_name,
            senderAddr=draft.sender_addr,
            senderBizClass=draft.sender_biz_class,
            senderBizType=draft.sender_biz_type,
            senderContactName=draft.sender_contact_name,
            senderEmail=draft.sender_email,
            senderTEL=draft.sender_tel,
            # 공급받는자
            receiverCorpNum=_normalize_corp_num(draft.receiver_corp_num),
            receiverCorpName=draft.receiver_corp_name,
            receiverCEOName=draft.receiver_ceo_name,
            receiverAddr=draft.receiver_addr,
            receiverEmail=draft.receiver_email,
            receiverTEL=draft.receiver_tel,
            # 금액
            supplyCostTotal=str(draft.supply_cost_total),
            taxTotal=str(draft.tax_total),
            totalAmount=str(draft.total_amount),
            # 비고
            remark1=draft.remark1,
            remark2=draft.remark2,
            remark3=draft.remark3,
            detailList=details,
        )

        # 양식별 특수 필드 — property_bag 의 key/value 를 SDK 객체 attribute 로 셋
        for k, v in (draft.property_bag or {}).items():
            if v is None or v == "":
                continue
            setattr(s, k, v)

        return s

    def issue(self, draft: StatementDraft) -> StatementResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            statement = self._build_statement(draft)
            r = svc.registIssue(
                self.corp_num,
                statement,
                Memo=draft.remark1 or "셈하나 발행",
                UserID=self.user_id,
                EmailSubject=draft.email_subject or None,
            )
            ok = getattr(r, "code", None) in (1, "1") or bool(getattr(r, "receiptNum", None))
            return StatementResult(
                ok=bool(ok),
                item_code=draft.item_code,
                mgt_key=draft.mgt_key,
                receipt_num=getattr(r, "receiptNum", None),
                issue_dt=getattr(r, "issueDT", None),
                error=None if ok else getattr(r, "message", None),
            )
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return StatementResult(
                ok=False,
                item_code=draft.item_code,
                mgt_key=draft.mgt_key,
                error=f"Popbill[{code}] {msg}",
            )
        except Exception as e:  # noqa: BLE001
            return StatementResult(
                ok=False,
                item_code=draft.item_code,
                mgt_key=draft.mgt_key,
                error=f"발행 오류: {e}",
            )

    def get_info(self, item_code: str, mgt_key: str) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            info = svc.getInfo(self.corp_num, item_code, mgt_key)
            return {"ok": True, "info": _info_to_dict(info)}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"조회 오류: {e}"}

    def search(self, *, item_code: str, s_date: str, e_date: str,
               state: Optional[list] = None,
               page: int = 1, per_page: int = 100) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            result = svc.search(
                self.corp_num, "W", s_date, e_date,
                state or [], [item_code],
                page, per_page, "D",
                self.user_id,
            )
            total = getattr(result, "total", 0)
            items = []
            for row in (getattr(result, "list", None) or []):
                items.append(_info_to_dict(row))
            return {"ok": True, "total": total, "list": items, "page": page, "per_page": per_page}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}", "list": []}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"조회 오류: {e}", "list": []}

    def send_fax(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            receipt = svc.sendFAX(
                self.corp_num, item_code, mgt_key,
                _normalize_corp_num(sender) or sender,
                _normalize_corp_num(receiver) or receiver,
                self.user_id,
            )
            return {"ok": True, "receipt_num": str(receipt) if receipt else None}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"팩스 발송 오류: {e}"}

    def send_sms(self, item_code: str, mgt_key: str,
                 sender: str, receiver: str, content: str) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            receipt = svc.sendSMS(
                self.corp_num, item_code, mgt_key,
                _normalize_corp_num(sender) or sender,
                _normalize_corp_num(receiver) or receiver,
                content,
                self.user_id,
            )
            return {"ok": True, "receipt_num": str(receipt) if receipt else None}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:  # noqa: BLE001
            return {"ok": False, "error": f"SMS 발송 오류: {e}"}

    def get_popbill_url(self, togo: str = "TBOX",
                        user_id: Optional[str] = None) -> str:
        svc = self._get_svc()
        # UserID 는 팝빌에 등록된 담당자 ID 여야 함. 잘못된 fallback 으로 -10000038 발생 방지.
        uid = user_id or self.user_id
        if not uid:
            raise RuntimeError("POPBILL_USER_ID 가 설정되지 않았습니다. (.env / Orbitron.yaml 확인)")
        return svc.getPopbillURL(self.corp_num, uid, togo)


def _info_to_dict(obj) -> dict:
    """팝빌 응답 객체를 dict 로 안전하게 변환."""
    if obj is None:
        return {}
    keys = [
        "itemKey", "itemCode", "mgtKey", "writeDate", "issueDT",
        "taxType", "purposeType", "formCode",
        "senderCorpNum", "senderCorpName", "senderCEOName",
        "receiverCorpNum", "receiverCorpName", "receiverCEOName",
        "supplyCostTotal", "taxTotal", "totalAmount",
        "stateMemo", "stateCode", "stateDT",
        "receiptNum", "ntsResult", "ntsSendDT",
        "remark1", "remark2", "remark3",
    ]
    out = {}
    for k in keys:
        v = getattr(obj, k, None)
        if v is not None:
            out[k] = str(v) if not isinstance(v, (int, float, bool, list)) else v
    return out


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillStatementProvider,
}


def get_provider() -> BaseStatementProvider:
    override = (os.getenv("STATEMENT_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillStatementProvider()
    return DevStubProvider()
