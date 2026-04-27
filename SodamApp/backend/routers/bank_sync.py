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
import re
from datetime import date, datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlmodel import select, or_

from collections import Counter, defaultdict

from models import User, BankAccount, BankTransaction, Vendor, DailyExpense
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
    classified_as: Optional[str] = Field(None, description="revenue/expense/purchase/transfer/excluded/unclassified")
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
    classified_as: Optional[str] = Query(None, description="unclassified/revenue/expense/purchase/transfer/excluded"),
    direction: Optional[str] = Query(None, description="in / out / all"),
    q: Optional[str] = Query(None, description="remark1 부분검색"),
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
            valid = {"unclassified", "revenue", "expense", "purchase", "transfer", "excluded"}
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
    """tx.classified_as 에 맞춰 DailyExpense 레코드 생성/갱신/삭제.

    - revenue: 입금액 → DailyExpense + revenue Vendor 자동 매칭/생성 → 매출관리에 표시
    - expense/purchase: 출금액 → DailyExpense (vendor_id null 허용) → 매입관리에 표시
    - 기존 linked 있으면 갱신 (분류 변경시)
    - transfer/excluded/unclassified: 기존 link 제거

    레거시: linked_revenue_id / linked_expense_id 필드는 보존(기존 데이터 호환).
    실제 화면 연동은 linked_daily_id 통해 수행.
    """
    sess = service.session

    # 1) 기존 DailyExpense 링크 정리 — 분류가 바뀌면 항상 새로 만든다
    if tx.linked_daily_id:
        old = sess.get(DailyExpense, tx.linked_daily_id)
        if old:
            sess.delete(old)
        tx.linked_daily_id = None

    # 2) 분류가 transfer/excluded/unclassified 면 링크만 제거하고 종료
    if tx.classified_as in ("transfer", "excluded", "unclassified"):
        return

    # 3) 매출 (입금)
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

    # 4) 매입/지출 (출금)
    if tx.classified_as in ("expense", "purchase") and tx.out_amount > 0:
        vendor_name = tx.remark1 or tx.remark2 or "은행출금"
        category = "매입" if tx.classified_as == "purchase" else "기타비용"
        de = DailyExpense(
            business_id=tx.business_id,
            date=tx.trans_date,
            vendor_name=vendor_name,
            vendor_id=tx.vendor_id,  # 매칭 안된 경우 None — 매입관리는 null 허용
            amount=tx.out_amount,
            category=category,
            payment_method="이체",
            note=(tx.remark1 or "") + ((" / " + tx.remark2) if tx.remark2 else ""),
        )
        sess.add(de)
        sess.flush()
        tx.linked_daily_id = de.id


# ============================================================
# 매출 채널 매핑 (입금 remark → 표준 채널명/카테고리)
# 우선순위: 위에서 아래 순서대로 first-match
# ============================================================

REVENUE_CHANNEL_MAP: List[tuple] = [
    # (키워드, 표준 vendor_name, Vendor.category, payment_method)
    # 배달앱 — delivery 카테고리
    ("쿠팡이츠", "쿠팡이츠", "delivery", "Card"),
    ("쿠팡페이", "쿠팡이츠", "delivery", "Card"),
    ("쿠팡", "쿠팡이츠", "delivery", "Card"),
    ("배달의민족", "배달의민족", "delivery", "Card"),
    ("배달의민", "배달의민족", "delivery", "Card"),
    ("배민", "배달의민족", "delivery", "Card"),
    ("요기요", "요기요", "delivery", "Card"),
    ("음식배달", "음식배달", "delivery", "Card"),
    # 페이먼트/간편결제 — store 카테고리
    ("카카오페이", "카카오페이", "store", "Card"),
    ("네이버페이", "네이버페이", "store", "Card"),
    ("네이버", "네이버페이", "store", "Card"),
    ("토스", "토스페이", "store", "Card"),
    ("서울페이", "서울페이", "store", "Card"),
    ("제로페이", "제로페이", "store", "Card"),
    # 카드 매입 정산 — store 카테고리
    ("카드매입", "카드매입", "store", "Card"),
    ("매입대금", "카드매입", "store", "Card"),
    ("매출표", "카드매입", "store", "Card"),
    ("BC카드", "카드매입", "store", "Card"),
    ("신한카드", "카드매입", "store", "Card"),
    ("KB국민카드", "카드매입", "store", "Card"),
    ("국민카드", "카드매입", "store", "Card"),
    ("삼성카드", "카드매입", "store", "Card"),
    ("현대카드", "카드매입", "store", "Card"),
    ("롯데카드", "카드매입", "store", "Card"),
    ("하나카드", "카드매입", "store", "Card"),
    ("NH카드", "카드매입", "store", "Card"),
    ("우리카드", "카드매입", "store", "Card"),
    ("나이스결제", "카드매입", "store", "Card"),
    ("NICE", "카드매입", "store", "Card"),
    ("KG이니시스", "카드매입", "store", "Card"),
    ("이니시스", "카드매입", "store", "Card"),
    # 카드 매입 약식 패턴 (팝빌 test 데이터에서 관측: "FB자금"/"FB이체"/"원신한")
    # 입금 한정으로 적용되므로 출금 건은 영향 없음
    ("원신한", "카드매입", "store", "Card"),
    ("FB자금", "카드매입", "store", "Card"),
    ("FB이체", "카드매입", "store", "Card"),
]

TRANSFER_KEYWORDS = ["내계좌", "자행이체", "이체입금", "적금이체", "예금이체", "본인이체"]


def _resolve_revenue_channel(remark1: Optional[str], remark2: Optional[str]) -> tuple:
    """입금 remark → (vendor_name, category, payment_method). 미매칭이면 ('기타매출', 'store', 'Card')."""
    text = " ".join(filter(None, [remark1, remark2])).strip()
    for keyword, name, category, payment in REVENUE_CHANNEL_MAP:
        if keyword in text:
            return name, category, payment
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

    # 1) 학습 패턴 (가장 강한 시그널 — 과거 분류 인계)
    if tx.remark1 and tx.remark1 in learned_remarks:
        return learned_remarks[tx.remark1]

    # 2) 이체 키워드 (revenue 키워드보다 우선)
    if any(k in remark for k in TRANSFER_KEYWORDS):
        return "transfer"

    # 3) 입금 → 매출 (channel map 매칭 또는 미매칭 시 unclassified 유지)
    if tx.in_amount > 0:
        # 입금은 채널 매핑 시도 (매칭 실패시 기타매출 처리는 _materialize_link에서)
        # 키워드 매칭이 1개라도 되면 revenue 로 분류
        for keyword, _name, _cat, _pay in REVENUE_CHANNEL_MAP:
            if keyword in remark:
                return "revenue"
        # 매칭 안 되면 미분류 유지 (자동 default 매출은 보수적으로 비활성)
        return None

    # 4) 출금 → 벤더 매칭 시 expense/purchase, 미매칭이면 default expense
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
    counts = {"revenue": 0, "expense": 0, "purchase": 0, "transfer": 0, "learned": 0, "skip": 0}
    if not txs:
        return counts

    sess = service.session
    now = datetime.now()

    vendors = sess.exec(
        select(Vendor).where(Vendor.business_id == business_id)
    ).all()
    vendor_by_name = {v.name.strip(): v for v in vendors if v.name}

    learned_remarks = _build_learned_remark_map(sess, business_id)

    for tx in txs:
        if only_unclassified and tx.classified_as != "unclassified":
            continue

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
    """규칙 기반 자동 분류 (학습 패턴 + 채널 매핑 + 벤더 매칭 + 출금 default).

    분류 우선순위 (_classify_one_tx 안에서):
      1. 학습 패턴: 이 사업장에서 같은 remark1 으로 분류된 과거 이력 (>=80% 합의)
      2. 이체 키워드 → transfer
      3. 입금 + REVENUE_CHANNEL_MAP 매칭 → revenue (채널별 Vendor 자동 생성)
      4. 출금 + 벤더 매칭 → expense/purchase (vendor.vendor_type/category 따라 결정)
      5. 출금 + 미매칭 → expense (기본값. 사용자가 수동 보정 가능)

    분류된 tx 는 즉시 DailyExpense 레코드를 생성/갱신하여
    매출관리(/revenue) · 매입관리(/purchase) 화면에 자동 노출.
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
