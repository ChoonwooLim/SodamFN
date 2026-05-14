"""CODEF 카드 매입(사용내역) 어댑터.

CODEF /v1/kr/card/common/p/approval 응답을 CardPurchase 로 저장.
사장님 결제용 카드 사용내역 = 매입(지출).

매출용 CodefCardProvider 와 분리: 같은 카드사라도 매출/매입은 별도 connectedId
(connection_type='card_purchase') 로 관리.
"""
import datetime
import json
from dataclasses import dataclass
from typing import Optional

from sqlmodel import Session, select

from models import CodefConnection, CardPurchase
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


APPROVAL_URL = "/v1/kr/card/common/p/approval"


@dataclass
class PurchaseSyncResult:
    organization_code: str
    organization_label: str
    new_purchases: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None


class CodefCardPurchaseProvider:
    """카드 매입(사용내역) Provider — CODEF MyData 개인 카드 승인내역."""

    def __init__(self, engine, client: Optional[CodefClient] = None,
                 quota: Optional[CodefQuotaService] = None,
                 connections: Optional[CodefConnectionService] = None):
        self.engine = engine
        self._client = client or CodefClient()
        self._quota = quota or CodefQuotaService(engine)
        self._connections = connections or CodefConnectionService(engine, client=self._client)

    def sync_one_connection(self, connection: CodefConnection,
                            days_back: int = 7,
                            triggered_by: str = "cron",
                            triggered_user_id: Optional[int] = None) -> PurchaseSyncResult:
        """카드사 1 connection 풀 동기화."""
        result = PurchaseSyncResult(
            organization_code=connection.organization_code,
            organization_label=connection.organization_label,
        )
        try:
            result.new_purchases = self._sync_approval(
                connection, days_back, triggered_by, triggered_user_id
            )
        except CodefAuthExpired as e:
            self._connections.mark_failed(connection.id, "expired", e.code, e.message)
            result.error = str(e)
            result.error_code = e.code
        except CodefAdditionalAuth as e:
            self._connections.mark_failed(connection.id, "failed_2fa", "", str(e))
            result.error = str(e)
            result.error_code = "additional_auth"
        except CodefRateLimited:
            result.error = "CODEF rate limited"
            result.error_code = "rate_limited"
        except CodefAPIError as e:
            result.error = str(e)
            result.error_code = e.code
        except CodefQuotaExceeded as e:
            result.error = str(e)
            result.error_code = f"quota_{e.scope}"
        return result

    # ─── /p/approval ───────────────────────────────

    def _sync_approval(self, conn: CodefConnection, days_back: int,
                       triggered_by: str,
                       triggered_user_id: Optional[int]) -> int:
        self._quota.check_before_call(conn.business_id, APPROVAL_URL)
        params = self._build_period_params(conn, days_back=days_back)
        response = self._client.request_product(APPROVAL_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=APPROVAL_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        return self._upsert_purchases(conn, response.rows)

    def _upsert_purchases(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                approval_date = self._parse_date(row.get("approvedDate"))
                approval_number = (row.get("approvalNo") or "").strip()
                if not approval_number or approval_date is None:
                    continue

                existing = s.exec(select(CardPurchase).where(
                    CardPurchase.business_id == conn.business_id,
                    CardPurchase.card_corp == conn.organization_label,
                    CardPurchase.approval_date == approval_date,
                    CardPurchase.approval_number == approval_number,
                )).first()
                if existing and existing.source == "codef":
                    # 이미 적재된 CODEF row — skip (재호출 idempotent)
                    continue

                amount = self._parse_int(row.get("amount", 0))
                installment = self._parse_int(row.get("installment", 0)) or None
                merchant_name = row.get("merchantName") or row.get("memberStoreName")
                merchant_no = row.get("merchantNo")
                business_type = row.get("businessType") or row.get("merchantBizType")
                card_number = row.get("cardNo")
                status = "승인" if str(row.get("status", "1")) == "1" else "취소"
                source_meta = json.dumps(row, ensure_ascii=False)[:2000]
                now = datetime.datetime.utcnow()

                if existing:
                    # excel/manual 행이 있던 자리에 CODEF row 채움 (덮어쓰기)
                    existing.amount = amount
                    existing.merchant_name = merchant_name
                    existing.merchant_no = merchant_no
                    existing.business_type = business_type
                    existing.card_number_masked = card_number
                    existing.installment = installment
                    existing.status = status
                    existing.source = "codef"
                    existing.source_meta = source_meta
                    existing.connection_id = conn.id
                    existing.synced_at = now
                    s.add(existing)
                else:
                    new_row = CardPurchase(
                        business_id=conn.business_id,
                        card_corp=conn.organization_label,
                        card_number_masked=card_number,
                        approval_date=approval_date,
                        approval_time=row.get("approvedTime"),
                        approval_number=approval_number,
                        merchant_name=merchant_name,
                        merchant_no=merchant_no,
                        business_type=business_type,
                        amount=amount,
                        installment=installment,
                        status=status,
                        source="codef",
                        source_meta=source_meta,
                        connection_id=conn.id,
                        synced_at=now,
                    )
                    s.add(new_row)
                    new_count += 1
            s.commit()
        return new_count

    # ─── 헬퍼 ──────────────────────────────────────

    def _build_period_params(self, conn: CodefConnection, days_back: int) -> dict:
        today = datetime.date.today()
        start = today - datetime.timedelta(days=days_back)
        return {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start.strftime("%Y%m%d"),
            "endDate": today.strftime("%Y%m%d"),
            "inquiryType": "1",
        }

    @staticmethod
    def _parse_date(value) -> Optional[datetime.date]:
        if not value:
            return None
        s = str(value).strip().replace("-", "").replace("/", "")
        try:
            return datetime.datetime.strptime(s, "%Y%m%d").date()
        except (ValueError, TypeError):
            return None

    @staticmethod
    def _parse_int(value) -> int:
        if value is None or value == "":
            return 0
        try:
            return int(float(str(value).replace(",", "")))
        except (ValueError, TypeError):
            return 0
