"""CODEF 은행 거래내역 어댑터 — BaseBankProvider 구현체.

21분 자동 갱신 cron 이 Popbill 과 동일 인터페이스로 CODEF 도 호출하도록 함.
CODEF 는 connectedId 기반이라 한 번 인증 후 만료까지 자동.

보안 모델:
- fast_id / fast_pwd (마이데이터 비번) 은 메모리 통과만, DB 저장 X.
- connectedId 는 DB(CodefConnection) 에 저장 — 만료 전까지 재인증 불필요.
- 만료시 cron 은 graceful error 로 빠지고, 사장님이 외부연동 화면에서 1회 재인증.
"""
from __future__ import annotations

import logging
import re
from datetime import date, datetime
from typing import List, Optional

from sqlmodel import Session, select

from services.bank_sync_service import (
    BaseBankProvider,
    BankSearchResult,
    BankTxRow,
    BankAccountInfo,
)
from services.codef.codef_client import CodefClient
from services.codef.exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefAPIError,
)
from models import CodefConnection, BankAccount

log = logging.getLogger("codef.bank_provider")


def _safe_codef_amount(v) -> int:
    """CODEF 응답 금액 문자열 → int 안전 변환. 쉼표/공백/이상값 대응."""
    if v is None or v == "":
        return 0
    s = str(v).replace(",", "").strip()
    if not s:
        return 0
    try:
        return int(float(s))
    except (TypeError, ValueError):
        log.warning("amount parse fail: %r → 0", v)
        return 0


def _normalize_acct(s: str) -> str:
    return re.sub(r"\D", "", str(s or ""))


def _ymd(d) -> str:
    if d is None:
        return ""
    if isinstance(d, (date, datetime)):
        return d.strftime("%Y%m%d")
    return re.sub(r"\D", "", str(d))[:8]


class CodefBankProvider(BaseBankProvider):
    """CODEF 마이데이터 기반 거래내역 어댑터.

    routing: get_provider() 가 BANK_SYNC_PROVIDER=codef 일 때 활성.
    Popbill 과 달리 사업장별 connectedId 가 필요하므로 search() 호출시
    business_id 가 필수.
    """

    name = "codef"

    def __init__(self, engine=None):
        # 기본은 database.engine. 테스트는 SQLite in-memory engine 주입.
        if engine is None:
            from database import engine as default_engine
            engine = default_engine
        self._engine = engine
        # CodefClient 는 connectedId 단위 stateful 이 아니라 매 호출 새로 만들어도 OK.
        # 하지만 1 instance 재사용으로 SDK 초기화 오버헤드 감소.
        self._client = CodefClient()

    # ─── list_accounts / get_balance / get_mgt_url 미지원 ───
    # CODEF 는 마이데이터 인증 후 등록된 연결만 노출. 계좌 자동 발견은
    # CodefConnection 테이블이 가지므로 본 메서드들은 빈/None 응답.
    def list_accounts(self) -> List[BankAccountInfo]:
        return []

    def get_balance(self) -> Optional[float]:
        return None

    def get_mgt_url(self) -> Optional[str]:
        return None

    def check_account_validity(self, bank_code: str, account_number: str) -> dict:
        return {
            "ok": True,
            "note": "codef: connection-based (no separate validity check)",
        }

    def search(
        self,
        bank_code: str,
        account_number: str,
        start_date,
        end_date,
        order: str = "D",
        page: int = 1,
        per_page: int = 500,
        business_id: Optional[int] = None,
    ) -> BankSearchResult:
        if not business_id:
            return BankSearchResult(
                ok=False,
                error="CODEF provider requires business_id (per-business connectedId routing).",
            )

        norm_acct = _normalize_acct(account_number)

        # 1) 활성 connectedId 조회 + 매핑된 BankAccount 로 client_type (P/B) 결정
        with Session(self._engine) as s:
            conn = s.exec(
                select(CodefConnection).where(
                    CodefConnection.business_id == business_id,
                    CodefConnection.organization_type == "bank",
                    CodefConnection.organization_code == bank_code,
                    CodefConnection.status == "active",
                )
            ).first()

            if not conn or not conn.connected_id:
                return BankSearchResult(
                    ok=False,
                    error=(
                        f"CODEF 연결 없음 (bank={bank_code}, business={business_id}). "
                        "외부연동(CODEF) 화면에서 최초 1회 인증이 필요합니다."
                    ),
                )

            # BankAccount.account_type ('P' 개인 / 'C' 법인) 로 CODEF 경로 결정.
            # 매칭 row 없으면 'P' 기본.
            ba = s.exec(
                select(BankAccount).where(
                    BankAccount.business_id == business_id,
                    BankAccount.bank_code == bank_code,
                    BankAccount.account_number == account_number,
                )
            ).first()
            acct_type_raw = (ba.account_type if ba and ba.account_type else "P").upper()

        # P=개인, 그 외(C/B)=사업자
        is_corp = acct_type_raw in ("C", "B")
        path = (
            "/v1/kr/bank/b/account/transaction-list"
            if is_corp
            else "/v1/kr/bank/p/account/transaction-list"
        )

        params = {
            "connectedId": conn.connected_id,
            "organization": bank_code,
            "account": norm_acct,
            "startDate": _ymd(start_date),
            "endDate": _ymd(end_date),
            "orderBy": "0" if order == "D" else "1",
            "inquiryType": "1",
        }

        try:
            result = self._client.request_product(path, params)
        except CodefAuthExpired as e:
            # cron 전체를 죽이지 않고 graceful 반환. 호출자(refresh-all)는
            # acc.last_sync_status='failed' 로 기록 → UI/알림이 사장님 재인증 유도.
            return BankSearchResult(
                ok=False,
                error=f"CODEF 인증 만료 ({e.code}): 사장님 재인증 필요",
            )
        except CodefAdditionalAuth as e:
            return BankSearchResult(
                ok=False,
                error=f"CODEF 추가본인확인 요구 ({e.method}): 외부연동 화면에서 처리 필요",
            )
        except CodefAPIError as e:
            return BankSearchResult(
                ok=False,
                error=f"CODEF API 오류 [{e.code}]: {e.message}",
            )
        except Exception as e:  # noqa: BLE001
            log.exception("CODEF bank search failed")
            return BankSearchResult(ok=False, error=f"CODEF 호출 실패: {e}")

        # CODEF 응답 — result.rows 는 list. 각 entry 의 resTrHistoryList 가 실 거래.
        raw_rows = result.rows if hasattr(result, "rows") else []
        history: list = []
        if isinstance(raw_rows, dict):
            history = raw_rows.get("resTrHistoryList", [])
        elif isinstance(raw_rows, list):
            for r in raw_rows:
                if isinstance(r, dict):
                    history.extend(r.get("resTrHistoryList", []))

        rows: List[BankTxRow] = []
        for r in history:
            trd = r.get("resAccountTrDate", "")
            trt = r.get("resAccountTrTime", "")
            if not trd or len(trd) != 8:
                continue
            in_amt = _safe_codef_amount(r.get("resAccountIn"))
            out_amt = _safe_codef_amount(r.get("resAccountOut"))
            balance = _safe_codef_amount(r.get("resAfterTranBalance"))

            # CODEF 필드 매핑 (popbill 과 의미 일치):
            #   resAccountDesc3 (거래상대방)   → remark1 (메인 표시 + 분류 키)
            #   resAccountDesc2 (거래 매체)    → remark2 (보조 표시)
            #   resAccountDesc4 (지점/메모)    → remark3
            #   resAccountDesc1 (대부분 비어)  → remark4
            remark1 = (r.get("resAccountDesc3", "") or "")[:200]
            remark2 = (r.get("resAccountDesc2", "") or "")[:200]
            remark3 = (r.get("resAccountDesc4", "") or "")[:200]
            remark4 = (r.get("resAccountDesc1", "") or "")[:200]

            # CODEF 거래에는 tid 가 없어 (date, time, in, out, balance, remark1) 조합 unique key.
            tid = f"codef:{trd}{trt}:{in_amt}:{out_amt}:{balance}:{remark1[:30]}"
            rows.append(
                BankTxRow(
                    tid=tid,
                    trans_date=trd,
                    trans_time=(trt or None),
                    in_amount=in_amt,
                    out_amount=out_amt,
                    balance=balance,
                    remark1=remark1 or None,
                    remark2=remark2 or None,
                    remark3=remark3 or None,
                    remark4=remark4 or None,
                    raw=r,
                )
            )

        return BankSearchResult(
            ok=True,
            rows=rows,
            total=len(rows),
            per_page=per_page,
            page=page,
        )
