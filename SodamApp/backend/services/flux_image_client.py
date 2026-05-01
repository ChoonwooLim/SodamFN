"""
Flux 이미지 생성 서비스 클라이언트
- 작업PC(192.168.219.100:8100) 자체 호스팅 FLUX.1-schnell 호출
- text-to-image, img2img, upscale, remove-bg, inpaint
"""
import os
import socket
import time
import logging
import httpx
from typing import Optional
from urllib.parse import urlparse

logger = logging.getLogger(__name__)


class FluxImageError(Exception):
    pass


class FluxImageClient:
    def __init__(self):
        # AI_FLUX_BASE_URL 우선, 없으면 레거시 AI_GPU_SERVER_URL fallback
        self.base_url = (
            os.getenv("AI_FLUX_BASE_URL")
            or os.getenv("AI_GPU_SERVER_URL", "")
        ).rstrip("/")
        self._reach_cache: dict = {"ts": 0.0, "ok": False}

    @property
    def configured(self) -> bool:
        return bool(self.base_url)

    def _is_reachable(self, timeout: float = 1.5) -> bool:
        if not self.base_url:
            return False
        now = time.time()
        if (now - self._reach_cache["ts"]) < 30:
            return self._reach_cache["ok"]
        ok = False
        try:
            parsed = urlparse(self.base_url)
            host = parsed.hostname
            port = parsed.port or (443 if parsed.scheme == "https" else 80)
            if host:
                with socket.create_connection((host, port), timeout=timeout):
                    ok = True
        except (OSError, ValueError) as e:
            logger.info(f"Flux 서버 도달 불가 ({self.base_url}): {e}")
        self._reach_cache = {"ts": now, "ok": ok}
        return ok

    async def health(self) -> dict:
        if not self.configured:
            return {"reachable": False, "configured": False}
        if not self._is_reachable():
            return {"reachable": False, "configured": True, "url": self.base_url}
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{self.base_url}/health")
                r.raise_for_status()
                return {"reachable": True, "configured": True, **r.json()}
        except httpx.HTTPError as e:
            return {"reachable": False, "configured": True, "error": str(e)[:200]}

    async def generate(
        self,
        prompt: str,
        width: int = 1024,
        height: int = 1024,
        steps: int = 4,
        seed: Optional[int] = None,
        upscale: int = 1,
    ) -> bytes:
        """text-to-image. style은 '' 빈 문자열로 전달하여 image-service 측 프롬프트 후처리 차단."""
        if not self.configured:
            raise FluxImageError("Flux 서버가 설정되지 않았습니다 (AI_FLUX_BASE_URL).")
        payload = {
            "prompt": prompt,
            "style": "",  # OpenClaw가 이미 스타일 주입했으므로 image-service 측 미사용
            "width": width,
            "height": height,
            "steps": steps,
            "upscale": upscale,
        }
        if seed is not None:
            payload["seed"] = seed

        async with httpx.AsyncClient(timeout=240.0) as client:
            r = await client.post(f"{self.base_url}/generate", json=payload)
            if r.status_code != 200:
                raise FluxImageError(f"Flux /generate {r.status_code}: {r.text[:200]}")
            return r.content  # PNG bytes

    async def img2img(
        self,
        prompt: str,
        image_bytes: bytes,
        filename: str,
        content_type: str,
        strength: float = 0.75,
        steps: int = 4,
        seed: Optional[int] = None,
        upscale: int = 1,
    ) -> tuple[bytes, dict]:
        if not self.configured:
            raise FluxImageError("Flux 서버가 설정되지 않았습니다.")
        data = {
            "prompt": prompt,
            "strength": str(min(max(strength, 0.1), 1.0)),
            "steps": str(steps),
            "style": "",
            "upscale": str(min(max(upscale, 1), 4)),
        }
        if seed is not None:
            data["seed"] = str(seed)

        async with httpx.AsyncClient(timeout=240.0) as client:
            r = await client.post(
                f"{self.base_url}/img2img",
                files={"file": (filename or "image.png", image_bytes, content_type or "image/png")},
                data=data,
            )
            if r.status_code == 429:
                raise FluxImageError("Flux 서버가 다른 작업 중입니다. 잠시 후 다시 시도해주세요.")
            if r.status_code != 200:
                raise FluxImageError(f"Flux /img2img {r.status_code}: {r.text[:200]}")
            return r.content, dict(r.headers)

    async def upscale(self, image_bytes: bytes, filename: str, content_type: str, scale: int = 4) -> tuple[bytes, dict]:
        if not self.configured:
            raise FluxImageError("Flux 서버가 설정되지 않았습니다.")
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{self.base_url}/upscale",
                files={"file": (filename or "image.png", image_bytes, content_type or "image/png")},
                data={"scale": str(min(max(scale, 2), 4))},
            )
            if r.status_code != 200:
                raise FluxImageError(f"Flux /upscale {r.status_code}: {r.text[:200]}")
            return r.content, dict(r.headers)

    async def remove_bg(self, image_bytes: bytes, filename: str, content_type: str) -> tuple[bytes, dict]:
        if not self.configured:
            raise FluxImageError("Flux 서버가 설정되지 않았습니다.")
        async with httpx.AsyncClient(timeout=120.0) as client:
            r = await client.post(
                f"{self.base_url}/remove-bg",
                files={"file": (filename or "image.png", image_bytes, content_type or "image/png")},
            )
            if r.status_code != 200:
                raise FluxImageError(f"Flux /remove-bg {r.status_code}: {r.text[:200]}")
            return r.content, dict(r.headers)

    async def inpaint(
        self,
        image_bytes: bytes, image_filename: str, image_ct: str,
        mask_bytes: bytes, mask_ct: str = "image/png",
    ) -> tuple[bytes, dict]:
        if not self.configured:
            raise FluxImageError("Flux 서버가 설정되지 않았습니다.")
        async with httpx.AsyncClient(timeout=180.0) as client:
            r = await client.post(
                f"{self.base_url}/inpaint",
                files={
                    "file": (image_filename or "image.png", image_bytes, image_ct or "image/png"),
                    "mask": ("mask.png", mask_bytes, mask_ct),
                },
            )
            if r.status_code != 200:
                raise FluxImageError(f"Flux /inpaint {r.status_code}: {r.text[:200]}")
            return r.content, dict(r.headers)


_client: Optional[FluxImageClient] = None


def get_flux() -> FluxImageClient:
    global _client
    if _client is None:
        _client = FluxImageClient()
    return _client
