"""은행 거래내역 AI 분류·분석 클라이언트 (멀티 프로바이더).

지원 프로바이더:
  - ollama: 로컬 LLM (qwen2.5/mistral/gemma 등). 비용 0원, LAN 내부, twinverse-ai @ 192.168.219.117:11434
  - openclaw: ChatGPT Plus/Pro OAuth 게이트웨이 (GPT-5.5). 토큰 비용. OPENCLAW_GATEWAY_URL/TOKEN 필요

환경변수:
  AI_CLASSIFY_PROVIDER       기본 provider (ollama | openclaw, 기본 ollama)
  OLLAMA_URL                 Ollama base URL
  OLLAMA_CLASSIFY_MODEL      Ollama 기본 모델 (qwen2.5:7b)
  OPENCLAW_GATEWAY_URL       OpenClaw 게이트웨이 URL
  OPENCLAW_GATEWAY_TOKEN     OpenClaw OAuth 토큰
  OPENCLAW_MODEL             OpenClaw 모델명 (openclaw/codex-pro)
  AI_CLASSIFY_TIMEOUT_SEC    기본 타임아웃 (초, 기본 30)

각 메서드 호출 시 provider/model 인자로 오버라이드 가능 (UI 셀렉터 → API 전달).
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Optional

import httpx

logger = logging.getLogger(__name__)


VALID_CLASSES = {
    "card_settlement", "pay_settlement", "delivery_settlement", "mobile_settlement",
    "transfer", "revenue", "expense", "purchase", "excluded", "unclassified",
}


SYSTEM_PROMPT = (
    "당신은 한국 자영업 사업장의 은행 거래내역을 분류하는 전문가입니다.\n\n"
    "거래 적요(remark)와 입출금 금액을 보고 다음 카테고리 중 하나를 선택하세요.\n\n"
    "[입금 분류]\n"
    "- card_settlement: 카드사 정산 입금. 적요에 KB국민카드/국민카드/신한카드/원신한/"
    "삼성카드/현대카드/롯데카드/하나카드/NH카드/농협카드/우리카드/BC카드/비씨카드/"
    "KG이니시스/이니시스/나이스페이/NICE 등 카드사명 포함\n"
    "- pay_settlement: 페이 결제 정산 입금. 적요에 카카오페이/네이버페이/네이버/토스페이/"
    "토스/서울페이/제로페이/페이코/SSG페이/KCP 등 페이사명 포함\n"
    "- delivery_settlement: 배달앱 정산 입금. 적요에 쿠팡이츠/쿠팡페이/쿠팡/배달의민족/"
    "배민/우아한형제/요기요/땡겨요/음식배달 등 포함\n"
    "- mobile_settlement: 이동식 단말기 카드매출 정산 (POS 미경유). "
    "적요에 코페이 등 포함. 매장 POS 와 별도라 매출에 포함됨\n"
    "- transfer: 본인 자행 이체 (적요에 '내계좌'/'자행이체'/'본인이체' 포함)\n"
    "- revenue: 일반 매출 입금 (위 카테고리 아닌 사업 관련 입금)\n"
    "- excluded: 개인 송금/사업 무관 입금\n\n"
    "[출금 분류]\n"
    "- purchase: 식자재/상품 매입 (도매·식자재 거래처)\n"
    "- expense: 일반 운영 지출 (임대료/관리비/세금/카드대금 등)\n"
    "- transfer: 본인 자행 출금\n\n"
    "[분류 불가]\n"
    "- unclassified: 정보 부족으로 확신 못함\n\n"
    "반드시 다음 JSON 형식으로만 응답하고, 다른 텍스트는 절대 포함하지 마세요:\n"
    '{"classified_as": "...", "standard_name": "...", "confidence": 0.0-1.0, "reason": "한국어 짧은 근거"}\n\n'
    'standard_name: settlement 분류 시 표준 카드사명/페이사명/배달앱명 '
    '(예: "신한카드", "카카오페이", "쿠팡이츠"). 비settlement면 빈 문자열.'
)


FEW_SHOT_EXAMPLES = [
    (
        '적요1: "원신한"\n적요2: "SHC140990276"\n적요3: ""\n입금액: 692,687원\n출금액: 0원',
        {"classified_as": "card_settlement", "standard_name": "신한카드",
         "confidence": 0.95, "reason": "원신한은 신한카드 정산 약식 패턴"},
    ),
    (
        '적요1: "음식배달"\n적요2: "잠실"\n적요3: ""\n입금액: 96,875원\n출금액: 0원',
        {"classified_as": "delivery_settlement", "standard_name": "기타배달",
         "confidence": 0.7, "reason": "음식배달 키워드, 배달앱사명 불명"},
    ),
    (
        '적요1: "삼성카드"\n적요2: "자금부"\n적요3: ""\n입금액: 0원\n출금액: 3,543,329원',
        {"classified_as": "expense", "standard_name": "",
         "confidence": 0.9, "reason": "삼성카드 자금부는 카드 대금 결제 출금"},
    ),
    (
        '적요1: "우602406580"\n적요2: ""\n적요3: ""\n입금액: 117,516원\n출금액: 0원',
        {"classified_as": "unclassified", "standard_name": "",
         "confidence": 0.4, "reason": "성씨 우+계좌번호로 보이는 개인 송금 가능성, 확신 부족"},
    ),
]


def _format_tx_user_text(remark1: str, remark2: str, remark3: str, in_amount: int, out_amount: int) -> str:
    return (
        f'적요1: "{remark1 or ""}"\n'
        f'적요2: "{remark2 or ""}"\n'
        f'적요3: "{remark3 or ""}"\n'
        f'입금액: {in_amount or 0:,}원\n'
        f'출금액: {out_amount or 0:,}원'
    )


def _build_messages(
    remark1: str, remark2: str, remark3: str,
    in_amount: int, out_amount: int,
    learned_cases: Optional[list[dict]] = None,
) -> list[dict]:
    """LLM messages 구성. learned_cases 제공 시 사업장 특화 few-shot 동적 주입."""
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 1) 일반 few-shot
    for user_text, assistant_json in FEW_SHOT_EXAMPLES:
        messages.append({"role": "user", "content": user_text})
        messages.append({
            "role": "assistant",
            "content": json.dumps(assistant_json, ensure_ascii=False),
        })

    # 2) 사업장 특화 few-shot (학습 데이터)
    if learned_cases:
        messages.append({
            "role": "system",
            "content": (
                "이하는 본 사업장에서 사장님이 직접 수동 분류하신 과거 사례입니다. "
                "이 패턴을 본 사업장의 비즈니스 규칙으로 간주하고 우선 참고하세요. "
                "동일/유사 적요가 같은 분류로 일관되게 적용되는지 확인하세요."
            ),
        })
        for case in learned_cases[:5]:
            ex_user = _format_tx_user_text(
                case.get("remark1", ""), case.get("remark2", ""), case.get("remark3", ""),
                case.get("in_amount", 0), case.get("out_amount", 0),
            )
            ex_assistant = {
                "classified_as": case.get("classified_as", "unclassified"),
                "standard_name": case.get("standard_name", ""),
                "confidence": 0.95,
                "reason": "본 사업장 과거 수동 분류 사례",
            }
            messages.append({"role": "user", "content": ex_user})
            messages.append({
                "role": "assistant",
                "content": json.dumps(ex_assistant, ensure_ascii=False),
            })

    # 3) 현재 거래
    messages.append({
        "role": "user",
        "content": _format_tx_user_text(remark1, remark2, remark3, in_amount, out_amount),
    })
    return messages


def _parse_response(text: str) -> dict:
    """LLM 응답에서 JSON 추출 + 검증."""
    raw = (text or "").strip()
    if not raw:
        raise AIClassifyError("응답이 비어있습니다.")
    if raw.startswith("```"):
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if m:
            raw = m.group(1)
    if not raw.startswith("{"):
        m = re.search(r"\{.*\}", raw, re.DOTALL)
        if m:
            raw = m.group(0)
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as e:
        raise AIClassifyError(f"응답 파싱 실패: {e} / raw='{raw[:200]}'")
    cls = obj.get("classified_as") or "unclassified"
    if cls not in VALID_CLASSES:
        cls = "unclassified"
    try:
        conf = float(obj.get("confidence") or 0)
    except (TypeError, ValueError):
        conf = 0.0
    return {
        "classified_as": cls,
        "standard_name": str(obj.get("standard_name") or "")[:50],
        "confidence": max(0.0, min(1.0, conf)),
        "reason": str(obj.get("reason") or "")[:200],
    }


class AIClassifyError(Exception):
    pass


class AIClassifyClient:
    """멀티 프로바이더 AI 클라이언트 (ollama + openclaw)."""

    def __init__(self):
        self.default_provider = (os.getenv("AI_CLASSIFY_PROVIDER") or "ollama").strip().lower()
        # ollama
        self.ollama_url = (os.getenv("OLLAMA_URL") or "").rstrip("/")
        self.ollama_default_model = (os.getenv("OLLAMA_CLASSIFY_MODEL") or "qwen2.5:7b").strip()
        # openclaw
        self.openclaw_url = (os.getenv("OPENCLAW_GATEWAY_URL") or "").rstrip("/")
        self.openclaw_token = (os.getenv("OPENCLAW_GATEWAY_TOKEN") or "").strip()
        self.openclaw_default_model = (os.getenv("OPENCLAW_MODEL") or "openclaw/codex-pro").strip()
        # shared
        self.timeout = float(os.getenv("AI_CLASSIFY_TIMEOUT_SEC") or "30")

    # ─── 프로바이더 헬퍼 ─────────────────────────────────────

    def provider_configured(self, provider: str) -> bool:
        p = (provider or "").lower()
        if p == "ollama":
            return bool(self.ollama_url)
        if p == "openclaw":
            return bool(self.openclaw_url and self.openclaw_token)
        return False

    def configured(self) -> bool:
        return self.provider_configured(self.default_provider)

    def _resolve(self, provider: Optional[str], model: Optional[str]) -> tuple[str, str]:
        prov = (provider or self.default_provider or "ollama").strip().lower()
        if prov == "ollama":
            return prov, (model or self.ollama_default_model or "qwen2.5:7b").strip()
        if prov == "openclaw":
            return prov, (model or self.openclaw_default_model or "openclaw/codex-pro").strip()
        raise AIClassifyError(f"미지원 provider: {prov}")

    # ─── 메타 (헬스/모델 목록) ────────────────────────────────

    def list_models(self) -> dict:
        """프로바이더별 가용 모델 목록 — UI 셀렉터용."""
        result = {
            "default_provider": self.default_provider,
            "default_ollama_model": self.ollama_default_model,
            "default_openclaw_model": self.openclaw_default_model,
            "providers": {},
        }
        # ollama
        ollama_info = {"configured": self.provider_configured("ollama"), "models": []}
        if ollama_info["configured"]:
            try:
                r = httpx.get(f"{self.ollama_url}/api/tags", timeout=3)
                if r.status_code == 200:
                    ollama_info["models"] = [m.get("name") for m in r.json().get("models", []) if m.get("name")]
            except (httpx.HTTPError, OSError, ValueError):
                pass
        result["providers"]["ollama"] = ollama_info
        # openclaw
        result["providers"]["openclaw"] = {
            "configured": self.provider_configured("openclaw"),
            "models": [self.openclaw_default_model] if self.provider_configured("openclaw") else [],
        }
        return result

    def health(self) -> dict:
        info = {
            "default_provider": self.default_provider,
            "default_model": self.ollama_default_model if self.default_provider == "ollama" else self.openclaw_default_model,
            "configured": self.configured(),
            "providers": {
                "ollama": {"configured": self.provider_configured("ollama"), "reachable": False},
                "openclaw": {"configured": self.provider_configured("openclaw"), "reachable": False},
            },
        }
        if self.provider_configured("ollama"):
            try:
                r = httpx.get(f"{self.ollama_url}/api/tags", timeout=3)
                if r.status_code == 200:
                    models = [m.get("name") for m in r.json().get("models", [])]
                    info["providers"]["ollama"]["reachable"] = True
                    info["providers"]["ollama"]["model_loaded"] = self.ollama_default_model in models
            except (httpx.HTTPError, OSError, ValueError) as e:
                info["providers"]["ollama"]["error"] = str(e)[:200]
        if self.provider_configured("openclaw"):
            try:
                r = httpx.get(f"{self.openclaw_url}/health", timeout=3)
                info["providers"]["openclaw"]["reachable"] = r.status_code == 200
            except (httpx.HTTPError, OSError):
                pass
        return info

    # ─── 메인 API ─────────────────────────────────────────────

    def suggest(
        self,
        remark1: Optional[str] = None,
        remark2: Optional[str] = None,
        remark3: Optional[str] = None,
        in_amount: int = 0,
        out_amount: int = 0,
        learned_cases: Optional[list[dict]] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> dict:
        """단일 거래에 대한 AI 분류 제안. provider/model 인자로 호출별 오버라이드 가능."""
        prov, mdl = self._resolve(provider, model)
        if not self.provider_configured(prov):
            raise AIClassifyError(f"{prov} 미설정")

        messages = _build_messages(
            remark1 or "", remark2 or "", remark3 or "",
            in_amount, out_amount,
            learned_cases=learned_cases,
        )

        if prov == "ollama":
            content = self._call_ollama(messages, mdl, json_mode=True,
                                        temperature=0.1, num_predict=200)
        else:  # openclaw
            content = self._call_openclaw(messages, mdl, json_mode=True)

        result = _parse_response(content)
        result["provider"] = f"{prov}:{mdl}"
        result["used_learned"] = len(learned_cases or [])
        return result

    def chat(
        self,
        messages: list[dict],
        options: Optional[dict] = None,
        provider: Optional[str] = None,
        model: Optional[str] = None,
    ) -> str:
        """범용 채팅 (Phase 3 대화형 분석). provider/model 오버라이드 지원."""
        prov, mdl = self._resolve(provider, model)
        if not self.provider_configured(prov):
            raise AIClassifyError(f"{prov} 미설정")
        if prov == "ollama":
            opts = {"temperature": 0.3, "num_predict": 800, **(options or {})}
            return self._call_ollama(
                messages, mdl, json_mode=False,
                temperature=opts["temperature"], num_predict=opts["num_predict"],
                timeout_mult=2.0,
            )
        return self._call_openclaw(messages, mdl, json_mode=False)

    # ─── 프로바이더 호출 ─────────────────────────────────────

    def _call_ollama(self, messages: list[dict], model: str, *, json_mode: bool,
                     temperature: float = 0.1, num_predict: int = 200,
                     timeout_mult: float = 1.0) -> str:
        try:
            payload = {
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": num_predict},
            }
            if json_mode:
                payload["format"] = "json"
            r = httpx.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=self.timeout * timeout_mult,
            )
            if r.status_code != 200:
                raise AIClassifyError(f"Ollama {r.status_code}: {r.text[:200]}")
            data = r.json()
            return (data.get("message") or {}).get("content") or ""
        except httpx.HTTPError as e:
            raise AIClassifyError(f"Ollama 호출 실패: {e}")

    def _call_openclaw(self, messages: list[dict], model: str, *, json_mode: bool) -> str:
        try:
            payload = {"model": model, "messages": messages}
            if json_mode:
                payload["response_format"] = {"type": "json_object"}
            r = httpx.post(
                f"{self.openclaw_url}/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.openclaw_token}",
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=self.timeout * 2,
            )
            if r.status_code != 200:
                raise AIClassifyError(f"OpenClaw {r.status_code}: {r.text[:200]}")
            data = r.json()
            return data["choices"][0]["message"]["content"]
        except (httpx.HTTPError, KeyError, IndexError) as e:
            raise AIClassifyError(f"OpenClaw 호출 실패: {e}")


_client: Optional[AIClassifyClient] = None


def get_ai_classifier() -> AIClassifyClient:
    global _client
    if _client is None:
        _client = AIClassifyClient()
    return _client
