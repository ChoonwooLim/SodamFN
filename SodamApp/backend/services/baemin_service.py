"""배민 사장님사이트 (ceo.baemin.com) 자동수집 어댑터.

쿠팡이츠와 동일 패턴 — curl_cffi (Chrome TLS) + 수동 쿠키 only.
HAR 캡처 후 fetch_orders / fetch_settlements 의 실제 URL·파라미터·응답 파싱을 채운다.
"""
from __future__ import annotations

import datetime
import json
import logging
from dataclasses import dataclass, field
from typing import Optional

try:
    from curl_cffi import requests as curl_requests  # type: ignore
    _CURL_CFFI_AVAILABLE = True
except ImportError:
    _CURL_CFFI_AVAILABLE = False
    curl_requests = None  # type: ignore


BASE_URL = "https://ceo.baemin.com"
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
    """ceo.baemin.com 세션 클라이언트. 인스턴스당 1매장 + 1세션."""

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
            domain = c.get("domain") or "ceo.baemin.com"
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
                        content_type: Optional[str] = None) -> dict:
        h = {
            "accept": "application/json",
            "accept-language": self._accept_language,
            "origin": BASE_URL,
            "referer": referer,
            "user-agent": self._user_agent,
            "x-requested-with": "XMLHttpRequest",
        }
        if content_type:
            h["content-type"] = content_type
        return h

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

    # ───── 인증 검증 (HAR 후 URL 확정) ─────
    def whoami(self) -> dict:
        """세션 검증. HAR 후 실제 endpoint 로 교체."""
        url = f"{BASE_URL}/api/whoami"  # TODO(HAR): 실제 URL 로 교체
        referer = f"{BASE_URL}/"
        try:
            r = self._session.get(url, headers=self._common_headers(referer),
                                  timeout=self._timeout)
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"통신 실패 [/whoami]: {e}") from e
        self._check_response(r)
        try:
            return r.json()
        except Exception as e:  # noqa: BLE001
            raise BaeminError(f"JSON 파싱 실패 [/whoami]: {e}") from e

    # ───── 매출 / 정산 (Task 5 에서 HAR 기반 구현) ─────
    def fetch_orders(self, store_id: str,
                     start: datetime.datetime,
                     end: datetime.datetime,
                     *, page_number: int = 0,
                     page_size: int = 50) -> OrderFetchResult:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_all_orders(self, store_id: str,
                         start: datetime.datetime,
                         end: datetime.datetime) -> list[dict]:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_settlements(self, store_id: str,
                          start_date: datetime.date,
                          end_date: datetime.date,
                          *, page_num: int = 0,
                          page_size: int = 100) -> SettlementFetchResult:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")

    def fetch_all_settlements(self, store_id: str,
                              start_date: datetime.date,
                              end_date: datetime.date) -> list[dict]:
        raise NotImplementedError("HAR 캡처 후 Task 5 에서 구현")
