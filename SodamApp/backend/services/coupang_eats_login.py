"""쿠팡이츠 자동 로그인 (Playwright + stealth) — Akamai sensor 통과.

이 모듈은 `coupang_eats_service.CoupangEatsClient` 가 사용할 인증 쿠키를 발급한다.
실 데이터 API 호출은 이 모듈에서 하지 않음 — 무거운 브라우저는 인증에만 사용.

## 왜 분리했나

쿠팡이츠는 로그인 게이트에서 Akamai Bot Manager 의 `sensor_data` POST 를
강제로 검증한다 (HAR 분석: 로그인 직전 `/YqaJ3sMCd0pM/...` POST 가 1초 안에 발생).
이 sensor JS 는 브라우저 환경(화면 크기, 폰트, 마우스 이벤트, WebGL 등 200+ 신호)
을 수집·암호화해서 전송하므로 Python 으로 재현 불가능.

해결책: 실제 Chromium 헤드리스 브라우저로 로그인만 수행 → 인증 쿠키 추출 →
이후 매출 API 는 가벼운 `curl_cffi` 로 직접 호출.

## 사용

    from services.coupang_eats_login import login_and_get_cookies
    result = login_and_get_cookies("sodam2025", "비밀번호")
    cookies = result["cookies"]   # list[dict] → coupang_eats_service.CoupangEatsClient 에 주입
    store_id = result["store_id"]
"""
from __future__ import annotations

import asyncio
import logging
import os
import re
from typing import Optional

try:
    from playwright.async_api import async_playwright, Page, BrowserContext, TimeoutError as PlaywrightTimeoutError  # type: ignore
    _PLAYWRIGHT_AVAILABLE = True
except ImportError:
    _PLAYWRIGHT_AVAILABLE = False
    async_playwright = None  # type: ignore
    PlaywrightTimeoutError = Exception  # type: ignore

try:
    from playwright_stealth import stealth_async  # type: ignore
    _STEALTH_AVAILABLE = True
except ImportError:
    _STEALTH_AVAILABLE = False
    stealth_async = None  # type: ignore


BASE_URL = "https://store.coupangeats.com"
LOGIN_URL = f"{BASE_URL}/merchant/login"
DEFAULT_TIMEOUT_MS = 60_000           # 60s — Akamai sensor + 로그인 처리 여유
DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/148.0.0.0 Safari/537.36"
)

log = logging.getLogger("coupang_eats.login")


class CoupangEatsLoginError(Exception):
    """로그인 실패 — 잘못된 자격증명 / 캡차 / Akamai 차단 등."""
    def __init__(self, message: str, reason: str = "unknown"):
        super().__init__(message)
        self.reason = reason   # bad_credentials / captcha / timeout / blocked / playwright_missing


# ──────────────────────────────────────────────────────────────────────────
# 로그인 흐름 (async)
# ──────────────────────────────────────────────────────────────────────────

async def _detect_block_signals(page: "Page") -> Optional[str]:
    """페이지에서 캡차/차단 신호 감지. 발견 시 reason 문자열 반환, 아니면 None."""
    # Akamai BM 차단 페이지 키워드
    try:
        title = (await page.title() or "").lower()
        if "access denied" in title or "blocked" in title:
            return "blocked"
    except Exception:
        pass
    # 캡차 element
    try:
        if await page.locator("iframe[src*='captcha'], div[class*='captcha']").count() > 0:
            return "captcha"
    except Exception:
        pass
    return None


async def _try_fill_login_form(page: "Page", login_id: str, password: str) -> None:
    """다양한 selector 로 로그인 폼 입력 시도.

    쿠팡이츠는 React 기반이라 input name/id 가 빌드마다 바뀔 수 있으므로
    여러 selector 를 fallback 으로 시도.
    """
    # ID 입력
    id_selectors = [
        "input[name='loginId']",
        "input[id='loginId']",
        "input[type='text'][placeholder*='아이디']",
        "input[type='text']:visible",
    ]
    pw_selectors = [
        "input[name='password']",
        "input[type='password']:visible",
    ]
    filled_id = False
    for sel in id_selectors:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.fill(login_id, timeout=5000)
                filled_id = True
                break
        except Exception:
            continue
    if not filled_id:
        raise CoupangEatsLoginError("로그인 ID 입력 필드를 찾지 못했습니다.", reason="ui_changed")

    filled_pw = False
    for sel in pw_selectors:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.fill(password, timeout=5000)
                filled_pw = True
                break
        except Exception:
            continue
    if not filled_pw:
        raise CoupangEatsLoginError("비밀번호 입력 필드를 찾지 못했습니다.", reason="ui_changed")


async def _click_login_button(page: "Page") -> None:
    selectors = [
        "button[type='submit']:visible",
        "button:has-text('로그인')",
        "input[type='submit'][value='로그인']",
        "form button:visible",
    ]
    for sel in selectors:
        try:
            loc = page.locator(sel).first
            if await loc.count() > 0:
                await loc.click(timeout=5000)
                return
        except Exception:
            continue
    raise CoupangEatsLoginError("로그인 버튼을 찾지 못했습니다.", reason="ui_changed")


async def _wait_login_success_or_error(page: "Page", timeout_ms: int) -> None:
    """로그인 후 성공/실패 판정.

    성공: URL 이 /merchant/management/... 또는 /merchant/web/... 으로 이동
    실패: alert / 토스트 / 에러 메시지 노출 → CoupangEatsLoginError
    """
    deadline = asyncio.get_event_loop().time() + (timeout_ms / 1000)
    while True:
        # 성공 URL 패턴
        url = page.url or ""
        if "/merchant/management" in url or "/merchant/web/stores" in url:
            return
        # 차단/캡차
        reason = await _detect_block_signals(page)
        if reason:
            raise CoupangEatsLoginError(
                f"로그인 차단 신호 감지 ({reason})", reason=reason
            )
        # 에러 토스트/메시지
        try:
            # 일반적인 에러 텍스트 패턴
            for txt in ("올바르지 않", "일치하지 않", "확인 후", "잘못된", "다시 시도"):
                loc = page.locator(f"text={txt}")
                if await loc.count() > 0:
                    snippet = (await loc.first.inner_text())[:120]
                    raise CoupangEatsLoginError(
                        f"로그인 거부: {snippet}", reason="bad_credentials"
                    )
        except CoupangEatsLoginError:
            raise
        except Exception:
            pass

        if asyncio.get_event_loop().time() > deadline:
            raise CoupangEatsLoginError(
                f"로그인 응답 대기 시간 초과 ({timeout_ms/1000:.0f}s) — 캡차/차단/UI 변경 가능성",
                reason="timeout",
            )
        await asyncio.sleep(0.4)


async def _login_async(login_id: str, password: str, *,
                       headless: bool = True,
                       slow_mo_ms: int = 0) -> dict:
    """실제 Playwright 로그인 작업.

    Returns:
        {"cookies": [...], "store_id": int|None, "url": str, "stealth_applied": bool}
    """
    if not _PLAYWRIGHT_AVAILABLE:
        raise CoupangEatsLoginError(
            "playwright 가 설치되지 않았습니다. "
            "pip install playwright && playwright install chromium",
            reason="playwright_missing",
        )

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=headless,
            slow_mo=slow_mo_ms,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-features=IsolateOrigins,site-per-process",
                "--no-sandbox",
                "--disable-dev-shm-usage",
                "--lang=ko-KR",
            ],
        )
        context = await browser.new_context(
            user_agent=DEFAULT_USER_AGENT,
            viewport={"width": 1440, "height": 900},
            locale="ko-KR",
            timezone_id="Asia/Seoul",
            extra_http_headers={"Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7"},
        )
        page = await context.new_page()
        stealth_applied = False
        if _STEALTH_AVAILABLE:
            try:
                await stealth_async(page)
                stealth_applied = True
            except Exception as e:  # noqa: BLE001
                log.warning("stealth_async failed: %s", e)

        try:
            # 1) 로그인 페이지 진입 + Akamai sensor 자동 실행 시간 확보
            await page.goto(LOGIN_URL, wait_until="domcontentloaded",
                            timeout=DEFAULT_TIMEOUT_MS)
            # sensor_data POST 가 발사될 시간 + 폼 렌더링 여유
            await page.wait_for_timeout(2500)

            reason = await _detect_block_signals(page)
            if reason:
                raise CoupangEatsLoginError(
                    f"로그인 페이지 진입 시 차단 ({reason}) — Akamai 가 Playwright 를 봇으로 판단",
                    reason=reason,
                )

            # 2) 폼 입력
            await _try_fill_login_form(page, login_id, password)

            # 3) sensor 가 추가 호출될 수 있도록 잠시 대기 (HAR: 로그인 직전 1초)
            await page.wait_for_timeout(1200)

            # 4) 로그인 버튼 클릭
            await _click_login_button(page)

            # 5) 성공/실패 판정
            await _wait_login_success_or_error(page, timeout_ms=DEFAULT_TIMEOUT_MS)

            # 6) 쿠키 + store_id 추출
            cookies = await context.cookies(BASE_URL)
            final_url = page.url
            store_id: Optional[int] = None
            m = re.search(r"/merchant/management/(?:home/)?(\d+)", final_url)
            if m:
                try:
                    store_id = int(m.group(1))
                except ValueError:
                    pass
            if store_id is None:
                # 매장 목록 페이지에 안착했을 수도 — list-by-pagination 호출은 별도
                log.info("login success but store_id not in URL: %s", final_url)

            return {
                "cookies": cookies,
                "store_id": store_id,
                "url": final_url,
                "stealth_applied": stealth_applied,
            }
        finally:
            try:
                await context.close()
            except Exception:
                pass
            try:
                await browser.close()
            except Exception:
                pass


def login_and_get_cookies(login_id: str, password: str, *,
                          headless: bool = True,
                          slow_mo_ms: int = 0) -> dict:
    """동기 진입점 — 라우터/cron 에서 직접 호출 가능.

    내부적으로 asyncio.run() 으로 새 이벤트루프를 만들므로 호출 컨텍스트가 이미
    이벤트루프 안이면 사용 불가 (그 경우 _login_async 직접 await).

    환경변수:
      COUPANG_EATS_HEADLESS=false → headed 모드 (디버깅용)
      COUPANG_EATS_SLOWMO_MS=300 → 단계마다 지연
    """
    if os.getenv("COUPANG_EATS_HEADLESS", "").lower() in ("0", "false", "no"):
        headless = False
    env_slowmo = os.getenv("COUPANG_EATS_SLOWMO_MS", "").strip()
    if env_slowmo.isdigit():
        slow_mo_ms = int(env_slowmo)

    return asyncio.run(_login_async(login_id, password,
                                    headless=headless,
                                    slow_mo_ms=slow_mo_ms))
