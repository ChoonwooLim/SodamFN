"""
소담김밥 AI 이미지 생성 서비스
- SD 1.5 + LCM-LoRA on 듀얼 GTX 1080 (cuda:0 + cuda:1)
- 라운드로빈 로드밸런싱 → 동시 2건 처리
- FastAPI REST API
- ~2초 생성, 무료
"""
import io
import os
import time
import logging
import threading
import torch
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-image-service")

# ── 설정 ──
DEVICES = ["cuda:0", "cuda:1"]
MODEL_ID = "runwayml/stable-diffusion-v1-5"
LCM_LORA_ID = "latent-consistency/lcm-lora-sdv1-5"

# 듀얼 GPU 파이프라인 + 락
pipes = {}       # {device_str: pipeline}
locks = {}       # {device_str: threading.Lock}
_round_robin = 0
_rr_lock = threading.Lock()


def load_pipeline(device: str):
    """SD 1.5 + LCM-LoRA 파이프라인 로드 (GPU 1장)"""
    from diffusers import StableDiffusionPipeline, LCMScheduler

    logger.info(f"Loading SD 1.5 on {device}...")
    start = time.time()

    pipe = StableDiffusionPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
        safety_checker=None,
        requires_safety_checker=False,
    )

    pipe.load_lora_weights(LCM_LORA_ID)
    pipe.scheduler = LCMScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    pipe.enable_attention_slicing()

    elapsed = time.time() - start
    logger.info(f"[{device}] Pipeline loaded in {elapsed:.1f}s")

    # 워밍업
    logger.info(f"[{device}] Warming up...")
    _ = pipe("test", num_inference_steps=4, guidance_scale=1.0, width=512, height=512)
    logger.info(f"[{device}] Ready!")

    return pipe


def load_all_pipelines():
    """듀얼 GPU 모두에 파이프라인 로드"""
    for dev in DEVICES:
        idx = int(dev.split(":")[1])
        if idx < torch.cuda.device_count():
            pipes[dev] = load_pipeline(dev)
            locks[dev] = threading.Lock()
            logger.info(f"[{dev}] {torch.cuda.get_device_name(idx)} — VRAM {torch.cuda.get_device_properties(idx).total_memory / 1e9:.1f}GB")
        else:
            logger.warning(f"[{dev}] GPU not available, skipping")

    if not pipes:
        raise RuntimeError("No GPU available!")
    logger.info(f"Total {len(pipes)} GPUs loaded: {list(pipes.keys())}")


def get_next_gpu():
    """라운드로빈으로 다음 GPU 선택 (유휴 GPU 우선)"""
    global _round_robin
    devices = list(pipes.keys())

    # 유휴 GPU가 있으면 우선 사용
    for dev in devices:
        if not locks[dev].locked():
            return dev

    # 모두 사용 중이면 라운드로빈
    with _rr_lock:
        dev = devices[_round_robin % len(devices)]
        _round_robin += 1
    return dev


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_all_pipelines()
    yield
    for dev, pipe in pipes.items():
        del pipe
    torch.cuda.empty_cache()


app = FastAPI(title="Sodam AI Image Service (Dual GPU)", lifespan=lifespan)


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


@app.post("/generate")
def generate_image(req: GenerateRequest):
    """이미지 생성 → PNG 바이너리 반환 (듀얼 GPU 로드밸런싱)"""
    if not pipes:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    device = get_next_gpu()
    pipe = pipes[device]
    lock = locks[device]

    # 스타일 적용
    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{req.prompt}. {style_suffix}"

    # 시드 설정
    seed = req.seed or int(time.time() * 1000) % (2**32)
    generator = torch.Generator(device=device).manual_seed(seed)

    # 해상도 제한 (VRAM 보호)
    width = min(req.width, 768)
    height = min(req.height, 768)
    width = (width // 8) * 8
    height = (height // 8) * 8

    logger.info(f"[{device}] Generating: {req.prompt[:50]}... ({width}x{height}, {req.steps} steps)")
    start = time.time()

    with lock:
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
    logger.info(f"[{device}] Generated in {elapsed:.1f}s")

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
            "X-GPU": device,
        },
    )


@app.get("/health")
def health():
    gpu_list = []
    for dev in pipes:
        idx = int(dev.split(":")[1])
        gpu_list.append({
            "device": dev,
            "gpu_name": torch.cuda.get_device_name(idx),
            "vram_total_gb": round(torch.cuda.get_device_properties(idx).total_memory / 1e9, 1),
            "vram_used_gb": round(torch.cuda.memory_allocated(idx) / 1e9, 1),
            "busy": locks[dev].locked(),
        })

    return {
        "status": "ok" if pipes else "loading",
        "model": MODEL_ID,
        "gpu_count": len(pipes),
        "gpus": gpu_list,
    }


@app.get("/")
def root():
    return {
        "service": "Sodam AI Image Service",
        "model": "SD 1.5 + LCM-LoRA",
        "gpus": len(pipes),
        "devices": list(pipes.keys()),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, workers=1)
