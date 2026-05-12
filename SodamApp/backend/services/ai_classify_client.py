"""은행 거래내역 AI 분류 클라이언트.

기본 백엔드: Ollama qwen2.5:7b (twinverse-ai @ 192.168.219.117:11434)
fallback: OpenClaw GPT-5.5 (미구현 — Phase 2 추가 예정)

환경변수:
  AI_CLASSIFY_PROVIDER     ollama (기본) | openclaw
  OLLAMA_URL               http://192.168.219.117:11434 (.env)
  OLLAMA_CLASSIFY_MODEL    qwen2.5:7b (기본)
  AI_CLASSIFY_TIMEOUT_SEC  30 (기본)

규칙 기반 분류기(`_classify_one_tx`)가 처리하지 못한 거래 또는 사용자가 명시적으로
AI 제안을 원할 때 호출. 자동 적용 금지 — 항상 사용자 승인 절차 필요.
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
    "card_settlement", "pay_settlement", "delivery_settlement",
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
    """LLM messages 구성.

    Args:
        remark1/2/3, in/out_amount: 현재 분류 대상 거래
        learned_cases: 사업장 과거 수동 분류 사례. 각 dict는
            {remark1, remark2, in_amount, out_amount, classified_as, standard_name?}.
            제공되면 일반 few-shot 뒤에 사업장 특화 few-shot 으로 추가.
    """
    messages: list[dict] = [{"role": "system", "content": SYSTEM_PROMPT}]

    # 1) 일반 few-shot (4건, 하드코딩)
    for user_text, assistant_json in FEW_SHOT_EXAMPLES:
        messages.append({"role": "user", "content": user_text})
        messages.append({
            "role": "assistant",
            "content": json.dumps(assistant_json, ensure_ascii=False),
        })

    # 2) 사업장 특화 few-shot (학습 데이터, 동적)
    if learned_cases:
        messages.append({
            "role": "system",
            "content": (
                "이하는 본 사업장에서 사장님이 직접 수동 분류하신 과거 사례입니다. "
                "이 패턴을 본 사업장의 비즈니스 규칙으로 간주하고 우선 참고하세요. "
                "동일/유사 적요가 같은 분류로 일관되게 적용되는지 확인하세요."
            ),
        })
        for case in learned_cases[:5]:  # 최대 5건
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
    # 코드블록 제거
    if raw.startswith("```"):
        m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", raw, re.DOTALL)
        if m:
            raw = m.group(1)
    # 첫 JSON 객체 추출
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
    def __init__(self):
        self.provider = (os.getenv("AI_CLASSIFY_PROVIDER") or "ollama").strip().lower()
        self.ollama_url = (os.getenv("OLLAMA_URL") or "").rstrip("/")
        self.ollama_model = (os.getenv("OLLAMA_CLASSIFY_MODEL") or "qwen2.5:7b").strip()
        self.timeout = float(os.getenv("AI_CLASSIFY_TIMEOUT_SEC") or "30")

    def configured(self) -> bool:
        if self.provider == "ollama":
            return bool(self.ollama_url)
        return False

    def health(self) -> dict:
        info = {
            "provider": self.provider,
            "model": self.ollama_model if self.provider == "ollama" else None,
            "configured": self.configured(),
            "reachable": False,
        }
        if not self.configured():
            return info
        try:
            r = httpx.get(f"{self.ollama_url}/api/tags", timeout=3)
            r.raise_for_status()
            models = [m.get("name") for m in r.json().get("models", [])]
            info["reachable"] = True
            info["model_loaded"] = self.ollama_model in models
        except (httpx.HTTPError, OSError, ValueError) as e:
            info["error"] = str(e)[:200]
        return info

    def suggest(
        self,
        remark1: Optional[str] = None,
        remark2: Optional[str] = None,
        remark3: Optional[str] = None,
        in_amount: int = 0,
        out_amount: int = 0,
        learned_cases: Optional[list[dict]] = None,
    ) -> dict:
        """단일 거래에 대한 AI 분류 제안.

        Args:
            learned_cases: 사업장 과거 수동 분류 사례. 제공되면 dynamic few-shot.
                각 dict: {remark1, remark2, remark3?, in_amount, out_amount,
                          classified_as, standard_name?}

        Returns: {classified_as, standard_name, confidence, reason, provider, used_learned}
        Raises: AIClassifyError
        """
        if not self.configured():
            raise AIClassifyError(f"AI 분류 미설정 (provider={self.provider})")

        messages = _build_messages(
            remark1 or "", remark2 or "", remark3 or "",
            in_amount, out_amount,
            learned_cases=learned_cases,
        )

        if self.provider == "ollama":
            result = self._suggest_ollama(messages)
            result["used_learned"] = len(learned_cases or [])
            return result
        raise AIClassifyError(f"미지원 provider: {self.provider}")

    def _suggest_ollama(self, messages: list[dict]) -> dict:
        try:
            r = httpx.post(
                f"{self.ollama_url}/api/chat",
                json={
                    "model": self.ollama_model,
                    "messages": messages,
                    "stream": False,
                    "format": "json",
                    "options": {"temperature": 0.1, "num_predict": 200},
                },
                timeout=self.timeout,
            )
            if r.status_code != 200:
                raise AIClassifyError(f"Ollama {r.status_code}: {r.text[:200]}")
            data = r.json()
            content = (data.get("message") or {}).get("content") or ""
            result = _parse_response(content)
            result["provider"] = f"ollama:{self.ollama_model}"
            return result
        except httpx.HTTPError as e:
            raise AIClassifyError(f"Ollama 호출 실패: {e}")


    def chat(self, messages: list[dict], options: Optional[dict] = None) -> str:
        """범용 채팅 호출 (Phase 3 대화형 분석용).

        Args:
            messages: OpenAI-style chat 메시지 [{role: system|user|assistant, content: ...}]
            options: 추가 Ollama 옵션 (temperature, num_predict 등)

        Returns:
            assistant 응답 텍스트
        """
        if not self.configured():
            raise AIClassifyError(f"AI 미설정 (provider={self.provider})")
        if self.provider != "ollama":
            raise AIClassifyError(f"미지원 provider: {self.provider}")
        try:
            payload = {
                "model": self.ollama_model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": 0.3, "num_predict": 800, **(options or {})},
            }
            r = httpx.post(
                f"{self.ollama_url}/api/chat",
                json=payload,
                timeout=self.timeout * 2,  # 분석은 더 길어질 수 있음
            )
            if r.status_code != 200:
                raise AIClassifyError(f"Ollama {r.status_code}: {r.text[:200]}")
            data = r.json()
            return (data.get("message") or {}).get("content") or ""
        except httpx.HTTPError as e:
            raise AIClassifyError(f"Ollama 호출 실패: {e}")


_client: Optional[AIClassifyClient] = None


def get_ai_classifier() -> AIClassifyClient:
    global _client
    if _client is None:
        _client = AIClassifyClient()
    return _client
