"""Fax transmission service with pluggable providers.

Provider is selected via env var ``FAX_PROVIDER``:
- ``stub`` (default): dev/no-op provider — logs the call, returns a fake tx id,
  and marks the transmission as success. Safe for local development.
- ``phaxio``: Phaxio API (sinch.com/products/messaging/fax). Requires
  PHAXIO_API_KEY and PHAXIO_API_SECRET. Works for international + Korean numbers.
- ``korean_generic``: placeholder for a Korean domestic provider
  (e.g. 이지팩스/팩스플러스). Currently returns ``not_implemented``.

Add more providers by subclassing ``BaseFaxProvider`` and registering them
in ``_PROVIDERS``.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass
from typing import Optional

logger = logging.getLogger("sodam.fax")


@dataclass
class FaxResult:
    ok: bool
    provider_tx_id: Optional[str] = None
    error: Optional[str] = None


class BaseFaxProvider:
    name = "base"

    def send(
        self,
        *,
        target_number: str,
        file_path_or_url: str,
        file_bytes: Optional[bytes] = None,
        original_filename: Optional[str] = None,
        caller_id: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> FaxResult:
        raise NotImplementedError


class DevStubProvider(BaseFaxProvider):
    """Development stub: logs and returns success without transmitting."""
    name = "stub"

    def send(self, **kwargs) -> FaxResult:
        import uuid
        tx_id = f"stub-{uuid.uuid4().hex[:12]}"
        logger.info(
            "[FAX-STUB] Pretending to send fax to %s (file=%s, subject=%r). tx=%s",
            kwargs.get("target_number"),
            kwargs.get("original_filename") or kwargs.get("file_path_or_url"),
            kwargs.get("subject"),
            tx_id,
        )
        return FaxResult(ok=True, provider_tx_id=tx_id)


class PhaxioProvider(BaseFaxProvider):
    """Phaxio v2.1 API — https://www.phaxio.com/docs/api/v2.1/faxes/create."""
    name = "phaxio"

    def __init__(self):
        self.api_key = os.getenv("PHAXIO_API_KEY", "").strip()
        self.api_secret = os.getenv("PHAXIO_API_SECRET", "").strip()
        self.endpoint = os.getenv(
            "PHAXIO_ENDPOINT", "https://api.phaxio.com/v2.1/faxes"
        )

    def send(
        self,
        *,
        target_number: str,
        file_path_or_url: str,
        file_bytes: Optional[bytes] = None,
        original_filename: Optional[str] = None,
        caller_id: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> FaxResult:
        if not self.api_key or not self.api_secret:
            return FaxResult(ok=False, error="PHAXIO_API_KEY/SECRET 미설정")

        import requests

        # Phaxio expects to= in E.164 format (e.g., +8224526510)
        to_e164 = _to_e164_kr(target_number)

        data = {"to": to_e164}
        if caller_id:
            data["caller_id"] = _to_e164_kr(caller_id)

        files = None
        if file_bytes:
            files = {"file": (original_filename or "fax.pdf", file_bytes, "application/pdf")}
        elif file_path_or_url and file_path_or_url.startswith("http"):
            data["content_url"] = file_path_or_url

        try:
            resp = requests.post(
                self.endpoint,
                auth=(self.api_key, self.api_secret),
                data=data,
                files=files,
                timeout=60,
            )
            j = resp.json() if resp.content else {}
            if not resp.ok:
                return FaxResult(
                    ok=False,
                    error=f"Phaxio {resp.status_code}: {j.get('message') or resp.text[:200]}",
                )
            fax_id = (j.get("data") or {}).get("id") or j.get("id")
            return FaxResult(ok=True, provider_tx_id=str(fax_id) if fax_id else None)
        except Exception as e:
            return FaxResult(ok=False, error=f"Phaxio 전송 오류: {e}")


class KoreanGenericProvider(BaseFaxProvider):
    """Placeholder for a Korean domestic fax provider (이지팩스/팩스플러스 등).

    To enable, implement the vendor HTTP/SOAP call here and add credentials to
    env. The interface and history UI are already wired so only this method
    needs to be filled in.
    """
    name = "korean_generic"

    def send(self, **kwargs) -> FaxResult:
        return FaxResult(
            ok=False,
            error="korean_generic 프로바이더는 아직 구현되지 않았습니다. "
            "services/fax_service.py의 KoreanGenericProvider.send()를 구현하세요.",
        )


_PROVIDERS = {
    "stub": DevStubProvider,
    "phaxio": PhaxioProvider,
    "korean_generic": KoreanGenericProvider,
}


def get_provider() -> BaseFaxProvider:
    name = (os.getenv("FAX_PROVIDER") or "stub").strip().lower()
    cls = _PROVIDERS.get(name, DevStubProvider)
    return cls()


# ─────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────

def normalize_fax_number(raw: str) -> str:
    """Keep digits and optional leading +; strip everything else."""
    if not raw:
        return ""
    s = raw.strip()
    keep_plus = s.startswith("+")
    digits = re.sub(r"\D", "", s)
    return ("+" + digits) if keep_plus else digits


def _to_e164_kr(raw: str) -> str:
    """Best-effort E.164 conversion for Korean domestic numbers.

    02-452-6510 → +82245265100 is wrong; correct is +8224526510
    010-1234-5678 → +821012345678
    Already-E.164 inputs pass through.
    """
    if not raw:
        return raw
    s = raw.strip()
    if s.startswith("+"):
        return "+" + re.sub(r"\D", "", s[1:])
    digits = re.sub(r"\D", "", s)
    if digits.startswith("82"):
        return "+" + digits
    if digits.startswith("0"):
        return "+82" + digits[1:]
    return digits  # unknown — let provider handle


def estimate_page_count(file_bytes: bytes, filename: str) -> Optional[int]:
    """Rough PDF page count via PyPDF or fallback heuristic."""
    if not file_bytes:
        return None
    name = (filename or "").lower()
    if not name.endswith(".pdf"):
        return 1
    try:
        from io import BytesIO
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader  # type: ignore
        return len(PdfReader(BytesIO(file_bytes)).pages)
    except Exception:
        return None
