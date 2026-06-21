"""텔레그램 봇 알림 — 개발자(Steven) 기술경보용.

env TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 미설정 시 no-op (False 반환).
1차 배포에서는 토큰 미설정 → 자동 비활성. 토큰 주입 시 즉시 동작.
"""
from __future__ import annotations
import os
import logging
import requests

log = logging.getLogger("telegram_service")


def send_message(text: str) -> bool:
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    if not token or not chat_id:
        log.info("telegram no-op (unconfigured): %s", text[:80])
        return False
    try:
        resp = requests.post(
            f"https://api.telegram.org/bot{token}/sendMessage",
            json={"chat_id": chat_id, "text": text},
            timeout=10,
        )
        if resp.status_code == 200 and resp.json().get("ok"):
            return True
        log.warning("telegram send failed: %s %s", resp.status_code, resp.text[:200])
        return False
    except Exception as e:  # noqa: BLE001
        log.warning("telegram send error: %s", e)
        return False
