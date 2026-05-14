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


def earliest_cookie_expiry(cookies: list[dict]) -> Optional[datetime.datetime]:
    """쿠키 list 에서 가장 빠른 만료 시간 반환 (UTC).

    Playwright cookie 형식: {expires: float (epoch seconds, -1 = session)}.
    Chrome DevTools 형식: 동일.
    """
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
    earliest = min(candidates)
    try:
        return datetime.datetime.utcfromtimestamp(earliest)
    except (OSError, OverflowError, ValueError):
        return None


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
    """일자 주문 집계 → Revenue(channel='CoupangEats') upsert.

    Revenue.amount 는 **취소 제외 총 주문가** (EasyPOS net_amount 와 의미는 다르지만
    배달앱은 영수증 단위 부가세 분리가 응답에 없으므로 totalSalePrice 사용).
    """
    from sqlmodel import select
    from models import CoupangEatsOrder, Revenue

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
            Revenue.channel == "CoupangEats",
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
            channel="CoupangEats",
            amount=total,
            description=description,
        )
        session.add(rev)
    session.commit()
    return total
