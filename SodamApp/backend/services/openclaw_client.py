"""
OpenClaw 게이트웨이 클라이언트
- twinverse-ai의 OpenClaw → ChatGPT Plus/Pro OAuth → GPT-5.5
- 식품 사진 프롬프트 엔지니어링 전담 (한국어 → 정제된 영문 Flux 프롬프트)
"""
import os
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


STYLE_HINTS = {
    "natural": "shot on Canon EOS R5, 50mm f/1.8, natural window light, warm tone, white ceramic plate on light wood, soft shadows, editorial food photography",
    "studio": "shot on Sony A7R IV, 85mm f/2.8, Profoto softbox, dark moody background, rim light, shallow DOF, Michelin-star plating, commercial food photography",
    "minimal": "shot on Fujifilm X-T5, 35mm f/2, bright diffused daylight, pure white seamless background, flat-lay overhead, clean negative space, catalog product photography",
    "overhead": "Canon EOS R5, 24mm f/4, directly overhead bird-eye, natural daylight, wooden table, multiple dishes, editorial spread",
    "angle45": "Sony A7 III, 50mm f/1.4, 45-degree angle, side window light, bokeh, oil sheen and moisture, lifestyle food photography",
    "closeup": "Canon EOS R5, 100mm macro f/2.8, extreme close-up, visible steam and oil droplets, sauce gloss, hyper-detailed food photography",
    "steam": "Sony A7R IV, 85mm f/2, backlit steam, warm tungsten, dark cozy background, freshly cooked moment, atmospheric food photography",
    "delivery": "clean product shot for delivery app menu, bright even lighting, white or light gray background, no shadows, centered, mobile-optimized food photography",
    "casual": "Fujifilm X100V, ambient light, casual table with chopsticks and side dishes, lived-in warm atmosphere, lifestyle photography",
    "premium": "Phase One IQ4, 80mm f/2.8, luxury restaurant plating on black slate, gold garnish, dramatic chiaroscuro, fine dining editorial",
}


SYSTEM_PROMPT = (
    "You are a professional food photography prompt engineer for FLUX.1-schnell. "
    "Convert Korean dish descriptions into precise English prompts (40-90 words) "
    "that produce mouth-watering, photorealistic food images. "
    "Always include: dish identity, key ingredients visible, plating, lighting, camera spec, mood. "
    "Output ONLY the final English prompt — no quotes, no explanation, no preamble."
)


class OpenClawError(Exception):
    pass


class OpenClawClient:
    def __init__(self):
        self.base_url = os.getenv("OPENCLAW_GATEWAY_URL", "").rstrip("/")
        self.token = os.getenv("OPENCLAW_GATEWAY_TOKEN", "")
        self.model = os.getenv("OPENCLAW_MODEL", "openclaw/codex-pro")
        self.timeout = float(os.getenv("OPENCLAW_TIMEOUT_SEC", "60"))

    @property
    def configured(self) -> bool:
        return bool(self.base_url and self.token)

    async def health(self) -> dict:
        if not self.base_url:
            return {"reachable": False, "configured": False}
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{self.base_url}/health")
                r.raise_for_status()
                return {"reachable": True, "configured": self.configured, **r.json()}
        except (httpx.HTTPError, OSError) as e:
            return {"reachable": False, "configured": self.configured, "error": str(e)[:200]}

    async def chat(self, messages: list[dict], model: Optional[str] = None) -> str:
        if not self.configured:
            raise OpenClawError("OpenClaw 게이트웨이가 설정되지 않았습니다. OPENCLAW_GATEWAY_URL/TOKEN 확인.")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                f"{self.base_url}/v1/chat/completions",
                headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"},
                json={"model": model or self.model, "messages": messages},
            )
            if r.status_code != 200:
                raise OpenClawError(f"OpenClaw {r.status_code}: {r.text[:300]}")
            data = r.json()
            try:
                return data["choices"][0]["message"]["content"].strip()
            except (KeyError, IndexError) as e:
                raise OpenClawError(f"OpenClaw 응답 형식 오류: {e}, payload={str(data)[:200]}")

    async def refine_image_prompt(
        self,
        korean_prompt: str,
        style: str = "natural",
        reference_description: Optional[str] = None,
        negative_prompt: Optional[str] = None,
    ) -> str:
        """한국어 음식 설명 → 정제된 영문 Flux 프롬프트.
        GPT-5.5가 식품 사진 전문 프롬프트 엔지니어 역할을 수행."""
        style_hint = STYLE_HINTS.get(style, STYLE_HINTS["natural"])
        user = f"Korean dish: {korean_prompt}\nPhotography style: {style_hint}"
        if reference_description:
            user += f"\nVisual reference: {reference_description}"
        if negative_prompt:
            user += f"\nAvoid: {negative_prompt}"

        try:
            return await self.chat(messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user},
            ])
        except OpenClawError:
            raise
        except Exception as e:
            logger.error(f"OpenClaw refine_image_prompt failed: {e}")
            raise OpenClawError(f"프롬프트 정제 실패: {e}")


_client: Optional[OpenClawClient] = None


def get_openclaw() -> OpenClawClient:
    global _client
    if _client is None:
        _client = OpenClawClient()
    return _client
