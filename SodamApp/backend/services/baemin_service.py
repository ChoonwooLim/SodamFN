"""배민 사장님사이트 (self.baemin.com / self-api.baemin.com) 자동수집 어댑터.

쿠팡이츠와 동일 패턴 — curl_cffi (Chrome TLS) + 수동 쿠키 only.
HAR (2026-05-14) 기반으로 fetch_orders / fetch_settlements 의 실제 URL·파라미터·응답 파싱 구현.
"""
from __future__ import annotations

import datetime
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Optional

try:
    from curl_cffi import requests as curl_requests  # type: ignore
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    _CURL_CFFI_AVAILABLE = False
    curl_requests = None  # type: ignore


BASE_URL = "https://self-api.baemin.com"        # API 호스트
WEB_ORIGIN = "https://self.baemin.com"           # 브라우저 페이지 origin/referer
DEFAULT_TIMEOUT = 30.0
DEFAULT_IMPERSONATE = "chrome120"

log = logging.getLogger("baemin")


class BaeminError(Exception):
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class CookieInvalidError(BaeminError):
    """쿠키 만료/무효 — 사장님 쿠키 갱신 필요."""


@dataclass
class OrderFetchResult:
    total_sale_price: int
    total_order_count: int
    orders: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


@dataclass
class SettlementFetchResult:
    total_elements: int
    total_pages: int
    contents: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


def serialize_cookies(cookies: list[dict]) -> str:
    return json.dumps(cookies, ensure_ascii=False)


def deserialize_cookies(blob: str) -> list[dict]:
    if not blob:
        return []
    try:
        data = json.loads(blob)
        return data if isinstance(data, list) else []
    except json.JSONDecodeError:
        return []


def earliest_cookie_expiry(cookies: list[dict]) -> Optional[datetime.datetime]:
    candidates: list[float] = []
    for c in cookies:
        exp = c.get("expires")
        if exp is None or exp == -1:
            continue
        try:
            candidates.append(float(exp))
        except (TypeError, ValueError):
            continue
    if not candidates:
        return None
    try:
        return datetime.datetime.fromtimestamp(min(candidates), tz=datetime.timezone.utc)
    except (OSError, OverflowError, ValueError):
        return None


class BaeminClient:
    """self.baemin.com 세션 클라이언트. 인스턴스당 1매장 + 1세션."""

    def __init__(self,
                 cookies: Optional[list[dict]] = None,
                 *,
                 impersonate: str = DEFAULT_IMPERSONATE,
                 timeout: float = DEFAULT_TIMEOUT,
                 user_agent: Optional[str] = None,
                 accept_language: str = "ko-KR"):
        if not _CURL_CFFI_AVAILABLE:
            raise BaeminError("curl_cffi 미설치. pip install curl_cffi")
        self._timeout = timeout
        self._impersonate = impersonate
        self._user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/148.0.0.0 Safari/537.36"
        )
        self._accept_language = accept_language

        self._session = curl_requests.Session(impersonate=impersonate)
        if cookies:
            self._load_cookies(cookies)

    def _load_cookies(self, cookies: list[dict]):
        for c in cookies:
            name = c.get("name")
            value = c.get("value")
            if not name or value is None:
                continue
            domain = c.get("domain") or "self.baemin.com"
            path = c.get("path") or "/"
            try:
                self._session.cookies.set(name, value, domain=domain, path=path)
            except Exception as e:  # noqa: BLE001
                log.warning("cookie set failed [%s]: %s", name, e)

    def get_cookies(self) -> list[dict]:
        out = []
        try:
            for c in self._session.cookies.jar:
                out.append({
                    "name": c.name,
                    "value": c.value,
                    "domain": c.domain,
                    "path": c.path,
                    "expires": c.expires if c.expires else -1,
                    "secure": bool(c.secure),
                    "httpOnly": bool(getattr(c, "_rest", {}).get("HttpOnly", False)),
                })
        except Exception as e:  # noqa: BLE001
            log.warning("get_cookies failed: %s", e)
        return out

    def close(self):
        try:
            self._session.close()
        except Exception:
            pass

    def __enter__(self): return self
    def __exit__(self, *exc): self.close()

    def _common_headers(self, referer: str,
                        content_type: Optional[str] = None,
                        pathname_trace: str = "/") -> dict:
        h = {
            "accept": "application/json",
            "accept-language": self._accept_language,
            "origin": WEB_ORIGIN,
            "referer": referer,
            "user-agent": self._user_agent,
            "x-requested-with": "XMLHttpRequest",
            # HAR 캡처 시 사용된 값들. 향후 timestamp 부분 갱신 로직 추가 가능.
            "x-pathname-trace-key": pathname_trace,
            # x-web-version: 배민 사장님사이트 빌드 버전. 사이트 재배포 시 갱신 필요.
            # 만료되면 401/403 또는 HTML response → CookieInvalidError. 갱신 절차는
            # _build_x_e_request docstring 의 절차와 동일 (Network 탭에서 x-web-version 추출).
            "x-web-version": "v20260513082427",
        }
        # x-e-request 는 호출별 timestamp 가 바뀜. 일단 placeholder — 실제 운영 시 갱신 로직 추가 검토.
        h["x-e-request"] = self._build_x_e_request()
        if content_type:
            h["content-type"] = content_type
        return h

    def _build_x_e_request(self) -> str:
        """x-e-request 헤더 — 형식: {terminalId}|{epoch_ms}|{fingerprint}.

        HAR 캡처에서 추출한 terminalId/fingerprint 를 재사용. timestamp 는 매 호출 갱신.

        ⚠ 만료 처리: terminalId 또는 fingerprint 가 만료되면 배민이 401/403 또는
        HTML 차단 페이지 반환 → CookieInvalidError. 운영자 대처:
          1) 사장님이 ceo.baemin.com 또는 self.baemin.com 에 로그인 후 F12 → Network
          2) /v3/settle/history/summary 같은 API 호출의 x-e-request 헤더 값 복사
          3) 이 함수의 terminal_id / fingerprint 상수를 갱신 → 재배포
          4) 또는 baemin_har_notes.md 에 적힌 캡처 절차 재수행
        """
        terminal_id = "72im16"
        fingerprint = "79e94e65cee5a0fd6b67748ef1056cc86eee6872d3bf6eee9241f9dff8f"
        ts_ms = int(time.time() * 1000)
        return f"{terminal_id}|{ts_ms}|{fingerprint}"

    def _check_response(self, r) -> None:
        body_preview = ""
        try:
            body_preview = (r.text or "")[:240].replace("\n", " ").replace("\r", " ")
        except Exception:
            pass
        if r.status_code in (401, 403):
            raise CookieInvalidError(
                f"세션 쿠키 거부 (HTTP {r.status_code}). 응답: {body_preview}",
                status_code=r.status_code,
            )
        if r.status_code >= 400:
            raise BaeminError(
                f"배민 API 오류 HTTP {r.status_code}: {body_preview}",
                status_code=r.status_code,
            )
        ctype = r.headers.get("content-type", "")
        if "application/json" not in ctype.lower():
            raise CookieInvalidError(
                f"배민이 JSON 대신 {ctype} 반환 (HTTP {r.status_code}) — "
                f"차단 페이지 가능성. 응답: {body_preview}",
                status_code=r.status_code,
            )

    # ───── 인증 검증 ─────
    def whoami(self) -> dict:
        """세션 검증 — GET /v1/session/user-profile.

        응답 핵심 필드: shopOwnerNumber, memName, decodedEmail, decodedMobileNo.
        """
        url = f"{BASE_URL}/v1/session/user-profile"
        referer = f"{WEB_ORIGIN}/"
        try:
            r = self._session.get(url, headers=self._common_headers(referer, pathname_trace="/"),
                                  timeout=self._timeout)
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"통신 실패 [/session/user-profile]: {e}") from e
        self._check_response(r)
        try:
            return r.json()
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"JSON 파싱 실패 [/session/user-profile]: {e}") from e

    # ───── 매장 list ─────
    def list_stores(self, shop_owner_number: str) -> list[dict]:
        """매장 list — GET /v4/store/shops/search."""
        url = f"{BASE_URL}/v4/store/shops/search"
        referer = f"{WEB_ORIGIN}/"
        params = {"shopOwnerNo": shop_owner_number, "pageSize": 50, "desc": "true",
                  "lastOffsetId": ""}
        try:
            r = self._session.get(url, params=params,
                                  headers=self._common_headers(referer, pathname_trace="/"),
                                  timeout=self._timeout)
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"통신 실패 [/store/shops/search]: {e}") from e
        self._check_response(r)
        data = r.json()
        return data.get("contents", []) or []

    # ───── 매출 / 정산 (HAR 기반 실제 구현) ─────
    def fetch_orders(self,
                     shop_owner_number: str,
                     start_date: datetime.date,
                     end_date: datetime.date,
                     *,
                     offset: int = 0,
                     limit: int = 10,
                     order_status: str = "CLOSED") -> OrderFetchResult:
        """주문 조회 — GET /v4/orders.

        응답: {"totalSize", "totalPayAmount", "contents":[{"order":{...}, "settle":{...}}]}.
        """
        url = f"{BASE_URL}/v4/orders"
        referer = f"{WEB_ORIGIN}/orders/history"
        params = {
            "offset": offset, "limit": limit,
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d"),
            "shopOwnerNumber": shop_owner_number,
            "shopNumbers": "",
            "orderStatus": order_status,
        }
        try:
            r = self._session.get(url, params=params,
                                  headers=self._common_headers(referer, pathname_trace="/orders/history"),
                                  timeout=self._timeout)
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"통신 실패 [/v4/orders]: {e}") from e
        self._check_response(r)
        try:
            raw = r.json()
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"JSON 파싱 실패 [/v4/orders]: {e}") from e
        if not isinstance(raw, dict):
            log.warning("baemin /v4/orders: unexpected response type %s — returning empty",
                        type(raw).__name__)
            return OrderFetchResult(0, 0, [], {})
        return OrderFetchResult(
            total_sale_price=int(raw.get("totalPayAmount") or 0),
            total_order_count=int(raw.get("totalSize") or 0),
            orders=raw.get("contents") or [],
            raw=raw,
        )

    def fetch_all_orders(self,
                         shop_owner_number: str,
                         start_date: datetime.date,
                         end_date: datetime.date,
                         *,
                         limit: int = 10,
                         order_status: str = "CLOSED",
                         max_pages: int = 200) -> list[dict]:
        """모든 페이지 순회. totalSize 는 page 0 에서만 캡처 (mid-pagination 서버 변경 대비)."""
        all_orders: list[dict] = []
        total_target: Optional[int] = None
        for page in range(max_pages):
            offset = page * limit
            res = self.fetch_orders(shop_owner_number, start_date, end_date,
                                    offset=offset, limit=limit,
                                    order_status=order_status)
            log.info(
                "fetch_all_orders page=%d offset=%d got=%d total=%d",
                page, offset, len(res.orders), res.total_order_count,
            )
            all_orders.extend(res.orders)
            if total_target is None:
                total_target = res.total_order_count
            if not res.orders:
                break
            if total_target > 0 and len(all_orders) >= total_target:
                break
        return all_orders

    def fetch_settlements(self,
                          shop_owner_number: str,
                          start_date: datetime.date,
                          end_date: datetime.date,
                          *,
                          page: int = 0,
                          size: int = 10,
                          settle_type: str = "ALL") -> SettlementFetchResult:
        """정산 조회 — GET /v3/settle/history/summary."""
        url = f"{BASE_URL}/v3/settle/history/summary"
        referer = f"{WEB_ORIGIN}/orders/billing"
        params = {
            "settleType": settle_type,
            "startDate": start_date.strftime("%Y-%m-%d"),
            "endDate": end_date.strftime("%Y-%m-%d"),
            "shopOwnerNumber": shop_owner_number,
            "page": page,
            "size": size,
        }
        try:
            r = self._session.get(url, params=params,
                                  headers=self._common_headers(referer, pathname_trace="/orders/billing"),
                                  timeout=self._timeout)
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"통신 실패 [/v3/settle/history/summary]: {e}") from e
        self._check_response(r)
        try:
            raw = r.json()
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"JSON 파싱 실패 [/v3/settle/history/summary]: {e}") from e
        if not isinstance(raw, dict):
            log.warning("baemin /v3/settle/history/summary: unexpected response type %s — returning empty",
                        type(raw).__name__)
            return SettlementFetchResult(0, 0, [], {})
        total_elements = int(raw.get("totalSize") or 0)
        # /v3/settle 은 total_pages 직접 안 줌 — size 로 계산
        total_pages = (total_elements + size - 1) // size if size > 0 else 1
        return SettlementFetchResult(
            total_elements=total_elements,
            total_pages=total_pages,
            contents=raw.get("contents") or [],
            raw=raw,
        )

    def fetch_all_settlements(self,
                              shop_owner_number: str,
                              start_date: datetime.date,
                              end_date: datetime.date,
                              *,
                              size: int = 10,
                              settle_type: str = "ALL",
                              max_pages: int = 100) -> list[dict]:
        """모든 정산 페이지 순회. totalElements 는 page 0 에서만 캡처 (mid-pagination 서버 변경 대비)."""
        all_rows: list[dict] = []
        total_target: Optional[int] = None
        for page in range(max_pages):
            res = self.fetch_settlements(shop_owner_number, start_date, end_date,
                                         page=page, size=size, settle_type=settle_type)
            all_rows.extend(res.contents)
            if total_target is None:
                total_target = res.total_elements
            if not res.contents:
                break
            if total_target > 0 and len(all_rows) >= total_target:
                break
        return all_rows


# ──────────────────────────────────────────────────────────────────────────
# DB upsert 헬퍼 — HAR 응답 구조 매핑
# ──────────────────────────────────────────────────────────────────────────

from sqlmodel import Session, select  # noqa: E402


def _parse_order_dt(value: Optional[str]) -> Optional[datetime.datetime]:
    """배민 orderDateTime → datetime.

    포맷: 'YYYY-MM-DDTHH:MM:SS' (KST naive, HAR 확인됨).

    ⚠ NOTE: 배민 응답에 timezone offset 포함 시 (예 '+09:00'), 현재 slice
    로직이 offset 을 silently truncate 함. API 포맷 변경 시 이 함수 갱신 필요.
    """
    if not value:
        return None
    s = str(value)
    for fmt in ("%Y-%m-%dT%H:%M:%S.%f",
                "%Y-%m-%dT%H:%M:%S",
                "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.datetime.strptime(s[:26 if "%f" in fmt else 19], fmt)
        except (ValueError, TypeError):
            continue
    return None


# 배민 취소/거부 status 화이트리스트 — HAR 확인 + 코쿵 패턴.
# 새 status 발견 시 이 set 에 추가. substring 매칭은 false-positive 위험.
_CANCELLED_STATUSES = frozenset({
    "CANCELED", "CANCELLED",
    "DELIVERY_CANCELED", "DELIVERY_CANCELLED",
    "OWNER_CANCELED", "OWNER_CANCELLED",
    "CUSTOMER_CANCELED", "CUSTOMER_CANCELLED",
    "REJECTED",
})


def _is_cancelled_status(status: str) -> bool:
    """배민 order.status 가 취소/거부 status 인지 판정."""
    if not status:
        return False
    return status.upper() in _CANCELLED_STATUSES


def upsert_orders(session: "Session", business_id: int,
                  shop_number: str,
                  orders_contents: list[dict]) -> dict:
    """배민 /v4/orders 응답 contents[] → BaeminOrder upsert.

    응답 구조: [{"order": {orderNumber, orderDateTime, payAmount, status, shopNumber, payType, ...},
                "settle": {orderBrokerageItems, deliveryItems, etcItems, ...}}, ...]

    BaeminOrder.raw_json 에 entry 전체 (order+settle) 보존 — normalizer 가 수수료 분해 시 참조.
    """
    from models import BaeminOrder
    inserted = 0
    updated = 0
    for entry in orders_contents:
        order = entry.get("order") if isinstance(entry, dict) else None
        if not isinstance(order, dict):
            continue
        order_id = str(order.get("orderNumber") or "").strip()
        if not order_id:
            continue
        existing = session.exec(
            select(BaeminOrder).where(
                BaeminOrder.business_id == business_id,
                BaeminOrder.order_id == order_id,
            )
        ).first()
        ordered_at = _parse_order_dt(order.get("orderDateTime"))
        pay_amount = int(float(order.get("payAmount") or 0))
        status_val = str(order.get("status") or "").strip()
        cancelled_flag = _is_cancelled_status(status_val)
        payment_method = str(order.get("payType") or "")[:32] or None
        delivery_type = str(order.get("deliveryType") or "")[:32] or None
        store_id_resp = str(order.get("shopNumber") or shop_number)
        raw_blob = json.dumps(entry, ensure_ascii=False)

        if existing:
            existing.ordered_at = ordered_at or existing.ordered_at
            existing.total_sale_price = pay_amount
            existing.cancelled = cancelled_flag
            existing.order_status = status_val[:32] or existing.order_status
            existing.payment_method = payment_method or existing.payment_method
            existing.delivery_type = delivery_type or existing.delivery_type
            existing.raw_json = raw_blob
            session.add(existing)
            updated += 1
        else:
            session.add(BaeminOrder(
                business_id=business_id, store_id=store_id_resp,
                order_id=order_id, ordered_at=ordered_at,
                total_sale_price=pay_amount, cancelled=cancelled_flag,
                order_status=status_val[:32] or None,
                payment_method=payment_method,
                delivery_type=delivery_type,
                raw_json=raw_blob,
            ))
            inserted += 1
    session.commit()
    return {"inserted": inserted, "updated": updated}


def upsert_settlements(session: "Session", business_id: int,
                       shop_number: str,
                       settlements_contents: list[dict]) -> dict:
    """배민 /v3/settle/history/summary 응답 contents[] → BaeminSettlement upsert.

    응답 구조: [{giveId, depositDueDate, giveStatus, giveAmount, settleCode, ...}, ...]
    """
    from models import BaeminSettlement
    inserted = 0
    updated = 0
    for row in settlements_contents:
        if not isinstance(row, dict):
            continue
        give_id_raw = row.get("giveId")
        if give_id_raw in (None, ""):
            continue
        give_id = str(give_id_raw)
        try:
            st_date = datetime.date.fromisoformat(
                str(row.get("depositDueDate"))[:10]
            )
        except (ValueError, TypeError):
            continue
        st_type = (str(row.get("giveStatus") or "SETTLEMENT"))[:16]
        amount = int(float(row.get("giveAmount") or 0))
        raw_blob = json.dumps(row, ensure_ascii=False)

        existing = session.exec(
            select(BaeminSettlement).where(
                BaeminSettlement.business_id == business_id,
                BaeminSettlement.settlement_date == st_date,
                BaeminSettlement.settlement_type == st_type,
                BaeminSettlement.seller_transfer_id == give_id,
            )
        ).first()
        if existing:
            existing.amount = amount
            existing.raw_json = raw_blob
            session.add(existing)
            updated += 1
        else:
            session.add(BaeminSettlement(
                business_id=business_id, store_id=shop_number,
                settlement_date=st_date, settlement_type=st_type,
                seller_transfer_id=give_id, amount=amount,
                raw_json=raw_blob,
            ))
            inserted += 1
    session.commit()
    return {"inserted": inserted, "updated": updated}


def upsert_revenue_from_orders(session: "Session", business_id: int,
                                date: datetime.date) -> int:
    """그 날짜 + 그 달 전체 BaeminOrder 합계 → DeliveryRevenue(channel='배달의민족') upsert.

    ⚠ TIME ZONE: 배민 orderDateTime 는 KST naive. 이 함수의 day_start/day_end /
    month_start/month_end 도 KST naive (timezone 정보 없음). 향후 UTC 와 섞지 말 것 —
    commit c7924469 (naive UTC datetime 9시간 어긋남) 같은 클래스 버그 재발 방지.

    Returns:
        date 일자의 매출 합계 (취소 제외). DeliveryRevenue 는 월 합계로 갱신.
    """
    from models import BaeminOrder, DeliveryRevenue
    day_start = datetime.datetime.combine(date, datetime.time.min)
    day_end = datetime.datetime.combine(
        date + datetime.timedelta(days=1), datetime.time.min
    )
    day_rows = session.exec(
        select(BaeminOrder).where(
            BaeminOrder.business_id == business_id,
            BaeminOrder.ordered_at >= day_start,
            BaeminOrder.ordered_at < day_end,
            BaeminOrder.cancelled == False,  # noqa: E712
        )
    ).all()
    day_total = sum(o.total_sale_price or 0 for o in day_rows)

    # 월 전체 합계 (DeliveryRevenue 는 월 단위)
    month_start = datetime.date(date.year, date.month, 1)
    if date.month == 12:
        month_end = datetime.date(date.year + 1, 1, 1)
    else:
        month_end = datetime.date(date.year, date.month + 1, 1)
    month_rows = session.exec(
        select(BaeminOrder).where(
            BaeminOrder.business_id == business_id,
            BaeminOrder.ordered_at >= datetime.datetime.combine(month_start, datetime.time.min),
            BaeminOrder.ordered_at < datetime.datetime.combine(month_end, datetime.time.min),
            BaeminOrder.cancelled == False,  # noqa: E712
        )
    ).all()
    month_total = sum(o.total_sale_price or 0 for o in month_rows)
    month_count = len(month_rows)

    dr = session.exec(
        select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == business_id,
            DeliveryRevenue.year == date.year,
            DeliveryRevenue.month == date.month,
            DeliveryRevenue.channel == "배달의민족",
        )
    ).first()
    if dr:
        dr.total_sales = month_total
        dr.order_count = month_count
        dr.source = "bank_sync"
        session.add(dr)
    else:
        session.add(DeliveryRevenue(
            business_id=business_id, channel="배달의민족",
            year=date.year, month=date.month,
            total_sales=month_total, order_count=month_count,
            source="bank_sync",
        ))
    session.commit()
    return day_total


# ──────────────────────────────────────────────────────────────────────────
# Phase 2a — 정산명세서 엑셀 수동 import upsert
# ──────────────────────────────────────────────────────────────────────────


def upsert_excel_settlement(session: "Session", business_id: int,
                            year: int, month: int,
                            parsed) -> dict:
    """배민 정산명세서 엑셀 1개월치 → DB 적재.

    1) BaeminSettlementDetail (business_id, year, month) 전체 truncate → 재삽입
    2) BaeminMonthlySummary upsert
    3) DeliveryRevenue(channel="배달의민족", year, month) 갱신 (source="excel")

    Args:
        parsed: ParsedBaeminMonth — services.baemin_excel_parser.parse_xlsx 결과

    Returns:
        {
          "detail_rows_inserted": int,
          "summary_upserted": bool,
          "delivery_revenue_total_sales": int,
          "delivery_revenue_settlement": int,
        }
    """
    from models import (
        BaeminSettlementDetail, BaeminMonthlySummary, DeliveryRevenue,
    )
    from services.baemin_excel_parser import (
        aggregate_completed, row_to_raw_json,
    )

    # 1) 기존 상세 row truncate
    existing = session.exec(
        select(BaeminSettlementDetail).where(
            BaeminSettlementDetail.business_id == business_id,
            BaeminSettlementDetail.year == year,
            BaeminSettlementDetail.month == month,
        )
    ).all()
    for r in existing:
        session.delete(r)
    session.flush()

    # 2) 신규 상세 row 삽입
    inserted = 0
    for r in parsed.detail_rows:
        session.add(BaeminSettlementDetail(
            business_id=business_id,
            year=year, month=month,
            deposit_date=r.deposit_date,
            settlement_period=r.settlement_period,
            deposit_amount=r.deposit_amount,
            service_type=r.service_type,
            order_type=r.order_type,
            order_amount=r.order_amount,
            refund_amount=r.refund_amount,
            brokerage_baemin1=r.brokerage_baemin1,
            brokerage_smart=r.brokerage_smart,
            brokerage_pickup=r.brokerage_pickup,
            customer_discount=r.customer_discount,
            tip_discount_single=r.tip_discount_single,
            tip_discount_smart=r.tip_discount_smart,
            club_single_discount=r.club_single_discount,
            club_single_subsidy=r.club_single_subsidy,
            club_smart_discount=r.club_smart_discount,
            club_smart_subsidy=r.club_smart_subsidy,
            delivery_fee_single=r.delivery_fee_single,
            delivery_fee_smart=r.delivery_fee_smart,
            payment_fee_base=r.payment_fee_base,
            payment_fee_preferred=r.payment_fee_preferred,
            etc_amount=r.etc_amount,
            adjustment_amount=r.adjustment_amount,
            vat=r.vat,
            ad_amount=r.ad_amount,
            ad_vat=r.ad_vat,
            baemin_order_amount=r.baemin_order_amount,
            deposit_final=r.deposit_final,
            status=r.status,
            raw_row_json=row_to_raw_json(r),
        ))
        inserted += 1

    # 3) [요약] upsert
    summary_dict = parsed.summary
    existing_summary = session.exec(
        select(BaeminMonthlySummary).where(
            BaeminMonthlySummary.business_id == business_id,
            BaeminMonthlySummary.year == year,
            BaeminMonthlySummary.month == month,
        )
    ).first()
    if existing_summary:
        existing_summary.order_brokerage_total = summary_dict["order_brokerage_total"]
        existing_summary.delivery_total = summary_dict["delivery_total"]
        existing_summary.etc_total = summary_dict["etc_total"]
        existing_summary.misc_total = summary_dict["misc_total"]
        existing_summary.vat_total = summary_dict["vat_total"]
        existing_summary.ad_total = summary_dict["ad_total"]
        existing_summary.baemin_order_total = summary_dict["baemin_order_total"]
        existing_summary.deposit_total = summary_dict["deposit_total"]
        existing_summary.source = "excel"
        existing_summary.file_name = parsed.file_name
        existing_summary.uploaded_at = datetime.datetime.utcnow()
        existing_summary.detail_rows = inserted
        session.add(existing_summary)
    else:
        session.add(BaeminMonthlySummary(
            business_id=business_id, year=year, month=month,
            order_brokerage_total=summary_dict["order_brokerage_total"],
            delivery_total=summary_dict["delivery_total"],
            etc_total=summary_dict["etc_total"],
            misc_total=summary_dict["misc_total"],
            vat_total=summary_dict["vat_total"],
            ad_total=summary_dict["ad_total"],
            baemin_order_total=summary_dict["baemin_order_total"],
            deposit_total=summary_dict["deposit_total"],
            source="excel",
            file_name=parsed.file_name,
            detail_rows=inserted,
        ))

    # 4) DeliveryRevenue 갱신 (입금완료 row 만 합산)
    agg = aggregate_completed(parsed.detail_rows)
    total_sales = agg.total_order_amount        # 바로결제주문금액 합 = 총매출
    settlement_amount = summary_dict["deposit_total"]   # (H) 입금금액 = 실수령
    total_fees = total_sales - settlement_amount         # 총 차감액 (수수료+배달비+VAT+광고 등)

    dr = session.exec(
        select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == business_id,
            DeliveryRevenue.year == year,
            DeliveryRevenue.month == month,
            DeliveryRevenue.channel == "배달의민족",
        )
    ).first()
    if dr:
        dr.total_sales = total_sales
        dr.total_fees = total_fees
        dr.settlement_amount = settlement_amount
        dr.order_count = agg.row_count
        dr.source = "excel"
    else:
        session.add(DeliveryRevenue(
            business_id=business_id, channel="배달의민족",
            year=year, month=month,
            total_sales=total_sales,
            total_fees=total_fees,
            settlement_amount=settlement_amount,
            order_count=agg.row_count,
            source="excel",
        ))

    session.commit()

    return {
        "detail_rows_inserted": inserted,
        "summary_upserted": True,
        "delivery_revenue_total_sales": total_sales,
        "delivery_revenue_settlement": settlement_amount,
    }
