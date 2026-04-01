"""
소담김밥 AI 이미지 생성 서비스
- SD 1.5 + LCM-LoRA on GTX 1080 (cuda:1)
- FastAPI REST API
- 3~8초 생성, 무료
"""
import io
import os
import time
import logging
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-image-service")

# ── 설정 ──
DEVICE = "cuda:1"
MODEL_ID = "runwayml/stable-diffusion-v1-5"
LCM_LORA_ID = "latent-consistency/lcm-lora-sdv1-5"
API_KEY = os.getenv("AI_SERVICE_API_KEY", "sodam-ai-2024")

# 전역 파이프라인
pipe = None


def load_pipeline():
    """SD 1.5 + LCM-LoRA 파이프라인 로드"""
    global pipe
    from diffusers import StableDiffusionPipeline, LCMScheduler

    logger.info(f"Loading SD 1.5 on {DEVICE}...")
    start = time.time()

    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    )

    # LCM-LoRA 적용 → 4 step으로 고품질 생성
    pipe.load_lora_weights(LCM_LORA_ID)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)

    pipe = pipe.to(DEVICE)
    pipe.enable_attention_slicing()  # 메모리 최적화

    elapsed = time.time() - start
    logger.info(f"Pipeline loaded in {elapsed:.1f}s")

    # 워밍업 (첫 생성이 느리므로)
    logger.info("Warming up...")
    _ = pipe("test", num_inference_steps=4, guidance_scale=1.0, width=512, height=512)
    logger.info("Warmup done, ready to serve!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_pipeline()
    yield
    # cleanup
    global pipe
    if pipe is not None:
        del pipe
        torch.cuda.empty_cache()


app = FastAPI(title="Sodam AI Image Service", lifespan=lifespan)


# ── 스타일 프리셋 ──
STYLE_SUFFIXES = {
    "natural": "professional food photography, natural lighting, appetizing presentation, top-down angle, Korean restaurant style, clean white plate background",
    "studio": "studio food photography, dramatic lighting, dark background, professional plating, high-end restaurant quality, shallow depth of field",
    "minimal": "minimal flat lay food photography, bright clean background, modern styling, negative space, Instagram-worthy composition",
}


class GenerateRequest(BaseModel):
    prompt: str
    style: str = "natural"
    width: int = 512
    height: int = 512
    steps: int = 4
    guidance_scale: float = 1.0
    seed: Optional[int] = None


class GenerateResponse(BaseModel):
    status: str
    generation_time: float
    seed: int
    width: int
    height: int


@app.post("/generate")
def generate_image(req: GenerateRequest):
    """이미지 생성 → PNG 바이너리 반환"""
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    # 스타일 적용
    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{req.prompt}. {style_suffix}"

    # 시드 설정
    generator = None
    seed = req.seed or int(time.time() * 1000) % (2**32)
    generator = torch.Generator(device=DEVICE).manual_seed(seed)

    # 해상도 제한 (VRAM 보호)
    width = min(req.width, 768)
    height = min(req.height, 768)
    # 8의 배수로 맞춤
    width = (width // 8) * 8
    height = (height // 8) * 8

    logger.info(f"Generating: {req.prompt[:50]}... ({width}x{height}, {req.steps} steps)")
    start = time.time()

    with torch.no_grad():
        result = pipe(
            full_prompt,
            negative_prompt="blurry, bad quality, distorted, ugly, watermark, text, logo",
            num_inference_steps=req.steps,
            guidance_scale=req.guidance_scale,
            width=width,
            height=height,
            generator=generator,
        )

    elapsed = time.time() - start
    logger.info(f"Generated in {elapsed:.1f}s")

    # PIL Image → PNG bytes
    image = result.images[0]
    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "X-Generation-Time": f"{elapsed:.2f}",
            "X-Seed": str(seed),
            "X-Width": str(width),
            "X-Height": str(height),
        },
    )


@app.get("/health")
def health():
    gpu_info = {}
    if torch.cuda.is_available():
        dev = torch.device(DEVICE)
        idx = dev.index if dev.index is not None else 0
        gpu_info = {
            "gpu_name": torch.cuda.get_device_name(idx),
            "vram_total_gb": round(torch.cuda.get_device_properties(idx).total_memory / 1e9, 1),
            "vram_used_gb": round(torch.cuda.memory_allocated(idx) / 1e9, 1),
        }

    return {
        "status": "ok" if pipe is not None else "loading",
        "model": MODEL_ID,
        "device": DEVICE,
        "gpu": gpu_info,
    }


@app.get("/")
def root():
    return {"service": "Sodam AI Image Service", "model": "SD 1.5 + LCM-LoRA", "device": DEVICE}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, workers=1)
