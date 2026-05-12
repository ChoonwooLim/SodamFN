"""대칭 암호화 유틸 — 외부 시스템 자격증명(EasyPOS 비밀번호 등)을 DB에 안전 보관.

환경변수 `CREDENTIAL_ENCRYPTION_KEY` 로 마스터 키 지정. raw 문자열을 SHA256 으로
정규화 후 Fernet 키(32-byte url-safe base64)로 변환한다.

production 에선 반드시 .env / Orbitron dashboard 에 충분히 긴 임의 문자열 설정.
키가 분실/변경되면 기존 암호화 데이터 복호 불가 — 사장님이 비밀번호 재입력 필요.

CODEF 가 RSA(외부 전송용)인 것과 달리 이건 **로컬 DB 보관용 대칭 암호화** 임.
"""
from __future__ import annotations

import base64
import hashlib
import os
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken


_DEV_FALLBACK = "sodamfn-dev-credential-key-please-set-CREDENTIAL_ENCRYPTION_KEY-env"
_cached_fernet: Optional[Fernet] = None


def _derive_key(raw: str) -> bytes:
    """raw 문자열 → SHA256 → url-safe base64 (Fernet 호환 32-byte 키)."""
    digest = hashlib.sha256(raw.encode("utf-8")).digest()
    return base64.urlsafe_b64encode(digest)


def _fernet() -> Fernet:
    global _cached_fernet
    if _cached_fernet is not None:
        return _cached_fernet
    raw = os.getenv("CREDENTIAL_ENCRYPTION_KEY", "").strip()
    if not raw:
        # production 미설정 경고
        import logging
        logging.getLogger("crypto").warning(
            "CREDENTIAL_ENCRYPTION_KEY env not set — using DEV fallback. "
            "Production deployment must set this to a long random string."
        )
        raw = _DEV_FALLBACK
    _cached_fernet = Fernet(_derive_key(raw))
    return _cached_fernet


def encrypt_text(plain: str) -> str:
    """평문 → 암호문(문자열). 빈 입력은 빈 출력."""
    if not plain:
        return ""
    token = _fernet().encrypt(plain.encode("utf-8"))
    return token.decode("ascii")


def decrypt_text(token: str) -> str:
    """암호문 → 평문. 키 불일치/위조면 InvalidToken raise — 호출자가 처리."""
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("ascii")).decode("utf-8")
    except InvalidToken:
        # 키가 바뀌었거나 데이터 손상 — 호출자가 사장님에게 재입력 요청
        raise


def mask_text(plain_or_token: str, head: int = 2, tail: int = 0) -> str:
    """UI 표시용 마스킹. 비밀번호는 길이만 노출."""
    if not plain_or_token:
        return ""
    n = len(plain_or_token)
    if n <= head + tail:
        return "*" * n
    return plain_or_token[:head] + "*" * (n - head - tail) + (plain_or_token[-tail:] if tail else "")
