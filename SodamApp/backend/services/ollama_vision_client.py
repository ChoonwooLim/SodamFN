"""
Ollama LLaVA 비전 클라이언트
- twinverse-ai @ 192.168.219.117:11434
- 참고 이미지를 받아 음식 사진 컨텍스트로 자연어 묘사 추출
- OpenClaw GPT-5.5 프롬프트 엔지니어링에 텍스트 입력으로 전달
  (OpenClaw는 image_url content parts를 통과시키지 않음 — issue #17685)
"""
import os
import base64
import logging
import httpx
from typing import Optional

logger = logging.getLogger(__name__)


VISION_PROMPT = (
    "Describe this food photo in detail for a prompt engineer. "
    "Cover: dish name and likely cuisine, visible ingredients and arrangement, "
    "plate / surface / props, lighting (natural / studio / backlit), color palette, "
    "camera angle (overhead / 45° / closeup), mood (casual / premium / minimal). "
    "Output 3-6 concise sentences in English. No introductions, just the description."
)


class OllamaVisionError(Exception):
    pass


class OllamaVisionClient:
    def __init__(self):
        self.base_url = os.getenv("OLLAMA_URL", "").rstrip("/")
        self.model = os.getenv("OLLAMA_VISION_MODEL", "llava:7b")
        self.timeout = float(os.getenv("OLLAMA_VISION_TIMEOUT_SEC", "120"))

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    async def describe_image(self, image_bytes: bytes) -> str:
        """LLaVA 가 이미지를 분석해 식품 사진 컨텍스트의 영문 묘사 반환."""
        if not self.configured:
            raise OllamaVisionError("OLLAMA_URL 미설정")

        b64 = base64.b64encode(image_bytes).decode("ascii")
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            r = await client.post(
                f"{self.base_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": VISION_PROMPT,
                    "images": [b64],
                    "stream": False,
                },
            )
            if r.status_code != 200:
                raise OllamaVisionError(f"LLaVA {r.status_code}: {r.text[:200]}")
            data = r.json()
            return (data.get("response") or "").strip()


_client: Optional[OllamaVisionClient] = None


def get_vision() -> OllamaVisionClient:
    global _client
    if _client is None:
        _client = OllamaVisionClient()
    return _client
