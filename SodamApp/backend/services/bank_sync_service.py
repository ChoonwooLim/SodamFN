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


def _attr(obj, *names):
    """팝빌 SDK 응답 객체에서 여러 속성명 중 첫 번째로 존재하는 값 반환.
    SDK 버전별 camelCase/PascalCase 차이를 흡수."""
    if obj is None:
        return None
    for n in names:
        v = getattr(obj, n, None)
        if v is not None:
            return v
        # dict 응답도 대비
        if isinstance(obj, dict) and n in obj:
            return obj[n]
    return None


def _to_int(v) -> int:
    """콤마·통화표시 포함 문자열을 안전하게 int 로 변환. 실패 시 0."""
    if v is None:
        return 0
    try:
        return int(str(v).replace(",", "").replace("원", "").strip() or 0)
    except (ValueError, TypeError):
        return 0


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

    def __init__(self, force_is_test: Optional[bool] = None):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = _normalize(os.getenv("POPBILL_CORP_NUM", ""))
        # is_test 결정 우선순위:
        #   1) force_is_test 인자 (진단 모달에서 환경별 비교용 강제 오버라이드)
        #   2) POPBILL_BANK_IS_TEST env (계좌조회 전용 명시적 토글)
        #   3) POPBILL_IS_TEST env fallback (FAX 등 다른 서비스와 동일 환경 따라감)
        #      — Orbitron 대시보드에 변수 하나만 설정해도 일관 동작하도록 fallback
        #   4) 기본 False (LIVE)
        if force_is_test is not None:
            self.is_test = force_is_test
        else:
            bank_test = os.getenv("POPBILL_BANK_IS_TEST")
            if bank_test is not None and bank_test.strip() != "":
                self.is_test = bank_test.strip().lower() in ("1", "true", "yes")
            else:
                fallback = os.getenv("POPBILL_IS_TEST", "").strip().lower()
                self.is_test = fallback in ("1", "true", "yes")
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
            rows = svc.listBankAccount(self.corp_num, self.user_id) or []
        except PopbillException as pe:
            raise RuntimeError(f"Popbill[{getattr(pe, 'code', '')}] {getattr(pe, 'message', pe)}")

        out: List[BankAccountInfo] = []
        for r in rows:
            # 팝빌 Python SDK 는 lowerCamelCase 로 응답 속성 노출
            bank_code = _attr(r, "bankCode", "BankCode") or ""
            acc = _attr(r, "accountNumber", "AccountNumber") or ""
            out.append(BankAccountInfo(
                bank_code=str(bank_code),
                account_number=str(acc),
                account_type=str(_attr(r, "accountType", "AccountType") or "P"),
                alias=_attr(r, "accountName", "AccountName"),
                memo=_attr(r, "memo", "Memo"),
                state=_attr(r, "state", "State"),
                regist_dt=_attr(r, "regDT", "RegDT"),
                # 사용기간: 팝빌 응답의 'contractStartDate' / 'contractEndDate' 또는
                # 'usePeriodStart' / 'usePeriodEnd'. SDK 버전에 따라 다를 수 있어 fallback.
                use_period_start=_attr(r, "contractStartDate", "ContractStartDate", "usePeriodStart"),
                use_period_end=_attr(r, "contractEndDate", "ContractEndDate", "usePeriodEnd"),
                next_billing_date=_attr(r, "nextBillingDate", "NextBillingDate"),
            ))
        return out

    def get_balance(self) -> Optional[float]:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            v = svc.getBalance(self.corp_num)
            return float(v) if v is not None else None
        except PopbillException as pe:
            logger.warning("getBalance 실패: %s", pe)
            return None
        except Exception as e:
            logger.warning("getBalance 예외: %s", e)
            return None

    def check_account_validity(self, bank_code: str, account_number: str) -> dict:
        """계좌 존재/정액제 상태 확인 — getBankAccountInfo + getFlatRateState 조합."""
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            info = svc.getBankAccountInfo(self.corp_num, bank_code, _normalize(account_number), self.user_id)
            state = None
            try:
                fr = svc.getFlatRateState(self.corp_num, bank_code, _normalize(account_number), self.user_id)
                state = _attr(fr, "state", "State")
            except PopbillException:
                pass
            return {
                "ok": True,
                "bank_name": _attr(info, "bankCodeName", "bankName"),
                "account_name": _attr(info, "accountName"),
                "flat_rate_state": state,
            }
        except PopbillException as pe:
            return {"ok": False, "code": getattr(pe, "code", None), "message": getattr(pe, "message", str(pe))}
        except Exception as e:
            return {"ok": False, "message": f"{e}"}

    # ---------- search (async job pattern) ----------
    #
    # 팝빌 이지펀뱅크 거래내역 조회는 2단계 비동기 패턴:
    #   1) requestJob(...) → JobID 발급 (수집 작업 큐잉)
    #   2) getJobState(JobID) 폴링 → jobState == 3(완료)
    #   3) search(JobID, ...) 로 결과 페이지네이션
    # 이지펀뱅크 Job 은 정액제 기간내 범위에서만 수집 가능.

    def _request_job(self, bank_code: str, account_number: str, start_date, end_date) -> str:
        PopbillException = self._popbill_exc()
        s = _ymd(start_date)
        e = _ymd(end_date)
        if not s or not e:
            raise RuntimeError("시작/종료일자 형식 오류")
        try:
            svc = self._get_svc()
            job_id = svc.requestJob(self.corp_num, bank_code, _normalize(account_number), s, e, self.user_id)
            return str(job_id or "").strip()
        except PopbillException as pe:
            raise RuntimeError(f"Popbill[{getattr(pe, 'code', '')}] requestJob 실패: {getattr(pe, 'message', pe)}")

    def _wait_job(self, job_id: str, timeout_sec: int = 60, poll_interval: float = 1.5) -> dict:
        """jobState:  1=수집대기, 2=수집중, 3=수집완료, 4=수집실패.
        Returns dict with {state, err_code, err_message, collect_count, regist_dt}.
        """
        import time
        PopbillException = self._popbill_exc()
        deadline = time.time() + timeout_sec
        last = None
        while time.time() < deadline:
            try:
                svc = self._get_svc()
                r = svc.getJobState(self.corp_num, job_id, self.user_id)
                state_raw = _attr(r, "jobState", "JobState")
                state = int(state_raw) if state_raw is not None else None
                err_code = _attr(r, "errorCode", "ErrorCode")
                err_msg = _attr(r, "errorReason", "ErrorReason")
                last = {
                    "state": state,
                    "err_code": err_code,
                    "err_message": err_msg,
                    "collect_count": _attr(r, "collectCount", "CollectCount"),
                    "result_count": _attr(r, "resultCount", "ResultCount"),
                    "regist_dt": _attr(r, "regDT", "RegDT"),
                }
                if state == 3:
                    return last
                if state == 4:
                    raise RuntimeError(f"팝빌 수집 실패: [{err_code}] {err_msg}")
            except PopbillException as pe:
                raise RuntimeError(f"Popbill[{getattr(pe, 'code', '')}] getJobState 실패: {getattr(pe, 'message', pe)}")
            time.sleep(poll_interval)
        raise RuntimeError(f"팝빌 수집 타임아웃 ({timeout_sec}s). 마지막 상태: {last}")

    def search(
        self,
        bank_code: str,
        account_number: str,
        start_date,
        end_date,
        order: str = "A",
        page: int = 1,
        per_page: int = 500,
    ) -> BankSearchResult:
        """requestJob → poll → search 를 한번에 수행. 모든 페이지 결과 누적 반환.

        주의: page/per_page 파라미터는 응답 메타데이터 용도로만 유지 (기존 시그니처 호환).
        실제로는 내부에서 모든 페이지를 순회하며 누적.
        정액제 내에서는 requestJob 자체는 무료이므로 단일 호출에 1 Job 만 소모.
        """
        PopbillException = self._popbill_exc()

        # Step 1–2: Job 큐잉 + 완료대기
        try:
            job_id = self._request_job(bank_code, account_number, start_date, end_date)
            if not job_id:
                return BankSearchResult(ok=False, error="requestJob 응답 비어있음")
            self._wait_job(job_id, timeout_sec=90, poll_interval=1.5)
        except Exception as e:
            return BankSearchResult(ok=False, error=str(e))

        # Step 3: 결과 검색 — 모든 페이지 누적
        out: List[BankTxRow] = []
        cur_page = 1
        total = 0
        per = per_page
        MAX_PAGES = 40  # 최대 40 × 500 = 20,000건 안전장치

        while cur_page <= MAX_PAGES:
            try:
                svc = self._get_svc()
                # search(CorpNum, JobID, TradeType, SearchString, Page, PerPage, Order, UserID)
                # TradeType: 'A'=전체, 'I'=입금, 'O'=출금 / SearchString: '' 전체
                resp = svc.search(
                    self.corp_num, job_id, "A", "",
                    cur_page, per_page, order, self.user_id,
                )
            except PopbillException as pe:
                return BankSearchResult(ok=False, error=f"Popbill[{getattr(pe, 'code', '')}] search 실패: {getattr(pe, 'message', pe)}")
            except Exception as e2:
                return BankSearchResult(ok=False, error=f"search 오류: {e2}")

            rows_raw = _attr(resp, "list", "List") or []
            total = int(_attr(resp, "total", "Total") or total)
            per = int(_attr(resp, "perPage", "PerPage") or per)

            if not rows_raw:
                break

            for r in rows_raw:
                tid = _attr(r, "tid", "TID") or ""
                trans_dt = _attr(r, "trdt", "TrDT") or ""  # YYYYMMDDHHMMSS
                trans_date = (trans_dt or "")[:8]
                trans_time = (trans_dt or "")[8:14] if len(trans_dt or "") >= 14 else None
                in_amt = _attr(r, "accIn", "AccIn") or 0
                out_amt = _attr(r, "accOut", "AccOut") or 0
                balance = _attr(r, "balance", "Balance")

                out.append(BankTxRow(
                    tid=str(tid),
                    trans_date=trans_date,
                    trans_time=trans_time,
                    in_amount=_to_int(in_amt),
                    out_amount=_to_int(out_amt),
                    balance=_to_int(balance) if balance is not None else None,
                    remark1=_attr(r, "remark1", "Remark1"),
                    remark2=_attr(r, "remark2", "Remark2"),
                    remark3=_attr(r, "remark3", "Remark3"),
                    remark4=_attr(r, "remark4", "Remark4"),
                    raw={
                        "tid": tid, "trdt": trans_dt,
                        "accIn": in_amt, "accOut": out_amt, "balance": balance,
                        "job_id": job_id,
                    },
                ))

            if len(rows_raw) < per_page:
                break
            cur_page += 1

        return BankSearchResult(ok=True, rows=out, total=max(total, len(out)), per_page=per, page=1)

    def get_mgt_url(self) -> Optional[str]:
        PopbillException = self._popbill_exc()
        try:
            svc = self._get_svc()
            return svc.getBankAccountMgtURL(self.corp_num, self.user_id)
        except PopbillException as pe:
            logger.warning("getBankAccountMgtURL 실패: %s", pe)
            return None
        except Exception as e:
            logger.warning("getBankAccountMgtURL 예외: %s", e)
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
