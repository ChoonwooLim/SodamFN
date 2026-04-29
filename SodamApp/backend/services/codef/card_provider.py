"""카드 매출 어댑터.

CODEF /v1/kr/card/common/b/{approval,billing,member-store} 응답을
셈하나 모델 (CardSalesApproval, CardPayment, CardMerchant) 로 매핑·적재.

중복 처리 정책 (spec § 4.2 ④):
- unique key = (business_id, approval_date, approval_number, card_corp)
- 동일 amount 의 excel 행 → source='excel_overridden' 마킹
- 다른 amount → 둘 다 보존 (UI 차이 경고)
"""
import datetime
import json
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from models import (
    CodefConnection,
    CardSalesApproval,
    CardPayment,
    CardMerchant,
)
from .codef_client import CodefClient
from .quota_service import CodefQuotaService
from .connection_service import CodefConnectionService
from .exceptions import (
    CodefAuthExpired,
    CodefAdditionalAuth,
    CodefRateLimited,
    CodefAPIError,
    CodefQuotaExceeded,
)


# 개인 카드 (clientType=P) — 현재 PoC 시나리오. 사업자 카드는 후속 옵션.
APPROVAL_URL = "/v1/kr/card/common/p/approval"
BILLING_URL = "/v1/kr/card/common/p/billing"
MEMBER_STORE_URL = "/v1/kr/card/common/p/member-store"

DEFAULT_SYNC_MODES = frozenset({"approval", "billing", "member_store"})


@dataclass
class SyncResult:
    organization_code: str
    organization_label: str
    new_approvals: int = 0
    new_payments: int = 0
    new_merchants: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None


class CodefCardProvider:
    def __init__(self, engine, client: Optional[CodefClient] = None,
                 quota: Optional[CodefQuotaService] = None,
                 connections: Optional[CodefConnectionService] = None):
        self.engine = engine
        self._client = client or CodefClient()
        self._quota = quota or CodefQuotaService(engine)
        self._connections = connections or CodefConnectionService(engine, client=self._client)

    def sync_one_connection(self, connection: CodefConnection,
                            sync_modes: Optional[set[str]] = None,
                            triggered_by: str = "cron",
                            triggered_user_id: Optional[int] = None) -> SyncResult:
        """카드사 1개 connection 풀 동기화."""
        modes = sync_modes if sync_modes is not None else set(DEFAULT_SYNC_MODES)
        result = SyncResult(
            organization_code=connection.organization_code,
            organization_label=connection.organization_label,
        )

        try:
            if "approval" in modes:
                result.new_approvals = self._sync_approval(
                    connection, triggered_by, triggered_user_id
                )
            if "billing" in modes:
                result.new_payments = self._sync_billing(
                    connection, triggered_by, triggered_user_id
                )
            if "member_store" in modes and self._needs_member_store_refresh(connection):
                result.new_merchants = self._sync_member_store(
                    connection, triggered_by, triggered_user_id
                )
        except CodefAuthExpired as e:
            self._connections.mark_failed(connection.id, "expired", e.code, e.message)
            result.error = str(e)
            result.error_code = e.code
        except CodefAdditionalAuth as e:
            self._connections.mark_failed(connection.id, "failed_2fa", "", str(e))
            result.error = str(e)
            result.error_code = "additional_auth"
        except CodefRateLimited as e:
            result.error = "CODEF rate limited"
            result.error_code = "rate_limited"
        except CodefAPIError as e:
            result.error = str(e)
            result.error_code = e.code
        except CodefQuotaExceeded as e:
            result.error = str(e)
            result.error_code = f"quota_{e.scope}"

        return result

    # ─── /b/approval ───────────────────────────────

    def _sync_approval(self, conn: CodefConnection, triggered_by: str,
                       triggered_user_id: Optional[int]) -> int:
        self._quota.check_before_call(conn.business_id, APPROVAL_URL)
        params = self._build_period_params(conn, days_back=7)
        response = self._client.request_product(APPROVAL_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=APPROVAL_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_approvals(conn, response.rows)

    def _upsert_approvals(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                approval_date = self._parse_date(row.get("approvedDate"))
                approval_number = (row.get("approvalNo") or "").strip()
                amount = self._parse_int(row.get("amount", 0))
                if not approval_number or approval_date is None:
                    continue

                stmt = select(CardSalesApproval).where(
                    CardSalesApproval.business_id == conn.business_id,
                    CardSalesApproval.approval_date == approval_date,
                    CardSalesApproval.approval_number == approval_number,
                    CardSalesApproval.card_corp == conn.organization_label,
                )
                existing = list(s.exec(stmt))

                if any(e.source == "codef" for e in existing):
                    continue  # 이미 CODEF 적재

                # excel 행 발견 — 동일 amount 면 overridden
                for e in existing:
                    if e.source == "excel" and e.amount == amount:
                        e.source = "excel_overridden"
                        s.add(e)

                new_row = CardSalesApproval(
                    business_id=conn.business_id,
                    approval_date=approval_date,
                    approval_time=row.get("approvedTime"),
                    card_corp=conn.organization_label,
                    card_number=row.get("cardNo"),
                    approval_number=approval_number,
                    amount=amount,
                    installment=row.get("installment"),
                    status="승인" if str(row.get("status", "1")) == "1" else "취소",
                    shop_name=row.get("merchantName"),
                    source="codef",
                    source_meta=json.dumps(row, ensure_ascii=False)[:1000],
                    connection_id=conn.id,
                    synced_at=datetime.datetime.utcnow(),
                )
                s.add(new_row)
                new_count += 1
            s.commit()
        return new_count

    # ─── /b/billing ────────────────────────────────

    def _sync_billing(self, conn: CodefConnection, triggered_by: str,
                      triggered_user_id: Optional[int]) -> int:
        self._quota.check_before_call(conn.business_id, BILLING_URL)
        params = self._build_period_params(conn, days_back=60)
        response = self._client.request_product(BILLING_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=BILLING_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_payments(conn, response.rows)

    def _upsert_payments(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                payment_date = self._parse_date(row.get("paymentDate"))
                if payment_date is None:
                    continue
                net_deposit = self._parse_int(row.get("netDeposit", 0))

                stmt = select(CardPayment).where(
                    CardPayment.business_id == conn.business_id,
                    CardPayment.payment_date == payment_date,
                    CardPayment.card_corp == conn.organization_label,
                    CardPayment.net_deposit == net_deposit,
                )
                existing = list(s.exec(stmt))
                if any(e.source == "codef" for e in existing):
                    continue
                for e in existing:
                    if e.source == "excel":
                        e.source = "excel_overridden"
                        s.add(e)

                new_row = CardPayment(
                    business_id=conn.business_id,
                    payment_date=payment_date,
                    card_corp=conn.organization_label,
                    sales_amount=self._parse_int(row.get("salesAmount", 0)),
                    fees=self._parse_int(row.get("fee", 0)),
                    vat_on_fees=self._parse_int(row.get("vatOnFees", 0)),
                    net_deposit=net_deposit,
                    bank=row.get("depositBank"),
                    source="codef",
                    source_meta=json.dumps(row, ensure_ascii=False)[:1000],
                    connection_id=conn.id,
                    synced_at=datetime.datetime.utcnow(),
                )
                s.add(new_row)
                new_count += 1
            s.commit()
        return new_count

    # ─── /b/member-store ───────────────────────────

    def _needs_member_store_refresh(self, conn: CodefConnection) -> bool:
        """월 1회 호출. 이번 달 호출 이력 없으면 True."""
        first_of_month = datetime.datetime.combine(
            datetime.date.today().replace(day=1), datetime.time.min
        )
        with Session(self.engine) as s:
            stmt = select(CardMerchant).where(
                CardMerchant.business_id == conn.business_id,
                CardMerchant.card_corp == conn.organization_label,
                CardMerchant.last_synced_at >= first_of_month,
            ).limit(1)
            return s.exec(stmt).first() is None

    def _sync_member_store(self, conn: CodefConnection, triggered_by: str,
                           triggered_user_id: Optional[int]) -> int:
        self._quota.check_before_call(conn.business_id, MEMBER_STORE_URL)
        params = {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
        }
        response = self._client.request_product(MEMBER_STORE_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=MEMBER_STORE_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_merchants(conn, response.rows)

    def _upsert_merchants(self, conn: CodefConnection, rows: list[dict]) -> int:
        upserted = 0
        with Session(self.engine) as s:
            for row in rows:
                mid = (row.get("merchantNo") or "").strip()
                if not mid:
                    continue
                fee_rate = self._parse_fee_rate(row.get("feeRate"))
                stmt = select(CardMerchant).where(
                    CardMerchant.business_id == conn.business_id,
                    CardMerchant.card_corp == conn.organization_label,
                    CardMerchant.merchant_id == mid,
                )
                existing = s.exec(stmt).first()
                now = datetime.datetime.utcnow()
                status = "active" if str(row.get("status", "Y")).upper() == "Y" else "suspended"
                if existing:
                    if row.get("merchantName"):
                        existing.merchant_name = row.get("merchantName")
                    existing.fee_rate = fee_rate
                    existing.fee_rate_updated_at = now
                    existing.status = status
                    existing.last_synced_at = now
                    s.add(existing)
                else:
                    s.add(CardMerchant(
                        business_id=conn.business_id,
                        card_corp=conn.organization_label,
                        merchant_id=mid,
                        merchant_name=row.get("merchantName"),
                        fee_rate=fee_rate,
                        fee_rate_updated_at=now,
                        registered_at=self._parse_date(row.get("registeredDate")),
                        status=status,
                        last_synced_at=now,
                    ))
                upserted += 1
            s.commit()
        return upserted

    # ─── 헬퍼 ──────────────────────────────────────

    def _build_period_params(self, conn: CodefConnection, days_back: int) -> dict:
        end = datetime.date.today()
        start = end - datetime.timedelta(days=days_back)
        return {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start.strftime("%Y%m%d"),
            "endDate": end.strftime("%Y%m%d"),
        }

    @staticmethod
    def _parse_date(s: Optional[str]) -> Optional[datetime.date]:
        if not s:
            return None
        cleaned = str(s).replace("-", "").replace("/", "")
        try:
            return datetime.datetime.strptime(cleaned, "%Y%m%d").date()
        except ValueError:
            return None

    @staticmethod
    def _parse_int(v) -> int:
        if v is None or v == "":
            return 0
        try:
            return int(str(v).replace(",", ""))
        except (ValueError, TypeError):
            return 0

    @staticmethod
    def _parse_fee_rate(s) -> Optional[float]:
        if s is None or s == "":
            return None
        try:
            v = float(str(s).replace("%", "").strip())
            return v / 100 if v > 1 else v  # "1.8" → 0.018, "0.018" → 0.018
        except (ValueError, TypeError):
            return None
