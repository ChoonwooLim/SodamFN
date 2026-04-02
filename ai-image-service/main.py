"""
소담김밥 AI 이미지 생성 서비스
- Flux.1-schnell (최고 품질 오픈소스 모델)
- GTX 1080 — sequential CPU offload
- FastAPI REST API
- 무료
"""
import io
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

MODEL_ID = "black-forest-labs/FLUX.1-schnell"

pipe = None
gen_lock = threading.Lock()


def load_pipeline():
    """Flux.1-schnell 파이프라인 로드 (sequential CPU offload)"""
    global pipe
    from diffusers import FluxPipeline

    gpu_count = torch.cuda.device_count()
    for i in range(gpu_count):
        name = torch.cuda.get_device_name(i)
        mem = torch.cuda.get_device_properties(i).total_memory / 1e9
        logger.info(f"  GPU {i}: {name} ({mem:.1f}GB)")

    logger.info("Loading Flux.1-schnell...")
    start = time.time()

    pipe = FluxPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
    )
    pipe.enable_sequential_cpu_offload(gpu_id=0)

    elapsed = time.time() - start
    logger.info(f"Pipeline loaded in {elapsed:.1f}s")

    # 워밍업 (소형으로)
    logger.info("Warming up...")
    pipe(
        "test",
        num_inference_steps=2,
        guidance_scale=0.0,
        width=256,
        height=256,
        max_sequence_length=64,
    )
    logger.info("Warmup done, ready to serve!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_pipeline()
    yield
    global pipe
    del pipe
    torch.cuda.empty_cache()


app = FastAPI(title="Sodam AI Image Service (Flux.1-schnell)", lifespan=lifespan)


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
    seed: Optional[int] = None


@app.post("/generate")
def generate_image(req: GenerateRequest):
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{req.prompt}. {style_suffix}"

    seed = req.seed or int(time.time() * 1000) % (2**32)
    generator = torch.Generator(device="cpu").manual_seed(seed)

    width = min(req.width, 768)
    height = min(req.height, 768)
    width = (width // 8) * 8
    height = (height // 8) * 8

    logger.info(f"Generating: {req.prompt[:50]}... ({width}x{height}, {req.steps} steps)")
    start = time.time()

    with gen_lock:
        with torch.no_grad():
            result = pipe(
                full_prompt,
                num_inference_steps=req.steps,
                guidance_scale=0.0,
                width=width,
                height=height,
                max_sequence_length=256,
                generator=generator,
            )

    elapsed = time.time() - start
    logger.info(f"Generated in {elapsed:.1f}s")

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
            "X-Model": "flux.1-schnell",
        },
    )


@app.get("/health")
def health():
    gpus = []
    for i in range(torch.cuda.device_count()):
        gpus.append({
            "device": f"cuda:{i}",
            "gpu_name": torch.cuda.get_device_name(i),
            "vram_total_gb": round(torch.cuda.get_device_properties(i).total_memory / 1e9, 1),
            "vram_used_gb": round(torch.cuda.memory_allocated(i) / 1e9, 1),
        })

    return {
        "status": "ok" if pipe is not None else "loading",
        "model": "Flux.1-schnell",
        "mode": "sequential-cpu-offload",
        "gpu_count": torch.cuda.device_count(),
        "gpus": gpus,
        "busy": gen_lock.locked(),
    }


@app.get("/")
def root():
    return {
        "service": "Sodam AI Image Service",
        "model": "Flux.1-schnell",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, workers=1)
