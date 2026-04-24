"""홈택스 전자세금계산서 수집 서비스 (Popbill HTTaxinvoiceService 래핑).

- 홈택스에 발급/수신된 전자세금계산서를 자동 수집 (매출 SELL / 매입 BUY)
- 수집 모델: 부서사용자 ID 등록 → RequestJob → JobID polling → Search/Summary
- 정액제 또는 건당 (수집 정책 별도)

팝빌 API:
- RegistDeptUser(CorpNum, DeptUserID, DeptUserPWD)  부서사용자 등록
- CheckDeptUser(CorpNum)                            등록 여부 확인 (DeptUserID 반환)
- CheckLoginDeptUser(CorpNum)                       로그인 가능 여부 (PW 만료 등)
- DeleteDeptUser(CorpNum)                           등록 해제
- RequestJob(CorpNum, Type, SDate, EDate)           수집 요청 → JobID
- GetJobState(CorpNum, JobID)                       작업 상태
- Search(CorpNum, JobID, Type, TaxType, PurposeType, ...) 수집 결과 페이지 조회
- Summary(CorpNum, JobID, Type, ...)                요약 (건수/합계)
- GetPopbillURL(CorpNum, UserID, TOGO)              팝빌 페이지 (HOMETAX, CERT)

Type:        SELL(매출) / BUY(매입) / TRUSTEE(수탁)
TaxType:     N(전자세금계산서) / M(수기세금계산서) — Search 필터
PurposeType: R(영수) / C(청구)
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, asdict
from typing import List, Optional

logger = logging.getLogger("sodam.hometax")


def _normalize_corp_num(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


@dataclass
class JobInfo:
    job_id: str
    job_state: int = 0          # 0=대기 / 1=진행 / 2=완료 / 3=실패
    start_dt: Optional[str] = None
    end_dt: Optional[str] = None
    request_dt: Optional[str] = None
    request_type: Optional[str] = None  # SELL/BUY
    request_s_date: Optional[str] = None
    request_e_date: Optional[str] = None
    error_code: Optional[int] = None
    error_reason: Optional[str] = None

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class CollectResult:
    ok: bool
    error: Optional[str] = None

    def to_dict(self) -> dict:
        return {"ok": self.ok, "error": self.error}


class BaseHomeTaxProvider:
    name = "base"

    # 부서사용자 인증
    def check_dept_user(self) -> dict:
        raise NotImplementedError

    def regist_dept_user(self, dept_user_id: str, dept_user_pwd: str) -> CollectResult:
        raise NotImplementedError

    def check_login_dept_user(self) -> CollectResult:
        raise NotImplementedError

    def delete_dept_user(self) -> CollectResult:
        raise NotImplementedError

    # 수집 작업
    def request_job(self, type_: str, s_date: str, e_date: str) -> dict:
        raise NotImplementedError

    def get_job_state(self, job_id: str) -> JobInfo:
        raise NotImplementedError

    def list_active_jobs(self) -> List[JobInfo]:
        raise NotImplementedError

    def search(self, *, job_id: str, type_filter: List[str], page: int = 1, per_page: int = 100,
               tax_type: Optional[List[str]] = None, purpose_type: Optional[List[str]] = None) -> dict:
        raise NotImplementedError

    def summary(self, *, job_id: str, type_filter: List[str],
                tax_type: Optional[List[str]] = None, purpose_type: Optional[List[str]] = None) -> dict:
        raise NotImplementedError

    def get_popbill_url(self, togo: str = "HOMETAX", user_id: Optional[str] = None) -> str:
        raise NotImplementedError


class DevStubProvider(BaseHomeTaxProvider):
    name = "stub"

    def check_dept_user(self) -> dict:
        return {"ok": False, "registered": False, "note": "STUB 모드 - 부서사용자 미등록"}

    def regist_dept_user(self, dept_user_id: str, dept_user_pwd: str) -> CollectResult:
        return CollectResult(ok=True)

    def check_login_dept_user(self) -> CollectResult:
        return CollectResult(ok=True)

    def delete_dept_user(self) -> CollectResult:
        return CollectResult(ok=True)

    def request_job(self, type_: str, s_date: str, e_date: str) -> dict:
        from datetime import datetime
        return {"ok": True, "job_id": f"STUBJOB{datetime.now().strftime('%Y%m%d%H%M%S')}"}

    def get_job_state(self, job_id: str) -> JobInfo:
        return JobInfo(job_id=job_id, job_state=2)

    def list_active_jobs(self) -> List[JobInfo]:
        return []

    def search(self, *, job_id: str, type_filter: List[str], page: int = 1, per_page: int = 100,
               tax_type=None, purpose_type=None) -> dict:
        return {"ok": True, "total": 0, "list": [], "note": "STUB 모드: 빈 결과"}

    def summary(self, *, job_id: str, type_filter: List[str], tax_type=None, purpose_type=None) -> dict:
        return {"ok": True, "count": 0, "supplyCostTotal": 0, "taxTotal": 0, "totalAmount": 0}

    def get_popbill_url(self, togo: str = "HOMETAX", user_id: Optional[str] = None) -> str:
        return "https://www.popbill.com/"


class PopbillHomeTaxProvider(BaseHomeTaxProvider):
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
        from popbill import HTTaxinvoiceService  # type: ignore
        svc = HTTaxinvoiceService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        self._svc = svc
        return svc

    def _ensure_corp_num(self):
        if not self.corp_num:
            raise RuntimeError("POPBILL_CORP_NUM 이 설정되지 않았습니다.")

    def check_dept_user(self) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            r = svc.checkDeptUser(self.corp_num, self.user_id)
            # CheckDeptUserResponse: code/message + dept user id (success → DeptUserID 가 응답)
            return {"ok": True, "registered": True, "raw": str(r)}
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            # code -12000xxx: 미등록 또는 만료. 미등록도 정상 응답으로 처리.
            return {"ok": True, "registered": False, "code": code, "message": msg}
        except Exception as e:
            return {"ok": False, "error": f"확인 오류: {e}"}

    def regist_dept_user(self, dept_user_id: str, dept_user_pwd: str) -> CollectResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            r = svc.registDeptUser(self.corp_num, dept_user_id, dept_user_pwd, self.user_id)
            ok = getattr(r, "code", 0) == 1 or getattr(r, "code", None) == "1"
            return CollectResult(ok=bool(ok), error=None if ok else getattr(r, "message", None))
        except PopbillException as pe:
            return CollectResult(ok=False, error=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return CollectResult(ok=False, error=f"등록 오류: {e}")

    def check_login_dept_user(self) -> CollectResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            r = svc.checkLoginDeptUser(self.corp_num, self.user_id)
            ok = getattr(r, "code", 0) == 1
            return CollectResult(ok=bool(ok), error=None if ok else getattr(r, "message", None))
        except PopbillException as pe:
            return CollectResult(ok=False, error=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return CollectResult(ok=False, error=f"로그인 확인 오류: {e}")

    def delete_dept_user(self) -> CollectResult:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            r = svc.deleteDeptUser(self.corp_num, self.user_id)
            ok = getattr(r, "code", 0) == 1
            return CollectResult(ok=bool(ok), error=None if ok else getattr(r, "message", None))
        except PopbillException as pe:
            return CollectResult(ok=False, error=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return CollectResult(ok=False, error=f"삭제 오류: {e}")

    def request_job(self, type_: str, s_date: str, e_date: str) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            job_id = svc.requestJob(self.corp_num, type_, s_date, e_date, self.user_id)
            return {"ok": True, "job_id": str(job_id)}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"요청 오류: {e}"}

    def _to_jobinfo(self, raw) -> JobInfo:
        return JobInfo(
            job_id=str(getattr(raw, "jobID", None) or getattr(raw, "JobID", "") or ""),
            job_state=int(getattr(raw, "jobState", 0) or 0),
            start_dt=getattr(raw, "startDT", None),
            end_dt=getattr(raw, "endDT", None),
            request_dt=getattr(raw, "requestDT", None),
            request_type=getattr(raw, "requestType", None),
            request_s_date=getattr(raw, "requestSDate", None),
            request_e_date=getattr(raw, "requestEDate", None),
            error_code=getattr(raw, "errorCode", None),
            error_reason=getattr(raw, "errorReason", None),
        )

    def get_job_state(self, job_id: str) -> JobInfo:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            r = svc.getJobState(self.corp_num, job_id, self.user_id)
            return self._to_jobinfo(r)
        except PopbillException as pe:
            return JobInfo(job_id=job_id, job_state=3, error_reason=f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}")
        except Exception as e:
            return JobInfo(job_id=job_id, job_state=3, error_reason=f"조회 오류: {e}")

    def list_active_jobs(self) -> List[JobInfo]:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            rows = svc.listActiveJob(self.corp_num, self.user_id) or []
            return [self._to_jobinfo(r) for r in rows]
        except PopbillException as pe:
            logger.warning("listActiveJob fail: %s", pe)
            return []
        except Exception as e:
            logger.warning("listActiveJob exc: %s", e)
            return []

    def search(self, *, job_id: str, type_filter: List[str], page: int = 1, per_page: int = 100,
               tax_type=None, purpose_type=None) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            res = svc.search(
                self.corp_num,
                job_id,
                type_filter or ["SELL"],
                tax_type or ["N", "M"],
                purpose_type or ["R", "C"],
                "",  # TaxRegIDType
                "",  # TaxRegID
                "",  # TaxRegIDYN
                page,
                per_page,
                "D",
                self.user_id,
            )
            total = getattr(res, "total", 0) or 0
            items: List[dict] = []
            for row in (getattr(res, "list", None) or []):
                items.append({
                    "ntsconfirmNum": getattr(row, "ntsconfirmNum", None) or getattr(row, "NTSConfirmNum", None),
                    "writeDate": getattr(row, "writeDate", None),
                    "issueDate": getattr(row, "issueDate", None),
                    "invoicerCorpNum": getattr(row, "invoicerCorpNum", None),
                    "invoicerCorpName": getattr(row, "invoicerCorpName", None),
                    "invoiceeCorpNum": getattr(row, "invoiceeCorpNum", None),
                    "invoiceeCorpName": getattr(row, "invoiceeCorpName", None),
                    "supplyCostTotal": getattr(row, "supplyCostTotal", None),
                    "taxTotal": getattr(row, "taxTotal", None),
                    "totalAmount": getattr(row, "totalAmount", None),
                    "purposeType": getattr(row, "purposeType", None),
                    "taxType": getattr(row, "taxType", None),
                    "stateMemo": getattr(row, "stateMemo", None),
                })
            return {"ok": True, "total": total, "list": items, "page": page, "per_page": per_page}
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def summary(self, *, job_id: str, type_filter: List[str],
                tax_type=None, purpose_type=None) -> dict:
        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore
        try:
            self._ensure_corp_num()
            svc = self._get_svc()
            res = svc.summary(
                self.corp_num,
                job_id,
                type_filter or ["SELL"],
                tax_type or ["N", "M"],
                purpose_type or ["R", "C"],
                "", "", "",
                self.user_id,
            )
            return {
                "ok": True,
                "count": int(getattr(res, "count", 0) or 0),
                "supplyCostTotal": int(getattr(res, "supplyCostTotal", 0) or 0),
                "taxTotal": int(getattr(res, "taxTotal", 0) or 0),
                "totalAmount": int(getattr(res, "amountTotal", 0) or getattr(res, "totalAmount", 0) or 0),
            }
        except PopbillException as pe:
            return {"ok": False, "error": f"Popbill[{getattr(pe, 'code', None)}] {getattr(pe, 'message', str(pe))}"}
        except Exception as e:
            return {"ok": False, "error": f"조회 오류: {e}"}

    def get_popbill_url(self, togo: str = "HOMETAX", user_id: Optional[str] = None) -> str:
        self._ensure_corp_num()
        svc = self._get_svc()
        return svc.getPopbillURL(self.corp_num, user_id or self.user_id or "sodam", togo)


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillHomeTaxProvider,
}


def get_provider() -> BaseHomeTaxProvider:
    override = (os.getenv("HOMETAX_PROVIDER") or "").strip().lower()
    if override:
        cls = _PROVIDERS.get(override, DevStubProvider)
        return cls()
    if os.getenv("POPBILL_LINK_ID") and os.getenv("POPBILL_SECRET_KEY"):
        return PopbillHomeTaxProvider()
    return DevStubProvider()
