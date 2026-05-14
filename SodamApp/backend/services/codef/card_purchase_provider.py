"""CODEF 카드 매입(사용내역) 어댑터.

엔드포인트 선택 (2026-05-14 결정):
- 현재: /v1/kr/card/p/account/billing-list (청구내역 — DEMO 가능)
  * 응답: 청구월별 묶음 (rows[]) + 각 row 의 resChargeHistoryList[] 가 개별 사용건
  * 제약: 청구 확정된 사용건만 (실시간 X), resApprovalNo 가 빈 문자열
    → 합성 key (날짜|가맹점|금액|할부) 로 UNIQUE 처리
  * 파라미터: startDate/endDate 가 YYYYMM (월 단위)
- PRODUCT 전환 후: /v1/kr/card/common/p/approval (실시간 승인내역)
  * approvalNo 가 응답에 포함 — 합성 key 불필요
  * 코드 변경 포인트:
      BILLING_LIST_URL → APPROVAL_URL
      _build_period_params 의 포맷 YYYYMM → YYYYMMDD (일 단위)
      response.rows 가 직접 사용내역 list (resChargeHistoryList 풀기 불필요)

CODEF 응답을 CardPurchase 로 저장.
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


# DEMO 환경에서 작동하는 청구내역 엔드포인트.
# PRODUCT 전환 후 실시간 승인내역으로 바꾸려면 "/v1/kr/card/common/p/approval" 로 교체.
BILLING_LIST_URL = "/v1/kr/card/p/account/billing-list"


@dataclass
class PurchaseSyncResult:
    organization_code: str
    organization_label: str
    new_purchases: int = 0
    error: Optional[str] = None
    error_code: Optional[str] = None


class CodefCardPurchaseProvider:
    """카드 매입(사용내역) Provider — CODEF MyData 개인 카드 청구내역."""

    def __init__(self, engine, client: Optional[CodefClient] = None,
                 quota: Optional[CodefQuotaService] = None,
                 connections: Optional[CodefConnectionService] = None):
        self.engine = engine
        self._client = client or CodefClient()
        self._quota = quota or CodefQuotaService(engine)
        self._connections = connections or CodefConnectionService(engine, client=self._client)

    def sync_one_connection(self, connection: CodefConnection,
                            months_back: int = 3,
                            triggered_by: str = "cron",
                            triggered_user_id: Optional[int] = None) -> PurchaseSyncResult:
        """카드사 1 connection 풀 동기화.

        billing-list 는 청구월 단위 조회 → months_back 는 "이번 달 포함 N개월 전까지".
        """
        result = PurchaseSyncResult(
            organization_code=connection.organization_code,
            organization_label=connection.organization_label,
        )
        try:
            result.new_purchases = self._sync_billing(
                connection, months_back, triggered_by, triggered_user_id
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

    # ─── /p/account/billing-list ──────────────────────

    def _sync_billing(self, conn: CodefConnection, months_back: int,
                      triggered_by: str,
                      triggered_user_id: Optional[int]) -> int:
        self._quota.check_before_call(conn.business_id, BILLING_LIST_URL)
        params = self._build_period_params(conn, months_back=months_back)
        response = self._client.request_product(BILLING_LIST_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=BILLING_LIST_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )

        # response.rows = 청구월 list. 각 row 의 resChargeHistoryList[] 가 실 매입 raw.
        purchases: list[dict] = []
        for billing in response.rows:
            charge_list = billing.get("resChargeHistoryList") or []
            for ch in charge_list:
                purchases.append(ch)
        return self._upsert_purchases(conn, purchases)

    def _upsert_purchases(self, conn: CodefConnection, rows: list[dict]) -> int:
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                approval_date = self._parse_date(row.get("resUsedDate"))
                if approval_date is None:
                    continue

                merchant_name = (row.get("resMemberStoreName") or "").strip() or None
                amount = self._parse_int(row.get("resUsedAmount", 0))
                installment = self._parse_int(row.get("resInstallmentMonth", 0)) or None

                # billing-list 는 승인번호가 비어있음 — 합성 key 생성 (32자 이내)
                approval_number = (row.get("resApprovalNo") or "").strip()
                if not approval_number:
                    synthesized = (
                        f"{approval_date.strftime('%Y%m%d')}|"
                        f"{merchant_name or 'NA'}|"
                        f"{amount}|{installment or 0}"
                    )
                    approval_number = synthesized[:32]

                existing = s.exec(select(CardPurchase).where(
                    CardPurchase.business_id == conn.business_id,
                    CardPurchase.card_corp == conn.organization_label,
                    CardPurchase.approval_date == approval_date,
                    CardPurchase.approval_number == approval_number,
                )).first()
                if existing and existing.source == "codef":
                    # 이미 적재된 CODEF row — skip (재호출 idempotent)
                    continue

                card_number = row.get("resUsedCard")  # 예: "본인072"
                business_type = row.get("resMemberStoreType") or None
                merchant_no = row.get("resMemberStoreNo") or None
                source_meta = json.dumps(row, ensure_ascii=False)[:2000]
                now = datetime.datetime.utcnow()

                # billing-list 는 확정된 청구건만 반환 → 항상 승인 상태로 간주
                status = "승인"

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

    def _build_period_params(self, conn: CodefConnection, months_back: int) -> dict:
        """billing-list 용 기간 파라미터.

        startDate/endDate = YYYYMM (월 단위). months_back=3 이면 이번 달 포함 4개월치.

        ``cardPassword`` 는 connection 등록 시 RSA 암호화 상태로 저장된 값을 그대로
        첨부 (현대카드 등 25.10.30~ 인증여부 필수 카드사 대응). 평문/재암호화 X.
        """
        today = datetime.date.today()
        months: list[tuple[int, int]] = []
        year, month = today.year, today.month
        for _ in range(months_back + 1):
            months.append((year, month))
            month -= 1
            if month < 1:
                month = 12
                year -= 1
        start = min(months)
        end = max(months)
        start_str = f"{start[0]}{start[1]:02d}"
        end_str = f"{end[0]}{end[1]:02d}"
        params = {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start_str,
            "endDate": end_str,
        }
        # 카드비번이 저장돼 있으면 첨부 (이미 RSA 암호화된 상태 — 재암호화 금지).
        if getattr(conn, "card_password_encrypted", None):
            params["cardPassword"] = conn.card_password_encrypted
        return params

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
