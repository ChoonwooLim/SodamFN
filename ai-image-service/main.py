"""
소담김밥 AI 이미지 생성 서비스
- Flux.1-schnell (최고 품질 오픈소스 모델)
- Text-to-Image + Image-to-Image 지원
- Real-ESRGAN 4x 업스케일러 (512→2048)
- GTX 1080 — sequential CPU offload
- FastAPI REST API
- 무료
"""
import gc
import io
import time
import logging
import threading
import numpy as np
import torch
from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.responses import Response
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
from PIL import Image

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-image-service")

MODEL_ID = "black-forest-labs/FLUX.1-schnell"
UPSCALE_GPU = 1  # 업스케일은 cuda:1 사용 (Flux가 cuda:0 사용)

pipe = None
img2img_pipe = None
upscaler = None
gen_lock = threading.Lock()
upscale_lock = threading.Lock()


def load_pipeline():
    """Flux.1-schnell 파이프라인 로드 (t2i + i2i)"""
    global pipe, img2img_pipe
    from diffusers import FluxPipeline, FluxImg2ImgPipeline

    gpu_count = torch.cuda.device_count()
    for i in range(gpu_count):
        name = torch.cuda.get_device_name(i)
        mem = torch.cuda.get_device_properties(i).total_memory / 1e9
        logger.info(f"  GPU {i}: {name} ({mem:.1f}GB)")

    logger.info("Loading Flux.1-schnell with model CPU offload...")
    start = time.time()

    pipe = FluxPipeline.from_pretrained(
        MODEL_ID,
        torch_dtype=torch.float16,
    )
    pipe.enable_model_cpu_offload(gpu_id=0)

    # i2i 파이프라인: 동일 모델 가중치 공유 (추가 VRAM 없음)
    img2img_pipe = FluxImg2ImgPipeline(**pipe.components)
    img2img_pipe.enable_model_cpu_offload(gpu_id=0)

    elapsed = time.time() - start
    logger.info(f"Pipeline loaded in {elapsed:.1f}s (t2i + i2i)")

    logger.info("Warming up...")
    try:
        torch.cuda.empty_cache()
        pipe(
            "test",
            num_inference_steps=2,
            guidance_scale=0.0,
            width=256,
            height=256,
            max_sequence_length=64,
        )
        logger.info("Warmup done!")
    except Exception as e:
        logger.warning(f"Warmup skipped ({e}). First request will be slower.")


def load_upscaler():
    """Real-ESRGAN 4x 업스케일러 로드 (cuda:1)"""
    global upscaler
    from realesrgan import RealESRGANer
    from basicsr.archs.rrdbnet_arch import RRDBNet

    logger.info(f"Loading Real-ESRGAN on cuda:{UPSCALE_GPU}...")

    model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
    upscaler = RealESRGANer(
        scale=4,
        model_path="https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth",
        model=model,
        tile=400,  # 타일 처리로 VRAM 절약
        tile_pad=10,
        pre_pad=0,
        half=True,
        gpu_id=UPSCALE_GPU,
    )
    logger.info("Real-ESRGAN loaded!")


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_pipeline()
    load_upscaler()
    yield
    global pipe, upscaler
    del pipe
    del upscaler
    torch.cuda.empty_cache()
    gc.collect()


app = FastAPI(title="Sodam AI Image Service (Flux + Upscaler)", lifespan=lifespan)


STYLE_SUFFIXES = {
    "natural": "shot on Canon EOS R5, 50mm f/1.8, natural window light, warm color temperature, real food texture with visible grain and gloss, white ceramic plate on light wood table, soft shadows, editorial food photography",
    "studio": "shot on Sony A7R IV, 85mm f/2.8, Profoto studio strobe with softbox, dark moody background, rim light highlighting steam and texture, shallow depth of field, Michelin-star plating, commercial food photography",
    "minimal": "shot on Fujifilm X-T5, 35mm f/2, bright diffused daylight, pure white seamless background, flat lay overhead composition, clean negative space, real food texture, catalog product photography",
    "overhead": "shot on Canon EOS R5, 24mm f/4, directly overhead bird-eye view, natural daylight, wooden table surface, multiple dishes arranged, real food texture, editorial spread layout",
    "angle45": "shot on Sony A7 III, 50mm f/1.4, 45-degree angle, natural side light from window, bokeh background, real food texture with oil sheen and moisture, lifestyle food photography",
    "closeup": "shot on Canon EOS R5, 100mm macro f/2.8, extreme close-up showing food texture detail, visible steam, oil droplets, sauce gloss, grain of rice, shallow depth of field, hyper-detailed food photography",
    "steam": "shot on Sony A7R IV, 85mm f/2, backlit steam rising from hot food, warm tungsten lighting, dark cozy background, condensation on bowl, freshly cooked moment captured, atmospheric food photography",
    "delivery": "clean product shot for delivery app menu, shot on iPhone 15 Pro, bright even lighting, white or light gray background, no shadows, centered composition, clear and appetizing, mobile-optimized food photography",
    "casual": "shot on Fujifilm X100V, natural ambient light, casual dining table setting with chopsticks and side dishes, lived-in warm atmosphere, slightly messy authentic Korean meal scene, lifestyle photography",
    "premium": "shot on Phase One IQ4, 80mm f/2.8, luxury restaurant plating on black slate plate, gold accent garnish, professional food styling with tweezers, dramatic chiaroscuro lighting, fine dining editorial photography",
}


class GenerateRequest(BaseModel):
    prompt: str
    style: str = "natural"
    width: int = 512
    height: int = 512
    steps: int = 4
    seed: Optional[int] = None
    upscale: int = 1  # 1=원본, 2=2x, 4=4x


def _upscale_image(pil_image: Image.Image, scale: int) -> Image.Image:
    """Real-ESRGAN으로 이미지 업스케일"""
    if upscaler is None or scale <= 1:
        return pil_image

    img_np = np.array(pil_image)
    # RGB → BGR (OpenCV 형식)
    img_bgr = img_np[:, :, ::-1]

    with upscale_lock:
        output, _ = upscaler.enhance(img_bgr, outscale=scale)

    # BGR → RGB
    output_rgb = output[:, :, ::-1]
    return Image.fromarray(output_rgb)


@app.post("/generate")
def generate_image(req: GenerateRequest):
    if pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    if gen_lock.locked():
        raise HTTPException(status_code=429, detail="Another generation in progress, try again shortly")

    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{req.prompt}. {style_suffix}"

    seed = req.seed or int(time.time() * 1000) % (2**32)
    generator = torch.Generator(device="cpu").manual_seed(seed)

    width = min(req.width, 768)
    height = min(req.height, 768)
    width = (width // 8) * 8
    height = (height // 8) * 8

    upscale = min(max(req.upscale, 1), 4)

    logger.info(f"Generating: {req.prompt[:50]}... ({width}x{height}, {req.steps} steps, upscale={upscale}x)")
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

    gen_time = time.time() - start
    image = result.images[0]

    # 업스케일
    if upscale > 1:
        logger.info(f"Upscaling {upscale}x...")
        up_start = time.time()
        image = _upscale_image(image, upscale)
        up_time = time.time() - up_start
        logger.info(f"Upscaled to {image.size[0]}x{image.size[1]} in {up_time:.1f}s")

    total_time = time.time() - start
    logger.info(f"Total: {total_time:.1f}s (gen={gen_time:.1f}s)")

    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "X-Generation-Time": f"{gen_time:.2f}",
            "X-Total-Time": f"{total_time:.2f}",
            "X-Seed": str(seed),
            "X-Width": str(image.size[0]),
            "X-Height": str(image.size[1]),
            "X-Upscale": str(upscale),
            "X-Model": "flux.1-schnell",
        },
    )


# ── Image-to-Image 엔드포인트 ──
@app.post("/img2img")
async def img2img(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    strength: float = Form(0.75),
    steps: int = Form(4),
    seed: Optional[int] = Form(None),
    upscale: int = Form(1),
    style: str = Form(""),
):
    """이미지 + 프롬프트로 새 이미지 생성 (Image-to-Image)"""
    if img2img_pipe is None:
        raise HTTPException(status_code=503, detail="Model not loaded yet")

    if gen_lock.locked():
        raise HTTPException(status_code=429, detail="Another generation in progress, try again shortly")

    # 프롬프트에 스타일 접미사 추가
    full_prompt = prompt
    if style and style in STYLE_SUFFIXES:
        full_prompt = f"{prompt}. {STYLE_SUFFIXES[style]}"

    # 입력 이미지 로드 및 크기 조정
    content = await file.read()
    init_image = Image.open(io.BytesIO(content)).convert("RGB")

    # 최대 768x768로 제한, 8의 배수로 맞춤
    w, h = init_image.size
    max_dim = 768
    if w > max_dim or h > max_dim:
        ratio = min(max_dim / w, max_dim / h)
        w, h = int(w * ratio), int(h * ratio)
    w = (w // 8) * 8
    h = (h // 8) * 8
    init_image = init_image.resize((w, h), Image.LANCZOS)

    seed_val = seed or int(time.time() * 1000) % (2**32)
    generator = torch.Generator(device="cpu").manual_seed(seed_val)
    strength = min(max(strength, 0.1), 1.0)
    upscale = min(max(upscale, 1), 4)

    logger.info(f"Img2Img: {prompt[:50]}... ({w}x{h}, strength={strength}, {steps} steps, upscale={upscale}x)")
    start = time.time()

    with gen_lock:
        with torch.no_grad():
            result = img2img_pipe(
                full_prompt,
                image=init_image,
                strength=strength,
                num_inference_steps=steps,
                guidance_scale=0.0,
                max_sequence_length=256,
                generator=generator,
            )

    gen_time = time.time() - start
    image = result.images[0]

    # 업스케일
    if upscale > 1:
        logger.info(f"Upscaling {upscale}x...")
        up_start = time.time()
        image = _upscale_image(image, upscale)
        up_time = time.time() - up_start
        logger.info(f"Upscaled to {image.size[0]}x{image.size[1]} in {up_time:.1f}s")

    total_time = time.time() - start
    logger.info(f"Img2Img total: {total_time:.1f}s (gen={gen_time:.1f}s)")

    buf = io.BytesIO()
    image.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "X-Generation-Time": f"{gen_time:.2f}",
            "X-Total-Time": f"{total_time:.2f}",
            "X-Seed": str(seed_val),
            "X-Width": str(image.size[0]),
            "X-Height": str(image.size[1]),
            "X-Upscale": str(upscale),
            "X-Strength": str(strength),
            "X-Model": "flux.1-schnell-img2img",
        },
    )


# ── 단독 업스케일 엔드포인트 (기존 이미지 업스케일) ──
@app.post("/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = Form(4),
):
    """기존 이미지를 업스케일 (2x 또는 4x)"""
    if upscaler is None:
        raise HTTPException(status_code=503, detail="Upscaler not loaded")

    scale = min(max(scale, 2), 4)

    content = await file.read()
    pil_image = Image.open(io.BytesIO(content)).convert("RGB")
    orig_size = pil_image.size

    logger.info(f"Upscaling {orig_size[0]}x{orig_size[1]} → {scale}x")
    start = time.time()

    result = _upscale_image(pil_image, scale)

    elapsed = time.time() - start
    logger.info(f"Upscaled to {result.size[0]}x{result.size[1]} in {elapsed:.1f}s")

    buf = io.BytesIO()
    result.save(buf, format="PNG", optimize=True)
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "X-Upscale-Time": f"{elapsed:.2f}",
            "X-Original-Size": f"{orig_size[0]}x{orig_size[1]}",
            "X-Output-Size": f"{result.size[0]}x{result.size[1]}",
            "X-Scale": str(scale),
        },
    )


# ── 배경 제거 엔드포인트 (rembg) ──
@app.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
):
    """이미지 배경 제거 (rembg / u2net, CPU 전용)"""
    try:
        from rembg import remove, new_session
    except ImportError:
        raise HTTPException(status_code=503, detail="rembg not installed. Run: pip install rembg")

    content = await file.read()
    pil_image = Image.open(io.BytesIO(content)).convert("RGBA")

    logger.info(f"Removing background: {pil_image.size[0]}x{pil_image.size[1]}")
    start = time.time()

    # CPU 세션 사용 (GPU는 Flux가 점유)
    session = new_session("u2net", providers=["CPUExecutionProvider"])
    result = remove(pil_image, session=session)

    elapsed = time.time() - start
    logger.info(f"Background removed in {elapsed:.1f}s")

    buf = io.BytesIO()
    result.save(buf, format="PNG")
    buf.seek(0)

    return Response(
        content=buf.getvalue(),
        media_type="image/png",
        headers={
            "X-Processing-Time": f"{elapsed:.2f}",
            "X-Width": str(result.size[0]),
            "X-Height": str(result.size[1]),
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
            "role": "flux-generate" if i == 0 else "upscale",
        })

    ram_info = {}
    try:
        import psutil
        ram = psutil.virtual_memory()
        ram_info = {
            "ram_total_gb": round(ram.total / 1e9, 1),
            "ram_used_gb": round(ram.used / 1e9, 1),
            "ram_percent": ram.percent,
        }
    except ImportError:
        pass

    return {
        "status": "ok" if pipe is not None else "loading",
        "model": "Flux.1-schnell",
        "img2img": "ready" if img2img_pipe is not None else "not loaded",
        "upscaler": "Real-ESRGAN x4" if upscaler is not None else "not loaded",
        "mode": "sequential-cpu-offload",
        "gpu_count": torch.cuda.device_count(),
        "gpus": gpus,
        "busy": gen_lock.locked(),
        "upscaling": upscale_lock.locked(),
    }


@app.get("/")
def root():
    return {
        "service": "Sodam AI Image Service",
        "model": "Flux.1-schnell + Real-ESRGAN",
        "features": ["generate", "img2img", "upscale", "remove-bg", "generate+upscale"],
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8100, workers=1)
