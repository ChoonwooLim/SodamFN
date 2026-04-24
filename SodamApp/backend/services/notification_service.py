"""알림 서비스 (카카오 알림톡 · 친구톡 · SMS · LMS · MMS).

팩스와 동일한 프로바이더 추상화 패턴.
`NOTIFICATION_PROVIDER` 환경변수로 선택:
- ``stub`` (기본): 로그만 남기고 실제 발송 안 함
- ``popbill``: Popbill KakaoService + MessageService SDK 래핑
  (팩스와 동일한 LinkID/SecretKey 사용)

알림톡 전송 사전 작업:
1. 카카오톡 비즈 채널(플러스친구) 개설
2. 팝빌에 채널 연결 (``getPlusFriendMgtURL``)
3. 알림톡 템플릿 등록 + 카카오 심사 (영업일 2~3일)
4. 승인된 TemplateCode 사용 → ``sendATS_one``

SMS/LMS/MMS는 발신번호 사전등록만 되어있으면 즉시 사용 가능
(팝빌 팩스 발신번호 공유).

--- Legacy API ---
이전에는 Solapi 기반의 `NotificationService` 클래스가 있었음. 하위 호환을 위해
동일한 메서드 시그니처를 유지하되, 내부 구현은 아래 프로바이더 추상화로 교체.
"""
from __future__ import annotations

import logging
import os
import re
from dataclasses import dataclass, field
from typing import Optional

logger = logging.getLogger("sodam.notification")


@dataclass
class NotificationResult:
    ok: bool
    provider_tx_id: Optional[str] = None
    error: Optional[str] = None
    meta: dict = field(default_factory=dict)


def _normalize_kr_mobile(raw: str) -> str:
    """국내 휴대/유선 번호를 하이픈 제거한 숫자로 정규화."""
    if not raw:
        return ""
    return re.sub(r"\D", "", str(raw).strip())


class BaseNotificationProvider:
    name = "base"

    def send_alimtalk(
        self,
        *,
        template_code: str,
        sender_number: str,
        receiver: str,
        receiver_name: Optional[str] = None,
        content: str = "",
        alt_content: Optional[str] = None,
        alt_send_type: str = "C",   # 'C'=대체 SMS, 'A'=대체 LMS, 'N'=미발송
        reserve_dt: Optional[str] = None,
        user_id: Optional[str] = None,
        request_num: Optional[str] = None,
    ) -> NotificationResult:
        raise NotImplementedError

    def send_sms(
        self,
        *,
        sender_number: str,
        receiver: str,
        receiver_name: Optional[str] = None,
        content: str = "",
        subject: Optional[str] = None,      # LMS/MMS 제목
        reserve_dt: Optional[str] = None,
        ads_yn: bool = False,
        user_id: Optional[str] = None,
        request_num: Optional[str] = None,
    ) -> NotificationResult:
        """XMS 자동 분기: 80자 이하 SMS, 초과 LMS."""
        raise NotImplementedError


class DevStubProvider(BaseNotificationProvider):
    """로그만 남기고 실전송 안 함. 개발·심사 대기 중 UI 동작 확인용."""
    name = "stub"

    def send_alimtalk(self, **kwargs) -> NotificationResult:
        import uuid
        tx = f"stub-alim-{uuid.uuid4().hex[:10]}"
        logger.info(
            "[ALIM-STUB] template=%s to=%s(%s) content=%r",
            kwargs.get("template_code"),
            kwargs.get("receiver"),
            kwargs.get("receiver_name"),
            (kwargs.get("content") or "")[:80],
        )
        return NotificationResult(ok=True, provider_tx_id=tx)

    def send_sms(self, **kwargs) -> NotificationResult:
        import uuid
        tx = f"stub-sms-{uuid.uuid4().hex[:10]}"
        logger.info(
            "[SMS-STUB] to=%s(%s) subject=%r content=%r",
            kwargs.get("receiver"),
            kwargs.get("receiver_name"),
            kwargs.get("subject"),
            (kwargs.get("content") or "")[:80],
        )
        return NotificationResult(ok=True, provider_tx_id=tx)


class PopbillNotificationProvider(BaseNotificationProvider):
    """팝빌 KakaoService + MessageService 통합.

    팩스와 동일한 POPBILL_LINK_ID / POPBILL_SECRET_KEY / POPBILL_CORP_NUM 사용.
    환경변수 공유 — 추가 설정 불필요.
    """
    name = "popbill"

    def __init__(self):
        self.link_id = os.getenv("POPBILL_LINK_ID", "").strip()
        self.secret_key = os.getenv("POPBILL_SECRET_KEY", "").strip()
        self.corp_num = re.sub(r"\D", "", os.getenv("POPBILL_CORP_NUM", ""))
        self.is_test = (os.getenv("POPBILL_IS_TEST", "true").strip().lower() in ("1", "true", "yes"))
        self.user_id = os.getenv("POPBILL_USER_ID", "").strip() or None
        self._kakao = None
        self._message = None

    def _init_svc(self, cls):
        if not self.link_id or not self.secret_key:
            raise RuntimeError("POPBILL_LINK_ID / POPBILL_SECRET_KEY 가 설정되지 않았습니다.")
        svc = cls(self.link_id, self.secret_key)
        svc.IsTest = self.is_test
        svc.IPRestrictOnOff = False
        svc.UseStaticIP = False
        svc.UseLocalTimeYN = True
        return svc

    def _get_kakao(self):
        if self._kakao is None:
            from popbill import KakaoService  # type: ignore
            self._kakao = self._init_svc(KakaoService)
        return self._kakao

    def _get_message(self):
        if self._message is None:
            from popbill import MessageService  # type: ignore
            self._message = self._init_svc(MessageService)
        return self._message

    def send_alimtalk(
        self,
        *,
        template_code: str,
        sender_number: str,
        receiver: str,
        receiver_name: Optional[str] = None,
        content: str = "",
        alt_content: Optional[str] = None,
        alt_send_type: str = "C",
        reserve_dt: Optional[str] = None,
        user_id: Optional[str] = None,
        request_num: Optional[str] = None,
    ) -> NotificationResult:
        if not self.corp_num or len(self.corp_num) != 10:
            return NotificationResult(ok=False, error="POPBILL_CORP_NUM (사업자번호 10자리)가 설정되지 않았습니다.")
        sender = _normalize_kr_mobile(sender_number)
        rcv = _normalize_kr_mobile(receiver)
        if not sender or not rcv:
            return NotificationResult(ok=False, error="발신번호 또는 수신번호가 유효하지 않습니다.")
        if not template_code:
            return NotificationResult(ok=False, error="알림톡 TemplateCode가 없습니다. 카카오 심사 승인된 템플릿 필요.")

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        svc = self._get_kakao()
        try:
            receipt_num = svc.sendATS_one(
                self.corp_num,
                template_code,
                sender,
                rcv,
                (receiver_name or "")[:30] or "",
                content,
                alt_content or content,
                alt_send_type,
                reserve_dt,
                user_id or self.user_id,
                request_num,
            )
            return NotificationResult(ok=True, provider_tx_id=str(receipt_num))
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return NotificationResult(ok=False, error=f"Popbill[{code}] {msg}")
        except Exception as e:
            return NotificationResult(ok=False, error=f"알림톡 전송 오류: {e}")

    def send_sms(
        self,
        *,
        sender_number: str,
        receiver: str,
        receiver_name: Optional[str] = None,
        content: str = "",
        subject: Optional[str] = None,
        reserve_dt: Optional[str] = None,
        ads_yn: bool = False,
        user_id: Optional[str] = None,
        request_num: Optional[str] = None,
    ) -> NotificationResult:
        if not self.corp_num or len(self.corp_num) != 10:
            return NotificationResult(ok=False, error="POPBILL_CORP_NUM 가 설정되지 않았습니다.")
        sender = _normalize_kr_mobile(sender_number)
        rcv = _normalize_kr_mobile(receiver)
        if not sender or not rcv:
            return NotificationResult(ok=False, error="발신번호 또는 수신번호가 유효하지 않습니다.")
        if not content or not content.strip():
            return NotificationResult(ok=False, error="메시지 내용이 비어 있습니다.")

        try:
            from popbill import PopbillException  # type: ignore
        except ImportError:
            PopbillException = Exception  # type: ignore

        svc = self._get_message()
        try:
            receipt_num = svc.sendXMS(
                self.corp_num,
                sender,
                (receiver_name or "")[:30] or None,
                rcv,
                (receiver_name or "")[:30] or None,
                content,
                reserve_dt,
                ads_yn,
                user_id or self.user_id,
                request_num,
                (subject or "")[:40] or None,
            )
            return NotificationResult(ok=True, provider_tx_id=str(receipt_num))
        except PopbillException as pe:
            code = getattr(pe, "code", None)
            msg = getattr(pe, "message", str(pe))
            return NotificationResult(ok=False, error=f"Popbill[{code}] {msg}")
        except Exception as e:
            return NotificationResult(ok=False, error=f"문자 전송 오류: {e}")

    # ─── 관리 URL 헬퍼 (UI에서 팝빌 관리 페이지 팝업용) ───

    def list_templates(self):
        try:
            return self._get_kakao().listATSTemplate(self.corp_num, self.user_id) or []
        except Exception:
            return []

    def get_template_mgt_url(self) -> Optional[str]:
        try:
            return self._get_kakao().getATSTemplateMgtURL(self.corp_num, self.user_id)
        except Exception:
            return None

    def get_plus_friend_mgt_url(self) -> Optional[str]:
        try:
            return self._get_kakao().getPlusFriendMgtURL(self.corp_num, self.user_id)
        except Exception:
            return None

    def get_sender_number_mgt_url(self) -> Optional[str]:
        try:
            return self._get_message().getSenderNumberMgtURL(self.corp_num, self.user_id)
        except Exception:
            return None

    def get_balance(self) -> Optional[float]:
        try:
            return float(self._get_kakao().getBalance(self.corp_num))
        except Exception:
            return None


_PROVIDERS = {
    "stub": DevStubProvider,
    "popbill": PopbillNotificationProvider,
}


def get_provider() -> BaseNotificationProvider:
    name = (os.getenv("NOTIFICATION_PROVIDER") or "stub").strip().lower()
    cls = _PROVIDERS.get(name, DevStubProvider)
    return cls()


# ─────────────────────────────────────────────────────────────
# Legacy NotificationService 하위 호환 래퍼
# ─────────────────────────────────────────────────────────────
# 이전 Solapi 기반 코드가 contract.py / payroll.py / purchase_requests.py 에서
# 호출 중. 시그니처 유지하되 내부는 신규 프로바이더로 전달.
#
# Variables 딕셔너리의 `#{name}` 치환은 Popbill 알림톡 템플릿이 서버 측에서 처리
# 하므로 (템플릿 원문에 변수 토큰 포함), 호출자가 content 문자열만 채우면 됨.

_SENDER_NUMBER_ENV = "POPBILL_SENDER_NUMBER"


def _resolve_sender() -> str:
    raw = os.getenv(_SENDER_NUMBER_ENV, "")
    return _normalize_kr_mobile(raw)


class NotificationService:
    """Legacy 호환 — 내부적으로 `get_provider()` 사용."""

    @classmethod
    def _apply_vars(cls, template: str, variables: dict) -> str:
        text = template or ""
        for k, v in (variables or {}).items():
            text = text.replace(k, str(v))
        return text

    @classmethod
    def send_alimtalk(cls, to: str, template_id: str, variables: dict):
        provider = get_provider()
        # 레거시 변수 치환을 대체 SMS content에 반영 (알림톡 실제 content는 템플릿 서버측 처리)
        fallback = cls._apply_vars(
            "#{name}님 안내입니다.",  # 기본 대체 문구 (레거시 호출자용)
            variables or {},
        )
        result = provider.send_alimtalk(
            template_code=template_id,
            sender_number=_resolve_sender(),
            receiver=to,
            content=fallback,
            alt_content=fallback,
        )
        if result.ok:
            return {"status": "success", "tx": result.provider_tx_id}
        return {"status": "error", "message": result.error or "unknown"}

    @classmethod
    def send_contract_link(cls, phone_num: str, staff_name: str, link: str):
        return cls.send_alimtalk(
            to=(phone_num or "").replace("-", ""),
            template_id="CONTRACT_TEMP_01",
            variables={"#{name}": staff_name, "#{link}": link},
        )

    @classmethod
    def send_attendance_request(cls, phone_num: str, staff_name: str, month: str, link: str):
        return cls.send_alimtalk(
            to=(phone_num or "").replace("-", ""),
            template_id="ATTENDANCE_REQ_01",
            variables={"#{name}": staff_name, "#{month}": month, "#{link}": link},
        )

    @classmethod
    def send_payroll_statement(cls, phone_num: str, staff_name: str, month: str, link: str):
        return cls.send_alimtalk(
            to=(phone_num or "").replace("-", ""),
            template_id="PAYROLL_STAT_01",
            variables={"#{name}": staff_name, "#{month}": month, "#{link}": link},
        )

    @classmethod
    def send_purchase_request(cls, phone_num: str, staff_name: str, items_text: str):
        return cls.send_alimtalk(
            to=(phone_num or "").replace("-", ""),
            template_id="PURCHASE_REQ_01",
            variables={"#{name}": staff_name, "#{items}": items_text},
        )
