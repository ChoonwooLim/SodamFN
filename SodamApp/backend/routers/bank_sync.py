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
from sqlmodel import select, and_, or_

from models import User, BankAccount, BankTransaction, Revenue, Expense, Vendor, Business
from routers.auth import get_admin_user
from services.database_service import DatabaseService
from services.bank_sync_service import (
    BANK_NAMES,
    BankAccountInfo,
    BankSearchResult,
    BankTxRow,
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
    note = (
        "⚠️ STUB 모드. 실제 팝빌 연결 없이 더미 데이터 반환. "
        "POPBILL_LINK_ID/SECRET_KEY 설정 시 자동으로 popbill 활성."
        if is_stub
        else "✅ 실제 팝빌 계좌조회 연결 (정액제 기반, 실서비스)."
    )
    return {
        "active": provider.name,
        "is_stub": is_stub,
        "balance_point": balance,
        "note": note,
        "bank_names": BANK_NAMES,
    }


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


@router.post("/accounts/{account_id}/pull")
def pull_transactions(
    account_id: int,
    body: PullIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """지정 계좌의 거래내역을 팝빌에서 가져와 BankTransaction 에 upsert.

    - 중복: (account_id, tid) UNIQUE 로 스킵
    - 페이지네이션: 응답이 per_page 채우면 page++ 반복 (최대 20페이지)
    """
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

        provider = get_provider()
        inserted = 0
        duplicated = 0
        page = 1
        total_fetched = 0
        MAX_PAGES = 20

        try:
            while page <= MAX_PAGES:
                res: BankSearchResult = provider.search(
                    bank_code=acc.bank_code,
                    account_number=acc.account_number,
                    start_date=start_d,
                    end_date=end_d,
                    order="A",   # 오름차순 (과거→최근) — 누적 적재에 유리
                    page=page,
                    per_page=body.per_page,
                )
                if not res.ok:
                    acc.last_sync_status = "failed"
                    acc.last_sync_error = res.error
                    acc.last_sync_at = datetime.now()
                    service.session.add(acc)
                    service.session.commit()
                    raise HTTPException(status_code=502, detail=f"거래내역 조회 실패: {res.error}")

                if not res.rows:
                    break

                for r in res.rows:
                    total_fetched += 1
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
                        business_id=bid,
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
                    inserted += 1

                # 다음 페이지 필요 여부 판단
                if len(res.rows) < body.per_page:
                    break
                page += 1

            acc.last_sync_at = datetime.now()
            acc.last_sync_status = "success"
            acc.last_sync_error = None
            service.session.add(acc)
            service.session.commit()
        except HTTPException:
            raise
        except Exception as e:
            service.session.rollback()
            acc.last_sync_status = "failed"
            acc.last_sync_error = str(e)
            acc.last_sync_at = datetime.now()
            service.session.add(acc)
            service.session.commit()
            raise HTTPException(status_code=500, detail=f"거래내역 적재 오류: {e}")

        return {
            "account_id": acc.id,
            "start_date": start_d.isoformat(),
            "end_date": end_d.isoformat(),
            "total_fetched": total_fetched,
            "inserted": inserted,
            "duplicated": duplicated,
            "pages_fetched": page,
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
    """tx.classified_as 에 맞춰 Revenue/Expense 레코드 생성/갱신.

    - revenue: 입금액을 Revenue(channel='은행입금') 로 등록. description 에 remark1
    - expense: 출금액을 Expense(category='기타') 로 등록. vendor_id 있으면 연결
    - 기존 linked 가 있으면 금액만 업데이트
    - transfer/excluded/unclassified: 링크 해제
    """
    # 먼저 기존 링크 제거 (분류 바뀔 때)
    if tx.classified_as in ("transfer", "excluded", "unclassified"):
        if tx.linked_revenue_id:
            r = service.session.get(Revenue, tx.linked_revenue_id)
            if r:
                service.session.delete(r)
            tx.linked_revenue_id = None
        if tx.linked_expense_id:
            e = service.session.get(Expense, tx.linked_expense_id)
            if e:
                service.session.delete(e)
            tx.linked_expense_id = None
        return

    if tx.classified_as == "revenue" and tx.in_amount > 0:
        desc = tx.remark1 or tx.remark2 or "은행입금"
        if tx.linked_revenue_id:
            r = service.session.get(Revenue, tx.linked_revenue_id)
            if r:
                r.date = tx.trans_date
                r.amount = tx.in_amount
                r.description = desc
                r.channel = "은행입금"
                service.session.add(r)
                return
        rev = Revenue(
            date=tx.trans_date,
            channel="은행입금",
            amount=tx.in_amount,
            description=desc,
            business_id=tx.business_id,
        )
        service.session.add(rev)
        service.session.flush()
        tx.linked_revenue_id = rev.id

    elif tx.classified_as in ("expense", "purchase") and tx.out_amount > 0:
        desc = tx.remark1 or tx.remark2 or "은행출금"
        category = "매입" if tx.classified_as == "purchase" else "기타"
        if tx.linked_expense_id:
            e = service.session.get(Expense, tx.linked_expense_id)
            if e:
                e.date = tx.trans_date
                e.amount = tx.out_amount
                e.category = category
                e.description = desc
                e.vendor_id = tx.vendor_id
                service.session.add(e)
                return
        exp = Expense(
            date=tx.trans_date,
            amount=tx.out_amount,
            category=category,
            payment_method="은행이체",
            description=desc,
            vendor_id=tx.vendor_id,
            business_id=tx.business_id,
        )
        service.session.add(exp)
        service.session.flush()
        tx.linked_expense_id = exp.id


@router.post("/transactions/auto-classify")
def auto_classify(
    body: AutoClassifyIn,
    admin: User = Depends(get_admin_user),
    x_view_as_business: Optional[int] = Header(None, alias="X-View-As-Business"),
):
    """간단한 규칙 기반 자동 분류.

    규칙 (확장 예정):
      - 입금(in_amount > 0) + remark1 ∈ {쿠팡이츠, 배달의민족, 요기요, 네이버페이,
          카드매입, 매입대금, BC카드, 신한카드, ...} → revenue
      - 출금(out_amount > 0) + vendor_id 매칭되면 expense/purchase
      - 이체/내부이체/내계좌 등 키워드 → transfer
      - 기타는 unclassified 유지 (수동)
    """
    bid = _resolve_bid(admin, x_view_as_business)
    service = DatabaseService()

    REVENUE_KEYWORDS = [
        "쿠팡이츠", "쿠팡", "배달의민족", "배달의민", "요기요", "네이버페이", "네이버",
        "카카오페이", "카드매입", "매입대금", "BC카드", "신한카드", "KB국민카드",
        "삼성카드", "현대카드", "롯데카드", "하나카드", "NH카드", "우리카드",
        "나이스결제", "NICE", "KG이니시스", "이니시스", "토스",
    ]
    TRANSFER_KEYWORDS = ["내계좌", "자행이체", "이체입금", "적금이체", "예금이체"]

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

        counts = {"revenue": 0, "expense": 0, "purchase": 0, "transfer": 0, "skip": 0}
        now = datetime.now()

        # 벤더명 매핑 (expense 후보)
        vendors = service.session.exec(
            select(Vendor).where(Vendor.business_id == bid)
        ).all()
        vendor_by_name = {v.name.strip(): v for v in vendors if v.name}

        for tx in rows:
            remark = " ".join(filter(None, [tx.remark1, tx.remark2, tx.remark3])).strip()
            if not remark:
                counts["skip"] += 1
                continue

            # 이체 키워드 우선
            if any(k in remark for k in TRANSFER_KEYWORDS):
                tx.classified_as = "transfer"
                tx.classified_by = "auto"
                tx.classified_at = now
                counts["transfer"] += 1
                service.session.add(tx)
                continue

            if tx.in_amount > 0:
                if any(k in remark for k in REVENUE_KEYWORDS):
                    tx.classified_as = "revenue"
                    tx.classified_by = "auto"
                    tx.classified_at = now
                    _materialize_link(service, tx)
                    counts["revenue"] += 1
                    service.session.add(tx)
                    continue
                counts["skip"] += 1
                continue

            if tx.out_amount > 0:
                matched_vendor = None
                for name, v in vendor_by_name.items():
                    if name and name in remark:
                        matched_vendor = v
                        break
                if matched_vendor:
                    tx.vendor_id = matched_vendor.id
                    tx.classified_as = "purchase" if matched_vendor.vendor_type == "expense" and matched_vendor.category in ("식자재", "매입") else "expense"
                    tx.classified_by = "auto"
                    tx.classified_at = now
                    _materialize_link(service, tx)
                    counts[tx.classified_as] += 1
                    service.session.add(tx)
                    continue

            counts["skip"] += 1

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
