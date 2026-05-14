"""CODEF 카드 매입(사용내역) 어댑터.

두 엔드포인트 통합 호출 (2026-05-14 재설계):
1. /v1/kr/card/p/account/approval-list (승인내역 — 실시간)
   * 응답: rows = 개별 승인건 직접 list
   * resApprovalNo, resUsedTime 모두 채워짐 → 합성 key 불필요
   * resCancelYN: "0" 정상 / "1" 취소 / "2" 부분취소 / "3" 거절
   * startDate/endDate = YYYYMMDD (일 단위), 조회가능기간 카드사별 상이 (3~18개월)
   * inquiryType="1" 전체조회 — cardNo 불필요
2. /v1/kr/card/p/account/billing-list (청구내역 — 백필)
   * 응답: rows = 청구월 묶음, 각 row 의 resChargeHistoryList[] = 개별 사용건
   * 청구 확정된 건만 (월 1회 청구 사이클), resApprovalNo 빈 문자열
     → 합성 key (날짜|가맹점|금액|할부) 로 UNIQUE 처리
   * 청구내역은 1년 전 등 오래된 데이터 백필용 (approval 조회기간 제한 우회)

두 엔드포인트 결과는 (business_id, card_corp, approval_date, approval_number)
UNIQUE 로 dedup. approval 이 먼저 들어와 있으면 billing 이 덮어쓰지 않음
(approval 의 정확한 승인번호 유지).

⚠ cardPassword 는 LOGIN INPUT (account create) 에만 필수. 조회 API (approval-list /
billing-list) 의 INPUT 명세 (PDF page 7, page 10) 에 없음. 따라서 query 파라미터에
포함 X. 과거 코드에서 cardPassword 첨부 → 현대카드 0건 응답 원인 (54f47646 회귀).

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


# CODEF 카드 매입 엔드포인트 (개인 카드 /p/)
APPROVAL_LIST_URL = "/v1/kr/card/p/account/approval-list"  # 승인내역 (실시간)
BILLING_LIST_URL  = "/v1/kr/card/p/account/billing-list"    # 청구내역 (백필)


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

        approval-list (실시간 승인내역) + billing-list (청구내역 백필) 순차 호출.
        approval 이 먼저 들어가서 정확한 resApprovalNo 를 차지하면 billing 의
        합성 key 와 겹치지 않아 자연스럽게 별개 row 로 저장됨.

        months_back: approval-list 는 일 단위로 (months_back * 30) 일 전부터,
        billing-list 는 청구월 단위로 N+1 개월치.
        """
        result = PurchaseSyncResult(
            organization_code=connection.organization_code,
            organization_label=connection.organization_label,
        )
        try:
            approval_count = self._sync_approval(
                connection, months_back, triggered_by, triggered_user_id
            )
            billing_count = self._sync_billing(
                connection, months_back, triggered_by, triggered_user_id
            )
            result.new_purchases = approval_count + billing_count
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

    # ─── /p/account/approval-list (실시간 승인내역) ─────

    def _sync_approval(self, conn: CodefConnection, months_back: int,
                       triggered_by: str,
                       triggered_user_id: Optional[int]) -> int:
        """승인내역 조회 (일 단위 startDate/endDate, YYYYMMDD).

        조회가능기간 (PDF page 7) 카드사별 상이 (현대 3개월 / 신한 6개월 등).
        months_back * 30일 범위로 안전하게 조회 — 카드사가 자체 한도 넘는 부분은
        그냥 빈값 반환.
        """
        self._quota.check_before_call(conn.business_id, APPROVAL_LIST_URL)
        today = datetime.date.today()
        start = today - datetime.timedelta(days=months_back * 30)
        params = {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start.strftime("%Y%m%d"),
            "endDate": today.strftime("%Y%m%d"),
            "orderBy": "0",       # 0: 최신순
            "inquiryType": "1",   # 1: 전체조회 (cardNo 불필요)
        }
        response = self._client.request_product(APPROVAL_LIST_URL, params)
        self._quota.record_call(
            business_id=conn.business_id, connection_id=conn.id,
            api_path=APPROVAL_LIST_URL, organization_code=conn.organization_code,
            status="success", rows=response.rows_count,
            result_code=response.result_code,
            triggered_by=triggered_by, triggered_user_id=triggered_user_id,
        )
        # response.rows = 개별 승인건 directly (no nesting)
        return self._upsert_purchases(conn, list(response.rows), kind="approval")

    # ─── /p/account/billing-list (청구내역 — 백필) ─────

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
        return self._upsert_purchases(conn, purchases, kind="billing")

    def _upsert_purchases(self, conn: CodefConnection, rows: list[dict],
                          kind: str = "billing") -> int:
        """rows 를 CardPurchase 로 upsert.

        kind:
          - "approval": 승인내역. resApprovalNo / resUsedTime / resCancelYN 채워짐.
            카드번호 키: resCardNo (or resCardNo1). 가맹점: resMemberStoreName.
          - "billing":  청구내역. resApprovalNo 빈값 → 합성 key. 항상 승인 상태.
            카드번호 키: resUsedCard. 가맹점: resMemberStoreName.
        """
        new_count = 0
        with Session(self.engine) as s:
            for row in rows:
                approval_date = self._parse_date(row.get("resUsedDate"))
                if approval_date is None:
                    continue

                merchant_name = (row.get("resMemberStoreName") or "").strip() or None
                amount = self._parse_int(row.get("resUsedAmount", 0))
                installment = self._parse_int(row.get("resInstallmentMonth", 0)) or None

                approval_number = (row.get("resApprovalNo") or "").strip()
                if not approval_number:
                    # billing-list 또는 승인번호 누락 — 합성 key 생성 (32자 이내)
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

                # 카드번호 키는 approval / billing 응답에서 다름
                if kind == "approval":
                    card_number = row.get("resCardNo") or row.get("resCardNo1")
                else:
                    card_number = row.get("resUsedCard")
                business_type = row.get("resMemberStoreType") or None
                merchant_no = row.get("resMemberStoreNo") or None
                source_meta = json.dumps(row, ensure_ascii=False)[:2000]
                now = datetime.datetime.utcnow()

                # status 판정
                if kind == "approval":
                    cancel_yn = (row.get("resCancelYN") or "0").strip()
                    status = {
                        "0": "승인",
                        "1": "취소",
                        "2": "부분취소",
                        "3": "거절",
                    }.get(cancel_yn, "승인")
                else:
                    # billing-list 는 확정된 청구건만 반환 → 항상 승인 상태
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

        ⚠ cardPassword 는 PDF page 10 (billing-list INPUT) 에 없어서 첨부 X.
        LOGIN INPUT 에만 필수 (account create 시점). 조회 API 는 connectedId 로 인증.
        과거 첨부 시 현대카드가 0건 응답 → 54f47646 회귀로 인한 버그였음.
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
        return {
            "connectedId": conn.connected_id,
            "organization": conn.organization_code,
            "startDate": start_str,
            "endDate": end_str,
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
