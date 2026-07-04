"""쿠팡이츠 (store.coupangeats.com) 사장님 포털 매출 자동수집 어댑터.

쿠팡이츠가 공식 Open API 를 제공하지 않으므로 가맹점주 권한 세션을 사용한
비공개 XHR endpoint 를 호출. 가맹점주 본인 데이터를 가맹점주 권한으로 조회 →
약관 위반 위험은 낮으나, 쿠팡이츠 측 차단 시 갱신 필요.

## 인증/봇 방어 전략 (Akamai Bot Manager)

쿠팡이츠는 Akamai 의 sensor_data 검증을 로그인 게이트에서 강제한다 (HAR 분석:
로그인 직전 1초 안에 `/YqaJ3sMCd0pM/...` POST 가 발생, 누락 시 차단).
반면 매출 API 는 살아있는 세션 쿠키만으로 통과 가능.

→ **하이브리드 전략**:
  1) 자동 로그인은 별도 `coupang_eats_login.py` 의 Playwright(stealth) 가 수행
  2) 매출 API 호출은 이 모듈의 `curl_cffi`(Chrome TLS fingerprint 위조) 가 수행
  3) 401/403 발생 시 → CookieInvalidError → 호출자가 자동 재로그인 트리거

## 전송 포맷

- Request : 표준 JSON (Content-Type: application/json;charset=UTF-8)
- Response: 표준 JSON
- 인증    : `EATS_AT` / `EATS_RT` / `XSRF-TOKEN` 쿠키 (외 보조 쿠키)
- 메타    : `x-request-meta` 헤더 (base64 JSON, 호출마다 timestamp 갱신)
"""
from __future__ import annotations

import base64
import datetime
import json
import logging
import re
from dataclasses import dataclass, field
from typing import Optional

# curl_cffi: Chrome120 의 TLS/HTTP2 fingerprint 를 흉내내어 Akamai 의 JA3
# 핑거프린트 차단을 우회. 표준 httpx 는 Python 의 ssl 모듈 핑거프린트가
# 그대로 노출되어 1회 호출도 탐지될 수 있음.
try:
    from curl_cffi import requests as curl_requests  # type: ignore
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    _CURL_CFFI_AVAILABLE = False
    curl_requests = None  # type: ignore


BASE_URL = "https://store.coupangeats.com"
DEFAULT_TIMEOUT = 30.0
DEFAULT_IMPERSONATE = "chrome120"

log = logging.getLogger("coupang_eats")


class CoupangEatsError(Exception):
    """쿠팡이츠 호출 실패."""
    def __init__(self, message: str, status_code: Optional[int] = None):
        super().__init__(message)
        self.status_code = status_code


class CookieInvalidError(CoupangEatsError):
    """쿠키 만료/무효 — 자동 재로그인 트리거 신호."""


# ──────────────────────────────────────────────────────────────────────────
# 데이터 클래스
# ──────────────────────────────────────────────────────────────────────────

@dataclass
class OrderFetchResult:
    """주문 조회 결과 (POST /api/v1/merchant/web/order/condition)."""
    total_sale_price: int
    total_order_count: int
    avg_order_amount: int
    orders: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


@dataclass
class SettlementFetchResult:
    """정산 조회 결과 (GET /settlement-management-data)."""
    total_elements: int
    total_pages: int
    contents: list[dict] = field(default_factory=list)
    raw: dict = field(default_factory=dict)


# ──────────────────────────────────────────────────────────────────────────
# 쿠키 직렬화 유틸 (Playwright cookie list ↔ JSON ↔ curl_cffi session)
# ──────────────────────────────────────────────────────────────────────────

def serialize_cookies(cookies: list[dict]) -> str:
    """Playwright/Chrome cookie dict list → JSON 문자열 (DB 보관용)."""
    return json.dumps(cookies, ensure_ascii=False)


def deserialize_cookies(blob: str) -> list[dict]:
    if not blob:
        return []
    try:
        data = json.loads(blob)
        if isinstance(data, list):
            return data
        return []
    except json.JSONDecodeError:
        return []


# Akamai 봇 탐지 인프라 쿠키 — 요청마다 짧은 TTL(2~4h)로 회전되므로
# 세션 수명 추정에 포함하면 "만료 임박" 오경보가 난다.
_AKAMAI_INFRA_COOKIE_RE = re.compile(r"^(_abck|ak_bmsc|bm_\w+)$", re.IGNORECASE)


def earliest_cookie_expiry(cookies: list[dict]) -> Optional[datetime.datetime]:
    """쿠키 list 에서 가장 빠른 만료 시간 반환 (UTC).

    Playwright cookie 형식: {expires: float (epoch seconds, -1 = session)}.
    Chrome DevTools 형식: 동일.
    Akamai 인프라 쿠키(_abck/ak_bmsc/bm_*)는 제외 — 인증 세션 수명과 무관.
    """
    candidates: list[float] = []
    for c in cookies:
        if _AKAMAI_INFRA_COOKIE_RE.match(c.get("name") or ""):
            continue
        exp = c.get("expires")
        if exp is None or exp == -1:
            continue
        try:
            candidates.append(float(exp))
        except (TypeError, ValueError):
            continue
    if not candidates:
        return None
    earliest = min(candidates)
    try:
        return datetime.datetime.utcfromtimestamp(earliest)
    except (OSError, OverflowError, ValueError):
        return None


def merge_rotated_cookies(original: list[dict], rotated: list[dict],
                          *, now: Optional[float] = None) -> list[dict]:
    """서버가 회전시킨 쿠키를 원본 쿠키에 선별 병합.

    회전본을 통째로 저장하면 안 된다 (2026-07-04 운영 장애 실증):
    whoami 응답의 Set-Cookie 가 Akamai `_abck` 를 즉시만료 값으로 회전시키고
    `access-token` 을 빈 값으로 지운다. 이를 그대로 저장하면 브라우저에서
    복사한 검증된 원본이 오염되어 바로 다음 호출부터 401/403 이 난다.

    규칙:
      - 빈 값 회전(서버 삭제 지시) → 스킵, 원본 유지
      - 이미 만료된 회전(expires <= now) → 스킵, 원본 유지
      - 그 외 → 값/만료 갱신 (원본 domain/path 유지)
      - 원본에 없던 이름 → 추가
    """
    if not original:
        return list(rotated or [])
    if now is None:
        now = datetime.datetime.now(datetime.timezone.utc).timestamp()
    merged = [dict(c) for c in original]
    index = {c.get("name"): i for i, c in enumerate(merged) if c.get("name")}
    for rc in rotated or []:
        name = rc.get("name")
        if not name:
            continue
        value = rc.get("value")
        if value is None or value == "":
            continue
        exp = rc.get("expires")
        try:
            if exp is not None and float(exp) != -1 and float(exp) <= now:
                continue
        except (TypeError, ValueError):
            pass
        if name in index:
            cur = merged[index[name]]
            cur["value"] = value
            if exp is not None:
                cur["expires"] = exp
        else:
            merged.append(dict(rc))
            index[name] = len(merged) - 1
    return merged


# ──────────────────────────────────────────────────────────────────────────
# 클라이언트
# ──────────────────────────────────────────────────────────────────────────

class CoupangEatsClient:
    """쿠팡이츠 사장님 세션 클라이언트. 인스턴스당 1매장 + 1세션.

    사용:
        client = CoupangEatsClient(cookies)
        result = client.fetch_orders(823245, start=..., end=...)
        # 401 → CookieInvalidError → 재로그인 → 다시 인스턴스 생성
    """

    def __init__(self,
                 cookies: Optional[list[dict]] = None,
                 *,
                 impersonate: str = DEFAULT_IMPERSONATE,
                 timeout: float = DEFAULT_TIMEOUT,
                 user_agent: Optional[str] = None,
                 screen_resolution: str = "2560x1440",
                 accept_language: str = "ko-KR"):
        if not _CURL_CFFI_AVAILABLE:
            raise CoupangEatsError(
                "curl_cffi 가 설치되지 않았습니다. "
                "pip install curl_cffi"
            )
        self._timeout = timeout
        self._impersonate = impersonate
        self._user_agent = user_agent or (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/148.0.0.0 Safari/537.36"
        )
        self._screen_resolution = screen_resolution
        self._accept_language = accept_language

        # curl_cffi Session — Chrome120 의 TLS handshake + HTTP/2 frame order 흉내
        self._session = curl_requests.Session(impersonate=impersonate)
        if cookies:
            self._load_cookies(cookies)

    def _load_cookies(self, cookies: list[dict]):
        """쿠키 dict list → curl_cffi Session 에 주입.

        Playwright cookie 포맷:
          {name, value, domain, path, expires, httpOnly, secure, sameSite}
        """
        for c in cookies:
            name = c.get("name")
            value = c.get("value")
            if not name or value is None:
                continue
            domain = c.get("domain") or "store.coupangeats.com"
            path = c.get("path") or "/"
            try:
                self._session.cookies.set(name, value, domain=domain, path=path)
            except Exception as e:  # noqa: BLE001
                log.warning("cookie set failed [%s]: %s", name, e)

    def get_cookies(self) -> list[dict]:
        """현재 세션 쿠키를 dict list 로 추출 (재저장용)."""
        out = []
        try:
            jar = self._session.cookies.jar
            for c in jar:
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

    def __enter__(self) -> "CoupangEatsClient":
        return self

    def __exit__(self, *exc):
        self.close()

    # ───── 내부 HTTP 헬퍼 ────────────────────────────────────

    def _build_request_meta(self, referer: str) -> str:
        """x-request-meta 헤더 값 — base64(JSON).

        HAR 디코드:
          {"o":"https://store.coupangeats.com",
           "ua":"Mozilla/5.0 ... Sa" (truncated 100자),
           "r":"https://store.coupangeats.com/",
           "t": epoch_ms,
           "sr":"2560x1440",
           "l":"ko-KR"}
        """
        payload = {
            "o": BASE_URL,
            "ua": self._user_agent[:100],
            "r": referer,
            "t": int(datetime.datetime.utcnow().timestamp() * 1000),
            "sr": self._screen_resolution,
            "l": self._accept_language,
        }
        return base64.b64encode(
            json.dumps(payload, separators=(",", ":")).encode("utf-8")
        ).decode("ascii")

    def _common_headers(self, referer: str, content_type: Optional[str] = None) -> dict:
        h = {
            "accept": "application/json",
            "accept-language": self._accept_language,
            "origin": BASE_URL,
            "referer": referer,
            "user-agent": self._user_agent,
            "x-request-meta": self._build_request_meta(referer),
            "x-requested-with": "XMLHttpRequest",
        }
        if content_type:
            h["content-type"] = content_type
        return h

    def _check_response(self, r) -> None:
        """401/403 → CookieInvalidError, 그 외 4xx/5xx → CoupangEatsError.

        응답 body 의 앞 240자를 에러 메시지에 포함 (사장님이 UI 에서 원인 추적 가능).
        """
        body_preview = ""
        try:
            body_preview = (r.text or "")[:240].replace("\n", " ").replace("\r", " ")
        except Exception:
            pass
        if r.status_code in (401, 403):
            raise CookieInvalidError(
                f"세션 쿠키 거부 (HTTP {r.status_code}) — "
                f"인증 쿠키(EATS_AT/EATS_RT) 또는 Akamai 쿠키(_abck/bm_sz) 누락 가능성. "
                f"응답: {body_preview}",
                status_code=r.status_code,
            )
        if r.status_code >= 400:
            raise CoupangEatsError(
                f"쿠팡이츠 API 오류 HTTP {r.status_code}: {body_preview}",
                status_code=r.status_code,
            )
        ctype = r.headers.get("content-type", "")
        if "application/json" not in ctype.lower():
            raise CookieInvalidError(
                f"쿠팡이츠가 JSON 대신 {ctype} 반환 (HTTP {r.status_code}) — "
                f"Akamai interstitial 또는 차단 페이지 가능성. 응답: {body_preview}",
                status_code=r.status_code,
            )

    # ───── 인증 검증 ────────────────────────────────────────

    def whoami(self) -> dict:
        """세션 검증 — GET /api/v1/merchant/whoami.

        쿠키가 살아있으면 사장님 정보 반환. 401 시 CookieInvalidError.
        """
        url = f"{BASE_URL}/api/v1/merchant/whoami"
        referer = f"{BASE_URL}/merchant/management/home/"
        try:
            r = self._session.get(
                url,
                headers=self._common_headers(referer),
                timeout=self._timeout,
            )
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/whoami]: {e}") from e
        self._check_response(r)
        try:
            return r.json()
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"JSON 파싱 실패 [/whoami]: {e}") from e

    def list_stores(self) -> list[dict]:
        """매장 list — GET /api/v1/merchant/web/stores/list-by-pagination."""
        url = f"{BASE_URL}/api/v1/merchant/web/stores/list-by-pagination"
        referer = f"{BASE_URL}/merchant/management/home/"
        try:
            r = self._session.get(
                url,
                headers=self._common_headers(referer),
                timeout=self._timeout,
            )
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/stores/list]: {e}") from e
        self._check_response(r)
        data = r.json()
        return data.get("data", {}).get("content", []) or data.get("stores", []) or []

    # ───── 주문 조회 ─────────────────────────────────────────

    def fetch_orders(self,
                     store_id: int,
                     start: datetime.datetime,
                     end: datetime.datetime,
                     *,
                     page_number: int = 0,
                     page_size: int = 100) -> OrderFetchResult:
        """주문 단위 조회 (페이지네이션 1회).

        Args:
            store_id: 쿠팡이츠 매장 ID
            start: 조회 시작 일시 (KST 기준, epoch ms 로 변환)
            end:   조회 종료 일시
        """
        url = f"{BASE_URL}/api/v1/merchant/web/order/condition"
        referer = f"{BASE_URL}/merchant/management/home/{store_id}"
        body = {
            "pageNumber": page_number,
            "pageSize": page_size,
            "storeId": store_id,
            "startDate": int(start.timestamp() * 1000),
            "endDate": int(end.timestamp() * 1000),
        }
        try:
            r = self._session.post(
                url,
                headers=self._common_headers(referer,
                                             content_type="application/json;charset=UTF-8"),
                data=json.dumps(body),
                timeout=self._timeout,
            )
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/order/condition]: {e}") from e
        self._check_response(r)
        try:
            raw = r.json()
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(
                f"order/condition JSON 파싱 실패: {e} body={(r.text or '')[:200]}"
            ) from e

        # 응답 구조 다양성 대응:
        # ① {"totalSalePrice":..., "orderPageVo":{...}}   (HAR 캡처 기준)
        # ② {"data": {"totalSalePrice":..., "orderPageVo":{...}}}  (API 버전에 따라)
        # ③ {"code":..., "data": null}  (조건에 데이터 없을 때)
        # ④ null / {} / "" 등 비정상
        if raw is None:
            log.warning("order/condition: response is None — returning empty")
            return OrderFetchResult(0, 0, 0, [], {})
        if not isinstance(raw, dict):
            log.warning("order/condition: response is not dict (type=%s)", type(raw).__name__)
            return OrderFetchResult(0, 0, 0, [], {"_raw": raw})

        # data 래핑 unwrap (있을 때만)
        data_root = raw
        if "data" in raw and "totalSalePrice" not in raw:
            inner = raw.get("data")
            if isinstance(inner, dict):
                data_root = inner
            elif inner is None:
                # 빈 응답 — 주문 0건
                log.info("order/condition: data is null (no orders in range)")
                return OrderFetchResult(0, 0, 0, [], raw)

        page_vo = data_root.get("orderPageVo") if isinstance(data_root, dict) else None
        if not isinstance(page_vo, dict):
            page_vo = {}
        orders = page_vo.get("content") or []
        if not isinstance(orders, list):
            orders = []

        return OrderFetchResult(
            total_sale_price=int(float(data_root.get("totalSalePrice") or 0)),
            total_order_count=int(data_root.get("totalOrderCount") or 0),
            avg_order_amount=int(float(data_root.get("avgOrderAmount") or 0)),
            orders=orders,
            raw=raw,
        )

    def fetch_all_orders(self,
                         store_id: int,
                         start: datetime.datetime,
                         end: datetime.datetime,
                         *,
                         page_size: int = 10,
                         max_pages: int = 500) -> list[dict]:
        """모든 페이지 순회 — orders list 만 평탄화.

        page_size 기본 10 — HAR 캡처 기준 쿠팡이츠가 큰 page_size 거부 (빈 응답).
        max_pages 안전장치 (10*500 = 5000건 한도).
        """
        all_orders: list[dict] = []
        for page in range(max_pages):
            res = self.fetch_orders(store_id, start, end,
                                    page_number=page, page_size=page_size)
            log.info(
                "fetch_all_orders: page=%d size=%d got=%d total_elem=%d total_sales=%d",
                page, page_size, len(res.orders),
                res.total_order_count, res.total_sale_price,
            )
            all_orders.extend(res.orders)

            # data_root 에서 orderPageVo 추출 (raw 가 wrapping 됐을 수 있어 양쪽 시도)
            page_vo = None
            for cand in (res.raw, res.raw.get("data") if isinstance(res.raw, dict) else None):
                if isinstance(cand, dict) and isinstance(cand.get("orderPageVo"), dict):
                    page_vo = cand["orderPageVo"]
                    break
            page_vo = page_vo or {}

            total_elem = int(page_vo.get("totalElements") or res.total_order_count or 0)
            last_page = page_vo.get("lastPageNumber")

            if not res.orders:
                break
            if last_page is not None:
                try:
                    if page >= int(last_page):
                        break
                except (TypeError, ValueError):
                    pass
            if total_elem > 0 and len(all_orders) >= total_elem:
                break
        return all_orders

    # ───── 정산 조회 ────────────────────────────────────────

    def fetch_settlements(self,
                          store_id: int,
                          start_date: datetime.date,
                          end_date: datetime.date,
                          *,
                          page_num: int = 0,
                          page_size: int = 100) -> SettlementFetchResult:
        """일별 정산 조회 (페이지네이션 1회).

        URL: GET /api/v1/merchant/transactions/{store_id}/settlement-management-data
             ?storeId=&startAt=YYYY-MM-DD&endAt=YYYY-MM-DD&pageNum=&pageSize=
        """
        url = f"{BASE_URL}/api/v1/merchant/transactions/{store_id}/settlement-management-data"
        referer = f"{BASE_URL}/merchant/management/settlement/{store_id}"
        params = {
            "storeId": store_id,
            "startAt": start_date.strftime("%Y-%m-%d"),
            "endAt": end_date.strftime("%Y-%m-%d"),
            "pageNum": page_num,
            "pageSize": page_size,
        }
        try:
            r = self._session.get(
                url,
                params=params,
                headers=self._common_headers(referer),
                timeout=self._timeout,
            )
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/settlement]: {e}") from e
        self._check_response(r)
        try:
            raw = r.json()
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(
                f"settlement JSON 파싱 실패: {e} body={(r.text or '')[:200]}"
            ) from e
        if raw is None:
            return SettlementFetchResult(0, 0, [], {})
        data = raw.get("data") if isinstance(raw, dict) else None
        if not isinstance(data, dict):
            data = raw if isinstance(raw, dict) else {}
        contents = data.get("contents") or []
        if not isinstance(contents, list):
            contents = []
        return SettlementFetchResult(
            total_elements=int(data.get("totalElements") or 0),
            total_pages=int(data.get("totalPages") or 0),
            contents=contents,
            raw=raw,
        )

    def fetch_all_settlements(self,
                              store_id: int,
                              start_date: datetime.date,
                              end_date: datetime.date,
                              *,
                              page_size: int = 100,
                              max_pages: int = 50) -> list[dict]:
        all_rows: list[dict] = []
        total_elem = 0
        for page in range(max_pages):
            res = self.fetch_settlements(store_id, start_date, end_date,
                                         page_num=page, page_size=page_size)
            all_rows.extend(res.contents)
            total_elem = res.total_elements
            if page >= max(0, res.total_pages - 1):
                break
            if len(all_rows) >= total_elem:
                break
            if not res.contents:
                break
        return all_rows

    # ───── 잔액 / 예상 정산 ───────────────────────────────────

    def fetch_balance(self, store_id: int) -> dict:
        url = f"{BASE_URL}/api/v1/merchant/transactions/{store_id}/balance/"
        referer = f"{BASE_URL}/merchant/management/settlement/{store_id}"
        r = self._session.get(url, headers=self._common_headers(referer),
                              timeout=self._timeout)
        self._check_response(r)
        return r.json()

    def fetch_expected_settlement(self, store_id: int) -> dict:
        url = f"{BASE_URL}/api/v2/merchant/transactions/{store_id}/expected-settlement"
        referer = f"{BASE_URL}/merchant/management/settlement/{store_id}"
        r = self._session.get(url, headers=self._common_headers(referer),
                              timeout=self._timeout)
        self._check_response(r)
        return r.json()

    # ───── 월별 매출내역서 엑셀 (fee breakdown 의 유일한 소스) ─────

    def fetch_downloadable_periods(self, store_id: int) -> dict:
        """매출내역서(엑셀) 다운로드 가능 기간 조회.

        URL: GET /api/v1/merchant/web/emails?type=salesOrder
        응답 예:
            {"data": {
              "downloadablePeriods": [
                {"periodUnitType": "MONTH", "start": "2020-01", "inclusiveEnd": "2026-04"},
                {"periodUnitType": "QUARTER_OF_YEAR", "start": "2020-1Q", "inclusiveEnd": "2026-Q1"}
              ],
              "nextSubscribePeriods": [...],
              "subscribers": []
            }, "code": "SUCCESS"}

        Returns: data dict (downloadablePeriods 만 사용 권장).
        """
        url = f"{BASE_URL}/api/v1/merchant/web/emails"
        referer = f"{BASE_URL}/merchant/management/orders/{store_id}"
        try:
            r = self._session.get(
                url,
                params={"type": "salesOrder"},
                headers=self._common_headers(referer),
                timeout=self._timeout,
            )
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/emails list]: {e}") from e
        self._check_response(r)
        try:
            raw = r.json()
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(
                f"emails list JSON 파싱 실패: {e} body={(r.text or '')[:200]}"
            ) from e
        if isinstance(raw, dict):
            return raw.get("data") or raw
        return {}

    def download_sales_order_excel(self,
                                   store_id: int,
                                   year_month: str) -> bytes:
        """월별 매출내역서 엑셀 raw bytes 다운로드.

        URL: GET /api/v1/merchant/web/emails
             ?type=salesOrder&action=download&downloadRequestDate=YYYY-MM&storeId=...

        Args:
            year_month: 'YYYY-MM' (fetch_downloadable_periods 의 start ~ inclusiveEnd 범위 내)

        Returns: xlsx 바이너리 (보통 ~90KB).

        Raises:
            CookieInvalidError: 세션 만료/봇 차단
            CoupangEatsError: 그 외 HTTP 4xx/5xx 또는 잘못된 mime
        """
        # 'YYYY-MM' 형식 검증
        if (not year_month or len(year_month) != 7
                or year_month[4] != '-' or not year_month[:4].isdigit()
                or not year_month[5:].isdigit()):
            raise CoupangEatsError(f"year_month 형식 오류 (YYYY-MM 필요): {year_month!r}")

        url = f"{BASE_URL}/api/v1/merchant/web/emails"
        referer = f"{BASE_URL}/merchant/management/orders/{store_id}"
        headers = self._common_headers(referer)
        # 다운로드는 binary 라 accept=*/* (JSON 엔드포인트와 구분)
        headers["accept"] = "*/*"

        params = {
            "type": "salesOrder",
            "action": "download",
            "downloadRequestDate": year_month,
            "storeId": store_id,
        }
        try:
            r = self._session.get(url, params=params, headers=headers,
                                   timeout=max(self._timeout, 60.0))
        except Exception as e:  # noqa: BLE001
            raise CoupangEatsError(f"통신 실패 [/emails download]: {e}") from e

        # _check_response 는 JSON 만 통과시키므로 여기선 binary 친화 검증
        body_preview = ""
        try:
            # binary 라도 text 시도시 일부 디코딩됨 (에러일 경우 HTML/JSON)
            body_preview = (r.text or "")[:200].replace("\n", " ").replace("\r", " ")
        except Exception:
            pass

        if r.status_code in (401, 403):
            raise CookieInvalidError(
                f"세션 쿠키 거부 (HTTP {r.status_code}): {body_preview}",
                status_code=r.status_code,
            )
        if r.status_code >= 400:
            raise CoupangEatsError(
                f"엑셀 다운로드 실패 HTTP {r.status_code}: {body_preview}",
                status_code=r.status_code,
            )

        ct = (r.headers.get("content-type") or "").lower()
        is_xlsx_mime = (
            "spreadsheet" in ct
            or "officedocument" in ct
            or "octet-stream" in ct
        )
        data = r.content
        # xlsx 파일은 zip 컨테이너 — 매직 'PK\x03\x04' 로 시작
        is_xlsx_magic = isinstance(data, (bytes, bytearray)) and data[:4] == b"PK\x03\x04"

        if not (is_xlsx_mime or is_xlsx_magic):
            raise CoupangEatsError(
                f"엑셀이 아닌 응답 (content-type={ct}, len={len(data)}): {body_preview}"
            )
        if not data:
            raise CoupangEatsError("엑셀 본문이 비어있음 (0바이트)")
        return data

    # ───── 정산 detail probe (URL 미확정 — fee breakdown 발굴용) ──────

    # detail endpoint URL 후보군. 사장님 인계 노트 가설 3종 + 흔한 변형 2종.
    # 첫 매칭 (status_code=200 + JSON body) 발견 시 그것을 정식 URL 로 채택.
    SETTLEMENT_DETAIL_URL_CANDIDATES: list[str] = [
        # 가설 1 — 인계 노트 "가장 가능성 ↑": 컬렉션 URL 끝에 ID
        "/api/v1/merchant/transactions/{store_id}/settlement-management-data/{seller_transfer_id}",
        # 가설 2 — 컬렉션/detail/ID
        "/api/v1/merchant/transactions/{store_id}/settlement-management-data/detail/{seller_transfer_id}",
        # 가설 3 — 별도 settlement-detail 패스
        "/api/v1/merchant/transactions/{store_id}/settlement-detail/{seller_transfer_id}",
        # 변형 — ID/detail
        "/api/v1/merchant/transactions/{store_id}/settlement-management-data/{seller_transfer_id}/detail",
        # 변형 — v2
        "/api/v2/merchant/transactions/{store_id}/settlement-management-data/{seller_transfer_id}",
    ]

    def probe_settlement_detail(self,
                                store_id: int,
                                seller_transfer_id: int,
                                *,
                                extra_urls: Optional[list[str]] = None) -> list[dict]:
        """detail endpoint URL 발굴용 probe — 후보 URL 들을 순회하며 결과 수집.

        절대 raise 하지 않음 (probe 목적). 각 시도마다 응답 상태/타입/본문 일부를 반환.
        """
        urls = list(self.SETTLEMENT_DETAIL_URL_CANDIDATES)
        if extra_urls:
            urls.extend(extra_urls)

        referer = f"{BASE_URL}/merchant/management/settlement/{store_id}"
        out: list[dict] = []
        for tpl in urls:
            url = BASE_URL + tpl.format(
                store_id=store_id,
                seller_transfer_id=seller_transfer_id,
            )
            entry: dict = {"url": url, "url_template": tpl}
            try:
                r = self._session.get(
                    url,
                    headers=self._common_headers(referer),
                    timeout=self._timeout,
                )
            except Exception as e:  # noqa: BLE001
                entry["error"] = f"통신 실패: {e}"
                out.append(entry)
                continue

            body_preview = ""
            try:
                body_preview = (r.text or "")[:1200].replace("\n", " ").replace("\r", " ")
            except Exception:
                pass

            entry["status_code"] = r.status_code
            entry["content_type"] = r.headers.get("content-type")
            entry["content_length"] = r.headers.get("content-length")
            entry["body_preview"] = body_preview

            # JSON 으로 파싱 시도 — 성공하면 키 list 함께 노출
            if "application/json" in (entry["content_type"] or "").lower():
                try:
                    parsed = r.json()
                    if isinstance(parsed, dict):
                        entry["json_top_keys"] = list(parsed.keys())
                        # data 래핑 한 단계 더 펼쳐서 안내
                        inner = parsed.get("data")
                        if isinstance(inner, dict):
                            entry["json_data_keys"] = list(inner.keys())
                        # 'code' 등 응답 wrapper 메타
                        entry["json_code"] = parsed.get("code") or parsed.get("status")
                except Exception as e:  # noqa: BLE001
                    entry["json_parse_error"] = str(e)

            out.append(entry)

        return out


# ──────────────────────────────────────────────────────────────────────────
# 비즈니스 로직 — DB 적재
# ──────────────────────────────────────────────────────────────────────────

def _to_int(v) -> int:
    if v is None or v == "":
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        try:
            return int(float(v))
        except (TypeError, ValueError):
            return 0


def _extract_settlement_breakdown(raw: dict) -> dict:
    """쿠팡이츠 정산 응답의 항목별 분해 추출.

    실제 응답 key 이름은 API 변경에 대비해 fallback 다중 매핑.
    """
    def g(*keys, default=0):
        for k in keys:
            v = raw.get(k)
            if v is not None:
                try:
                    return int(v)
                except (TypeError, ValueError):
                    continue
        return default

    return dict(
        total_sales=g("totalSales", "totalSaleAmount", "grossSales"),
        fee_brokerage=g("brokerageFee", "feeBrokerage", "commissionFee"),
        fee_payment=g("paymentFee", "feePayment", "pgFee"),
        fee_delivery=g("deliveryFee", "feeDelivery"),
        fee_advertising=g("advertisingFee", "adFee", "feeAdvertising"),
        fee_membership=g("membershipFee", "wowFee"),
        fee_other=g("otherFee", "etcFee"),
        deduction_etc=g("deductionEtc", "adjustment"),
    )


def _parse_kst_datetime(value) -> Optional[datetime.datetime]:
    """쿠팡이츠 응답의 다양한 일시 포맷 → naive datetime (KST 가정).

    예상: "2026-05-12T18:30:00", "2026-05-12 18:30:00", epoch ms (int)
    """
    if value is None or value == "":
        return None
    if isinstance(value, (int, float)):
        try:
            return datetime.datetime.fromtimestamp(value / 1000)
        except (OSError, OverflowError, ValueError):
            return None
    s = str(value).strip().replace("T", " ").replace("Z", "")
    # 'YYYY-MM-DD HH:MM:SS' 또는 'YYYY-MM-DD HH:MM:SS.fff'
    for fmt in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S",
                "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.datetime.strptime(s[:len(fmt) + 6], fmt)
        except ValueError:
            continue
    return None


def upsert_orders(session, business_id: int, store_id: int,
                  raw_orders: list[dict]) -> dict:
    """주문 list → CoupangEatsOrder 에 upsert.

    중복 키: (business_id, order_id)
    """
    from sqlmodel import select
    from models import CoupangEatsOrder

    inserted = 0
    updated = 0
    skipped = 0

    for row in raw_orders:
        order_id = str(row.get("orderId") or row.get("uniqueOrderId") or "").strip()
        if not order_id:
            skipped += 1
            continue
        existing = session.exec(
            select(CoupangEatsOrder).where(
                CoupangEatsOrder.business_id == business_id,
                CoupangEatsOrder.order_id == order_id,
            )
        ).first()

        # 일시 — 실제 응답: createdAt (epoch ms)
        ordered_at = _parse_kst_datetime(
            row.get("createdAt") or row.get("orderedAt") or row.get("orderTime")
        )
        delivered_at = _parse_kst_datetime(
            row.get("completedAt") or row.get("deliveredAt")
        )

        # 총 금액 — 실제 응답: totalAmount / totalAmountMoney.units (우선)
        # salePrice / initialSalePrice 도 후보
        total_money = (
            row.get("totalAmountMoney")
            or row.get("salePriceMoney")
            or row.get("totalSalePriceMoney")
            or {}
        )
        total_amount = (
            _to_int(total_money.get("units"))
            or _to_int(row.get("totalAmount"))
            or _to_int(row.get("salePrice"))
            or _to_int(row.get("totalSalePrice"))
            or _to_int(row.get("initialSalePrice"))
        )

        # 할인 — discountPrice / discountPriceMoney
        discount_money = row.get("discountPriceMoney") or {}
        discount_amount = (
            _to_int(discount_money.get("units"))
            or _to_int(row.get("discountPrice"))
            or _to_int(row.get("discountAmount"))
        )

        # 상태 — 실제: status (COMPLETED / CANCELED / PARTIAL_CANCELED 등)
        order_status = str(row.get("status") or row.get("orderStatus") or "").strip() or None
        canceled_amount = _to_int(
            (row.get("canceledAmountMoney") or {}).get("units")
            or row.get("canceledAmount")
        )
        cancelled = (
            (order_status or "").upper() in ("CANCELLED", "CANCELED", "REFUNDED")
            or bool(row.get("partialCanceled"))
            or canceled_amount > 0
        )

        items = row.get("items") or row.get("orderItems") or row.get("menus")
        items_blob = None
        if items is not None:
            try:
                items_blob = json.dumps(items, ensure_ascii=False)
            except (TypeError, ValueError):
                items_blob = None

        try:
            raw_blob = json.dumps(row, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            raw_blob = None

        fields = dict(
            business_id=business_id,
            store_id=store_id,
            order_id=order_id,
            abbr_order_id=str(row.get("abbrOrderId") or "")[:16] or None,
            ordered_at=ordered_at,
            delivered_at=delivered_at,
            total_sale_price=total_amount,
            discount_amount=discount_amount,
            cancelled=cancelled,
            payment_method=(row.get("paymentMethod") or row.get("paymentType") or None),
            order_status=order_status,
            delivery_type=(row.get("deliveryType") or row.get("orderType") or None),
            items_json=items_blob,
            raw_json=raw_blob,
            synced_at=datetime.datetime.utcnow(),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            session.add(CoupangEatsOrder(**fields))
            inserted += 1

    session.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": inserted + updated,
    }


def upsert_settlements(session, business_id: int, store_id: int,
                       raw_settlements: list[dict]) -> dict:
    """정산 list → CoupangEatsSettlement 에 upsert.

    중복 키: (business_id, settlement_date, settlement_type, seller_transfer_id)
    """
    from sqlmodel import select
    from models import CoupangEatsSettlement

    inserted = 0
    updated = 0
    skipped = 0

    for row in raw_settlements:
        date_str = (row.get("settlementDate") or "").strip()
        settle_type = (row.get("settlementManageType") or "").strip().upper()
        if not date_str or not settle_type:
            skipped += 1
            continue
        # "2026.05.13" → date(2026,5,13)
        try:
            settle_date = datetime.datetime.strptime(date_str.replace("-", "."),
                                                     "%Y.%m.%d").date()
        except ValueError:
            skipped += 1
            continue
        seller_transfer_id = row.get("sellerTransferId")
        try:
            seller_transfer_id = int(seller_transfer_id) if seller_transfer_id is not None else None
        except (TypeError, ValueError):
            seller_transfer_id = None

        existing = session.exec(
            select(CoupangEatsSettlement).where(
                CoupangEatsSettlement.business_id == business_id,
                CoupangEatsSettlement.settlement_date == settle_date,
                CoupangEatsSettlement.settlement_type == settle_type,
                CoupangEatsSettlement.seller_transfer_id == seller_transfer_id,
            )
        ).first()

        try:
            raw_blob = json.dumps(row, ensure_ascii=False, default=str)
        except (TypeError, ValueError):
            raw_blob = None

        start_dt = (row.get("startDate") or "").strip()
        end_dt = (row.get("endDate") or "").strip()
        start_date = None
        end_date = None
        for fmt in ("%Y.%m.%d", "%Y-%m-%d"):
            if start_dt and start_date is None:
                try:
                    start_date = datetime.datetime.strptime(start_dt, fmt).date()
                except ValueError:
                    pass
            if end_dt and end_date is None:
                try:
                    end_date = datetime.datetime.strptime(end_dt, fmt).date()
                except ValueError:
                    pass

        breakdown = _extract_settlement_breakdown(row)
        fields = dict(
            business_id=business_id,
            store_id=store_id,
            settlement_date=settle_date,
            settlement_type=settle_type,
            amount=_to_int(row.get("amount")),
            balance=_to_int(row.get("balance")),
            start_date=start_date,
            end_date=end_date,
            seller_transfer_id=seller_transfer_id,
            raw_json=raw_blob,
            synced_at=datetime.datetime.utcnow(),
            **breakdown,
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            session.add(CoupangEatsSettlement(**fields))
            inserted += 1

    session.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": inserted + updated,
    }


def upsert_revenue_from_orders(session, business_id: int,
                               sale_date: datetime.date) -> int:
    """일자 주문 집계 → Revenue(channel='쿠팡이츠') upsert.

    Revenue.amount 는 **취소 제외 총 주문가** (EasyPOS net_amount 와 의미는 다르지만
    배달앱은 영수증 단위 부가세 분리가 응답에 없으므로 totalSalePrice 사용).
    """
    from sqlmodel import select
    from models import CoupangEatsOrder, Revenue
    from constants import REVENUE_CHANNEL_COUPANG

    rows = session.exec(
        select(CoupangEatsOrder).where(
            CoupangEatsOrder.business_id == business_id,
            CoupangEatsOrder.ordered_at >= datetime.datetime.combine(sale_date, datetime.time.min),
            CoupangEatsOrder.ordered_at < datetime.datetime.combine(
                sale_date + datetime.timedelta(days=1), datetime.time.min
            ),
            CoupangEatsOrder.cancelled == False,  # noqa: E712
        )
    ).all()

    total = sum(int(r.total_sale_price or 0) for r in rows)
    order_count = len(rows)

    if order_count == 0:
        return 0

    rev = session.exec(
        select(Revenue).where(
            Revenue.business_id == business_id,
            Revenue.date == sale_date,
            Revenue.channel == REVENUE_CHANNEL_COUPANG,
        )
    ).first()
    description = f"쿠팡이츠 자동수집 (주문 {order_count}건)"
    if rev:
        rev.amount = total
        rev.description = description
        session.add(rev)
    else:
        rev = Revenue(
            business_id=business_id,
            date=sale_date,
            channel=REVENUE_CHANNEL_COUPANG,
            amount=total,
            description=description,
        )
        session.add(rev)
    session.commit()
    return total


# ──────────────────────────────────────────────────────────────────────────
# 월별 매출내역서(엑셀) → CoupangEatsOrderFee 적재 + Settlement fee_* 보강
# ──────────────────────────────────────────────────────────────────────────


def upsert_order_fees(session, business_id: int, store_id: int,
                      year_month: str,
                      parsed_orders: list) -> dict:
    """ParsedOrderFee list → CoupangEatsOrderFee upsert.

    중복 키: (business_id, order_id). 재실행 시 갱신만.
    """
    from sqlmodel import select
    from models import CoupangEatsOrderFee

    inserted = 0
    updated = 0
    skipped = 0

    for p in parsed_orders:
        if not p.order_id:
            skipped += 1
            continue
        existing = session.exec(
            select(CoupangEatsOrderFee).where(
                CoupangEatsOrderFee.business_id == business_id,
                CoupangEatsOrderFee.order_id == p.order_id,
            )
        ).first()

        fields = dict(
            business_id=business_id,
            store_id=store_id,
            order_date=p.order_date,
            ordered_at=p.ordered_at,
            order_id=p.order_id,
            order_type=p.order_type,
            items_summary=p.items_summary,
            brand=p.brand,
            shop_name=p.shop_name,
            payment_method=p.payment_method,
            transaction_type=p.transaction_type,
            total_amount=p.total_amount,
            order_amount=p.order_amount,
            payment_amount=p.payment_amount,
            coupon_coupang=p.coupon_coupang,
            coupon_store=p.coupon_store,
            brokerage_before_basic=p.brokerage_before_basic,
            brokerage_before_promo=p.brokerage_before_promo,
            brokerage_final=p.brokerage_final,
            payment_fee_basic=p.payment_fee_basic,
            payment_fee_promo=p.payment_fee_promo,
            delivery_before_basic=p.delivery_before_basic,
            delivery_before_promo=p.delivery_before_promo,
            delivery_final=p.delivery_final,
            delivery_only=p.delivery_only,
            food_only=p.food_only,
            customer_delivery_fee=p.customer_delivery_fee,
            customer_delivery_fee_total=p.customer_delivery_fee_total,
            service_before_disposable_cup=p.service_before_disposable_cup,
            service_before_supply=p.service_before_supply,
            service_before_vat=p.service_before_vat,
            service_before_total=p.service_before_total,
            service_after_disposable_cup=p.service_after_disposable_cup,
            service_after_supply=p.service_after_supply,
            service_after_vat=p.service_after_vat,
            service_after_total=p.service_after_total,
            ad_supply=p.ad_supply,
            ad_vat=p.ad_vat,
            ad_total=p.ad_total,
            settle_before_basic=p.settle_before_basic,
            settle_before_promo=p.settle_before_promo,
            settle_final=p.settle_final,
            extra_col_40=p.extra_col_40,
            promotion_benefit=p.promotion_benefit,
            refund_amount=p.refund_amount,
            source_year_month=year_month,
            synced_at=datetime.datetime.utcnow(),
        )
        if existing:
            for k, v in fields.items():
                setattr(existing, k, v)
            session.add(existing)
            updated += 1
        else:
            session.add(CoupangEatsOrderFee(**fields))
            inserted += 1

    session.commit()
    return {
        "inserted": inserted,
        "updated": updated,
        "skipped": skipped,
        "total_processed": inserted + updated,
    }


def update_settlements_from_fees(session, business_id: int,
                                 year_month: str) -> dict:
    """월별 OrderFee 일자별 집계 → CoupangEatsSettlement.fee_* 갱신.

    `year_month` ('YYYY-MM') 범위 안의 모든 일자에 대해:
      1) CoupangEatsOrderFee 를 일자별로 그룹핑 (취소 제외)
      2) 각 일자의 SETTLEMENT row 를 찾아 fee_brokerage / fee_payment /
         fee_delivery / fee_advertising / fee_membership / total_sales 업데이트
      3) detail_synced_at + detail_source_year_month 마킹

    Settlement row 가 없는 일자는 (정산이 아직 안 들어온 일자) skip.
    동일 일자에 SETTLEMENT 가 여러 건이면 첫 번째 (settlement_date 동일 + sellerTransferId 있음) 에만 적재
    — 쿠팡이츠 정상 케이스는 1일 1 SETTLEMENT.
    """
    from sqlmodel import select
    from models import CoupangEatsOrderFee, CoupangEatsSettlement

    # year_month 파싱
    try:
        year = int(year_month[:4])
        month = int(year_month[5:7])
        period_start = datetime.date(year, month, 1)
        if month == 12:
            period_end = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            period_end = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    except (ValueError, IndexError) as e:
        raise CoupangEatsError(f"year_month 형식 오류: {year_month!r} ({e})") from e

    # 1) OrderFee 일자별 집계
    fees = session.exec(
        select(CoupangEatsOrderFee).where(
            CoupangEatsOrderFee.business_id == business_id,
            CoupangEatsOrderFee.order_date >= period_start,
            CoupangEatsOrderFee.order_date <= period_end,
        )
    ).all()

    # 일자 → 집계
    daily_agg: dict[datetime.date, dict] = {}
    for f in fees:
        if (f.transaction_type or "").strip() == "취소":
            continue
        agg = daily_agg.setdefault(f.order_date, {
            "order_count": 0,
            "total_amount": 0,
            "fee_brokerage": 0,
            "fee_payment": 0,
            "fee_delivery": 0,
            "fee_advertising": 0,
            "fee_membership": 0,
            "coupon_store": 0,
            "settle_final": 0,
        })
        agg["order_count"] += 1
        agg["total_amount"] += f.total_amount
        agg["fee_brokerage"] += f.brokerage_final
        agg["fee_payment"] += f.payment_fee_basic + f.payment_fee_promo
        agg["fee_delivery"] += f.delivery_final
        agg["fee_advertising"] += f.ad_total
        agg["fee_membership"] += f.service_after_total
        agg["coupon_store"] += f.coupon_store
        agg["settle_final"] += f.settle_final

    # 2) 각 일자의 SETTLEMENT row 업데이트
    settlements_updated = 0
    dates_without_settlement: list[str] = []
    now = datetime.datetime.utcnow()

    for d, agg in daily_agg.items():
        settle = session.exec(
            select(CoupangEatsSettlement).where(
                CoupangEatsSettlement.business_id == business_id,
                CoupangEatsSettlement.settlement_date == d,
                CoupangEatsSettlement.settlement_type == "SETTLEMENT",
            ).order_by(CoupangEatsSettlement.id.desc()).limit(1)
        ).first()

        if not settle:
            dates_without_settlement.append(d.isoformat())
            continue

        settle.total_sales = agg["total_amount"]
        settle.fee_brokerage = agg["fee_brokerage"]
        settle.fee_payment = agg["fee_payment"]
        settle.fee_delivery = agg["fee_delivery"]
        settle.fee_advertising = agg["fee_advertising"]
        settle.fee_membership = agg["fee_membership"]
        settle.detail_synced_at = now
        settle.detail_source_year_month = year_month
        session.add(settle)
        settlements_updated += 1

    session.commit()

    return {
        "year_month": year_month,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "order_fees_count": len(fees),
        "daily_aggregates_count": len(daily_agg),
        "settlements_updated": settlements_updated,
        "dates_without_settlement": dates_without_settlement,
    }


def update_delivery_revenue_from_fees(session, business_id: int,
                                      year_month: str) -> dict:
    """월별 OrderFee 합계 → DeliveryRevenue(channel='쿠팡', year, month) upsert.

    매출관리 페이지(/revenue)는 DeliveryRevenue.total_fees + fee_breakdown 을
    읽어 채널별 수수료율을 계산한다. settlement.fee_* 만 채워서는 그 화면이
    수수료 0% 로 보이므로, 월 합계를 DeliveryRevenue 로 다시 한 번 적재.

    fee_breakdown JSON 구조:
      {"중개수수료": int, "결제수수료": int, "배달비": int,
       "광고비": int, "멤버십": int}
    """
    from sqlmodel import select
    from models import CoupangEatsOrderFee, DeliveryRevenue

    try:
        year = int(year_month[:4])
        month = int(year_month[5:7])
        period_start = datetime.date(year, month, 1)
        if month == 12:
            period_end = datetime.date(year + 1, 1, 1) - datetime.timedelta(days=1)
        else:
            period_end = datetime.date(year, month + 1, 1) - datetime.timedelta(days=1)
    except (ValueError, IndexError) as e:
        raise CoupangEatsError(f"year_month 형식 오류: {year_month!r} ({e})") from e

    fees = session.exec(
        select(CoupangEatsOrderFee).where(
            CoupangEatsOrderFee.business_id == business_id,
            CoupangEatsOrderFee.order_date >= period_start,
            CoupangEatsOrderFee.order_date <= period_end,
        )
    ).all()

    total_sales = 0
    fee_brokerage = 0
    fee_payment = 0
    fee_delivery = 0
    fee_advertising = 0
    fee_membership = 0
    coupon_store = 0       # 점주 부담 쿠폰 (매출에서 빠지는 추가 부담)
    settle_total = 0
    order_count = 0
    cancelled_count = 0

    for f in fees:
        if (f.transaction_type or "").strip() == "취소":
            cancelled_count += 1
            continue
        order_count += 1
        total_sales += f.total_amount
        fee_brokerage += f.brokerage_final
        fee_payment += f.payment_fee_basic + f.payment_fee_promo
        fee_delivery += f.delivery_final
        fee_advertising += f.ad_total
        fee_membership += f.service_after_total
        coupon_store += f.coupon_store
        settle_total += f.settle_final

    # total_fees = 점주가 실제로 부담한 모든 수수료 + 점주부담 쿠폰
    # (쿠폰 쿠팡부담은 매출 인식엔 포함되지만 점주가 부담 안 하므로 fee 에서 제외)
    total_fees = (fee_brokerage + fee_payment + fee_delivery + fee_advertising
                  + fee_membership + coupon_store)

    fee_breakdown_json = json.dumps({
        "중개수수료": fee_brokerage,
        "결제수수료": fee_payment,
        "배달비": fee_delivery,
        "광고비": fee_advertising,
        "멤버십": fee_membership,
        "쿠폰(점주부담)": coupon_store,
    }, ensure_ascii=False)

    # 기존 row 검색 — 한국어 alias 모두 (bank_sync 가 "쿠팡이츠" 로 저장, legacy 가 "쿠팡" 으로 저장)
    # 매출관리 페이지의 LEGACY_CHANNEL_MAP 과 동일 정규화로 한 행만 남기는 게 중요.
    existing_rows = session.exec(
        select(DeliveryRevenue).where(
            DeliveryRevenue.business_id == business_id,
            DeliveryRevenue.year == year,
            DeliveryRevenue.month == month,
            DeliveryRevenue.channel.in_(["쿠팡이츠", "쿠팡", "쿠팡잇츠", "쿠팡페이"]),
        )
    ).all()

    # 채널명은 "쿠팡이츠" 로 통일 (기존 bank_sync 패턴).
    canonical_channel = "쿠팡이츠"

    # settle_final 이 0 (4월처럼 엑셀에 정산금액 비어있는 케이스) 이면 기존 bank_sync
    # settle 값 보존. fee_* 는 항상 우리 값으로 덮어씀 (엑셀이 진실의 출처).
    preserved_settle = settle_total
    if settle_total == 0 and existing_rows:
        for r in existing_rows:
            if r.settlement_amount > 0:
                preserved_settle = r.settlement_amount
                break

    fields = dict(
        business_id=business_id,
        channel=canonical_channel,
        year=year,
        month=month,
        total_sales=total_sales,
        total_fees=total_fees,
        settlement_amount=preserved_settle,
        order_count=order_count,
        fee_breakdown=fee_breakdown_json,
        source="auto_coupang_excel",
    )

    action = None
    if existing_rows:
        # 첫 번째 row 를 업데이트, 나머지 (중복) 는 삭제
        primary = existing_rows[0]
        for k, v in fields.items():
            setattr(primary, k, v)
        session.add(primary)
        for r in existing_rows[1:]:
            session.delete(r)
        action = "updated" + (f" (deduped {len(existing_rows)-1} dup)" if len(existing_rows) > 1 else "")
    else:
        session.add(DeliveryRevenue(**fields))
        action = "inserted"
    session.commit()

    return {
        "year_month": year_month,
        "channel": canonical_channel,
        "action": action,
        "order_count": order_count,
        "cancelled_count": cancelled_count,
        "total_sales": total_sales,
        "total_fees": total_fees,
        "fee_rate_percent": (
            round(total_fees / total_sales * 100, 2) if total_sales > 0 else 0
        ),
        "settlement_amount_excel": settle_total,
        "settlement_amount_used": preserved_settle,
        "fee_breakdown": json.loads(fee_breakdown_json),
    }


def sync_monthly_excel(session,
                      business_id: int,
                      store_id: int,
                      year_month: str,
                      excel_bytes: bytes,
                      *,
                      triggered_by: str = "manual") -> dict:
    """월별 매출내역서 엑셀 1건 처리 — 파싱 → upsert → settlement 보강 → SyncLog.

    Args:
        excel_bytes: download_sales_order_excel() 결과 또는 사용자 업로드.
    """
    from services.coupang_eats_excel_parser import parse_sales_order_excel
    from models import CoupangEatsSyncLog

    # SyncLog 시작
    sl = CoupangEatsSyncLog(
        business_id=business_id,
        sync_mode="monthly_excel",
        excel_year_month=year_month,
        triggered_by=triggered_by,
        status="running",
    )
    session.add(sl)
    session.commit()
    session.refresh(sl)

    try:
        # 1) 파싱
        report = parse_sales_order_excel(excel_bytes, expected_year_month=year_month)

        # 2) upsert
        up = upsert_order_fees(session, business_id, store_id, year_month, report.orders)

        # 3) settlement.fee_* 갱신
        settle_report = update_settlements_from_fees(session, business_id, year_month)

        # 4) DeliveryRevenue 월별 합계 갱신 (매출관리 페이지의 데이터 소스)
        dr_report = update_delivery_revenue_from_fees(session, business_id, year_month)

        # 5) SyncLog 완료
        sl.finished_at = datetime.datetime.utcnow()
        sl.status = "success"
        sl.excel_orders_parsed = report.parsed_count
        sl.excel_orders_upserted = up["inserted"] + up["updated"]
        sl.excel_orders_skipped = report.skipped_count + up["skipped"]
        sl.excel_settlements_updated = settle_report["settlements_updated"]
        session.add(sl)
        session.commit()

        return {
            "ok": True,
            "year_month": year_month,
            "parsed": report.parsed_count,
            "inserted": up["inserted"],
            "updated": up["updated"],
            "skipped": report.skipped_count + up["skipped"],
            "period_start": report.period_start.isoformat() if report.period_start else None,
            "period_end": report.period_end.isoformat() if report.period_end else None,
            "settlements_updated": settle_report["settlements_updated"],
            "dates_without_settlement": settle_report["dates_without_settlement"],
            "delivery_revenue": dr_report,
            "sync_log_id": sl.id,
        }

    except Exception as e:
        sl.finished_at = datetime.datetime.utcnow()
        sl.status = "failed"
        sl.error_message = str(e)[:500]
        session.add(sl)
        session.commit()
        log.error("sync_monthly_excel failed bid=%s ym=%s: %s",
                  business_id, year_month, e, exc_info=True)
        raise
