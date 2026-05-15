"""홈택스 수집 provider — CODEF organization 0001 (국세청) 호출 wrapping.

발행은 팝빌, 조회/수집은 CODEF — 외부 통합 전략 SSOT 일관.

다루는 자료:
  cash_sales         : 현금영수증 매출 (cash-sales-sum-details)
  cash_purchase      : 현금영수증 매입 (cash-purchase-details)
  tax_invoice_int    : 전자세금계산서 통합 매입+매출 (taxinvoice-integrated-list)
  vat_return         : 부가세 신고결과 (report-tax-result)

조회 후 HometaxRecord 로 upsert + HometaxSyncCursor 갱신.
"""
from __future__ import annotations

import datetime
import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from models import (
    Business,
    CodefConnection,
    HometaxRecord,
    HometaxSyncCursor,
)
from .codef_client import CodefClient

logger = logging.getLogger("sodam.codef.hometax")


# CODEF 홈택스 organization 코드 — product 별로 다름 (PDF spec 검증)
# 0001 은 존재하지 않는 코드 (CF-04033) — 절대 사용 금지.
ORG_CASH_RECEIPT = "0003"        # 현금영수증 (매입/매출)
ORG_TAX_INVOICE = "0002"         # 전자세금계산서 (통계/발행 등)
ORG_HOMETAX_GENERAL = "0004"     # 세금 납부/환급, 사업자등록상태
ORG_CARD_SALES = "0006"          # 신용카드 매출자료

# connect (최초 등록) 시 사용할 organization — 사장님 우선순위(현금영수증) 기준.
# CODEF 는 organization 별 별도 connectedId 발급 — 다른 product 호출 시 추가 등록 필요.
HOMETAX_ORG_CODE = ORG_CASH_RECEIPT

# CODEF API path — 사장님 제공 PDF spec 으로 모두 확정.
PATH_CASH_PURCHASE = "/v1/kr/public/nt/cash-receipt/purchase-details"
PATH_CASH_SALES = "/v1/kr/public/nt/cash-receipt/sales-details"
# "전자세금계산서 기간별 매출/매입 통계" — 매출+매입 합계 한 번에.
PATH_TAXINVOICE_INTEGRATED = "/v1/kr/public/nt/tax-invoice/sales-purchase-statistics"


@dataclass
class SyncResult:
    ok: bool
    record_type: str
    rows_inserted: int = 0
    rows_updated: int = 0
    rows_total: int = 0
    error: Optional[str] = None


def _normalize(raw: str) -> str:
    return re.sub(r"\D", "", str(raw or ""))


def _parse_date(raw) -> Optional[datetime.date]:
    """YYYYMMDD / YYYY-MM-DD / yyyy.MM.dd 등 다양한 포맷에서 date 추출."""
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    digits = re.sub(r"\D", "", s)
    if len(digits) >= 8:
        try:
            return datetime.date(int(digits[:4]), int(digits[4:6]), int(digits[6:8]))
        except ValueError:
            return None
    return None


def _as_int(raw) -> int:
    if raw is None or raw == "":
        return 0
    try:
        return int(re.sub(r"[^\d-]", "", str(raw)) or "0")
    except Exception:  # noqa: BLE001
        return 0


class CodefHometaxProvider:
    """홈택스 자료 수집 어댑터.

    각 sync_* 메서드는 connection_id 받아 CODEF API 호출 → DB 적재.
    cursor 기반 증분 sync: HometaxSyncCursor.last_tx_date 다음날부터 오늘까지.
    """

    def __init__(self, engine, client: Optional[CodefClient] = None):
        self.engine = engine
        self._client = client or CodefClient()

    # ─── 헬퍼 ────────────────────────────────────────

    def _get_connection(self, connection_id: int) -> CodefConnection:
        with Session(self.engine) as s:
            conn = s.get(CodefConnection, connection_id)
            if not conn:
                raise ValueError(f"connection {connection_id} 없음")
            if conn.organization_code != HOMETAX_ORG_CODE:
                raise ValueError(
                    f"홈택스 연결이 아님 (organization_code={conn.organization_code})"
                )
            return conn

    def _get_business_reg_no(self, business_id: int) -> str:
        with Session(self.engine) as s:
            biz = s.get(Business, business_id)
            if not biz or not biz.business_number:
                return ""
            return _normalize(biz.business_number)

    def _date_range(self, business_id: int, record_type: str,
                    fallback_days: int = 30) -> tuple[str, str]:
        """cursor 기반 sync 범위 산출 (YYYYMMDD ~ YYYYMMDD).

        cursor 가 있으면 last_tx_date + 1 일 ~ 오늘.
        없으면 fallback_days 일 전 ~ 오늘.
        """
        today = datetime.date.today()
        with Session(self.engine) as s:
            cur = s.exec(select(HometaxSyncCursor).where(
                HometaxSyncCursor.business_id == business_id,
                HometaxSyncCursor.record_type == record_type,
            )).first()
            if cur and cur.last_tx_date:
                start = cur.last_tx_date + datetime.timedelta(days=1)
            else:
                start = today - datetime.timedelta(days=fallback_days)
        if start > today:
            start = today
        return start.strftime("%Y%m%d"), today.strftime("%Y%m%d")

    def _update_cursor(self, business_id: int, record_type: str,
                       last_tx_date: Optional[datetime.date],
                       status: str, error: Optional[str] = None,
                       added_rows: int = 0) -> None:
        with Session(self.engine) as s:
            cur = s.exec(select(HometaxSyncCursor).where(
                HometaxSyncCursor.business_id == business_id,
                HometaxSyncCursor.record_type == record_type,
            )).first()
            now = datetime.datetime.utcnow()
            if cur:
                cur.last_synced_at = now
                if last_tx_date and (not cur.last_tx_date or last_tx_date > cur.last_tx_date):
                    cur.last_tx_date = last_tx_date
                cur.last_status = status
                cur.last_error = (error or "")[:500] if error else None
                cur.rows_total = (cur.rows_total or 0) + max(added_rows, 0)
                s.add(cur)
            else:
                s.add(HometaxSyncCursor(
                    business_id=business_id,
                    record_type=record_type,
                    last_synced_at=now,
                    last_tx_date=last_tx_date,
                    last_status=status,
                    last_error=(error or "")[:500] if error else None,
                    rows_total=max(added_rows, 0),
                ))
            s.commit()

    def _upsert_record(self, business_id: int, record_type: str,
                       identifier: str, tx_date: datetime.date,
                       *, counterparty_name: str = "",
                       counterparty_corp_num: str = "",
                       supply_cost: int = 0, tax: int = 0, total_amount: int = 0,
                       item_name: str = "", raw: Optional[dict] = None) -> bool:
        """단건 upsert. Returns True if newly inserted, False if updated."""
        with Session(self.engine) as s:
            existing = s.exec(select(HometaxRecord).where(
                HometaxRecord.business_id == business_id,
                HometaxRecord.record_type == record_type,
                HometaxRecord.identifier == identifier,
            )).first()
            now = datetime.datetime.utcnow()
            if existing:
                existing.tx_date = tx_date
                existing.counterparty_name = counterparty_name or existing.counterparty_name
                existing.counterparty_corp_num = counterparty_corp_num or existing.counterparty_corp_num
                existing.supply_cost = supply_cost or existing.supply_cost
                existing.tax = tax or existing.tax
                existing.total_amount = total_amount or existing.total_amount
                existing.item_name = item_name or existing.item_name
                if raw is not None:
                    existing.raw_json = json.dumps(raw, ensure_ascii=False)
                existing.updated_at = now
                s.add(existing)
                s.commit()
                return False
            s.add(HometaxRecord(
                business_id=business_id,
                record_type=record_type,
                identifier=identifier,
                tx_date=tx_date,
                counterparty_name=counterparty_name or None,
                counterparty_corp_num=counterparty_corp_num or None,
                supply_cost=supply_cost,
                tax=tax,
                total_amount=total_amount,
                item_name=item_name or None,
                raw_json=json.dumps(raw, ensure_ascii=False) if raw else None,
                created_at=now, updated_at=now,
            ))
            s.commit()
            return True

    # ─── sync 메서드 ─────────────────────────────────

    def sync_cash_sales(self, connection_id: int) -> SyncResult:
        """현금영수증 매출 수집 (organization 0003)."""
        return self._sync_cash_receipt(
            connection_id=connection_id,
            record_type="cash_sales",
            api_path=PATH_CASH_SALES,
            organization=ORG_CASH_RECEIPT,
        )

    def sync_cash_purchase(self, connection_id: int) -> SyncResult:
        """현금영수증 매입내역 수집 (organization 0003)."""
        return self._sync_cash_receipt(
            connection_id=connection_id,
            record_type="cash_purchase",
            api_path=PATH_CASH_PURCHASE,
            organization=ORG_CASH_RECEIPT,
        )

    def _sync_cash_receipt(self, connection_id: int, record_type: str,
                            api_path: str, organization: str) -> SyncResult:
        try:
            conn = self._get_connection(connection_id)
        except ValueError as e:
            return SyncResult(ok=False, record_type=record_type, error=str(e))

        business_id = conn.business_id
        biz_reg_no = self._get_business_reg_no(business_id)
        s_date, e_date = self._date_range(business_id, record_type, fallback_days=30)

        # CODEF 공공 API spec (PDF 검증):
        # organization (product 별 다름 — 인자로 전달), connectedId,
        # startDate(YYYYMMDD), endDate(YYYYMMDD),
        # orderBy("0"=오름차순/"1"=내림차순), inquiryType("0"=전체/"1"=본인사업장/"2"=별도사업장)
        # identity (사업자번호, 다중 사업장 시 필수)
        params = {
            "organization": organization,
            "connectedId": conn.connected_id,
            "startDate": s_date,
            "endDate": e_date,
            "orderBy": "0",
            "inquiryType": "0",  # 전체
        }
        if biz_reg_no:
            params["identity"] = biz_reg_no
        try:
            result = self._client.request_product(api_path, params)
        except Exception as e:  # noqa: BLE001
            logger.warning("hometax %s 호출 실패: %s", record_type, e)
            self._update_cursor(business_id, record_type, None, "failed", str(e))
            return SyncResult(ok=False, record_type=record_type, error=str(e))

        rows = result.rows or []
        inserted = updated = 0
        latest_date: Optional[datetime.date] = None
        for row in rows:
            tx_date = _parse_date(row.get("resTradeDate") or row.get("commTradeDate") or row.get("resReceiptDate"))
            if not tx_date:
                continue
            identifier = (
                row.get("resApprovalNo")
                or row.get("commApprovalNum")
                or row.get("resReceiptNo")
                or f"{record_type}:{tx_date.isoformat()}:{row.get('resTotAmt') or ''}"
            )
            is_new = self._upsert_record(
                business_id=business_id,
                record_type=record_type,
                identifier=str(identifier),
                tx_date=tx_date,
                counterparty_name=str(row.get("resFranchiseName") or row.get("resBuyerName") or ""),
                counterparty_corp_num=_normalize(row.get("resFranchiseCorpNum") or row.get("resBuyerCorpNum") or ""),
                supply_cost=_as_int(row.get("resSupplyCost") or row.get("resSupplyAmt")),
                tax=_as_int(row.get("resTaxAmt") or row.get("resTax")),
                total_amount=_as_int(row.get("resTotAmt") or row.get("resTotalAmount")),
                item_name=str(row.get("resItemName") or ""),
                raw=row,
            )
            if is_new:
                inserted += 1
            else:
                updated += 1
            if latest_date is None or tx_date > latest_date:
                latest_date = tx_date

        self._update_cursor(business_id, record_type, latest_date, "success", added_rows=inserted)
        return SyncResult(
            ok=True, record_type=record_type,
            rows_inserted=inserted, rows_updated=updated, rows_total=len(rows),
        )

    def sync_tax_invoice_integrated(self, connection_id: int) -> SyncResult:
        """전자세금계산서 통합 매입+매출 (taxinvoice-integrated-list).

        하나의 호출 결과를 매출/매입 으로 분리해 두 record_type 으로 저장.
        """
        try:
            conn = self._get_connection(connection_id)
        except ValueError as e:
            return SyncResult(ok=False, record_type="tax_invoice", error=str(e))

        business_id = conn.business_id
        biz_reg_no = self._get_business_reg_no(business_id)
        s_date, e_date = self._date_range(business_id, "tax_invoice_sales", fallback_days=30)

        params = {
            "organization": ORG_TAX_INVOICE,  # 0002 (세금계산서)
            "connectedId": conn.connected_id,
            "startDate": s_date,
            "endDate": e_date,
        }
        if biz_reg_no:
            params["identity"] = biz_reg_no
        try:
            result = self._client.request_product(PATH_TAXINVOICE_INTEGRATED, params)
        except Exception as e:  # noqa: BLE001
            self._update_cursor(business_id, "tax_invoice_sales", None, "failed", str(e))
            return SyncResult(ok=False, record_type="tax_invoice", error=str(e))

        rows = result.rows or []
        inserted_sales = inserted_purchase = 0
        latest_sales: Optional[datetime.date] = None
        latest_purchase: Optional[datetime.date] = None

        for row in rows:
            tx_date = _parse_date(row.get("resWriteDate") or row.get("resIssueDate"))
            if not tx_date:
                continue
            # 매출/매입 분류: 공급자 사업자번호 == 본인이면 매출, 아니면 매입
            supplier_corp = _normalize(row.get("resSupplierBusinessNum") or row.get("resSupplyCorpNum") or "")
            is_sales = supplier_corp == biz_reg_no
            sub_type = "tax_invoice_sales" if is_sales else "tax_invoice_purchase"
            counterparty = (
                row.get("resBuyerCorpName") if is_sales else row.get("resSupplierCorpName")
            ) or ""
            counterparty_corp = _normalize(
                (row.get("resBuyerBusinessNum") if is_sales else row.get("resSupplierBusinessNum")) or ""
            )
            identifier = (
                row.get("resNtsApprovalNum")
                or row.get("resIssueId")
                or row.get("commIssueId")
                or f"{sub_type}:{tx_date.isoformat()}:{row.get('resTotalAmount') or ''}"
            )
            is_new = self._upsert_record(
                business_id=business_id,
                record_type=sub_type,
                identifier=str(identifier),
                tx_date=tx_date,
                counterparty_name=str(counterparty),
                counterparty_corp_num=counterparty_corp,
                supply_cost=_as_int(row.get("resSupplyCostTotal") or row.get("resSupplyAmt")),
                tax=_as_int(row.get("resTaxTotal") or row.get("resTaxAmt")),
                total_amount=_as_int(row.get("resTotalAmount") or row.get("resTotAmt")),
                item_name=str(row.get("resItemName1") or row.get("resItemName") or ""),
                raw=row,
            )
            if is_sales:
                if is_new:
                    inserted_sales += 1
                if latest_sales is None or tx_date > latest_sales:
                    latest_sales = tx_date
            else:
                if is_new:
                    inserted_purchase += 1
                if latest_purchase is None or tx_date > latest_purchase:
                    latest_purchase = tx_date

        if latest_sales:
            self._update_cursor(business_id, "tax_invoice_sales", latest_sales,
                                "success", added_rows=inserted_sales)
        if latest_purchase:
            self._update_cursor(business_id, "tax_invoice_purchase", latest_purchase,
                                "success", added_rows=inserted_purchase)
        if not latest_sales and not latest_purchase:
            self._update_cursor(business_id, "tax_invoice_sales", None,
                                "success" if rows else "empty",
                                added_rows=0)

        return SyncResult(
            ok=True, record_type="tax_invoice",
            rows_inserted=inserted_sales + inserted_purchase,
            rows_total=len(rows),
        )
