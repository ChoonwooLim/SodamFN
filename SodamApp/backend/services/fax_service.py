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


class PopbillProvider(BaseFaxProvider):
    """팝빌(Linkhub) FAX API 연동.

    https://developers.popbill.com/api-reference/fax

    필요 환경변수:
      POPBILL_LINK_ID       - 팝빌 발급 LinkID (영문, 예: SODAM)
      POPBILL_SECRET_KEY    - 팝빌 발급 SecretKey (최초 1회만 노출)
      POPBILL_CORP_NUM      - 사업자등록번호 (10자리, 하이픈 제거 자동)
      POPBILL_SENDER_NUMBER - 사전등록된 발신번호 (하이픈 제거)
      POPBILL_IS_TEST       - "true" | "false" (기본 true)
      POPBILL_USER_ID       - 팝빌 회원 ID (선택, 감사용)
    """
    name = "popbill"

    def __init__(self):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = re.sub(r"\D", "", os.getenv("POPBILL_CORP_NUM", ""))
        self.sender_num = re.sub(r"\D", "", os.getenv("POPBILL_SENDER_NUMBER", ""))
        self.is_test = (os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes"))
        self.user_id = os.getenv("POPBILL_USER_ID", "").strip() or None
        self._service = None

    def _get_service(self):
        if self._service is not None:
            return self._service
        if not self.link_id or not self.secret_key:
            raise RuntimeError("POPBILL_LINK_ID / POPBILL_SECRET_KEY 가 설정되지 않았습니다.")
        try:
            from popbill import FaxService  # type: ignore
        except ImportError as e:
            raise RuntimeError(
                "popbill SDK가 설치되지 않았습니다. requirements.txt에 popbill 포함 후 재설치하세요."
            ) from e
        svc = FaxService(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        # 팝빌 IP 제한은 선택 기능. 프록시/컨테이너 환경에서는 꺼둠 권장.
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseGAIP = False
        svc.UseLocalTimeYN = True
        self._service = svc
        return svc

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
        if not self.corp_num or len(self.corp_num) != 10:
            return FaxResult(ok=False, error="POPBILL_CORP_NUM (사업자번호 10자리)가 설정되지 않았습니다.")
        sender = re.sub(r"\D", "", caller_id or "") or self.sender_num
        if not sender:
            return FaxResult(ok=False, error="발신번호(POPBILL_SENDER_NUMBER)가 설정되지 않았습니다.")
        receiver = re.sub(r"\D", "", target_number)
        if not receiver:
            return FaxResult(ok=False, error="수신번호가 비어있습니다.")

        # 팝빌 SDK는 파일 경로를 요구하므로 bytes → 임시파일로 저장.
        import tempfile
        tmp_path = None
        try:
            if file_bytes:
                suffix = os.path.splitext(original_filename or "fax.pdf")[1] or ".pdf"
                fd, tmp_path = tempfile.mkstemp(prefix="popbill_fax_", suffix=suffix)
                with os.fdopen(fd, "wb") as f:
                    f.write(file_bytes)
                file_path = tmp_path
            elif file_path_or_url and not file_path_or_url.startswith("http"):
                file_path = file_path_or_url.lstrip("/")
                if not os.path.isabs(file_path):
                    file_path = os.path.abspath(file_path)
            else:
                return FaxResult(
                    ok=False,
                    error="팝빌은 로컬 파일만 지원합니다. file_bytes 또는 로컬 경로를 전달하세요.",
                )

            svc = self._get_service()

            try:
                from popbill import PopbillException  # type: ignore
            except ImportError:
                PopbillException = Exception  # type: ignore

            try:
                receipt_num = svc.sendFax(
                    self.corp_num,
                    sender,
                    receiver,
                    "",  # ReceiverName — 서버 측에서 직접 비워 호출
                    file_path,
                    None,  # ReserveDT
                    self.user_id,
                    None,  # SenderName
                    False,  # adsYN
                    (subject or "")[:60] if subject else None,
                )
                return FaxResult(ok=True, provider_tx_id=str(receipt_num))
            except PopbillException as pe:
                code = getattr(pe, "code", None)
                msg = getattr(pe, "message", str(pe))
                return FaxResult(ok=False, error=f"Popbill[{code}] {msg}")
            except Exception as e:
                return FaxResult(ok=False, error=f"Popbill 전송 오류: {e}")
        finally:
            if tmp_path:
                try:
                    os.remove(tmp_path)
                except Exception:
                    pass

    def send_multi(
        self,
        *,
        target_number: str,
        files,  # List[Tuple[bytes, str]] — (content, original_filename)
        caller_id: Optional[str] = None,
        subject: Optional[str] = None,
    ) -> FaxResult:
        """여러 파일을 한 통의 팩스로 묶어 발송 (팝빌 sendFAX_multi).

        files = [(file_bytes, filename), ...]
        SDK 가 파일들을 PDF 변환 + 한 통으로 합산해 발송. 페이지 수 = 합산.
        """
        if not self.corp_num or len(self.corp_num) != 10:
            return FaxResult(ok=False, error="POPBILL_CORP_NUM (사업자번호 10자리) 미설정.")
        sender = re.sub(r"\D", "", caller_id or "") or self.sender_num
        if not sender:
            return FaxResult(ok=False, error="발신번호(POPBILL_SENDER_NUMBER) 미설정.")
        receiver = re.sub(r"\D", "", target_number)
        if not receiver:
            return FaxResult(ok=False, error="수신번호가 비어있습니다.")
        if not files:
            return FaxResult(ok=False, error="파일이 1개 이상 필요합니다.")

        import tempfile
        tmp_paths = []
        try:
            # 모든 파일을 임시 파일로 저장 (팝빌 SDK 는 파일 경로 list 요구)
            for content, filename in files:
                suffix = os.path.splitext(filename or "fax.pdf")[1] or ".pdf"
                fd, tmp = tempfile.mkstemp(prefix="popbill_fax_multi_", suffix=suffix)
                with os.fdopen(fd, "wb") as f:
                    f.write(content)
                tmp_paths.append(tmp)

            svc = self._get_service()
            try:
                from popbill import PopbillException  # type: ignore
            except ImportError:
                PopbillException = Exception  # type: ignore

            try:
                receipt_num = svc.sendFax_multi(
                    self.corp_num,
                    sender,
                    receiver,
                    "",  # ReceiverName
                    tmp_paths,
                    None,  # ReserveDT
                    self.user_id,
                    None,  # SenderName
                    False,  # adsYN
                    (subject or "")[:60] if subject else None,
                )
                return FaxResult(ok=True, provider_tx_id=str(receipt_num))
            except PopbillException as pe:
                code = getattr(pe, "code", None)
                msg = getattr(pe, "message", str(pe))
                return FaxResult(ok=False, error=f"Popbill[{code}] {msg}")
            except Exception as e:
                return FaxResult(ok=False, error=f"Popbill 다중 전송 오류: {e}")
        finally:
            for tp in tmp_paths:
                try:
                    os.remove(tp)
                except Exception:
                    pass

    def get_balance(self) -> Optional[float]:
        """현재 팝빌 포인트 잔액. 디버깅/어드민 화면용."""
        try:
            svc = self._get_service()
            return float(svc.getBalance(self.corp_num))
        except Exception:
            return None

    def get_result(self, receipt_num: str) -> Optional[dict]:
        """팩스 전송 결과 조회 (재확인용)."""
        try:
            svc = self._get_service()
            rows = svc.getFaxResult(self.corp_num, receipt_num, self.user_id)
            if not rows:
                return None
            r = rows[0]
            # sendState: 1=대기, 2=전송중, 3=전송완료, 4=전송실패
            return {
                "sendState": getattr(r, "sendState", None),
                "convState": getattr(r, "convState", None),
                "receiveNum": getattr(r, "receiveNum", None),
                "receiptNum": getattr(r, "receiptNum", None),
                "sendNum": getattr(r, "sendNum", None),
                "sendDT": getattr(r, "sendDT", None),
                "resultDT": getattr(r, "resultDT", None),
                "result": getattr(r, "result", None),
            }
        except Exception:
            return None


_PROVIDERS = {
    "stub": DevStubProvider,
    "phaxio": PhaxioProvider,
    "korean_generic": KoreanGenericProvider,
    "popbill": PopbillProvider,
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
