"""기업정보 조회 서비스 (Popbill BizInfoCheckService 래핑).

- 사업자번호로 상호/대표자/주소/업태/종목/기업규모 등 상세 기업정보 조회
- 거래처 등록/수정 시 자동 채움에 활용
- 건당 ~88원 (팝빌 포인트)

※ biz_check(국세청 휴폐업상태)과는 다른 데이터 소스(한국기업데이터 기반).
   결과가 약간 다르거나 매핑되지 않는 사업자도 있을 수 있음.

팝빌 API:
- CheckBizInfo(CorpNum, CheckCorpNum, UserID=None) → BizInfo
    - companyName      : 상호
    - ceoname          : 대표자명
    - companyRegNum    : 법인등록번호
    - bizClass         : 업태
    - bizType          : 종목
    - address          : 주소
    - phone            : 전화번호
    - companySize      : 기업규모 (대기업 / 중견기업 / 중소기업 / 개인사업자 등)
    - establishDate    : 설립일자 (YYYY-MM-DD)
    - listedMarket     : 상장시장 (유가증권/코스닥/코넥스/비상장 등)
    - industryCode     : 업종코드
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, asdict
from typing import Optional

logger = logging.getLogger("sodam.bizinfo_check")


@dataclass
class BizInfoResult:
    ok: bool
    corp_num: Optional[str] = None
    company_name: Optional[str] = None
    ceo_name: Optional[str] = None
    company_reg_num: Optional[str] = None
    biz_class: Optional[str] = None            # 업태
    biz_type: Optional[str] = None             # 종목
    address: Optional[str] = None
    phone: Optional[str] = None
    company_size: Optional[str] = None
    establish_date: Optional[str] = None
    listed_market: Optional[str] = None
    industry_code: Optional[str] = None
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


class BaseBizInfoProvider:
    name = "base"

    def check(self, corp_num: str) -> BizInfoResult:
        raise NotImplementedError


class DevStubProvider(BaseBizInfoProvider):
    name = "stub"

    def check(self, corp_num: str) -> BizInfoResult:
        num = _normalize_corp_num(corp_num)
        if len(num) != 10:
            return BizInfoResult(ok=False, corp_num=num, error="사업자번호는 10자리여야 합니다.")
        logger.info("[BIZINFO-STUB] check %s → stub data", num)
        return BizInfoResult(
            ok=True,
            corp_num=num,
            company_name="(주)스텁컴퍼니",
            ceo_name="홍길동",
            biz_class="도매및소매업",
            biz_type="식료품 도매",
            address="서울특별시 강남구 테헤란로 123",
            phone="02-0000-0000",
            company_size="중소기업",
            establish_date="2020-01-01",
            listed_market="비상장",
        )


class PopbillBizInfoProvider(BaseBizInfoProvider):
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
        from popbill import BizInfoCheckService  # type: ignore
        svc = BizInfoCheckService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def check(self, corp_num: str) -> BizInfoResult:
        num = _normalize_corp_num(corp_num)
        if len(num) != 10:
            return BizInfoResult(ok=False, corp_num=num, error="사업자번호는 10자리여야 합니다.")
        if not self.corp_num:
            return BizInfoResult(ok=False, corp_num=num, error="POPBILL_CORP_NUM 이 설정되지 않았습니다.")

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        try:
            svc = self._get_svc()
            r = svc.checkBizInfo(self.corp_num, num, self.user_id)

            def _g(*keys):
                for k in keys:
                    v = getattr(r, k, None)
                    if v is not None and str(v).strip():
                        return str(v).strip()
                return None

            return BizInfoResult(
                ok=True,
                corp_num=num,
                company_name=_g("companyName", "CompanyName"),
                ceo_name=_g("ceoname", "CEOName", "ceoName"),
                company_reg_num=_g("companyRegNum", "CompanyRegNum"),
                biz_class=_g("bizClass", "BizClass"),
                biz_type=_g("bizType", "BizType"),
                address=_g("address", "Address"),
                phone=_g("phone", "Phone"),
                company_size=_g("companySize", "CompanySize"),
                establish_date=_g("establishDate", "EstablishDate"),
                listed_market=_g("listedMarket", "ListedMarket"),
                industry_code=_g("industryCode", "IndustryCode"),
            )
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return BizInfoResult(ok=False, corp_num=num, error=f"Popbill[{code}] {msg}")
        except Exception as e:
            return BizInfoResult(ok=False, corp_num=num, error=f"조회 오류: {e}")


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillBizInfoProvider,
}


def get_provider() -> BaseBizInfoProvider:
    override = (os.getenv("BIZINFO_CHECK_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillBizInfoProvider()
    return DevStubProvider()
