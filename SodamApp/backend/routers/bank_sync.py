"""은행 계좌 거래내역 자동 수집 API (팝빌 EasyFinBank 래핑).

- GET  /api/bank-sync/status           프로바이더/포인트/등록계좌 수 요약
- GET  /api/bank-sync/accounts         등록 계좌 리스트 (DB)
- POST /api/bank-sync/accounts/sync    팝빌에서 계좌 리스트 → DB 동기화 (upsert)
- POST /api/bank-sync/accounts/{id}/pull   거래내역 수집 { start_date, end_date }
- GET  /api/bank-sync/transactions     거래내역 리스트 (account_id/기간/분류 필터)
- PATCH /api/bank-sync/transactions/{id}   분류/메모/vendor 수동 업데이트
- POST /api/bank-sync/transactions/auto-classify   규칙기반 일괄 분류
- GET  /api/bank-sync/mgt-url          팝빌 계좌관리 팝업 URL (1회용)

보안:
- admin / superadmin 만 접근. superadmin은 X-View-As-Business 헤더 필수
- 응답시 account_number 마스킹 (`110-357-7****`)
"""
from __future__ import annotations

import json
import logging
import os
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import select, or_

from collections import Counter, defaultdict

from models import (
    User, BankAccount, BankTransaction, Vendor, DailyExpense,
    CardPayment, PayPayment, DeliveryRevenue, CardSalesApproval,
    MobilePgConfig,
)
from routers.auth import get_admin_user
from services.database_service import DatabaseService
from services.bank_sync_service import (
    BANK_NAMES,
    BankAccountInfo,
    BankSearchResult,
    get_provider,
)

logger = logging.getLogger("sodam.bank_sync")

router = APIRouter(prefix="/bank-sync", tags=["bank-sync"])


# ============================================================
# Helpers
# ============================================================

def _resolve_bid(admin: User, x_view_as_business: Optional[int]) -> int:
    bid = admin.business_id
    if admin.role == "superadmin" and x_view_as_business is not None:
        bid = x_view_as_business
    if not bid:
        raise HTTPException(
            status_code=400,
            detail="사업장 정보가 없습니다. (SuperAdmin은 먼저 대상 사업장을 선택하세요.)",
        )
    return bid


def _mask_account(num: Optional[str]) -> str:
    if not num:
        return ""
    digits = re.sub(r"\D", "", num)
    if len(digits) <= 4:
        return "*" * len(digits)
    # 마지막 4자리 마스킹, 앞은 2그룹 표시
    if len(digits) >= 10:
        return f"{digits[:3]}-{digits[3:6]}-{digits[6]}{'*' * (len(digits) - 7 - 4)}****"
    return digits[:-4] + "****"


def _parse_date(v) -> date:
    if isinstance(v, date):
        return v
    s = str(v or "").replace("-", "").replace(".", "").strip()
    if len(s) != 8:
        raise HTTPException(status_code=400, detail=f"날짜 형식 오류: {v} (YYYY-MM-DD 또는 YYYYMMDD)")
    return date(int(s[:4]), int(s[4:6]), int(s[6:8]))


def _safe_codef_amount(v) -> int:
    """CODEF 응답의 금액 문자열을 int 로 변환. 쉼표/공백/비정상값에 안전.

    실패 시 0 으로 fallback 하여 한 건의 파싱 오류가 전체 수집을 죽이지 않게 한다.
    """
    if v is None or v == "":
        return 0
    s = str(v).replace(",", "").strip()
    if not s:
        return 0
    try:
        return int(float(s))
    except (TypeError, ValueError):
        logging.getLogger("codef.bank").warning("amount parse fail: %r → 0", v)
        return 0


def _acc_to_dict(acc: BankAccount) -> dict:
    return {
        "id": acc.id,
        "business_id": acc.business_id,
        "bank_code": acc.bank_code,
        "bank_name": acc.bank_name,
        "account_number_masked": _mask_account(acc.account_number),
        "account_type": acc.account_type,
        "alias": acc.alias,
        "memo": acc.memo,
        "popbill_use_start": acc.popbill_use_start.isoformat() if acc.popbill_use_start else None,
        "popbill_use_end": acc.popbill_use_end.isoformat() if acc.popbill_use_end else None,
        "next_billing_date": acc.next_billing_date.isoformat() if acc.next_billing_date else None,
        "popbill_state": acc.popbill_state,
        "last_sync_at": acc.last_sync_at.isoformat() if acc.last_sync_at else None,
        "last_sync_status": acc.last_sync_status,
        "last_sync_error": acc.last_sync_error,
        "is_active": acc.is_active,
        "created_at": acc.created_at.isoformat() if acc.created_at else None,
    }


def _tx_to_dict(tx: BankTransaction, acc: Optional[BankAccount] = None) -> dict:
    return {
        "id": tx.id,
        "account_id": tx.account_id,
        "account_alias": acc.alias if acc else None,
        "account_bank": acc.bank_name if acc else None,
        "tid": tx.tid,
        "trans_date": tx.trans_date.isoformat() if tx.trans_date else None,
        "trans_time": tx.trans_time,
        "trans_dt": tx.trans_dt.isoformat() if tx.trans_dt else None,
        "in_amount": tx.in_amount,
        "out_amount": tx.out_amount,
        "balance": tx.balance,
        "remark1": tx.remark1,
        "remark2": tx.remark2,
        "remark3": tx.remark3,
        "remark4": tx.remark4,
        "classified_as": tx.classified_as,
        "classified_by": tx.classified_by,
        "classified_at": tx.classified_at.isoformat() if tx.classified_at else None,
        "linked_revenue_id": tx.linked_revenue_id,
        "linked_expense_id": tx.linked_expense_id,
        "linked_daily_id": tx.linked_daily_id,
        "linked_card_payment_id": tx.linked_card_payment_id,
        "linked_pay_payment_id": tx.linked_pay_payment_id,
        "linked_delivery_revenue_id": tx.linked_delivery_revenue_id,
        "vendor_id": tx.vendor_id,
        "user_memo": tx.user_memo,
    }


def _ymd_to_date(ymd: Optional[str]) -> Optional[date]:
    if not ymd:
        return None
    s = re.sub(r"\D", "", str(ymd))
    if len(s) != 8:
        return None
    try:
        return date(int(s[:4]), int(s[4:6]), int(s[6:8]))
    except (ValueError, TypeError):
        return None


# ============================================================
# Request models
# ============================================================

class PullIn(BaseModel):
    start_date: Optional[str] = Field(None, description="YYYY-MM-DD. 미지정시 today-7일")
    end_date: Optional[str] = Field(None, description="YYYY-MM-DD. 미지정시 today")
    per_page: int = Field(default=500, ge=1, le=1000)


class ManualAccountIn(BaseModel):
    bank_code: str = Field(..., description="팝빌 은행코드 (예: '0088' 신한)")
    account_number: str = Field(..., description="계좌번호 (하이픈 허용, 자동 제거)")
    account_type: str = Field(default="P", description="'P' 개인 / 'C' 법인")
    alias: Optional[str] = Field(None, description="별칭 (예: '소단신한은행')")
    memo: Optional[str] = None
    skip_verify: bool = Field(default=False, description="getBankAccountInfo 검증 스킵 (권한 이슈 시)")


class TxUpdateIn(BaseModel):
    classified_as: Optional[str] = Field(
        None,
        description=(
            "revenue/expense/purchase/transfer/excluded/unclassified/"
            "card_settlement/pay_settlement/delivery_settlement/mobile_settlement/"
            "cash_revenue/owner_deposit/loan_in/other_income"
        ),
    )
    vendor_id: Optional[int] = None
    user_memo: Optional[str] = None


class AutoClassifyIn(BaseModel):
    account_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    only_unclassified: bool = True


# ============================================================
# Endpoints
# ============================================================

@router.get("/status")
def get_status(admin: User = Depends(get_admin_user)):
    provider = get_provider()
    try:
        balance = provider.get_balance()
    except Exception as e:
        balance = None
        logger.warning("포인트 잔액 조회 실패: %s", e)

    is_stub = provider.name == "stub"
    is_test = bool(getattr(provider, "is_test", False))

    if is_stub:
        note = (
            "⚠️ STUB 모드. 실제 팝빌 연결 없이 더미 데이터 반환. "
            "POPBILL_LINK_ID/SECRET_KEY 설정 시 자동으로 popbill 활성."
        )
    elif is_test:
        note = (
            "🧪 팝빌 TEST 환경 연결. test.popbill.com 의 시뮬레이션 데이터로 동작합니다. "
            "검증 완료 후 LIVE 활성화 시 POPBILL_BANK_IS_TEST=false 로 토글하세요."
        )
    else:
        note = "✅ 팝빌 LIVE 환경 연결 (정액제 기반, 실서비스)."

    return {
        "active": provider.name,
        "is_stub": is_stub,
        "is_test": is_test,
        "balance_point": balance,
        "note": note,
        "bank_names": BANK_NAMES,
    }


@router.get("/diagnose")
def diagnose(
    account_id: Optional[int] = Query(None, description="requestJob/getJobState 테스트에 쓸 DB 계좌 ID"),
    env: str = Query("live", description="live | test | both — 진단할 팝빌 환경"),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """팝빌 연결 진단 — 각 API 호출을 개별로 실행하고 결과/에러를 JSON 으로 반환.

    502/500 에러가 Cloudflare 에 가려져도 이 엔드포인트는 항상 200 으로 응답해
    각 단계의 성공/실패를 클라이언트 UI 에 노출시킴.

    account_id 가 주어지면 해당 계좌에 대해 requestJob + getJobState 1회 테스트
    추가 수행 (폴링 없이 즉시 반환, CF 타임아웃 회피).

    env='both' 로 호출하면 live / test 양쪽 환경 모두에서 동일 체크를 실행해
    나란히 비교 결과 반환.
    """
    import os
    import traceback
    from datetime import date, timedelta

    from services.bank_sync_service import PopbillEasyFinBankProvider, _attr

    bank_test_raw = os.getenv("POPBILL_BANK_IS_TEST", "")
    fax_test_raw = os.getenv("POPBILL_IS_TEST", "")
    if bank_test_raw.strip() != "":
        is_test_source = "POPBILL_BANK_IS_TEST"
    elif fax_test_raw.strip() != "":
        is_test_source = "POPBILL_IS_TEST (fallback)"
    else:
        is_test_source = "default (false=LIVE)"

    result = {
        "env": {
            "POPBILL_LINK_ID": bool(os.getenv("POPBILL_LINK_ID", "").strip()),
            "POPBILL_SECRET_KEY_set": bool(os.getenv("POPBILL_SECRET_KEY", "").strip()),
            "POPBILL_SECRET_KEY_len": len(os.getenv("POPBILL_SECRET_KEY", "").strip()),
            "POPBILL_CORP_NUM": os.getenv("POPBILL_CORP_NUM", ""),
            "POPBILL_USER_ID": os.getenv("POPBILL_USER_ID", ""),
            "POPBILL_IS_TEST": fax_test_raw,
            "POPBILL_BANK_IS_TEST": bank_test_raw,
            "BANK_SYNC_PROVIDER": os.getenv("BANK_SYNC_PROVIDER", ""),
            "is_test_source": is_test_source,
        },
        "provider": None,
        "checks": [],
    }

    # 기본 (default) provider — env 기반
    try:
        default_provider = get_provider()
        result["provider"] = default_provider.name
        result["is_test_mode"] = getattr(default_provider, "is_test", None)
    except Exception as e:
        result["provider_init_error"] = f"{type(e).__name__}: {e}"
        return result

    # 어떤 환경들을 테스트할지 결정
    targets: List[tuple] = []  # [(label, provider)]
    if env == "test":
        try:
            targets.append(("test", PopbillEasyFinBankProvider(force_is_test=True)))
        except Exception as e:
            result["provider_init_error"] = f"test provider init 실패: {e}"
            return result
    elif env == "both":
        try:
            targets.append(("live", PopbillEasyFinBankProvider(force_is_test=False)))
            targets.append(("test", PopbillEasyFinBankProvider(force_is_test=True)))
        except Exception as e:
            result["provider_init_error"] = f"both provider init 실패: {e}"
            return result
    else:  # "live" 또는 미지정 — 기본 provider 사용 (env 반영)
        targets.append(("", default_provider))

    # 계좌 정보 미리 조회 (account_id 기준)
    target_account: Optional[BankAccount] = None
    if account_id is not None:
        bid = _resolve_bid(admin, x_view_as_business)
        svc = DatabaseService()
        try:
            acc = svc.session.get(BankAccount, account_id)
            if acc and acc.business_id == bid:
                target_account = acc
        finally:
            svc.close()
        if target_account is None:
            result["checks"].append({
                "name": "requestJob",
                "ok": False,
                "error_type": "LookupError",
                "error": f"account_id={account_id} 를 찾을 수 없음",
            })

    for label, provider in targets:
        prefix = f"[{label}] " if label else ""

        def _run(name: str, fn):
            step = {"name": f"{prefix}{name}", "env_label": label or "default", "ok": False}
            try:
                res = fn()
                step["result"] = res
                # 반환 dict 안에 ok=False 또는 skipped 가 있으면 외부적으로도 실패로 표시
                if isinstance(res, dict):
                    if res.get("ok") is False:
                        step["ok"] = False
                        step["error_type"] = "PopbillError"
                        msg_parts = []
                        if res.get("code") is not None:
                            msg_parts.append(f"[{res['code']}]")
                        if res.get("message"):
                            msg_parts.append(str(res["message"]))
                        step["error"] = " ".join(msg_parts) or "ok=False (상세 없음)"
                    elif "skipped" in res:
                        step["ok"] = False
                        step["error_type"] = "Skipped"
                        step["error"] = str(res["skipped"])
                    else:
                        step["ok"] = True
                else:
                    step["ok"] = True
            except Exception as e:
                step["error_type"] = type(e).__name__
                step["error"] = str(e)
                step["traceback"] = traceback.format_exc().splitlines()[-5:]
            result["checks"].append(step)

        _run("getBalance", lambda p=provider: p.get_balance())
        _run("getBankAccountMgtURL", lambda p=provider: p.get_mgt_url())
        _run("listBankAccount", lambda p=provider: [
            {
                "bank_code": a.bank_code, "bank_name": a.bank_name,
                "account_number": a.account_number, "alias": a.alias,
                "state": a.state,
                "use_start": a.use_period_start, "use_end": a.use_period_end,
            }
            for a in p.list_accounts()
        ])

        if target_account is not None and isinstance(provider, PopbillEasyFinBankProvider):
            _run("getBankAccountInfo",
                 lambda p=provider: p.check_account_validity(target_account.bank_code, target_account.account_number))

            job_id_holder = {"job_id": None}

            def _test_request_job(p=provider):
                sdate = date.today() - timedelta(days=7)
                edate = date.today()
                jid = p._request_job(target_account.bank_code, target_account.account_number, sdate, edate)
                job_id_holder["job_id"] = jid
                return {"job_id": jid, "start_date": sdate.isoformat(), "end_date": edate.isoformat()}
            _run("requestJob", _test_request_job)

            def _test_job_state(p=provider):
                if not job_id_holder["job_id"]:
                    return {"skipped": "requestJob 실패로 스킵"}
                svc2 = p._get_svc()
                r = svc2.getJobState(p.corp_num, job_id_holder["job_id"], p.user_id)
                return {
                    "jobState": _attr(r, "jobState", "JobState"),
                    "errorCode": _attr(r, "errorCode", "ErrorCode"),
                    "errorReason": _attr(r, "errorReason", "ErrorReason"),
                    "collectCount": _attr(r, "collectCount", "CollectCount"),
                    "resultCount": _attr(r, "resultCount", "ResultCount"),
                    "regDT": _attr(r, "regDT", "RegDT"),
                }
            _run("getJobState (1회)", _test_job_state)

    return result


@router.get("/mgt-url")
def get_mgt_url(admin: User = Depends(get_admin_user)):
    """팝빌 계좌조회 관리 페이지 팝업 URL (로그인 스킵된 1회용 링크)."""
    provider = get_provider()
    try:
        url = provider.get_mgt_url()
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"URL 조회 실패: {e}")


@router.get("/accounts")
def list_accounts(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        rows = service.session.exec(
            select(BankAccount).where(BankAccount.business_id == bid).order_by(BankAccount.id)
        ).all()
        return [_acc_to_dict(r) for r in rows]
    finally:
        service.close()


@router.post("/accounts/manual")
def add_account_manual(
    body: ManualAccountIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """계좌를 수동 입력해 DB 에 등록.

    - listBankAccount 권한 이슈 우회용
    - 기본: getBankAccountInfo 로 팝빌에서 계좌 존재여부 검증 (실패해도 skip_verify 로 강제 등록 가능)
    - 검증 성공 시 반환된 계좌명을 alias 기본값으로 사용
    """
    from services.bank_sync_service import PopbillEasyFinBankProvider, BANK_NAMES

    bid = _resolve_bid(admin, x_view_as_business)
    bank_code = str(body.bank_code).strip()
    acc_num = re.sub(r"\D", "", str(body.account_number))
    if not bank_code or not acc_num:
        raise HTTPException(status_code=400, detail="은행코드와 계좌번호를 입력하세요.")
    if bank_code not in BANK_NAMES:
        raise HTTPException(status_code=400, detail=f"알 수 없는 은행코드: {bank_code}")

    provider = get_provider()

    # 검증 단계 (skip_verify=False 일 때만)
    verify_result = None
    if not body.skip_verify and isinstance(provider, PopbillEasyFinBankProvider):
        verify_result = provider.check_account_validity(bank_code, acc_num)
        if not verify_result.get("ok"):
            raise HTTPException(
                status_code=422,
                detail={
                    "message": "계좌 검증 실패",
                    "popbill": verify_result,
                    "hint": "권한 이슈가 의심되면 skip_verify=true 로 강제 등록 가능",
                },
            )

    service = DatabaseService()
    try:
        existing = service.session.exec(
            select(BankAccount).where(
                BankAccount.business_id == bid,
                BankAccount.bank_code == bank_code,
                BankAccount.account_number == acc_num,
            )
        ).first()
        if existing:
            # 이미 있으면 메타만 업데이트
            if body.alias:
                existing.alias = body.alias
            if body.memo is not None:
                existing.memo = body.memo
            if verify_result and verify_result.get("account_name") and not existing.alias:
                existing.alias = verify_result["account_name"]
            existing.updated_at = datetime.now()
            if verify_result and verify_result.get("flat_rate_state"):
                existing.popbill_state = str(verify_result["flat_rate_state"])
            service.session.add(existing)
            service.session.commit()
            service.session.refresh(existing)
            return {"created": False, "updated": True, "account": _acc_to_dict(existing), "verify": verify_result}

        alias = body.alias
        if not alias and verify_result and verify_result.get("account_name"):
            alias = verify_result["account_name"]

        acc = BankAccount(
            business_id=bid,
            bank_code=bank_code,
            bank_name=BANK_NAMES.get(bank_code, bank_code),
            account_number=acc_num,
            account_type=body.account_type or "P",
            alias=alias,
            memo=body.memo,
            popbill_state=(str(verify_result["flat_rate_state"]) if verify_result and verify_result.get("flat_rate_state") else "active"),
        )
        service.session.add(acc)
        service.session.commit()
        service.session.refresh(acc)
        return {"created": True, "updated": False, "account": _acc_to_dict(acc), "verify": verify_result}
    finally:
        service.close()


@router.post("/accounts/sync")
def sync_accounts_from_popbill(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """팝빌에 등록된 계좌 리스트를 DB로 upsert.

    기준: (business_id, bank_code, account_number). 기존 레코드는 메타 업데이트.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    provider = get_provider()

    try:
        popbill_accounts: List[BankAccountInfo] = provider.list_accounts()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"팝빌 계좌 목록 조회 실패: {e}")

    service = DatabaseService()
    created = 0
    updated = 0
    try:
        for info in popbill_accounts:
            acc = service.session.exec(
                select(BankAccount).where(
                    BankAccount.business_id == bid,
                    BankAccount.bank_code == info.bank_code,
                    BankAccount.account_number == info.account_number,
                )
            ).first()
            if acc is None:
                acc = BankAccount(
                    business_id=bid,
                    bank_code=info.bank_code,
                    bank_name=info.bank_name,
                    account_number=info.account_number,
                    account_type=info.account_type or "P",
                    alias=info.alias,
                    memo=info.memo,
                    popbill_state=info.state or "active",
                    popbill_use_start=_ymd_to_date(info.use_period_start),
                    popbill_use_end=_ymd_to_date(info.use_period_end),
                    next_billing_date=_ymd_to_date(info.next_billing_date),
                )
                service.session.add(acc)
                created += 1
            else:
                acc.bank_name = info.bank_name or acc.bank_name
                acc.account_type = info.account_type or acc.account_type
                if info.alias:
                    acc.alias = info.alias
                if info.memo is not None:
                    acc.memo = info.memo
                acc.popbill_state = info.state or acc.popbill_state
                acc.popbill_use_start = _ymd_to_date(info.use_period_start) or acc.popbill_use_start
                acc.popbill_use_end = _ymd_to_date(info.use_period_end) or acc.popbill_use_end
                acc.next_billing_date = _ymd_to_date(info.next_billing_date) or acc.next_billing_date
                acc.updated_at = datetime.now()
                service.session.add(acc)
                updated += 1

        service.session.commit()
        rows = service.session.exec(
            select(BankAccount).where(BankAccount.business_id == bid).order_by(BankAccount.id)
        ).all()
        return {
            "created": created,
            "updated": updated,
            "total_synced": len(popbill_accounts),
            "accounts": [_acc_to_dict(r) for r in rows],
        }
    finally:
        service.close()


def _do_pull(
    service: DatabaseService,
    acc: BankAccount,
    business_id: int,
    start_d: date,
    end_d: date,
    per_page: int = 500,
) -> dict:
    """단일 계좌의 거래내역 pull + 자동 분류. /pull, /refresh-all 공용.

    호출자 책임: commit / rollback / HTTP 상태코드 매핑.
    실패시 RuntimeError raise (acc.last_sync_status 는 호출자가 갱신).
    """
    provider = get_provider()
    new_txs: List[BankTransaction] = []
    inserted = 0
    duplicated = 0

    res: BankSearchResult = provider.search(
        bank_code=acc.bank_code,
        account_number=acc.account_number,
        start_date=start_d,
        end_date=end_d,
        order="A",
        page=1,
        per_page=per_page,
        business_id=business_id,  # CODEF provider 의 connectedId routing 에 필요. Popbill 은 ignore.
    )
    if not res.ok:
        raise RuntimeError(res.error or "팝빌 조회 실패")

    total_fetched = len(res.rows)
    for r in res.rows:
        existing = service.session.exec(
            select(BankTransaction).where(
                BankTransaction.account_id == acc.id,
                BankTransaction.tid == r.tid,
            )
        ).first()
        if existing:
            duplicated += 1
            continue

        # 시각+금액 기반 2차 중복 차단 — 같은 거래를 다른 provider/등록(CODEF·팝빌)이
        # 서로 다른 tid 로 가져오는 경우 tid 체크만으로는 못 거른다. 같은 계좌·같은 초·
        # 같은 입출금액이면 동일 이체로 간주(동시에 두 곳 이체 불가). trans_time(HHMMSS)
        # 이 있을 때만 적용 — 없으면 tid 체크로 폴백.
        if r.trans_time:
            td_dup = _ymd_to_date(r.trans_date) or start_d
            dup = service.session.exec(
                select(BankTransaction).where(
                    BankTransaction.account_id == acc.id,
                    BankTransaction.trans_date == td_dup,
                    BankTransaction.trans_time == r.trans_time,
                    BankTransaction.in_amount == r.in_amount,
                    BankTransaction.out_amount == r.out_amount,
                )
            ).first()
            if dup:
                duplicated += 1
                continue

        td = _ymd_to_date(r.trans_date) or start_d
        tdt = None
        if r.trans_date and r.trans_time and len(r.trans_time) == 6:
            try:
                tdt = datetime(
                    td.year, td.month, td.day,
                    int(r.trans_time[:2]), int(r.trans_time[2:4]), int(r.trans_time[4:6]),
                )
            except (ValueError, TypeError):
                tdt = None

        tx = BankTransaction(
            business_id=business_id,
            account_id=acc.id,
            tid=r.tid,
            trans_date=td,
            trans_time=r.trans_time,
            trans_dt=tdt,
            in_amount=r.in_amount,
            out_amount=r.out_amount,
            balance=r.balance,
            remark1=r.remark1,
            remark2=r.remark2,
            remark3=r.remark3,
            remark4=r.remark4,
            raw_json=json.dumps(r.raw, ensure_ascii=False) if r.raw else None,
        )
        service.session.add(tx)
        new_txs.append(tx)
        inserted += 1

    service.session.flush()  # tx.id 확보
    classify_counts = _classify_txs(service, business_id, new_txs, only_unclassified=True)

    acc.last_sync_at = datetime.now()
    acc.last_sync_status = "success"
    acc.last_sync_error = None
    service.session.add(acc)

    return {
        "account_id": acc.id,
        "start_date": start_d.isoformat(),
        "end_date": end_d.isoformat(),
        "total_fetched": total_fetched,
        "inserted": inserted,
        "duplicated": duplicated,
        "auto_classified": classify_counts,
    }


@router.post("/accounts/{account_id}/pull")
def pull_transactions(
    account_id: int,
    body: PullIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """지정 계좌의 거래내역을 팝빌에서 가져와 BankTransaction 에 upsert + 자동 분류."""
    bid = _resolve_bid(admin, x_view_as_business)

    start_d = _parse_date(body.start_date) if body.start_date else date.today() - timedelta(days=7)
    end_d = _parse_date(body.end_date) if body.end_date else date.today()
    if end_d < start_d:
        raise HTTPException(status_code=400, detail="end_date 가 start_date 보다 이전입니다.")
    if (end_d - start_d).days > 90:
        raise HTTPException(status_code=400, detail="조회 기간은 최대 90일까지 가능합니다.")

    service = DatabaseService()
    try:
        acc = service.session.get(BankAccount, account_id)
        if not acc or acc.business_id != bid:
            raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")

        try:
            result = _do_pull(service, acc, bid, start_d, end_d, body.per_page)
            service.session.commit()
            return result
        except RuntimeError as e:
            service.session.rollback()
            acc.last_sync_status = "failed"
            acc.last_sync_error = str(e)
            acc.last_sync_at = datetime.now()
            service.session.add(acc)
            service.session.commit()
            raise HTTPException(status_code=502, detail=f"거래내역 조회 실패: {e}")
        except Exception as e:
            service.session.rollback()
            acc.last_sync_status = "failed"
            acc.last_sync_error = str(e)
            acc.last_sync_at = datetime.now()
            service.session.add(acc)
            service.session.commit()
            raise HTTPException(status_code=500, detail=f"거래내역 적재 오류: {e}")
    finally:
        service.close()


@router.post("/refresh-all")
def refresh_all(
    days: int = Query(7, ge=1, le=30, description="조회 기간 (일). 기본 7일"),
    skip_recent_minutes: int = Query(
        20, ge=0, le=120,
        description="최근 X분 내 갱신된 계좌는 스킵 (정기 호출 중복 방지). 기본 20분"
    ),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """현재 사업장의 모든 활성 계좌를 일괄 갱신 + 자동 분류.

    21분 단위 자동 갱신 (프론트엔드 setInterval / 외부 cron) 등 정기 호출용.
    skip_recent_minutes 내에 갱신된 계좌는 자동 스킵 → 중복 호출 안전.
    각 계좌 단위로 try/except 하여 한 계좌 실패가 전체를 막지 않음.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    end_d = date.today()
    start_d = end_d - timedelta(days=days)
    skip_threshold = datetime.now() - timedelta(minutes=skip_recent_minutes)

    service = DatabaseService()
    try:
        accs = service.session.exec(
            select(BankAccount).where(
                BankAccount.business_id == bid,
                BankAccount.is_active == True,  # noqa: E712
            ).order_by(BankAccount.id)
        ).all()

        results = []
        for acc in accs:
            if acc.last_sync_at and acc.last_sync_at > skip_threshold:
                results.append({
                    "account_id": acc.id,
                    "status": "skipped",
                    "reason": f"{skip_recent_minutes}분 내 갱신됨 (last_sync_at={acc.last_sync_at.isoformat()})",
                })
                continue
            try:
                r = _do_pull(service, acc, bid, start_d, end_d, 500)
                service.session.commit()
                results.append({"status": "ok", **r})
            except Exception as e:
                service.session.rollback()
                acc.last_sync_status = "failed"
                acc.last_sync_error = str(e)
                acc.last_sync_at = datetime.now()
                service.session.add(acc)
                service.session.commit()
                results.append({"account_id": acc.id, "status": "failed", "error": str(e)})

        total_inserted = sum(r.get("inserted", 0) for r in results if r.get("status") == "ok")

        def _sum_classified(r):
            ac = r.get("auto_classified") or {}
            return sum(v for k, v in ac.items() if k != "skip")

        total_classified = sum(_sum_classified(r) for r in results if r.get("status") == "ok")
        return {
            "ran_at": datetime.now().isoformat(),
            "days": days,
            "total_accounts": len(accs),
            "ok": sum(1 for r in results if r.get("status") == "ok"),
            "skipped": sum(1 for r in results if r.get("status") == "skipped"),
            "failed": sum(1 for r in results if r.get("status") == "failed"),
            "total_inserted": total_inserted,
            "total_classified": total_classified,
            "results": results,
        }
    finally:
        service.close()


@router.get("/transactions")
def list_transactions(
    account_id: Optional[int] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    classified_as: Optional[str] = Query(
        None,
        description=(
            "unclassified/revenue/expense/purchase/transfer/excluded/"
            "card_settlement/pay_settlement/delivery_settlement/mobile_settlement/"
            "cash_revenue/owner_deposit/loan_in/other_income"
        ),
    ),
    direction: Optional[str] = Query(None, description="in / out / all"),
    q: Optional[str] = Query(None, description="remark1 부분검색"),
    source: Optional[str] = Query(None, description="codef | popbill — 거래 출처 필터 (tid prefix 기반)"),
    limit: int = Query(200, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        stmt = select(BankTransaction).where(BankTransaction.business_id == bid)
        if account_id:
            stmt = stmt.where(BankTransaction.account_id == account_id)
        if start_date:
            sd = _parse_date(start_date)
            stmt = stmt.where(BankTransaction.trans_date >= sd)
        if end_date:
            ed = _parse_date(end_date)
            stmt = stmt.where(BankTransaction.trans_date <= ed)
        if classified_as:
            stmt = stmt.where(BankTransaction.classified_as == classified_as)
        if source == "codef":
            stmt = stmt.where(BankTransaction.tid.like("codef:%"))
        elif source == "popbill":
            stmt = stmt.where(~BankTransaction.tid.like("codef:%"))
        if direction == "in":
            stmt = stmt.where(BankTransaction.in_amount > 0)
        elif direction == "out":
            stmt = stmt.where(BankTransaction.out_amount > 0)
        if q:
            kw = f"%{q}%"
            stmt = stmt.where(or_(
                BankTransaction.remark1.ilike(kw),
                BankTransaction.remark2.ilike(kw),
                BankTransaction.remark3.ilike(kw),
            ))
        stmt = stmt.order_by(BankTransaction.trans_date.desc(), BankTransaction.id.desc())
        total_stmt = stmt
        rows = service.session.exec(stmt.offset(offset).limit(limit)).all()
        # total count (간단히 len으로 — 오프셋 쿼리 분리하면 성능↑. 일단 200건 기준 OK)
        total_rows = service.session.exec(total_stmt).all()
        total = len(total_rows)

        # 계좌 정보 맵핑
        acc_ids = {r.account_id for r in rows}
        acc_map = {}
        if acc_ids:
            accs = service.session.exec(
                select(BankAccount).where(BankAccount.id.in_(acc_ids))
            ).all()
            acc_map = {a.id: a for a in accs}

        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "items": [_tx_to_dict(r, acc_map.get(r.account_id)) for r in rows],
        }
    finally:
        service.close()


@router.patch("/transactions/{tx_id}")
def update_transaction(
    tx_id: int,
    body: TxUpdateIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        tx = service.session.get(BankTransaction, tx_id)
        if not tx or tx.business_id != bid:
            raise HTTPException(status_code=404, detail="거래내역을 찾을 수 없습니다.")

        if body.classified_as is not None:
            valid = {
                "unclassified", "revenue", "expense", "purchase", "transfer", "excluded",
                "card_settlement", "pay_settlement", "delivery_settlement", "mobile_settlement",
                "cash_revenue", "owner_deposit", "loan_in", "other_income",
            }
            if body.classified_as not in valid:
                raise HTTPException(status_code=400, detail=f"classified_as 값 오류: {body.classified_as}")
            tx.classified_as = body.classified_as
            tx.classified_by = "manual"
            tx.classified_at = datetime.now()

        if body.vendor_id is not None:
            if body.vendor_id == 0:
                tx.vendor_id = None
            else:
                v = service.session.get(Vendor, body.vendor_id)
                if not v or (v.business_id and v.business_id != bid):
                    raise HTTPException(status_code=400, detail="벤더를 찾을 수 없습니다.")
                tx.vendor_id = body.vendor_id

        if body.user_memo is not None:
            tx.user_memo = body.user_memo

        # revenue/expense 자동 링크 생성
        _materialize_link(service, tx)

        service.session.add(tx)
        service.session.commit()
        service.session.refresh(tx)

        acc = service.session.get(BankAccount, tx.account_id)
        return _tx_to_dict(tx, acc)
    finally:
        service.close()


def _materialize_link(service: DatabaseService, tx: BankTransaction) -> None:
    """tx.classified_as 에 맞춰 DailyExpense / CardPayment / PayPayment / DeliveryRevenue 동기화.

    - revenue: 입금액 → DailyExpense (미매칭 입금이 수동 revenue 분류된 경우만 — 카드/페이/배달은 settlement 로 빠짐)
    - expense/purchase: 출금액 → DailyExpense
    - card_settlement: CardPayment 매칭 또는 생성 (DailyExpense 미생성 — 매출 중복 방지)
    - pay_settlement: PayPayment 생성 (매출 원본 없으므로 항상 신규)
    - delivery_settlement: DeliveryRevenue 월별 매칭 또는 생성
    - transfer/excluded/unclassified: 기존 link 모두 제거

    레거시: linked_revenue_id / linked_expense_id 필드는 보존(기존 데이터 호환).
    """
    sess = service.session

    # 1) 기존 링크 정리 — 분류가 바뀌면 항상 새로 만든다
    if tx.linked_daily_id:
        old = sess.get(DailyExpense, tx.linked_daily_id)
        if old:
            sess.delete(old)
        tx.linked_daily_id = None
    if tx.linked_card_payment_id:
        old_cp = sess.get(CardPayment, tx.linked_card_payment_id)
        if old_cp and old_cp.source == "bank_sync":
            # bank-sync 가 자동 생성한 행만 삭제. excel/codef 로 들어온 행은 보존.
            sess.delete(old_cp)
        tx.linked_card_payment_id = None
    if tx.linked_pay_payment_id:
        old_pp = sess.get(PayPayment, tx.linked_pay_payment_id)
        if old_pp and old_pp.source == "bank_sync":
            sess.delete(old_pp)
        tx.linked_pay_payment_id = None
    if tx.linked_delivery_revenue_id:
        old_dr = sess.get(DeliveryRevenue, tx.linked_delivery_revenue_id)
        if old_dr and old_dr.source == "bank_sync":
            # 사용자 업로드 정산명세서(excel)은 보존, bank-sync 자동 생성만 삭제
            sess.delete(old_dr)
        tx.linked_delivery_revenue_id = None

    # 2) 분류가 transfer/excluded/unclassified/owner_deposit/loan_in/other_income/card_payment 면
    #    링크만 제거하고 종료 (DailyExpense 미생성 — 매출 집계에 안 잡힘)
    #    owner_deposit: 사장님 자금 보충
    #    loan_in:       차입금/대출 (부채)
    #    other_income:  영업외수익 (이자/환급 등)
    #    card_payment:  카드대금 납부 (실제 매입은 카드 사용 시점에 잡힘 — 이중 계상 방지)
    if tx.classified_as in (
        "transfer", "excluded", "unclassified",
        "owner_deposit", "loan_in", "other_income",
        "card_payment",
    ):
        return

    # 3) 카드 정산 입금 → CardPayment (DailyExpense 미생성)
    if tx.classified_as == "card_settlement" and tx.in_amount > 0:
        cp = _link_card_settlement(sess, tx)
        if cp:
            tx.linked_card_payment_id = cp.id
        return

    # 4) 페이 정산 입금 → PayPayment (DailyExpense 미생성)
    if tx.classified_as == "pay_settlement" and tx.in_amount > 0:
        pp = _create_pay_settlement(sess, tx)
        if pp:
            tx.linked_pay_payment_id = pp.id
        return

    # 5) 배달앱 정산 입금 → DeliveryRevenue 월별 (DailyExpense 미생성)
    if tx.classified_as == "delivery_settlement" and tx.in_amount > 0:
        dr = _link_delivery_settlement(sess, tx)
        if dr:
            tx.linked_delivery_revenue_id = dr.id
        return

    # 5-2) 이동식 단말기 카드매출 정산 (코페이 등) → PayPayment + DailyExpense 매출
    #   다른 settlement 과 달리 매출 원본이 별도로 없으므로 DailyExpense 도 생성한다.
    #   수수료는 PayPayment.fees 에 자동 역산.
    if tx.classified_as == "mobile_settlement" and tx.in_amount > 0:
        pp = _create_mobile_settlement(sess, tx)
        if pp:
            tx.linked_pay_payment_id = pp.id
            # 매출 DailyExpense 생성 (sales_amount = 카드결재 원본)
            vendor = _get_or_create_vendor(
                sess, tx.business_id, pp.pay_corp, "revenue", category="이동식카드매출"
            )
            de = DailyExpense(
                business_id=tx.business_id,
                date=tx.trans_date,
                vendor_name=pp.pay_corp,
                vendor_id=vendor.id,
                amount=pp.sales_amount,  # 매출은 수수료 차감 전 결재 원본
                category="이동식카드매출",
                payment_method="Card",
                note=f"{tx.remark1 or ''} / 수수료 {pp.fees:,}원 차감 후 입금 {pp.net_deposit:,}원",
            )
            sess.add(de)
            sess.flush()
            tx.linked_daily_id = de.id
        return

    # 6) 일반 매출 (입금이 카드/페이/배달이 아닌데 수동으로 revenue 분류된 경우) → DailyExpense
    if tx.classified_as == "revenue" and tx.in_amount > 0:
        channel_name, vcategory, payment = _resolve_revenue_channel(tx.remark1, tx.remark2)
        vendor = _get_or_create_vendor(
            sess, tx.business_id, channel_name, "revenue", category=vcategory
        )
        de = DailyExpense(
            business_id=tx.business_id,
            date=tx.trans_date,
            vendor_name=channel_name,
            vendor_id=vendor.id,
            amount=tx.in_amount,
            category=vcategory,
            payment_method=payment,
            note=(tx.remark1 or "") + ((" / " + tx.remark2) if tx.remark2 else ""),
        )
        sess.add(de)
        sess.flush()
        tx.linked_daily_id = de.id
        return

    # 6-2) 현금매출 (cash_revenue) — 개인이 손님으로 송금한 입금 → DailyExpense (매출)
    #   카드/페이/배달이 아니지만 매출로 잡혀야 하는 케이스. 보통 손님 직접 송금.
    if tx.classified_as == "cash_revenue" and tx.in_amount > 0:
        channel_name = tx.remark1 or "현금매출"
        vendor = _get_or_create_vendor(
            sess, tx.business_id, channel_name, "revenue", category="현금매출"
        )
        de = DailyExpense(
            business_id=tx.business_id,
            date=tx.trans_date,
            vendor_name=channel_name,
            vendor_id=vendor.id,
            amount=tx.in_amount,
            category="현금매출",
            payment_method="Cash",
            note=(tx.remark1 or "") + ((" / " + tx.remark2) if tx.remark2 else ""),
        )
        sess.add(de)
        sess.flush()
        tx.linked_daily_id = de.id
        return

    # 7) 매입/지출 (출금)
    if tx.classified_as in ("expense", "purchase") and tx.out_amount > 0:
        vendor_name = tx.remark1 or tx.remark2 or "은행출금"
        category = "매입" if tx.classified_as == "purchase" else "기타비용"
        de = DailyExpense(
            business_id=tx.business_id,
            date=tx.trans_date,
            vendor_name=vendor_name,
            vendor_id=tx.vendor_id,
            amount=tx.out_amount,
            category=category,
            payment_method="이체",
            note=(tx.remark1 or "") + ((" / " + tx.remark2) if tx.remark2 else ""),
        )
        sess.add(de)
        sess.flush()
        tx.linked_daily_id = de.id


# ============================================================
# Settlement 매칭/생성 헬퍼 (2026-05-12)
# ============================================================

def _link_card_settlement(sess, tx: BankTransaction) -> Optional[CardPayment]:
    """카드 정산 입금 → CardPayment 매칭 시도 → 미매칭 시 신규 생성.

    매칭 단계:
      1) Exact: business_id + payment_date == trans_date + card_corp + net_deposit == in_amount
      2) Fuzzy: payment_date in [T-3, T] + card_corp + |net_deposit - in_amount| <= 1000
      3) Create: source='bank_sync', sales_amount=0, fees=0, net_deposit=in_amount
         → 추후 카드사 정산명세 Excel 업로드되면 sales_amount/fees 채워질 수 있음
    """
    s = _resolve_settlement(tx.remark1, tx.remark2)
    card_corp = s[1] if s and s[0] == "card" else "기타카드정산"

    # 1) Exact match
    cp = sess.exec(
        select(CardPayment).where(
            CardPayment.business_id == tx.business_id,
            CardPayment.payment_date == tx.trans_date,
            CardPayment.card_corp == card_corp,
            CardPayment.net_deposit == tx.in_amount,
        )
    ).first()
    if cp:
        return cp

    # 2) Fuzzy match — ±3일 + 같은 카드사 + 금액 차 1000원 이하
    fuzzy_start = tx.trans_date - timedelta(days=3)
    candidates = sess.exec(
        select(CardPayment).where(
            CardPayment.business_id == tx.business_id,
            CardPayment.payment_date >= fuzzy_start,
            CardPayment.payment_date <= tx.trans_date,
            CardPayment.card_corp == card_corp,
        )
    ).all()
    for c in candidates:
        if abs((c.net_deposit or 0) - tx.in_amount) <= 1000:
            return c

    # 3) Create new — bank-sync 가 가장 먼저 잡은 정산 입금
    cp = CardPayment(
        business_id=tx.business_id,
        payment_date=tx.trans_date,
        card_corp=card_corp,
        sales_amount=0,
        fees=0,
        vat_on_fees=0,
        net_deposit=tx.in_amount,
        source="bank_sync",
        synced_at=datetime.now(),
    )
    sess.add(cp)
    sess.flush()
    return cp


def _create_pay_settlement(sess, tx: BankTransaction) -> Optional[PayPayment]:
    """페이 정산 입금 → PayPayment 신규 생성.

    이지포스 POS daily 가 페이결제를 카드 합계에 통합하므로 매출 원본 데이터가 없다.
    따라서 매칭 시도 없이 항상 새 행 생성. sales_amount/fees=0 으로 두고,
    추후 페이 매출 원본 입력 경로가 생기면 그때 채워진다.
    """
    s = _resolve_settlement(tx.remark1, tx.remark2)
    pay_corp = s[1] if s and s[0] == "pay" else "기타페이"
    pp = PayPayment(
        business_id=tx.business_id,
        payment_date=tx.trans_date,
        pay_corp=pay_corp,
        sales_amount=0,
        fees=0,
        vat_on_fees=0,
        net_deposit=tx.in_amount,
        source="bank_sync",
        synced_at=datetime.now(),
    )
    sess.add(pp)
    sess.flush()
    return pp


def _match_mobile_pg(sess, business_id: int, remark1: Optional[str], remark2: Optional[str]) -> Optional[MobilePgConfig]:
    """사업장 등록 mobile PG 중 적요와 매칭되는 첫 번째 룰 반환."""
    text = " ".join(filter(None, [remark1, remark2])).strip()
    if not text:
        return None
    pgs = sess.exec(
        select(MobilePgConfig).where(
            MobilePgConfig.business_id == business_id,
            MobilePgConfig.is_active == True,  # noqa: E712
        )
    ).all()
    for pg in pgs:
        if pg.keyword and pg.keyword in text:
            return pg
    return None


def _create_mobile_settlement(sess, tx: BankTransaction) -> Optional[PayPayment]:
    """이동식 단말기 카드매출 정산 입금 → PayPayment 신규 생성 + 수수료 자동 역산.

    PG 결정 우선순위:
      1) 사업장 MobilePgConfig (사장님이 UI 로 등록한 룰) — name, commission_rate 사용
      2) 폴백: _resolve_settlement 하드코딩 ('코페이' 키워드, KOPAY_COMMISSION_RATE env)

    역산 공식:
      sales_amount = round(net_deposit / (1 - commission_rate))
      fees         = sales_amount - net_deposit
    """
    pg = _match_mobile_pg(sess, tx.business_id, tx.remark1, tx.remark2)
    if pg:
        pay_corp = pg.name
        rate = pg.commission_rate or 0.0275
    else:
        s = _resolve_settlement(tx.remark1, tx.remark2)
        pay_corp = s[1] if s and s[0] == "mobile" else "기타이동식"
        rate = _get_mobile_commission_rate(pay_corp)

    net = tx.in_amount or 0
    sales = round(net / (1 - rate)) if 0 < rate < 1 else net
    fees = sales - net
    pp = PayPayment(
        business_id=tx.business_id,
        payment_date=tx.trans_date,
        pay_corp=pay_corp,
        sales_amount=sales,
        fees=fees,
        vat_on_fees=0,
        net_deposit=net,
        source="bank_sync_mobile",  # 일반 pay_settlement 과 구분 (집계 시 분기)
        synced_at=datetime.now(),
    )
    sess.add(pp)
    sess.flush()
    return pp


def _link_delivery_settlement(sess, tx: BankTransaction) -> Optional[DeliveryRevenue]:
    """배달앱 정산 입금 → DeliveryRevenue (같은 channel/year/month) 매칭 또는 생성.

    배달앱은 월별 1행 누적 구조 (DeliveryRevenue 기존 정의).
    - 같은 (business_id, channel, year, month) 행이 source='excel' 이면 사용자 업로드된 정산명세서.
      → 입금건은 그 행에 link 만, settlement_amount 변경 안 함.
    - source='bank_sync' 면 우리가 만든 행 → settlement_amount 에 누적 (월 여러 번 입금).
    - 없으면 신규 생성.
    """
    s = _resolve_settlement(tx.remark1, tx.remark2)
    channel = s[1] if s and s[0] == "delivery" else "기타배달"

    dr = sess.exec(
        select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == tx.business_id,
            DeliveryRevenue.channel == channel,
            DeliveryRevenue.year == tx.trans_date.year,
            DeliveryRevenue.month == tx.trans_date.month,
        )
    ).first()

    if dr:
        if dr.source == "bank_sync":
            # bank-sync 자동 생성 행은 월 내 여러 입금 누적
            dr.settlement_amount = (dr.settlement_amount or 0) + tx.in_amount
            sess.add(dr)
        # excel 업로드 행은 보존 (사용자 업로드한 정산명세서가 우선)
        return dr

    # 신규 생성
    dr = DeliveryRevenue(
        business_id=tx.business_id,
        channel=channel,
        year=tx.trans_date.year,
        month=tx.trans_date.month,
        total_sales=0,
        total_fees=0,
        settlement_amount=tx.in_amount,
        order_count=0,
        source="bank_sync",
    )
    sess.add(dr)
    sess.flush()
    return dr


# ============================================================
# 매출 채널 매핑 (입금 remark → 표준 채널명/카테고리)
# 우선순위: 위에서 아래 순서대로 first-match
# ============================================================

# ============================================================
# 정산 채널 매핑 — 카드 / 페이 / 배달앱 3그룹 분리 (2026-05-12)
# 매출 중복 방지 + 수수료 역산을 위해 settlement 분류값과 표준명을 같이 결정.
# first-match 순서이므로 더 구체적인 키워드를 위에 둔다.
# ============================================================

# (키워드, CardPayment.card_corp 표준명)
CARD_CHANNEL_MAP: List[tuple] = [
    # 정확한 카드사명 우선 — 길이/구체성 순
    ("KB국민카드", "KB국민카드"),
    ("국민카드", "KB국민카드"),
    ("KG이니시스", "KG이니시스"),
    ("이니시스", "KG이니시스"),
    ("나이스결제", "나이스페이먼츠"),
    ("나이스페이", "나이스페이먼츠"),
    ("NICE", "나이스페이먼츠"),
    ("BC카드", "BC카드"),
    ("비씨카드", "BC카드"),
    ("신한카드", "신한카드"),
    ("원신한", "신한카드"),       # 신한카드 정산 약식 패턴
    ("삼성카드", "삼성카드"),
    ("현대카드", "현대카드"),
    ("롯데카드", "롯데카드"),
    ("하나카드", "하나카드"),
    ("NH카드", "NH카드"),
    ("농협카드", "NH카드"),
    ("우리카드", "우리카드"),
    # 카드사 미식별 정산 — 기타카드정산으로 묶음
    ("카드매입", "기타카드정산"),
    ("매입대금", "기타카드정산"),
    ("매출표", "기타카드정산"),
    ("FB자금", "기타카드정산"),    # 팝빌 test 패턴
    ("FB이체", "기타카드정산"),
]

# (키워드, PayPayment.pay_corp 표준명)
PAY_CHANNEL_MAP: List[tuple] = [
    ("카카오페이", "카카오페이"),
    ("네이버페이", "네이버페이"),
    ("네이버",     "네이버페이"),
    ("토스페이",   "토스페이"),
    ("토스",       "토스페이"),
    ("서울페이",   "서울페이"),
    ("제로페이",   "제로페이"),
    ("페이코",     "페이코"),
    ("SSG페이",    "SSG페이"),
    ("KCP",        "KCP페이"),
]

# (키워드, DeliveryRevenue.channel 표준명)
DELIVERY_CHANNEL_MAP: List[tuple] = [
    ("쿠팡이츠",     "쿠팡이츠"),
    ("쿠팡페이",     "쿠팡이츠"),
    ("쿠팡",         "쿠팡이츠"),
    ("배달의민족",   "배달의민족"),
    ("배달의민",     "배달의민족"),
    ("우아한형제",   "배달의민족"),
    ("배민",         "배달의민족"),
    ("요기요",       "요기요"),
    ("땡겨요",       "땡겨요"),
    # "음식배달" 은 배민의 알뜰배달/포장주문 등이 적요에 사용하는 표기. 실제는 배민 정산.
    ("음식배달",     "배달의민족"),
]

# (키워드, PayPayment.pay_corp 표준명, 수수료율)
# 이동식 단말기 (POS 미경유 별도 카드매출). 일반 페이결제와 달리
# 매출 원본이 별도로 없으므로 매출에 포함되어야 함. 수수료율 역산 적용.
# 코페이는 환경변수 KOPAY_COMMISSION_RATE 로 조정 가능 (기본 2.75%)
MOBILE_CHANNEL_MAP: List[tuple] = [
    ("코페이",       "코페이"),
]

def _get_mobile_commission_rate(pay_corp: str) -> float:
    """이동식 단말기 PG 별 수수료율. 환경변수로 조정 가능."""
    if pay_corp == "코페이":
        try:
            return float(os.getenv("KOPAY_COMMISSION_RATE") or "0.0275")
        except (TypeError, ValueError):
            return 0.0275
    return 0.0275  # 기타 이동식 PG 기본값

TRANSFER_KEYWORDS = ["내계좌", "자행이체", "이체입금", "적금이체", "예금이체", "본인이체"]

# 카드대금 납부 키워드 — 출금 시 이 키워드가 remark 에 있으면 매입 아님
# (실제 매입은 카드 사용 시점에 잡힘; 이 출금은 그 정산)
CARD_PAYMENT_KEYWORDS = [
    "현대카드", "삼성카드", "신한카드", "BC카드", "비씨카드",
    "롯데카드", "KB국민", "국민카드", "농협카드", "NH카드",
    "하나카드", "우리카드", "씨티카드",
    "현대(주)", "삼성(주)", "롯데(주)",
]


# remark1 = "{카드사 약자}{6+ digits}" 형태의 정산 입금 패턴
# 한국 카드사 매출 정산 표준 포맷 (예: 롯데9924419309, NH17831866, 하나92510497,
# SHC140990276, 우602406580, 현850570073)
# 사장님 확인 (2026-05-12): '우'/'현' 도 카드 정산이 맞음 — 6+ 자리 숫자 패턴에 한정
CARD_PREFIX_MAP: dict = {
    "NH":   "NH카드",
    "KB":   "KB국민카드",
    "하나":  "하나카드",       # 하나은행 송금은 한글 이름이라 digits 패턴 아님 → 안전
    "롯데":  "롯데카드",
    "SHC":  "신한카드",        # Shinhan Card 표준 정산 코드
    "신한":  "신한카드",
    "삼성":  "삼성카드",
    "비씨":  "BC카드",
    "BC":   "BC카드",
    "우":   "우리카드",        # 우602406580 패턴 (사장님 확인)
    "현":   "현대카드",        # 현850570073 패턴 (사장님 확인)
}

# remark1 끝에 카드사 약자 붙는 패턴 (예: "743149798BC")
CARD_SUFFIX_MAP: dict = {
    "BC": "BC카드",
}

# remark2 = "(은행명)" 정산 은행 힌트 — remark1 매칭 실패 시 폴백
# (우리)/(외환) 는 ambiguous 라 제외
SETTLEMENT_BANK_HINT: dict = {
    "(국민)": "KB국민카드",
    "(농협)": "NH카드",
    "(하나)": "하나카드",
}

_CARD_PREFIX_RE = re.compile(r'^([가-힣A-Z]+)(\d{6,})$')
_CARD_SUFFIX_RE = re.compile(r'^(\d{6,})([A-Z]{2,})$')


def _resolve_settlement(remark1: Optional[str], remark2: Optional[str]) -> Optional[tuple]:
    """입금 remark → (settlement_type, standard_name) 또는 None.

    매칭 우선순위:
      1. DELIVERY 키워드 (가장 구체적)
      2. PAY 키워드
      3. CARD 키워드 (전체 문자열)
      4. CARD prefix+digits 패턴 (예: 'NH17831866' → NH카드)
      5. CARD suffix 패턴 (예: '743149798BC' → BC카드)
      6. CARD remark2 은행 힌트 (예: '(국민)' → KB국민카드)
    """
    text = " ".join(filter(None, [remark1, remark2])).strip()
    if not text:
        return None
    for kw, name in DELIVERY_CHANNEL_MAP:
        if kw in text:
            return ("delivery", name)
    # MOBILE (코페이 등 이동식 단말기 카드매출) — PAY 보다 먼저 매칭 (수수료 역산+매출 인식 다름)
    for kw, name in MOBILE_CHANNEL_MAP:
        if kw in text:
            return ("mobile", name)
    for kw, name in PAY_CHANNEL_MAP:
        if kw in text:
            return ("pay", name)
    for kw, name in CARD_CHANNEL_MAP:
        if kw in text:
            return ("card", name)
    # 4) remark1 prefix + digits — exact prefix match 만 (false positive 방지)
    #    예: '우영민123456' → prefix '우영민' 으로 추출돼 매칭 안 됨 (개인송금 가능성)
    if remark1:
        r1 = remark1.strip()
        m = _CARD_PREFIX_RE.match(r1)
        if m:
            prefix = m.group(1)
            if prefix in CARD_PREFIX_MAP:
                return ("card", CARD_PREFIX_MAP[prefix])
        # 5) suffix pattern (예: 743149798BC)
        m2 = _CARD_SUFFIX_RE.match(r1)
        if m2:
            suffix = m2.group(2)
            if suffix in CARD_SUFFIX_MAP:
                return ("card", CARD_SUFFIX_MAP[suffix])
    # 6) remark2 (은행) 힌트 — remark1 이 digits 만 있을 때 보조
    if remark2:
        r2 = remark2.strip()
        for kw, name in SETTLEMENT_BANK_HINT.items():
            if kw in r2:
                return ("card", name)
    return None


def _resolve_revenue_channel(remark1: Optional[str], remark2: Optional[str]) -> tuple:
    """[LEGACY] 미매칭 입금에 대한 폴백 채널 결정.

    settlement 분리(2026-05-12) 이후로는 카드/페이/배달이 settlement 분류로 빠지므로
    이 함수는 _resolve_settlement 가 None 일 때만 호출됨 (기타매출 처리).
    """
    return "기타매출", "store", "Card"


def _get_or_create_vendor(
    session,
    business_id: int,
    name: str,
    vendor_type: str,
    category: Optional[str] = None,
) -> Vendor:
    """이름+타입+사업장 기준으로 Vendor 조회. 없으면 자동 생성."""
    v = session.exec(
        select(Vendor).where(
            Vendor.business_id == business_id,
            Vendor.vendor_type == vendor_type,
            Vendor.name == name,
        )
    ).first()
    if v:
        return v
    v = Vendor(
        name=name,
        vendor_type=vendor_type,
        category=category,
        business_id=business_id,
    )
    session.add(v)
    session.flush()
    return v


# ============================================================
# 분류 헬퍼 — 단일 tx 분류 + 학습 패턴 빌드
# ============================================================

def _build_learned_remark_map(session, business_id: int, threshold: float = 0.8) -> dict:
    """과거 분류된 BankTransaction 의 remark1 → classified_as 합의 매핑.

    threshold(기본 80%) 이상 동일 분류로 합의된 remark1 만 채택.
    수동 분류('manual')는 자동분류('auto')보다 우선 가중 (manual 1건 = auto 2건).

    ⚠ 카드사 키워드는 학습 패턴에서 제외: 과거 잘못 분류된 row(예: '신한카드' → expense)가
       학습으로 강화되어 새 BT 도 잘못 분류되는 자기복제 버그 회피. CARD_PAYMENT_KEYWORDS
       에 매칭되는 remark 는 항상 _classify_one_tx 의 카드대금 분기가 처리.
    """
    rows = session.exec(
        select(BankTransaction).where(
            BankTransaction.business_id == business_id,
            BankTransaction.classified_as != "unclassified",
            BankTransaction.remark1.isnot(None),
        )
    ).all()
    by_remark = defaultdict(Counter)
    for r in rows:
        if not r.remark1:
            continue
        # 카드사 키워드는 학습 무시 — 카드대금 분기가 우선 (위 docstring)
        if any(k in r.remark1 for k in CARD_PAYMENT_KEYWORDS):
            continue
        weight = 2 if (r.classified_by == "manual") else 1
        by_remark[r.remark1][r.classified_as] += weight

    result = {}
    for remark, counter in by_remark.items():
        total = sum(counter.values())
        if total == 0:
            continue
        top, count = counter.most_common(1)[0]
        if count / total >= threshold:
            result[remark] = top
    return result


def _classify_one_tx(
    tx: BankTransaction,
    vendor_by_name: dict,
    learned_remarks: dict,
) -> Optional[str]:
    """단일 tx 분류 결정. classified_as 반환 또는 None(미분류 유지).

    부수효과: matched expense vendor 가 있으면 tx.vendor_id 설정.
    실제 분류 적용/링크 생성은 호출자 책임.
    """
    remark = " ".join(filter(None, [tx.remark1, tx.remark2, tx.remark3])).strip()
    if not remark:
        return None

    # 1) 이체 키워드 (항상 우선)
    if any(k in remark for k in TRANSFER_KEYWORDS):
        return "transfer"

    # 2) 입금 + settlement 매핑 매칭 — 학습 패턴보다 우선 (명확한 비즈니스 규칙)
    #    카드사/페이사/배달앱 이름이 remark 에 있으면 settlement 가 확실하므로
    #    과거 '제외'/'매출' 로 학습된 패턴이 있어도 settlement 로 분류한다.
    if tx.in_amount > 0:
        s = _resolve_settlement(tx.remark1, tx.remark2)
        if s is not None:
            stype, _name = s
            if stype == "card":
                return "card_settlement"
            if stype == "pay":
                return "pay_settlement"
            if stype == "delivery":
                return "delivery_settlement"
            if stype == "mobile":
                return "mobile_settlement"

    # 2.5) 출금 + 카드사 키워드 → 항상 card_payment (학습보다 우선)
    #      과거 잘못 분류로 학습 패턴이 expense 로 굳어진 자기복제 버그 회피.
    #      카드대금 납부는 매입 아님 (실제 매입은 카드 사용 시점에 잡힘).
    if tx.out_amount > 0 and any(k in remark for k in CARD_PAYMENT_KEYWORDS):
        return "card_payment"

    # 3) 학습 패턴 (settlement / 카드대금 미매칭 시 적용)
    if tx.remark1 and tx.remark1 in learned_remarks:
        return learned_remarks[tx.remark1]

    # 4) 입금 + settlement 미매칭 + 학습 없음 → 미분류 유지
    if tx.in_amount > 0:
        return None

    # 5) 출금 → 벤더 매칭 시 expense/purchase, 미매칭이면 default expense
    if tx.out_amount > 0:
        for name, v in vendor_by_name.items():
            if name and name in remark:
                tx.vendor_id = v.id
                if v.vendor_type == "expense" and v.category in ("식자재", "매입"):
                    return "purchase"
                return "expense"
        # 미매칭 출금 — 기본 expense 로 자동 분류 (학습/수동으로 보정)
        return "expense"

    return None


def _classify_txs(
    service: DatabaseService,
    business_id: int,
    txs: List[BankTransaction],
    only_unclassified: bool = True,
) -> dict:
    """txs 리스트를 받아 분류 + DailyExpense 링크 생성.

    Returns counts dict: {revenue, expense, purchase, transfer, learned, skip}
    """
    counts = {
        "revenue": 0, "expense": 0, "purchase": 0, "transfer": 0,
        "card_payment": 0,
        "card_settlement": 0, "pay_settlement": 0, "delivery_settlement": 0,
        "mobile_settlement": 0,
        "learned": 0, "skip": 0,
    }
    if not txs:
        return counts

    sess = service.session
    now = datetime.now()

    vendors = sess.exec(
        select(Vendor).where(Vendor.business_id == business_id)
    ).all()
    vendor_by_name = {v.name.strip(): v for v in vendors if v.name}

    # 사업장별 mobile PG 룰 (1회 로드)
    mobile_pgs = sess.exec(
        select(MobilePgConfig).where(
            MobilePgConfig.business_id == business_id,
            MobilePgConfig.is_active == True,  # noqa: E712
        )
    ).all()

    learned_remarks = _build_learned_remark_map(sess, business_id)

    for tx in txs:
        if only_unclassified and tx.classified_as != "unclassified":
            continue

        # Step A: 사업장 mobile PG 룰 우선 (입금만)
        new_class = None
        if tx.in_amount and tx.in_amount > 0 and mobile_pgs:
            text = " ".join(filter(None, [tx.remark1, tx.remark2])).strip()
            for pg in mobile_pgs:
                if pg.keyword and pg.keyword in text:
                    new_class = "mobile_settlement"
                    break

        # Step B: 기본 분류 (기존 로직 — 이체/카드/페이/배달/하드코딩 코페이 등)
        if not new_class:
            new_class = _classify_one_tx(tx, vendor_by_name, learned_remarks)
        if not new_class:
            counts["skip"] += 1
            continue

        # 학습 패턴 적용 시 카운트 분리
        is_learned = bool(tx.remark1 and tx.remark1 in learned_remarks)

        tx.classified_as = new_class
        tx.classified_by = "learned" if is_learned else "auto"
        tx.classified_at = now
        _materialize_link(service, tx)
        sess.add(tx)

        if is_learned:
            counts["learned"] += 1
        elif new_class in counts:
            counts[new_class] += 1

    return counts


@router.post("/transactions/auto-classify")
def auto_classify(
    body: AutoClassifyIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """규칙 기반 자동 분류 (학습 패턴 + settlement 매핑 + 벤더 매칭 + 출금 default).

    분류 우선순위 (_classify_one_tx 안에서):
      1. 학습 패턴: 이 사업장에서 같은 remark1 으로 분류된 과거 이력 (>=80% 합의)
      2. 이체 키워드 → transfer
      3. 입금 + DELIVERY/PAY/CARD 매핑 매칭 →
         card_settlement / pay_settlement / delivery_settlement (매출 중복 방지)
      4. 입금 + 매칭 없음 → 미분류 (수동 보정 또는 학습으로 채워짐)
      5. 출금 + 벤더 매칭 → expense/purchase (vendor.vendor_type/category 따라 결정)
      6. 출금 + 미매칭 → expense (기본값. 사용자가 수동 보정 가능)

    분류된 tx 는 즉시 적절한 레코드를 생성/갱신:
      - revenue/expense/purchase → DailyExpense (매출관리/매입관리 노출)
      - card_settlement → CardPayment (수수료 역산 데이터)
      - pay_settlement → PayPayment
      - delivery_settlement → DeliveryRevenue (월별 누적)
    """
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()

    try:
        stmt = select(BankTransaction).where(BankTransaction.business_id == bid)
        if body.account_id:
            stmt = stmt.where(BankTransaction.account_id == body.account_id)
        if body.start_date:
            stmt = stmt.where(BankTransaction.trans_date >= _parse_date(body.start_date))
        if body.end_date:
            stmt = stmt.where(BankTransaction.trans_date <= _parse_date(body.end_date))
        if body.only_unclassified:
            stmt = stmt.where(BankTransaction.classified_as == "unclassified")

        rows = service.session.exec(stmt).all()
        counts = _classify_txs(service, bid, rows, only_unclassified=body.only_unclassified)
        service.session.commit()
        return {"processed": len(rows), "counts": counts}
    finally:
        service.close()


def _select_learned_examples(session, business_id: int, current_remark1: Optional[str], limit: int = 3) -> list[dict]:
    """현재 거래의 remark1 과 매칭되는 과거 수동 분류 사례 조회.

    AI 분류기에 사업장 특화 few-shot 으로 주입할 데이터.
    선정 기준:
      1. 같은 business_id
      2. classified_by='manual' (학습 신뢰도 높은 시그널)
      3. remark1 매칭 점수: exact > substring > char-set overlap

    Returns:
        [{remark1, remark2, in_amount, out_amount, classified_as}, ...]
        최대 limit 건.
    """
    if not current_remark1:
        return []
    candidates = session.exec(
        select(BankTransaction)
        .where(
            BankTransaction.business_id == business_id,
            BankTransaction.classified_by == "manual",
            BankTransaction.classified_as != "unclassified",
            BankTransaction.remark1.isnot(None),
        )
        .order_by(BankTransaction.classified_at.desc())
        .limit(100)
    ).all()
    scored = []
    cur_chars = set(current_remark1)
    for r in candidates:
        if not r.remark1:
            continue
        if r.remark1 == current_remark1:
            score = 100
        elif r.remark1 in current_remark1 or current_remark1 in r.remark1:
            score = 50
        else:
            overlap = len(cur_chars & set(r.remark1))
            score = overlap if overlap >= 3 else 0
        if score > 0:
            scored.append((score, r))
    scored.sort(key=lambda x: -x[0])
    return [
        {
            "remark1": r.remark1,
            "remark2": r.remark2 or "",
            "in_amount": r.in_amount or 0,
            "out_amount": r.out_amount or 0,
            "classified_as": r.classified_as,
        }
        for _, r in scored[:limit]
    ]


@router.get("/ai-classify/health")
def ai_classify_health(admin: User = Depends(get_admin_user)):
    """AI 분류 서비스 상태 점검 (provider/model/도달가능성)."""
    from services.ai_classify_client import get_ai_classifier
    return get_ai_classifier().health()


@router.get("/ai-classify/models")
def ai_classify_models(admin: User = Depends(get_admin_user)):
    """가용 AI 모델 목록 — UI 셀렉터용. providers 별 configured + 모델 리스트."""
    from services.ai_classify_client import get_ai_classifier
    return get_ai_classifier().list_models()


class AISuggestIn(BaseModel):
    provider: Optional[str] = Field(default=None, description="ollama | openclaw (없으면 env 기본)")
    model: Optional[str] = Field(default=None, description="모델 이름 (없으면 provider 기본)")


@router.post("/transactions/{tx_id}/ai-classify-suggest")
def ai_classify_suggest(
    tx_id: int,
    body: AISuggestIn = AISuggestIn(),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """단일 거래에 대한 AI 분류 제안 (provider/model 선택 가능).

    적용은 별도(PATCH /transactions/{id} 호출). 이 endpoint는 제안만 반환.
    """
    from services.ai_classify_client import get_ai_classifier, AIClassifyError
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        tx = service.session.get(BankTransaction, tx_id)
        if not tx or tx.business_id != bid:
            raise HTTPException(status_code=404, detail="거래를 찾을 수 없습니다.")
        ai = get_ai_classifier()
        target_provider = (body.provider or ai.default_provider).lower()
        if not ai.provider_configured(target_provider):
            raise HTTPException(
                status_code=503,
                detail=f"AI provider '{target_provider}' 미설정. (OLLAMA_URL / OPENCLAW_GATEWAY_* 환경변수 확인)",
            )
        try:
            learned_cases = _select_learned_examples(service.session, bid, tx.remark1, limit=3)
            result = ai.suggest(
                remark1=tx.remark1, remark2=tx.remark2, remark3=tx.remark3,
                in_amount=tx.in_amount or 0, out_amount=tx.out_amount or 0,
                learned_cases=learned_cases,
                provider=body.provider, model=body.model,
            )
            return {"tx_id": tx_id, **result}
        except AIClassifyError as e:
            raise HTTPException(status_code=502, detail=f"AI 분류 실패: {e}")
    finally:
        service.close()


class AIClassifyBatchIn(BaseModel):
    account_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    only_unclassified: bool = True
    max_items: int = Field(default=50, le=200, description="과도한 호출 방지")
    min_confidence: float = Field(default=0.7, ge=0, le=1,
        description="이 이상의 confidence만 자동 적용. 미만은 suggestions 로만 반환")
    apply: bool = Field(default=False,
        description="True 면 min_confidence 이상은 자동 적용. False면 제안만 반환")
    provider: Optional[str] = Field(default=None, description="ollama | openclaw")
    model: Optional[str] = Field(default=None, description="모델 이름")


@router.post("/transactions/ai-classify-batch")
def ai_classify_batch(
    body: AIClassifyBatchIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """필터된 거래들에 대해 AI 분류 일괄 제안(또는 자동 적용).

    동작:
    - max_items 만큼 LLM 호출 (Ollama qwen2.5:7b)
    - apply=True 면 min_confidence 이상은 즉시 적용 (classified_by='ai_qwen')
    - apply=False 면 suggestions 배열만 반환 (UI에서 사용자 일괄 승인)
    - manual 분류 거래는 절대 덮어쓰지 않음
    """
    from services.ai_classify_client import get_ai_classifier, AIClassifyError
    bid = _resolve_bid(admin, x_view_as_business)
    ai = get_ai_classifier()
    if not ai.configured():
        raise HTTPException(status_code=503, detail="AI 분류 서비스 미설정.")

    service = DatabaseService()
    try:
        stmt = select(BankTransaction).where(BankTransaction.business_id == bid)
        if body.account_id:
            stmt = stmt.where(BankTransaction.account_id == body.account_id)
        if body.start_date:
            stmt = stmt.where(BankTransaction.trans_date >= _parse_date(body.start_date))
        if body.end_date:
            stmt = stmt.where(BankTransaction.trans_date <= _parse_date(body.end_date))
        if body.only_unclassified:
            stmt = stmt.where(BankTransaction.classified_as == "unclassified")

        rows = service.session.exec(stmt).all()[: body.max_items]

        suggestions = []
        applied = 0
        errors = 0
        now = datetime.now()
        # classified_by tag (provider 정보 포함)
        prov_tag = f"ai_{(body.provider or ai.default_provider).lower()}"

        for tx in rows:
            try:
                learned_cases = _select_learned_examples(service.session, bid, tx.remark1, limit=3)
                s = ai.suggest(
                    remark1=tx.remark1, remark2=tx.remark2, remark3=tx.remark3,
                    in_amount=tx.in_amount or 0, out_amount=tx.out_amount or 0,
                    learned_cases=learned_cases,
                    provider=body.provider, model=body.model,
                )
            except AIClassifyError as e:
                errors += 1
                suggestions.append({"tx_id": tx.id, "error": str(e)[:200]})
                continue

            entry = {"tx_id": tx.id, **s}
            suggestions.append(entry)

            if body.apply and tx.classified_by != "manual" and s["confidence"] >= body.min_confidence:
                if s["classified_as"] != "unclassified" and s["classified_as"] != tx.classified_as:
                    tx.classified_as = s["classified_as"]
                    tx.classified_by = prov_tag
                    tx.classified_at = now
                    _materialize_link(service, tx)
                    service.session.add(tx)
                    applied += 1

        if body.apply and applied > 0:
            service.session.commit()

        return {
            "processed": len(rows),
            "applied": applied,
            "errors": errors,
            "suggestions": suggestions,
        }
    finally:
        service.close()


def _build_analysis_context(session, business_id: int) -> dict:
    """Phase 3 대화형 분석을 위한 사업장 재무 컨텍스트 수집.

    최근 3개월 settlement_stats + 분류 분포 + 등록 계좌 수 등.
    """
    today = date.today()
    months = []
    # 최근 3개월 (이번 달 포함)
    y, m = today.year, today.month
    for _ in range(3):
        months.append((y, m))
        m -= 1
        if m == 0:
            m = 12
            y -= 1
    months.reverse()

    settlement_summary = []
    for yy, mm in months:
        start = date(yy, mm, 1)
        if mm == 12:
            next_start = date(yy + 1, 1, 1)
        else:
            next_start = date(yy, mm + 1, 1)
        end = next_start - timedelta(days=1)

        card_payments = session.exec(
            select(CardPayment).where(
                CardPayment.business_id == business_id,
                CardPayment.payment_date >= start,
                CardPayment.payment_date <= end,
            )
        ).all()
        card_approvals = session.exec(
            select(CardSalesApproval).where(
                CardSalesApproval.business_id == business_id,
                CardSalesApproval.approval_date >= start,
                CardSalesApproval.approval_date <= end,
                CardSalesApproval.status == "승인",
            )
        ).all()
        pay_payments = session.exec(
            select(PayPayment).where(
                PayPayment.business_id == business_id,
                PayPayment.payment_date >= start,
                PayPayment.payment_date <= end,
            )
        ).all()
        delivery = session.exec(
            select(DeliveryRevenue).where(
                DeliveryRevenue.business_id == business_id,
                DeliveryRevenue.year == yy,
                DeliveryRevenue.month == mm,
            )
        ).all()

        card_sales = sum(a.amount or 0 for a in card_approvals)
        card_deposit = sum(c.net_deposit or 0 for c in card_payments)
        card_fees = sum(c.fees or 0 for c in card_payments) or max(card_sales - card_deposit, 0)
        card_rate = round(card_fees / card_sales * 100, 2) if card_sales > 0 else None

        pay_deposit = sum(p.net_deposit or 0 for p in pay_payments)
        pay_sales = sum(p.sales_amount or 0 for p in pay_payments)
        pay_fees = sum(p.fees or 0 for p in pay_payments)
        pay_rate = round(pay_fees / pay_sales * 100, 2) if pay_sales > 0 else None

        delivery_sales = sum(d.total_sales or 0 for d in delivery)
        delivery_deposit = sum(d.settlement_amount or 0 for d in delivery)
        delivery_fees = sum(d.total_fees or 0 for d in delivery)
        delivery_rate = round(delivery_fees / delivery_sales * 100, 2) if delivery_sales > 0 else None

        settlement_summary.append({
            "year": yy, "month": mm,
            "card": {"sales": card_sales, "deposit": card_deposit, "fees": card_fees, "rate_pct": card_rate},
            "pay":  {"deposit": pay_deposit, "sales": pay_sales, "fees": pay_fees, "rate_pct": pay_rate},
            "delivery": {"sales": delivery_sales, "deposit": delivery_deposit, "fees": delivery_fees, "rate_pct": delivery_rate},
        })

    # 분류 분포 (전체)
    classification_dist: dict = {}
    rows = session.exec(
        select(BankTransaction).where(BankTransaction.business_id == business_id)
    ).all()
    for r in rows:
        c = r.classified_as or "unclassified"
        classification_dist[c] = classification_dist.get(c, 0) + 1

    # 등록 계좌
    accounts = session.exec(
        select(BankAccount).where(BankAccount.business_id == business_id)
    ).all()

    return {
        "today": today.isoformat(),
        "settlement_summary": settlement_summary,
        "classification_distribution": classification_dist,
        "total_transactions": len(rows),
        "accounts": [{"bank": a.bank_name, "alias": a.alias} for a in accounts],
    }


CHAT_SYSTEM_PROMPT = """당신은 한국 자영업 사업장 재무 분석 전문가입니다.
은행 거래내역, 카드 정산, 페이 결제, 배달앱 정산 데이터를 보고 사장님께
숫자 근거가 있는 명확하고 짧은 한국어 답변을 합니다.

규칙:
- 반드시 제공된 [컨텍스트] 데이터에만 근거해 답하세요. 데이터에 없는 사실을 만들어내지 마세요.
- 숫자는 천 단위 쉼표로 표기하고, 비율은 % 단위로.
- 추세·비교가 필요하면 월별 비교 표 또는 짧은 bullet 로 정리.
- 정보가 부족하면 "더 자세히 분석하려면 X 데이터가 필요합니다" 라고 명시.
- 절대 추측·과장·홍보성 표현 금지. 친근하지만 사실 중심.
- 답변은 보통 3-6 문장 또는 짧은 표. 길어도 200단어 이내."""


class ChatIn(BaseModel):
    messages: list[dict] = Field(...,
        description="대화 히스토리. [{role: 'user'|'assistant', content: '...'}, ...]")
    provider: Optional[str] = Field(default=None, description="ollama | openclaw")
    model: Optional[str] = Field(default=None, description="모델 이름")


@router.post("/chat")
def chat(
    body: ChatIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """Phase 3 — 사업장 재무 데이터에 대한 자연어 분석.

    사장님 질문을 받으면 백엔드가 자동으로 사업장의 settlement·분류 분포 등
    재무 컨텍스트를 수집해 LLM 시스템 프롬프트에 주입 후 응답.

    Request:
        messages: 누적 대화 (최신 user 메시지 포함)

    Response:
        {answer, context_summary}
    """
    from services.ai_classify_client import get_ai_classifier, AIClassifyError
    bid = _resolve_bid(admin, x_view_as_business)
    ai = get_ai_classifier()
    if not ai.configured():
        raise HTTPException(status_code=503, detail="AI 서비스 미설정.")

    if not body.messages or not any(m.get("role") == "user" for m in body.messages):
        raise HTTPException(status_code=400, detail="사용자 메시지가 필요합니다.")

    service = DatabaseService()
    try:
        ctx = _build_analysis_context(service.session, bid)
        context_text = (
            "[컨텍스트 — 본 사업장 재무 데이터]\n"
            f"오늘 날짜: {ctx['today']}\n"
            f"등록 계좌: {len(ctx['accounts'])}개 — "
            + ", ".join(f"{a['bank']}({a['alias'] or '-'})" for a in ctx['accounts'])
            + "\n전체 거래 수: " + str(ctx['total_transactions']) + "건\n"
            "\n분류 분포:\n"
            + "\n".join(f"  - {k}: {v}건" for k, v in sorted(ctx['classification_distribution'].items(), key=lambda x: -x[1]))
            + "\n\n최근 3개월 정산 통계:\n"
        )
        for m in ctx['settlement_summary']:
            context_text += (
                f"\n  [{m['year']}-{m['month']:02d}]\n"
                f"    카드: 매출 {m['card']['sales']:,}원 / 입금 {m['card']['deposit']:,}원 / "
                f"수수료 {m['card']['fees']:,}원 ({m['card']['rate_pct']}%)\n"
                f"    페이: 매출 {m['pay']['sales']:,}원 / 입금 {m['pay']['deposit']:,}원 / "
                f"수수료 {m['pay']['fees']:,}원 ({m['pay']['rate_pct']}%)\n"
                f"    배달: 매출 {m['delivery']['sales']:,}원 / 입금 {m['delivery']['deposit']:,}원 / "
                f"수수료 {m['delivery']['fees']:,}원 ({m['delivery']['rate_pct']}%)\n"
            )

        messages = [
            {"role": "system", "content": CHAT_SYSTEM_PROMPT},
            {"role": "system", "content": context_text},
            *body.messages,
        ]

        try:
            answer = ai.chat(messages, provider=body.provider, model=body.model)
        except AIClassifyError as e:
            raise HTTPException(status_code=502, detail=f"AI 분석 실패: {e}")

        prov, mdl = ai._resolve(body.provider, body.model)
        return {
            "answer": answer.strip(),
            "model_used": f"{prov}:{mdl}",
            "context_summary": {
                "months": [f"{m['year']}-{m['month']:02d}" for m in ctx['settlement_summary']],
                "accounts": len(ctx['accounts']),
                "total_transactions": ctx['total_transactions'],
            },
        }
    finally:
        service.close()


class AuditIn(BaseModel):
    account_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_items: int = Field(default=100, le=300,
        description="검사 대상 거래 수 (호출 비용 제한)")
    min_disagreement_confidence: float = Field(default=0.75, ge=0, le=1,
        description="AI 신뢰도가 이 이상이고 현재 분류와 다를 때만 의심으로 플래그")
    skip_manual: bool = Field(default=True,
        description="수동 분류 거래는 검사 제외 (사용자 의도 보호)")
    provider: Optional[str] = Field(default=None, description="ollama | openclaw")
    model: Optional[str] = Field(default=None, description="모델 이름")


@router.post("/audit/run")
def audit_run(
    body: AuditIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """AI 감사 — 이미 분류된 거래에 대해 AI가 다른 분류를 고신뢰도로 제안하는 케이스 탐지.

    동작:
    - classified_as != 'unclassified' 인 거래를 max_items 만큼 샘플링
    - 각 거래에 대해 AI 분류 호출 (학습 인식)
    - AI 신뢰도 >= min_disagreement_confidence AND AI 분류 != 현재 분류 → 의심으로 플래그
    - 결과 리스트 반환 (자동 변경 없음 — UI 에서 사용자가 선택적 승인)

    Returns:
        {processed, suspicious_count, suspicious: [{tx_id, ...tx_info, current_class,
                                                     ai_class, ai_confidence, ai_reason}]}
    """
    from services.ai_classify_client import get_ai_classifier, AIClassifyError
    bid = _resolve_bid(admin, x_view_as_business)
    ai = get_ai_classifier()
    if not ai.configured():
        raise HTTPException(status_code=503, detail="AI 분류 서비스 미설정.")

    service = DatabaseService()
    try:
        stmt = select(BankTransaction).where(
            BankTransaction.business_id == bid,
            BankTransaction.classified_as != "unclassified",
        )
        if body.account_id:
            stmt = stmt.where(BankTransaction.account_id == body.account_id)
        if body.start_date:
            stmt = stmt.where(BankTransaction.trans_date >= _parse_date(body.start_date))
        if body.end_date:
            stmt = stmt.where(BankTransaction.trans_date <= _parse_date(body.end_date))
        if body.skip_manual:
            stmt = stmt.where(BankTransaction.classified_by != "manual")

        rows = service.session.exec(stmt.order_by(BankTransaction.trans_date.desc())).all()[: body.max_items]

        suspicious = []
        errors = 0
        for tx in rows:
            try:
                learned_cases = _select_learned_examples(service.session, bid, tx.remark1, limit=3)
                s = ai.suggest(
                    remark1=tx.remark1, remark2=tx.remark2, remark3=tx.remark3,
                    in_amount=tx.in_amount or 0, out_amount=tx.out_amount or 0,
                    learned_cases=learned_cases,
                    provider=body.provider, model=body.model,
                )
            except AIClassifyError:
                errors += 1
                continue

            if (
                s["classified_as"] != "unclassified"
                and s["classified_as"] != tx.classified_as
                and s["confidence"] >= body.min_disagreement_confidence
            ):
                suspicious.append({
                    "tx_id": tx.id,
                    "trans_date": tx.trans_date.isoformat() if tx.trans_date else None,
                    "remark1": tx.remark1,
                    "remark2": tx.remark2,
                    "in_amount": tx.in_amount or 0,
                    "out_amount": tx.out_amount or 0,
                    "current_class": tx.classified_as,
                    "current_classified_by": tx.classified_by,
                    "ai_class": s["classified_as"],
                    "ai_standard_name": s["standard_name"],
                    "ai_confidence": s["confidence"],
                    "ai_reason": s["reason"],
                    "ai_used_learned": s.get("used_learned", 0),
                })

        return {
            "processed": len(rows),
            "errors": errors,
            "suspicious_count": len(suspicious),
            "suspicious": suspicious,
            "settings": {
                "min_disagreement_confidence": body.min_disagreement_confidence,
                "skip_manual": body.skip_manual,
            },
        }
    finally:
        service.close()


class AuditApplyIn(BaseModel):
    tx_ids: list[int] = Field(..., description="감사 결과 중 AI 제안을 수락할 tx id 리스트")
    provider: Optional[str] = Field(default=None, description="ollama | openclaw")
    model: Optional[str] = Field(default=None, description="모델 이름")


@router.post("/audit/apply")
def audit_apply(
    body: AuditApplyIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """감사 결과 중 사용자가 수락한 tx 들에 대해 AI 제안을 실제로 적용.

    프론트엔드는 audit_run 결과를 보여주고 사용자가 체크박스로 선택한 tx_id들을 전달.
    각 tx 마다 AI 재호출 (race condition 방지: 데이터가 audit_run 시점과 같다고 가정).
    """
    from services.ai_classify_client import get_ai_classifier, AIClassifyError
    bid = _resolve_bid(admin, x_view_as_business)
    ai = get_ai_classifier()
    if not ai.configured():
        raise HTTPException(status_code=503, detail="AI 분류 서비스 미설정.")

    service = DatabaseService()
    try:
        applied = 0
        skipped = 0
        errors = 0
        now = datetime.now()
        for tx_id in body.tx_ids:
            tx = service.session.get(BankTransaction, tx_id)
            if not tx or tx.business_id != bid:
                skipped += 1
                continue
            if tx.classified_by == "manual":
                skipped += 1
                continue
            try:
                learned_cases = _select_learned_examples(service.session, bid, tx.remark1, limit=3)
                s = ai.suggest(
                    remark1=tx.remark1, remark2=tx.remark2, remark3=tx.remark3,
                    in_amount=tx.in_amount or 0, out_amount=tx.out_amount or 0,
                    learned_cases=learned_cases,
                    provider=body.provider, model=body.model,
                )
            except AIClassifyError:
                errors += 1
                continue
            if s["classified_as"] in {"unclassified", tx.classified_as}:
                skipped += 1
                continue
            tx.classified_as = s["classified_as"]
            tx.classified_by = "ai_audit"
            tx.classified_at = now
            _materialize_link(service, tx)
            service.session.add(tx)
            applied += 1
        service.session.commit()
        return {"requested": len(body.tx_ids), "applied": applied, "skipped": skipped, "errors": errors}
    finally:
        service.close()


class ReclassifySettlementsIn(BaseModel):
    account_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    override_manual: bool = Field(
        default=False,
        description="True 면 classified_by='manual' 도 덮어씀. 기본 False (수동 분류 보호)",
    )


@router.post("/transactions/reclassify-settlements")
def reclassify_settlements(
    body: ReclassifySettlementsIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """입금 거래 중 카드사/페이/배달앱 키워드 매칭되는 건을 settlement 로 강제 재분류.

    기존 분류 (excluded/revenue/expense 등) 와 학습 패턴을 무시하고
    _resolve_settlement 매칭이 우선. CardPayment/PayPayment/DeliveryRevenue 자동 생성.
    classified_by='manual' 은 override_manual=True 가 아닌 한 보호.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        stmt = select(BankTransaction).where(
            BankTransaction.business_id == bid,
            BankTransaction.in_amount > 0,
        )
        if body.account_id:
            stmt = stmt.where(BankTransaction.account_id == body.account_id)
        if body.start_date:
            stmt = stmt.where(BankTransaction.trans_date >= _parse_date(body.start_date))
        if body.end_date:
            stmt = stmt.where(BankTransaction.trans_date <= _parse_date(body.end_date))

        rows = service.session.exec(stmt).all()

        target_map = {
            "card": "card_settlement",
            "pay": "pay_settlement",
            "delivery": "delivery_settlement",
            "mobile": "mobile_settlement",
        }
        counts = {
            "scanned": len(rows),
            "card_settlement": 0,
            "pay_settlement": 0,
            "delivery_settlement": 0,
            "mobile_settlement": 0,
            "skipped_manual": 0,
            "skipped_no_match": 0,
            "already_correct": 0,
        }
        now = datetime.now()

        # 사업장 mobile PG 룰 (사용자 등록) 1회 로드
        user_mobile_pgs = service.session.exec(
            select(MobilePgConfig).where(
                MobilePgConfig.business_id == bid,
                MobilePgConfig.is_active == True,  # noqa: E712
            )
        ).all()

        for tx in rows:
            # 사업장 PG 룰 우선
            stype = None
            if user_mobile_pgs:
                text = " ".join(filter(None, [tx.remark1, tx.remark2])).strip()
                for pg in user_mobile_pgs:
                    if pg.keyword and pg.keyword in text:
                        stype = "mobile"
                        break
            if not stype:
                s = _resolve_settlement(tx.remark1, tx.remark2)
                if s is None:
                    counts["skipped_no_match"] += 1
                    continue
                stype, _name = s
            target = target_map[stype]

            if tx.classified_as == target:
                counts["already_correct"] += 1
                continue

            if tx.classified_by == "manual" and not body.override_manual:
                counts["skipped_manual"] += 1
                continue

            tx.classified_as = target
            tx.classified_by = "reclassify_settlement"
            tx.classified_at = now
            _materialize_link(service, tx)
            service.session.add(tx)
            counts[target] += 1

        service.session.commit()
        return {"processed": len(rows), "counts": counts}
    finally:
        service.close()


class RegistBankAccountIn(BaseModel):
    bank_code: str = Field(..., min_length=4, max_length=4, description="은행 4자리 코드 (예: 0088 신한, 0004 국민)")
    account_number: str = Field(..., min_length=5, max_length=30, description="계좌번호 (하이픈 자동 제거)")
    account_pwd: str = Field(..., min_length=4, max_length=4, description="계좌 비밀번호 4자리")
    account_type: str = Field(default="법인", description="법인 또는 개인")
    identity_number: str = Field(..., description="법인: 사업자번호 / 개인: 생년월일(yyMMdd)")
    fast_id: Optional[str] = Field(default=None, description="조회전용 ID — 신한/IM/신협 필수")
    fast_pwd: Optional[str] = Field(default=None, description="조회전용 비밀번호 — 신한/IM/신협 필수")
    bank_id: Optional[str] = Field(default=None, description="인터넷뱅킹 ID — 국민은행 필수")
    account_name: Optional[str] = Field(default=None, description="계좌 별칭")
    use_period: int = Field(default=11, ge=1, le=12, description="정액제 사용 개월수 (1~12, 기본 11)")
    memo: Optional[str] = Field(default=None, max_length=200)


@router.post("/accounts/regist")
def regist_bank_account(
    body: RegistBankAccountIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """팝빌 EasyFinBank.registBankAccount API 직접 호출로 계좌 등록.

    동작:
    1. 은행별 필수 필드 검증 (신한/IM/신협 → FastID/PWD 필수, 국민 → BankID 필수)
    2. popbill API 호출 (자격증명은 popbill 서버로 즉시 전송 후 메모리 폐기 — DB 저장 없음)
    3. 성공 시 BankAccount DB 에 upsert (메타정보만, 자격증명 제외)
    4. 실패 시 popbill 에러 코드 + 메시지 반환

    보안:
    - account_pwd / fast_pwd / bank_id 는 popbill API 호출 직후 변수에서 사라짐
    - 응답·로그에 자격증명 절대 포함 안 됨
    """
    bid = _resolve_bid(admin, x_view_as_business)
    provider = get_provider()
    if provider.name != "popbill":
        raise HTTPException(
            status_code=503,
            detail=f"popbill provider 가 아닙니다 (현재: {provider.name}). POPBILL_LINK_ID/SECRET_KEY 확인 필요.",
        )

    # 은행별 필수 필드 검증
    bank_code = body.bank_code.strip()
    fast_required_banks = {"0088", "0031", "0048"}  # 신한, IM, 신협
    bank_id_required_banks = {"0004"}                # 국민
    if bank_code in fast_required_banks:
        if not body.fast_id or not body.fast_pwd:
            raise HTTPException(
                status_code=400,
                detail=f"{BANK_NAMES.get(bank_code, bank_code)} 은 조회전용 ID/비밀번호(fast_id, fast_pwd) 필수입니다.",
            )
    if bank_code in bank_id_required_banks:
        if not body.bank_id:
            raise HTTPException(
                status_code=400,
                detail="국민은행은 인터넷뱅킹 ID(bank_id) 필수입니다.",
            )

    # popbill API 호출 (자격증명 메모리 통과만)
    result = provider.regist_account(
        bank_code=bank_code,
        account_number=body.account_number,
        account_pwd=body.account_pwd,
        account_type=body.account_type,
        identity_number=body.identity_number,
        fast_id=body.fast_id,
        fast_pwd=body.fast_pwd,
        bank_id=body.bank_id,
        account_name=body.account_name,
        use_period=body.use_period,
        memo=body.memo,
    )

    if not result.get("ok"):
        raise HTTPException(
            status_code=502,
            detail=f"팝빌 등록 실패 [{result.get('code')}] {result.get('message', '알 수 없는 오류')}",
        )

    # BankAccount DB upsert (자격증명 제외)
    service = DatabaseService()
    try:
        clean_acc = re.sub(r"\D", "", body.account_number)
        existing = service.session.exec(
            select(BankAccount).where(
                BankAccount.business_id == bid,
                BankAccount.bank_code == bank_code,
                BankAccount.account_number == clean_acc,
            )
        ).first()
        if existing:
            existing.alias = body.account_name or existing.alias
            existing.memo = body.memo or existing.memo
            existing.last_sync_status = "registered"
            existing.last_sync_error = None
            service.session.add(existing)
            service.session.commit()
            service.session.refresh(existing)
            return {
                "ok": True,
                "created": False,
                "account": _acc_to_dict(existing),
                "popbill_message": result.get("message"),
            }
        new_acc = BankAccount(
            business_id=bid,
            bank_code=bank_code,
            bank_name=BANK_NAMES.get(bank_code, bank_code),
            account_number=clean_acc,
            account_type=body.account_type,
            alias=body.account_name,
            memo=body.memo,
            last_sync_status="registered",
        )
        service.session.add(new_acc)
        service.session.commit()
        service.session.refresh(new_acc)
        return {
            "ok": True,
            "created": True,
            "account": _acc_to_dict(new_acc),
            "popbill_message": result.get("message"),
        }
    finally:
        service.close()


class CodefHistoricalPullIn(BaseModel):
    account_id: int = Field(..., description="등록된 계좌 ID (BankAccount.id)")
    start_date: str = Field(..., description="YYYY-MM-DD")
    end_date: str = Field(..., description="YYYY-MM-DD")
    client_type: str = Field(default="B", description="B(법인) or P(개인)")
    # 인증 방식 (셋 중 하나만 제공)
    fast_id: Optional[str] = Field(default=None, description="ID/PW: 조회전용 ID")
    fast_pwd: Optional[str] = Field(default=None, description="ID/PW: 조회전용 비밀번호")
    cert_file: Optional[str] = Field(default=None, description="공동인증서: signCert.der base64")
    key_file: Optional[str] = Field(default=None, description="공동인증서: signPri.key base64")
    cert_pwd: Optional[str] = Field(default=None, description="공동인증서: 인증서 비밀번호 (평문, RSA 암호화 백엔드 수행)")
    simple_provider: Optional[str] = Field(default=None, description="간편인증: kakao|naver|pass|toss|payco|samsung")
    user_name: Optional[str] = Field(default=None, description="간편인증: 본인 이름")
    phone_no: Optional[str] = Field(default=None, description="간편인증: 휴대폰 번호")
    birth_date: Optional[str] = Field(default=None, description="간편인증: 생년월일 yyMMdd 또는 사업자번호")
    telecom: Optional[str] = Field(default="0", description="간편인증: 0=SKT/1=KT/2=LG")


def _build_codef_auth_payload(body: "CodefHistoricalPullIn") -> dict:
    """body 에서 CODEF auth_payload (CodefConnectionService.register_bank 용) 추출."""
    auth: dict = {"client_type": body.client_type or "B"}
    if body.cert_file and body.key_file:
        auth.update({
            "certFile": body.cert_file,
            "keyFile": body.key_file,
            "certPwd": body.cert_pwd or "",
        })
    elif body.simple_provider:
        auth.update({
            "loginType": body.simple_provider,
            "userName": body.user_name or "",
            "phoneNo": body.phone_no or "",
            "birthDate": body.birth_date or "",
            "telecom": body.telecom or "0",
        })
    elif body.fast_id and body.fast_pwd:
        auth.update({"id": body.fast_id, "password": body.fast_pwd})
    else:
        raise HTTPException(
            status_code=400,
            detail="인증 정보가 부족합니다. (fast_id/fast_pwd) 또는 (cert_file/key_file/cert_pwd) "
                   "또는 (simple_provider/user_name/phone_no/birth_date) 중 하나 필요"
        )
    return auth


class CodefRegisterBankIn(BaseModel):
    account_id: int = Field(..., description="등록된 계좌 ID")
    client_type: str = Field(default="B")
    fast_id: Optional[str] = None
    fast_pwd: Optional[str] = None
    cert_file: Optional[str] = None
    key_file: Optional[str] = None
    cert_pwd: Optional[str] = None
    simple_provider: Optional[str] = None
    user_name: Optional[str] = None
    phone_no: Optional[str] = None
    birth_date: Optional[str] = None
    telecom: Optional[str] = "0"


@router.post("/codef-register-bank")
def codef_register_bank(
    body: CodefRegisterBankIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """CODEF 은행 연결 등록 — 거래 가져오기 없이 connectedId 만 발급/갱신.

    auth_payload 형식:
      - ID/PW: fast_id + fast_pwd
      - 공동인증서: cert_file + key_file + cert_pwd
      - 간편인증: simple_provider + user_name + phone_no + birth_date
    """
    from services.codef.connection_service import CodefConnectionService
    from services.codef.exceptions import (
        CodefAuthExpired, CodefAdditionalAuth, CodefAPIError,
    )
    from models import CodefConnection

    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        acc = service.session.get(BankAccount, body.account_id)
        if not acc or acc.business_id != bid:
            raise HTTPException(404, "계좌를 찾을 수 없습니다.")

        # auth_payload 추출 (HistoricalPullIn 형식과 호환되도록 같은 로직)
        auth = {"client_type": body.client_type or "B"}
        if body.cert_file and body.key_file:
            auth.update({"certFile": body.cert_file, "keyFile": body.key_file, "certPwd": body.cert_pwd or ""})
        elif body.simple_provider:
            auth.update({
                "loginType": body.simple_provider,
                "userName": body.user_name or "",
                "phoneNo": body.phone_no or "",
                "birthDate": body.birth_date or "",
                "telecom": body.telecom or "0",
            })
        elif body.fast_id and body.fast_pwd:
            auth.update({"id": body.fast_id, "password": body.fast_pwd})
        else:
            raise HTTPException(400, "인증 정보 부족")

        conn_svc = CodefConnectionService(service.session.bind)
        existing = service.session.exec(
            select(CodefConnection).where(
                CodefConnection.business_id == bid,
                CodefConnection.organization_code == acc.bank_code,
                CodefConnection.organization_type == "bank",
            )
        ).first()
        try:
            if existing:
                conn = conn_svc.reverify(existing.id, auth)
            else:
                conn = conn_svc.register_bank(bid, acc.bank_code, auth)
        except CodefAuthExpired as e:
            # 외부(CODEF) 인증 만료 — 셈하나 JWT 만료가 아니므로 401 사용 금지.
            # axios interceptor 가 401 받으면 사용자를 강제 로그아웃시킴.
            raise HTTPException(422, f"CODEF 인증 실패: {e.message}")
        except CodefAdditionalAuth as e:
            raise HTTPException(428, {
                "message": "간편인증 진행 중 — 휴대폰에서 인증을 완료한 뒤 다시 호출하세요.",
                "method": e.method,
                "extra_info": e.extra_info,
            })
        except CodefAPIError as e:
            raise HTTPException(502, f"CODEF [{e.code}]: {e.message}")

        return {
            "ok": True,
            "connection_id": conn.id,
            "connected_id": (conn.connected_id or "")[:8] + "...",
            "auth_method": conn.auth_method,
            "organization": conn.organization_label,
            "status": conn.status,
        }
    finally:
        service.close()


@router.post("/codef-pull-historical")
def codef_pull_historical(
    body: CodefHistoricalPullIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """CODEF API 로 popbill 3개월 한도 이전 거래내역 가져오기.

    동작:
    1. CodefConnection 조회 → 없거나 inactive 면 새로 발급 (auth_payload 사용)
    2. CODEF /v1/kr/bank/b/account/transaction-list 호출 (법인) 또는 /p/ (개인)
    3. 응답 거래 → BankTransaction 으로 변환 + 중복 차단 + 자동 분류

    보안: fast_id/fast_pwd 는 메모리 통과만 + 즉시 폐기. DB 저장 X.
    """
    bid = _resolve_bid(admin, x_view_as_business)
    sd = _parse_date(body.start_date)
    ed = _parse_date(body.end_date)
    if sd > ed:
        raise HTTPException(400, "start_date 가 end_date 보다 이전이어야 합니다.")

    from services.codef.connection_service import CodefConnectionService
    from services.codef.codef_client import CodefClient
    from services.codef.exceptions import (
        CodefAuthExpired, CodefAdditionalAuth, CodefAPIError,
    )
    from models import CodefConnection

    service = DatabaseService()
    try:
        # 1) BankAccount 먼저 조회 (account_id 기반 — 평문 계좌번호 + bank_code 확보)
        acc = service.session.get(BankAccount, body.account_id)
        if not acc or acc.business_id != bid:
            raise HTTPException(404, "해당 계좌가 등록되어 있지 않습니다.")
        bank_code = acc.bank_code
        account_number_plain = re.sub(r"\D", "", acc.account_number or "")

        # 2) CodefConnection 확보 (재인증 또는 신규 발급)
        conn_svc = CodefConnectionService(service.session.bind)
        existing = service.session.exec(
            select(CodefConnection).where(
                CodefConnection.business_id == bid,
                CodefConnection.organization_code == bank_code,
                CodefConnection.organization_type == "bank",
            )
        ).first()
        auth_payload = _build_codef_auth_payload(body)
        try:
            if existing and existing.status == "active":
                conn = existing
                connected_id = conn.connected_id
            else:
                if existing:
                    conn = conn_svc.reverify(existing.id, auth_payload)
                else:
                    conn = conn_svc.register_bank(bid, bank_code, auth_payload)
                connected_id = conn.connected_id
        except CodefAuthExpired as e:
            # 외부(CODEF) 인증 만료 — 셈하나 JWT 만료가 아니므로 401 사용 금지.
            raise HTTPException(422, f"CODEF 인증 실패: {e.message}")
        except CodefAdditionalAuth as e:
            raise HTTPException(
                428,
                {
                    "message": "간편인증/추가본인확인 진행 중 — 휴대폰에서 인증 완료 후 [거래 가져오기] 다시 누르세요.",
                    "method": e.method,
                    "extra_info": e.extra_info,
                }
            )
        except CodefAPIError as e:
            raise HTTPException(502, f"CODEF 등록 실패 [{e.code}]: {e.message}")

        # 3) CODEF 거래내역 조회
        client = CodefClient()
        url_path = (
            "/v1/kr/bank/b/account/transaction-list"
            if body.client_type == "B"
            else "/v1/kr/bank/p/account/transaction-list"
        )
        codef_params = {
            "connectedId": connected_id,
            "organization": bank_code,
            "account": account_number_plain,
            "startDate": sd.strftime("%Y%m%d"),
            "endDate": ed.strftime("%Y%m%d"),
            "orderBy": "1",       # 과거→최신
            "inquiryType": "1",   # 전체 (입금+출금)
        }
        try:
            result = client.request_product(url_path, codef_params)
        except CodefAuthExpired as e:
            conn_svc.mark_failed(conn.id, "expired", error_code=e.code, error_message=e.message)
            conn = conn_svc.reverify(conn.id, auth_payload)
            codef_params["connectedId"] = conn.connected_id
            result = client.request_product(url_path, codef_params)
        except CodefAPIError as e:
            raise HTTPException(502, f"CODEF 조회 실패 [{e.code}]: {e.message}")

        # 4) 응답 거래내역 → BankTransaction 변환 + 저장
        rows = result.rows
        if isinstance(rows, dict):
            # 가끔 dict 형식으로 옴 — resTrHistoryList 추출
            history = rows.get("resTrHistoryList", [])
        else:
            # rows 가 [dict] 형식이면 첫 entry 의 history 추출
            history = []
            for r in rows:
                if isinstance(r, dict):
                    history.extend(r.get("resTrHistoryList", []))

        new_txs = []
        inserted = 0
        duplicated = 0
        for r in history:
            trd = r.get("resAccountTrDate", "")
            trt = r.get("resAccountTrTime", "")
            if not trd or len(trd) != 8:
                continue
            try:
                td = date(int(trd[:4]), int(trd[4:6]), int(trd[6:8]))
            except (ValueError, TypeError):
                continue

            # 금액은 "1,234" 같은 쉼표/공백 포함 문자열로 올 수 있음.
            # 파싱 실패 한 건이 전체 수집을 500 으로 죽이지 않도록 안전 fallback.
            in_amt = _safe_codef_amount(r.get("resAccountIn"))
            out_amt = _safe_codef_amount(r.get("resAccountOut"))
            balance = _safe_codef_amount(r.get("resAfterTranBalance"))
            # CODEF 필드 매핑 (popbill 과 의미 일치시킴):
            #   resAccountDesc3 (거래상대방, 예: '정정길'/'롯데카드') → remark1 (메인 표시 + 분류 키)
            #   resAccountDesc2 (거래 매체, 예: '모바일')              → remark2 (보조 표시)
            #   resAccountDesc4 (지점/메모, 예: '광장동')               → remark3
            #   resAccountDesc1 (대부분 비어있음)                      → remark4
            remark1 = (r.get("resAccountDesc3", "") or "")[:200]
            remark2 = (r.get("resAccountDesc2", "") or "")[:200]
            remark3 = (r.get("resAccountDesc4", "") or "")[:200]
            remark4 = (r.get("resAccountDesc1", "") or "")[:200]

            # CODEF 거래에는 tid 가 없어서 (date, time, in, out, balance, remark1) 조합 unique key 생성
            tid = f"codef:{trd}{trt}:{in_amt}:{out_amt}:{balance}:{remark1[:30]}"

            existing_tx = service.session.exec(
                select(BankTransaction).where(
                    BankTransaction.account_id == acc.id,
                    BankTransaction.tid == tid,
                )
            ).first()
            if existing_tx:
                duplicated += 1
                continue

            tdt = None
            if trt and len(trt) == 6:
                try:
                    tdt = datetime(td.year, td.month, td.day,
                                   int(trt[:2]), int(trt[2:4]), int(trt[4:6]))
                except (ValueError, TypeError):
                    tdt = None

            tx = BankTransaction(
                business_id=bid,
                account_id=acc.id,
                tid=tid,
                trans_date=td,
                trans_time=trt or None,
                trans_dt=tdt,
                in_amount=in_amt,
                out_amount=out_amt,
                balance=balance,
                remark1=remark1 or None,
                remark2=remark2 or None,
                remark3=remark3 or None,
                remark4=remark4 or None,
                raw_json=json.dumps(r, ensure_ascii=False),
            )
            service.session.add(tx)
            new_txs.append(tx)
            inserted += 1

        service.session.flush()

        # 5) 자동 분류
        classify_counts = _classify_txs(service, bid, new_txs, only_unclassified=True)
        service.session.commit()

        return {
            "ok": True,
            "connected_id": connected_id[:8] + "...",  # 일부만 노출 (보안)
            "start_date": sd.isoformat(),
            "end_date": ed.isoformat(),
            "total_fetched": len(history),
            "inserted": inserted,
            "duplicated": duplicated,
            "auto_classified": classify_counts,
        }
    finally:
        service.close()


class PullMonthlyBulkIn(BaseModel):
    year: int = Field(..., description="대상 연도 (예: 2026)")
    account_id: Optional[int] = Field(default=None,
        description="특정 계좌만 동기화 (없으면 사업장의 모든 계좌)")
    start_month: int = Field(default=1, ge=1, le=12)
    end_month: Optional[int] = Field(default=None,
        description="없으면 현재월 (당해 연도) 또는 12 (과거 연도)")
    auto_reclassify_settlements: bool = Field(default=True,
        description="pull 후 settlement 강제 재분류도 실행")


@router.post("/pull-monthly-bulk")
def pull_monthly_bulk(
    body: PullMonthlyBulkIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """월별 일괄 동기화 — 연도 + 월 범위 지정해 모든 계좌의 거래내역을 한 번에 pull.

    각 월마다 _do_pull 호출 (popbill API → DB 저장 → 자동 분류 자동 실행).
    마지막에 settlement 강제 재분류도 옵션으로 실행 (학습 패턴 우선이 이미 가능하지만
    안전망 차원).

    Returns:
        {
          per_month: [{account_id, month, total_fetched, inserted, duplicated, auto_classified, error?}, ...],
          totals: {fetched, inserted, duplicated},
          settlement_reclassify: {scanned, card_settlement, pay_settlement, ...} or null
        }
    """
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        # 계좌 결정
        if body.account_id:
            accs = [service.session.get(BankAccount, body.account_id)]
            if not accs[0] or accs[0].business_id != bid:
                raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
        else:
            accs = service.session.exec(
                select(BankAccount).where(BankAccount.business_id == bid)
            ).all()
            if not accs:
                raise HTTPException(status_code=400, detail="등록된 계좌가 없습니다.")

        today = date.today()
        # end_month 결정
        if body.end_month is None:
            end_m = today.month if body.year == today.year else 12
        else:
            end_m = body.end_month

        per_month = []
        total_fetched = 0
        total_inserted = 0
        total_duplicated = 0

        for acc in accs:
            for m in range(body.start_month, end_m + 1):
                start_d = date(body.year, m, 1)
                if start_d > today:
                    break
                if m == 12:
                    end_d = date(body.year, 12, 31)
                else:
                    end_d = date(body.year, m + 1, 1) - timedelta(days=1)
                if end_d > today:
                    end_d = today

                month_label = f"{body.year}-{m:02d}"
                # popbill EasyFinBank 정책: 현재일로부터 3개월 초과 조회 불가 (-18000030)
                # 미리 클램프 — start_d 가 3개월 전 미만이면 그 시점으로 조정 또는 스킵
                popbill_min = today - timedelta(days=92)  # 3개월 + 약간 여유
                if end_d < popbill_min:
                    per_month.append({
                        "account_id": acc.id,
                        "account_label": f"{acc.bank_name} {_mask_account(acc.account_number)}",
                        "month": month_label,
                        "skipped": "popbill 3개월 한도 초과 — 신한 인터넷뱅킹 거래내역 Excel 다운로드 후 별도 업로드 필요",
                    })
                    continue
                clamped = False
                if start_d < popbill_min:
                    start_d = popbill_min
                    clamped = True

                try:
                    r = _do_pull(service, acc, bid, start_d, end_d, 500)
                    entry = {
                        "account_id": acc.id,
                        "account_label": f"{acc.bank_name} {_mask_account(acc.account_number)}",
                        "month": month_label,
                        "total_fetched": r["total_fetched"],
                        "inserted": r["inserted"],
                        "duplicated": r["duplicated"],
                        "auto_classified": r["auto_classified"],
                    }
                    if clamped:
                        entry["clamped_start_date"] = start_d.isoformat()
                        entry["clamped_note"] = "popbill 3개월 한도로 시작일 자동 조정"
                    per_month.append(entry)
                    total_fetched += r["total_fetched"]
                    total_inserted += r["inserted"]
                    total_duplicated += r["duplicated"]
                except RuntimeError as e:
                    per_month.append({
                        "account_id": acc.id,
                        "account_label": f"{acc.bank_name} {_mask_account(acc.account_number)}",
                        "month": month_label,
                        "error": str(e)[:200],
                    })
                    acc.last_sync_status = "error"
                    acc.last_sync_error = str(e)[:200]
                    service.session.add(acc)

        service.session.commit()

        # 정산 강제 재분류 (옵션)
        settlement_reclassify = None
        if body.auto_reclassify_settlements:
            stmt = select(BankTransaction).where(
                BankTransaction.business_id == bid,
                BankTransaction.in_amount > 0,
            )
            rows = service.session.exec(stmt).all()
            target_map = {
                "card": "card_settlement",
                "pay": "pay_settlement",
                "delivery": "delivery_settlement",
                "mobile": "mobile_settlement",
            }
            sr_counts = {
                "scanned": len(rows),
                "card_settlement": 0, "pay_settlement": 0,
                "delivery_settlement": 0, "mobile_settlement": 0,
                "already_correct": 0, "skipped_manual": 0, "skipped_no_match": 0,
            }
            now = datetime.now()
            user_pgs = service.session.exec(
                select(MobilePgConfig).where(
                    MobilePgConfig.business_id == bid,
                    MobilePgConfig.is_active == True,  # noqa: E712
                )
            ).all()
            for tx in rows:
                stype = None
                if user_pgs:
                    text = " ".join(filter(None, [tx.remark1, tx.remark2])).strip()
                    for pg in user_pgs:
                        if pg.keyword and pg.keyword in text:
                            stype = "mobile"
                            break
                if not stype:
                    s = _resolve_settlement(tx.remark1, tx.remark2)
                    if s is None:
                        sr_counts["skipped_no_match"] += 1
                        continue
                    stype, _name = s
                target = target_map[stype]
                if tx.classified_as == target:
                    sr_counts["already_correct"] += 1
                    continue
                if tx.classified_by == "manual":
                    sr_counts["skipped_manual"] += 1
                    continue
                tx.classified_as = target
                tx.classified_by = "reclassify_settlement"
                tx.classified_at = now
                _materialize_link(service, tx)
                service.session.add(tx)
                sr_counts[target] += 1
            service.session.commit()
            settlement_reclassify = sr_counts

        skipped_months = [pm for pm in per_month if "skipped" in pm]
        return {
            "per_month": per_month,
            "totals": {
                "fetched": total_fetched,
                "inserted": total_inserted,
                "duplicated": total_duplicated,
                "skipped_months": len(skipped_months),
            },
            "skipped_months": [pm["month"] for pm in skipped_months],
            "settlement_reclassify": settlement_reclassify,
        }
    finally:
        service.close()


@router.delete("/accounts/{account_id}")
def delete_account(
    account_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """DB에서 계좌 레코드 삭제 (팝빌 등록은 건드리지 않음). 관련 거래내역도 함께 삭제."""
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        acc = service.session.get(BankAccount, account_id)
        if not acc or acc.business_id != bid:
            raise HTTPException(status_code=404, detail="계좌를 찾을 수 없습니다.")
        # 관련 거래내역 일괄 제거 (linked revenue/expense는 유지)
        txs = service.session.exec(
            select(BankTransaction).where(BankTransaction.account_id == account_id)
        ).all()
        for t in txs:
            service.session.delete(t)
        service.session.delete(acc)
        service.session.commit()
        return {"deleted": True, "removed_transactions": len(txs)}
    finally:
        service.close()


# ============================================================
# 이동식 단말기 PG 설정 — 사업장별 CRUD (2026-05-12)
# 코페이/KSnet/키움페이 등 — 사장님이 직접 등록·수수료율 조정
# ============================================================

class MobilePgIn(BaseModel):
    name: str = Field(..., min_length=1, max_length=50, description="표시명 (예: '코페이')")
    keyword: str = Field(..., min_length=1, max_length=100, description="적요 매칭 키워드")
    commission_rate: float = Field(default=0.0275, ge=0, le=0.2,
        description="수수료율 (0~0.2, 예: 0.0275 = 2.75%)")
    note: Optional[str] = Field(default=None, max_length=500)
    is_active: bool = Field(default=True)


class MobilePgPatchIn(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=50)
    keyword: Optional[str] = Field(default=None, min_length=1, max_length=100)
    commission_rate: Optional[float] = Field(default=None, ge=0, le=0.2)
    note: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None


def _pg_to_dict(pg: MobilePgConfig) -> dict:
    return {
        "id": pg.id,
        "name": pg.name,
        "keyword": pg.keyword,
        "commission_rate": pg.commission_rate,
        "commission_pct": round((pg.commission_rate or 0) * 100, 3),
        "note": pg.note,
        "is_active": pg.is_active,
        "created_at": pg.created_at.isoformat() if pg.created_at else None,
        "updated_at": pg.updated_at.isoformat() if pg.updated_at else None,
    }


@router.get("/mobile-pgs")
def list_mobile_pgs(
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """사업장의 이동식 PG 설정 리스트."""
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        rows = service.session.exec(
            select(MobilePgConfig)
            .where(MobilePgConfig.business_id == bid)
            .order_by(MobilePgConfig.created_at.desc())
        ).all()
        return [_pg_to_dict(r) for r in rows]
    finally:
        service.close()


@router.post("/mobile-pgs")
def create_mobile_pg(
    body: MobilePgIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """이동식 PG 신규 등록."""
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        # 동일 사업장 + 동일 키워드 중복 방지
        existing = service.session.exec(
            select(MobilePgConfig).where(
                MobilePgConfig.business_id == bid,
                MobilePgConfig.keyword == body.keyword,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"이미 등록된 키워드입니다: '{body.keyword}' (PG: {existing.name})",
            )
        pg = MobilePgConfig(
            business_id=bid,
            name=body.name.strip(),
            keyword=body.keyword.strip(),
            commission_rate=body.commission_rate,
            note=body.note,
            is_active=body.is_active,
        )
        service.session.add(pg)
        service.session.commit()
        service.session.refresh(pg)
        return _pg_to_dict(pg)
    finally:
        service.close()


@router.patch("/mobile-pgs/{pg_id}")
def update_mobile_pg(
    pg_id: int,
    body: MobilePgPatchIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """이동식 PG 수정 (수수료율 조정 등)."""
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        pg = service.session.get(MobilePgConfig, pg_id)
        if not pg or pg.business_id != bid:
            raise HTTPException(status_code=404, detail="PG 설정을 찾을 수 없습니다.")
        if body.name is not None:
            pg.name = body.name.strip()
        if body.keyword is not None:
            pg.keyword = body.keyword.strip()
        if body.commission_rate is not None:
            pg.commission_rate = body.commission_rate
        if body.note is not None:
            pg.note = body.note
        if body.is_active is not None:
            pg.is_active = body.is_active
        pg.updated_at = datetime.now()
        service.session.add(pg)
        service.session.commit()
        service.session.refresh(pg)
        return _pg_to_dict(pg)
    finally:
        service.close()


@router.delete("/mobile-pgs/{pg_id}")
def delete_mobile_pg(
    pg_id: int,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """이동식 PG 삭제 (이미 분류된 과거 거래는 그대로 유지)."""
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()
    try:
        pg = service.session.get(MobilePgConfig, pg_id)
        if not pg or pg.business_id != bid:
            raise HTTPException(status_code=404, detail="PG 설정을 찾을 수 없습니다.")
        service.session.delete(pg)
        service.session.commit()
        return {"deleted": True, "id": pg_id}
    finally:
        service.close()


# ============================================================
# 수수료 역산 통계 (2026-05-12)
# ============================================================

@router.get("/settlement-stats")
def get_settlement_stats(
    year: int = Query(..., description="대상 연도"),
    month: int = Query(..., description="대상 월 (1-12)"),
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """월별 카드/페이/배달앱 정산 통계 — 수수료 역산.

    카드:
      - 같은 (business_id, card_corp, year, month) 의 CardSalesApproval 합 = sales_amount
      - 같은 그룹의 CardPayment 합 = net_deposit
      - fees = sales - net_deposit (sales >= deposit 인 경우만)
      - fee_rate_pct = fees / sales * 100

    페이:
      - PayPayment 의 net_deposit 만 표시. sales_amount 가 채워져 있으면 rate 산출.

    배달앱:
      - DeliveryRevenue 의 total_sales / total_fees / settlement_amount 그대로 사용.
      - fee_rate_pct = total_fees / total_sales * 100
    """
    bid = _resolve_bid(admin, x_view_as_business)
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="month 는 1-12")
    start = date(year, month, 1)
    if month == 12:
        next_start = date(year + 1, 1, 1)
    else:
        next_start = date(year, month + 1, 1)
    end = next_start - timedelta(days=1)

    service = DatabaseService()
    try:
        sess = service.session

        # --- 카드 ---
        card_payments = sess.exec(
            select(CardPayment).where(
                CardPayment.business_id == bid,
                CardPayment.payment_date >= start,
                CardPayment.payment_date <= end,
            )
        ).all()
        card_approvals = sess.exec(
            select(CardSalesApproval).where(
                CardSalesApproval.business_id == bid,
                CardSalesApproval.approval_date >= start,
                CardSalesApproval.approval_date <= end,
                CardSalesApproval.status == "승인",
            )
        ).all()
        # group by card_corp
        deposit_by_corp: dict = {}
        for cp in card_payments:
            d = deposit_by_corp.setdefault(cp.card_corp, {"net_deposit": 0, "rows": 0, "fees_recorded": 0})
            d["net_deposit"] += cp.net_deposit or 0
            d["fees_recorded"] += cp.fees or 0
            d["rows"] += 1
        sales_by_corp: dict = {}
        for ap in card_approvals:
            sales_by_corp[ap.card_corp] = sales_by_corp.get(ap.card_corp, 0) + (ap.amount or 0)
        all_corps = set(deposit_by_corp.keys()) | set(sales_by_corp.keys())
        card_rows = []
        for corp in sorted(all_corps):
            sales = sales_by_corp.get(corp, 0)
            d = deposit_by_corp.get(corp, {"net_deposit": 0, "rows": 0, "fees_recorded": 0})
            deposit = d["net_deposit"]
            # 기록된 fees 가 있으면 우선 사용, 없으면 sales - deposit
            fees = d["fees_recorded"] if d["fees_recorded"] > 0 else max(sales - deposit, 0)
            rate = round(fees / sales * 100, 2) if sales > 0 else None
            card_rows.append({
                "corp": corp,
                "sales_amount": sales,
                "net_deposit": deposit,
                "fees": fees,
                "fee_rate_pct": rate,
                "tx_count": d["rows"],
            })

        # --- 페이 + 이동식 카드매출 (PayPayment 공유, source 로 분기) ---
        pay_payments = sess.exec(
            select(PayPayment).where(
                PayPayment.business_id == bid,
                PayPayment.payment_date >= start,
                PayPayment.payment_date <= end,
            )
        ).all()
        pay_groups: dict = {}
        mobile_groups: dict = {}
        for pp in pay_payments:
            target = mobile_groups if pp.source == "bank_sync_mobile" else pay_groups
            g = target.setdefault(pp.pay_corp, {"sales_amount": 0, "net_deposit": 0, "fees": 0, "rows": 0})
            g["sales_amount"] += pp.sales_amount or 0
            g["net_deposit"] += pp.net_deposit or 0
            g["fees"] += pp.fees or 0
            g["rows"] += 1

        def _group_to_rows(groups: dict) -> list:
            rows = []
            for corp in sorted(groups.keys()):
                g = groups[corp]
                rate = round(g["fees"] / g["sales_amount"] * 100, 2) if g["sales_amount"] > 0 else None
                rows.append({
                    "corp": corp,
                    "sales_amount": g["sales_amount"],
                    "net_deposit": g["net_deposit"],
                    "fees": g["fees"],
                    "fee_rate_pct": rate,
                    "tx_count": g["rows"],
                })
            return rows

        pay_rows = _group_to_rows(pay_groups)
        mobile_rows = _group_to_rows(mobile_groups)

        # --- 배달앱 ---
        delivery_rows_db = sess.exec(
            select(DeliveryRevenue).where(
                DeliveryRevenue.business_id == bid,
                DeliveryRevenue.year == year,
                DeliveryRevenue.month == month,
            )
        ).all()
        delivery_rows = []
        for dr in sorted(delivery_rows_db, key=lambda r: r.channel):
            sales = dr.total_sales or 0
            fees = dr.total_fees or 0
            settlement = dr.settlement_amount or 0
            # fees 가 기록 안 됐고 sales 가 있으면 sales - settlement 로 추정
            if fees == 0 and sales > 0 and settlement > 0:
                fees = max(sales - settlement, 0)
            rate = round(fees / sales * 100, 2) if sales > 0 else None
            delivery_rows.append({
                "channel": dr.channel,
                "total_sales": sales,
                "settlement_amount": settlement,
                "total_fees": fees,
                "fee_rate_pct": rate,
                "order_count": dr.order_count or 0,
                "source": dr.source,
            })

        return {
            "year": year,
            "month": month,
            "card": card_rows,
            "pay": pay_rows,
            "mobile": mobile_rows,
            "delivery": delivery_rows,
        }
    finally:
        service.close()
