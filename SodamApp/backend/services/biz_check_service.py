"""사업자등록상태 조회 서비스 (Popbill ClosedownService 래핑).

- 사업자등록번호로 휴·폐업 상태 + 세금계산서 발행 가능 여부를 즉시 조회
- 거래처 등록 시 자동 검증, 월별 일괄 점검 크론 등에 사용
- 건당 ~30원 (팝빌 포인트)
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import List, Optional

logger = logging.getLogger("sodam.biz_check")


@dataclass
class BizStateResult:
    ok: bool
    corp_num: Optional[str] = None
    state: Optional[str] = None          # '01'=등록, '02'=말소, '03'=정지, '04'=미발견
    state_label: Optional[str] = None    # '정상' / '휴업' / '폐업' / '미등록'
    tax_type: Optional[str] = None       # '01'=일반, '02'=면세, '03'=간이, '04'=비영리
    tax_type_label: Optional[str] = None
    state_date: Optional[str] = None     # 상태 변경일 YYYYMMDD
    check_date: Optional[str] = None     # 조회일 YYYYMMDDHHMMSS
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {
            "ok": self.ok,
            "corp_num": self.corp_num,
            "state": self.state,
            "state_label": self.state_label,
            "tax_type": self.tax_type,
            "tax_type_label": self.tax_type_label,
            "state_date": self.state_date,
            "check_date": self.check_date,
            "error": self.error,
        }


_STATE_MAP = {"01": "정상(등록)", "02": "폐업", "03": "휴업", "04": "미등록"}
_TAX_TYPE_MAP = {
    "01": "일반과세자",
    "02": "면세사업자",
    "03": "간이과세자",
    "04": "비영리사업자",
    "05": "간이과세자(세금계산서 발급사업자)",
}


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


class BaseBizCheckProvider:
    name = "base"

    def check_one(self, corp_num: str) -> BizStateResult:
        raise NotImplementedError

    def check_many(self, corp_nums: List[str]) -> List[BizStateResult]:
        return [self.check_one(c) for c in corp_nums]


class DevStubProvider(BaseBizCheckProvider):
    name = "stub"

    def check_one(self, corp_num: str) -> BizStateResult:
        num = _normalize_corp_num(corp_num)
        if len(num) != 10:
            return BizStateResult(ok=False, corp_num=num, error="사업자번호는 10자리여야 합니다.")
        logger.info("[BIZ-STUB] check %s → 정상(등록) 반환 (stub)", num)
        return BizStateResult(
            ok=True,
            corp_num=num,
            state="01",
            state_label=_STATE_MAP["01"],
            tax_type="01",
            tax_type_label=_TAX_TYPE_MAP["01"],
            state_date=None,
            check_date=None,
        )


class PopbillBizCheckProvider(BaseBizCheckProvider):
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
        from popbill import ClosedownService  # type: ignore
        svc = ClosedownService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def check_one(self, corp_num: str) -> BizStateResult:
        num = _normalize_corp_num(corp_num)
        if len(num) != 10:
            return BizStateResult(ok=False, corp_num=num, error="사업자번호는 10자리여야 합니다.")
        if not self.corp_num:
            return BizStateResult(ok=False, corp_num=num, error="POPBILL_CORP_NUM 이 설정되지 않았습니다.")

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            r = svc.checkCorpNum(self.corp_num, num)
            state = getattr(r, "state", None) or getattr(r, "State", None)
            tax_type = getattr(r, "taxType", None) or getattr(r, "TaxType", None)
            state_date = getattr(r, "stateDate", None) or getattr(r, "StateDate", None)
            check_date = getattr(r, "checkDate", None) or getattr(r, "CheckDate", None)
            return BizStateResult(
                ok=True,
                corp_num=num,
                state=str(state) if state is not None else None,
                state_label=_STATE_MAP.get(str(state), None),
                tax_type=str(tax_type) if tax_type is not None else None,
                tax_type_label=_TAX_TYPE_MAP.get(str(tax_type), None),
                state_date=state_date,
                check_date=check_date,
            )
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return BizStateResult(ok=False, corp_num=num, error=f"Popbill[{code}] {msg}")
        except Exception as e:
            return BizStateResult(ok=False, corp_num=num, error=f"조회 오류: {e}")

    def check_many(self, corp_nums: List[str]) -> List[BizStateResult]:
        nums = [_normalize_corp_num(n) for n in corp_nums]
        valid = [n for n in nums if len(n) == 10]
        invalid = [n for n in nums if len(n) != 10]

        if not valid:
            return [BizStateResult(ok=False, corp_num=n, error="사업자번호 형식 오류") for n in nums]

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        results: List[BizStateResult] = []
        try:
            svc = self._get_svc()
            rows = svc.checkCorpNums(self.corp_num, valid) or []
            for r in rows:
                corp = getattr(r, "corpNum", None) or getattr(r, "CorpNum", None) or ""
                state = getattr(r, "state", None) or getattr(r, "State", None)
                tax_type = getattr(r, "taxType", None) or getattr(r, "TaxType", None)
                results.append(BizStateResult(
                    ok=True,
                    corp_num=str(corp),
                    state=str(state) if state is not None else None,
                    state_label=_STATE_MAP.get(str(state), None),
                    tax_type=str(tax_type) if tax_type is not None else None,
                    tax_type_label=_TAX_TYPE_MAP.get(str(tax_type), None),
                    state_date=getattr(r, "stateDate", None) or getattr(r, "StateDate", None),
                    check_date=getattr(r, "checkDate", None) or getattr(r, "CheckDate", None),
                ))
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            for n in valid:
                results.append(BizStateResult(ok=False, corp_num=n, error=f"Popbill[{code}] {msg}"))
        except Exception as e:
            for n in valid:
                results.append(BizStateResult(ok=False, corp_num=n, error=f"조회 오류: {e}"))

        for n in invalid:
            results.append(BizStateResult(ok=False, corp_num=n, error="사업자번호는 10자리여야 합니다."))
        return results


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillBizCheckProvider,
}


def get_provider() -> BaseBizCheckProvider:
    # 팩스·알림 공용 POPBILL env가 있으면 popbill 사용. 별도 BIZ_CHECK_PROVIDER로 override 가능
    override = (os.getenv("BIZ_CHECK_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    # Auto: LINK_ID + SECRET_KEY가 있으면 popbill 자동 활성
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillBizCheckProvider()
    return DevStubProvider()
