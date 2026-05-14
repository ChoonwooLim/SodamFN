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
        return datetime.datetime.utcfromtimestamp(min(candidates))
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
            "x-web-version": "v20260513082427",  # TODO: 주기적 갱신 필요할 수 있음
        }
        # x-e-request 는 호출별 timestamp 가 바뀜. 일단 placeholder — 실제 운영 시 갱신 로직 추가 검토.
        h["x-e-request"] = self._build_x_e_request()
        if content_type:
            h["content-type"] = content_type
        return h

    def _build_x_e_request(self) -> str:
        """x-e-request 헤더 — 형식: {terminalId}|{epoch_ms}|{fingerprint}.

        HAR 캡처에서 추출한 terminalId/fingerprint 를 재사용. timestamp 는 매 호출 갱신.
        TODO(추후): 운영 중 만료되면 사장님이 다시 캡처하거나, 헤더 검증 우회 패턴 발견.
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
        """모든 페이지 순회. HAR 패턴: offset += limit 까지 totalSize 도달."""
        all_orders: list[dict] = []
        total_target = 0
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
        all_rows: list[dict] = []
        for page in range(max_pages):
            res = self.fetch_settlements(shop_owner_number, start_date, end_date,
                                         page=page, size=size, settle_type=settle_type)
            all_rows.extend(res.contents)
            if not res.contents:
                break
            if res.total_elements > 0 and len(all_rows) >= res.total_elements:
                break
        return all_rows
