"""
배달앱 이미지 관리 API
- CRUD: 이미지 목록 / 업로드 / 삭제
- AI 파이프라인: OpenClaw(GPT-5.5) 프롬프트 정제 → Flux.1-schnell 이미지 생성
  · 외부 API(Replicate / OpenAI) 의존성 제거 — OpenClaw + 자체 GPU만 사용
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from routers.auth import get_admin_user
from models import User as AuthUser, DeliveryImage
from sqlmodel import Session, select
from database import get_session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from io import BytesIO
import os
import logging

from tenant_filter import get_bid_from_token, apply_bid_filter
from services.storage_service import get_storage
from services.openclaw_client import get_openclaw, OpenClawError
from services.flux_image_client import get_flux, FluxImageError
from services.ollama_vision_client import get_vision, OllamaVisionError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/delivery-images", tags=["delivery-images"])


# ── 이미지 목록 조회 ──
@router.get("")
def list_images(
    category: Optional[str] = None,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    stmt = select(DeliveryImage).order_by(DeliveryImage.category, DeliveryImage.name)
    stmt = apply_bid_filter(stmt, DeliveryImage, bid)
    if category:
        stmt = stmt.where(DeliveryImage.category == category)
    images = session.exec(stmt).all()
    return {
        "status": "success",
        "data": [
            {
                "id": img.id,
                "name": img.name,
                "category": img.category,
                "image_url": img.image_url,
                "source": img.source,
                "created_at": img.created_at.isoformat() if img.created_at else None,
            }
            for img in images
        ],
    }


# ── 이미지 업로드 ──
@router.post("/upload")
async def upload_image(
    file: UploadFile = File(...),
    name: str = Form(...),
    category: str = Form("김밥류"),
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    allowed_types = ["image/jpeg", "image/png", "image/gif", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="JPG, PNG, GIF, WEBP만 업로드 가능합니다.")

    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    ext = os.path.splitext(file.filename or "image.jpg")[1]
    storage_key = f"delivery_images/{timestamp}{ext}"

    file_url = storage.upload_file(file.file, storage_key, file.content_type)

    img = DeliveryImage(
        business_id=bid,
        name=name,
        category=category,
        image_url=file_url,
        storage_key=storage_key,
        source="upload",
    )
    session.add(img)
    session.commit()
    session.refresh(img)

    return {
        "status": "success",
        "data": {
            "id": img.id,
            "name": img.name,
            "category": img.category,
            "image_url": img.image_url,
            "source": img.source,
        },
    }


# ── 이미지 삭제 ──
@router.delete("/{image_id}")
def delete_image(
    image_id: int,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    _bid=Depends(get_bid_from_token),
):
    img = session.get(DeliveryImage, image_id)
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")
    if img.storage_key:
        storage = get_storage()
        storage.delete_file(img.storage_key)
    session.delete(img)
    session.commit()
    return {"status": "success"}


# ── 다중 삭제 ──
class BulkDeleteRequest(BaseModel):
    ids: List[int]


@router.post("/bulk-delete")
def bulk_delete(
    req: BulkDeleteRequest,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    _bid=Depends(get_bid_from_token),
):
    storage = get_storage()
    images = session.exec(select(DeliveryImage).where(DeliveryImage.id.in_(req.ids))).all()
    for img in images:
        if img.storage_key:
            storage.delete_file(img.storage_key)
        session.delete(img)
    session.commit()
    return {"status": "success", "deleted": len(images)}


# ══════════════════════════════════════════════════
# AI 이미지 생성 (OpenClaw → Flux 파이프라인)
# ══════════════════════════════════════════════════
class AIGenerateRequest(BaseModel):
    prompt: str
    name: str = "AI 생성 이미지"
    category: str = "김밥류"
    style: str = "natural"
    width: int = 1024
    height: int = 1024
    steps: int = 4
    seed: Optional[int] = None
    upscale: int = 1                    # 1=SD, 2=HD, 4=4K (Real-ESRGAN 후처리)
    negative_prompt: Optional[str] = None
    reference_description: Optional[str] = None
    skip_refinement: bool = False       # True면 OpenClaw 우회 (영문 프롬프트 직접 입력)


async def _refine_prompt(req: AIGenerateRequest) -> str:
    """OpenClaw GPT-5.5로 한국어 → 정제된 영문 Flux 프롬프트 생성."""
    if req.skip_refinement:
        return req.prompt.strip()
    oc = get_openclaw()
    if not oc.configured:
        raise HTTPException(
            status_code=503,
            detail="OpenClaw 게이트웨이가 설정되지 않았습니다. 환경변수 OPENCLAW_GATEWAY_URL/TOKEN 확인.",
        )
    try:
        return await oc.refine_image_prompt(
            korean_prompt=req.prompt,
            style=req.style,
            reference_description=req.reference_description,
            negative_prompt=req.negative_prompt,
        )
    except OpenClawError as e:
        raise HTTPException(status_code=502, detail=f"프롬프트 정제 실패: {e}")


# ── 프롬프트 정제 (미리보기용 - 이미지 생성 없이) ──
class TranslateRequest(BaseModel):
    prompt: str
    style: str = "natural"
    reference_description: Optional[str] = None
    negative_prompt: Optional[str] = None


@router.post("/translate-prompt")
async def translate_prompt(req: TranslateRequest, _admin: AuthUser = Depends(get_admin_user)):
    """한국어 음식 설명을 OpenClaw GPT-5.5로 정제된 영문 프롬프트로 변환."""
    oc = get_openclaw()
    if not oc.configured:
        raise HTTPException(status_code=503, detail="OpenClaw 게이트웨이가 설정되지 않았습니다.")
    try:
        refined = await oc.refine_image_prompt(
            korean_prompt=req.prompt,
            style=req.style,
            reference_description=req.reference_description,
            negative_prompt=req.negative_prompt,
        )
        return {"translated": refined, "full_prompt": refined}
    except OpenClawError as e:
        raise HTTPException(status_code=502, detail=str(e))


# ── AI 이미지 생성 (DB 저장 포함) ──
@router.post("/ai-generate")
async def ai_generate_image(
    req: AIGenerateRequest,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다 (AI_FLUX_BASE_URL).")

    full_prompt = await _refine_prompt(req)

    try:
        image_bytes = await flux.generate(
            prompt=full_prompt,
            width=req.width, height=req.height,
            steps=req.steps, seed=req.seed,
            upscale=req.upscale,
        )
    except FluxImageError as e:
        logger.error(f"Flux generate error: {e}")
        raise HTTPException(status_code=502, detail=f"이미지 생성 실패: {e}")

    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    storage_key = f"delivery_images/ai_{timestamp}.png"
    stored_url = storage.upload_file(BytesIO(image_bytes), storage_key, "image/png")

    img = DeliveryImage(
        business_id=bid,
        name=req.name,
        category=req.category,
        image_url=stored_url,
        storage_key=storage_key,
        source="ai_generated",
    )
    session.add(img)
    session.commit()
    session.refresh(img)

    return {
        "status": "success",
        "data": {
            "id": img.id,
            "name": img.name,
            "category": img.category,
            "image_url": img.image_url,
            "source": img.source,
            "provider": "openclaw+flux",
            "refined_prompt": full_prompt,
        },
    }


# ── AI 이미지 미리보기 (DB 저장 없이 PNG 반환) ──
@router.post("/ai-preview")
async def ai_preview_image(
    req: AIGenerateRequest,
    _admin: AuthUser = Depends(get_admin_user),
):
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    full_prompt = await _refine_prompt(req)

    try:
        image_bytes = await flux.generate(
            prompt=full_prompt,
            width=req.width, height=req.height,
            steps=req.steps, seed=req.seed,
            upscale=req.upscale,
        )
    except FluxImageError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={"X-Refined-Prompt": full_prompt[:512]},
    )


# ══════════════════════════════════════════════════
# Flux GPU 프록시 — 이미지 편집 6종
# ══════════════════════════════════════════════════
@router.post("/img2img")
async def img2img_generate(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    strength: float = Form(0.75),
    steps: int = Form(4),
    seed: Optional[int] = Form(None),
    upscale: int = Form(1),
    refine: bool = Form(True),
    style: str = Form("natural"),
    _admin: AuthUser = Depends(get_admin_user),
):
    """이미지 + 프롬프트로 새 이미지 생성. refine=True면 OpenClaw로 프롬프트 정제."""
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    final_prompt = prompt
    if refine:
        oc = get_openclaw()
        if oc.configured:
            try:
                final_prompt = await oc.refine_image_prompt(prompt, style=style)
            except OpenClawError as e:
                logger.warning(f"img2img 프롬프트 정제 실패, 원본 사용: {e}")

    file_bytes = await file.read()
    try:
        image_bytes, headers = await flux.img2img(
            prompt=final_prompt,
            image_bytes=file_bytes,
            filename=file.filename or "image.png",
            content_type=file.content_type or "image/png",
            strength=strength, steps=steps, seed=seed, upscale=upscale,
        )
    except FluxImageError as e:
        if "다른 작업 중" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "X-Generation-Time": headers.get("x-generation-time", ""),
            "X-Seed": headers.get("x-seed", ""),
            "X-Strength": headers.get("x-strength", ""),
            "X-Refined-Prompt": final_prompt[:512],
        },
    )


@router.post("/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = Form(4),
    _admin: AuthUser = Depends(get_admin_user),
):
    """이미지 업스케일 (Real-ESRGAN 4x) — SD→HD/4K 업그레이드 버튼용."""
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    file_bytes = await file.read()
    try:
        image_bytes, headers = await flux.upscale(
            image_bytes=file_bytes,
            filename=file.filename or "image.png",
            content_type=file.content_type or "image/png",
            scale=scale,
        )
    except FluxImageError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={
            "X-Original-Size": headers.get("x-original-size", ""),
            "X-Output-Size": headers.get("x-output-size", ""),
            "X-Scale": headers.get("x-scale", ""),
            "X-Upscale-Time": headers.get("x-upscale-time", ""),
        },
    )


@router.post("/remove-bg")
async def remove_background(
    file: UploadFile = File(...),
    _admin: AuthUser = Depends(get_admin_user),
):
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    file_bytes = await file.read()
    try:
        image_bytes, headers = await flux.remove_bg(
            image_bytes=file_bytes,
            filename=file.filename or "image.png",
            content_type=file.content_type or "image/png",
        )
    except FluxImageError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={"X-Processing-Time": headers.get("x-processing-time", "")},
    )


@router.post("/inpaint")
async def inpaint_image(
    file: UploadFile = File(...),
    mask: UploadFile = File(...),
    _admin: AuthUser = Depends(get_admin_user),
):
    """마스크 영역을 LaMa로 자연스럽게 제거."""
    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    file_bytes = await file.read()
    mask_bytes = await mask.read()
    try:
        image_bytes, headers = await flux.inpaint(
            image_bytes=file_bytes,
            image_filename=file.filename or "image.png",
            image_ct=file.content_type or "image/png",
            mask_bytes=mask_bytes,
        )
    except FluxImageError as e:
        raise HTTPException(status_code=502, detail=str(e))

    return Response(
        content=image_bytes,
        media_type="image/png",
        headers={"X-Processing-Time": headers.get("x-processing-time", "")},
    )


# ══════════════════════════════════════════════════
# 대화형 프롬프트 엔지니어링 (OpenClaw GPT-5.5 + LLaVA 참고이미지 분석)
# ══════════════════════════════════════════════════
class ChatMessage(BaseModel):
    role: str  # "user" | "assistant"
    content: str


class AIChatRequest(BaseModel):
    messages: List[ChatMessage]
    reference_image_description: Optional[str] = None  # 클라이언트가 한 번 분석 후 캐시 가능


class AIChatResponse(BaseModel):
    reply: str
    final_prompt: Optional[str] = None  # ```prompt 코드블록에서 추출


def _extract_prompt_block(text: str) -> Optional[str]:
    """AI 응답에서 ```prompt ... ``` 블록 안 영문 프롬프트 추출."""
    import re
    m = re.search(r"```(?:prompt)?\s*\n(.+?)\n```", text, re.DOTALL | re.IGNORECASE)
    if not m:
        return None
    body = m.group(1).strip()
    # 너무 짧으면 무효 (아직 정제 미완)
    return body if len(body) >= 20 else None


@router.post("/ai-chat", response_model=AIChatResponse)
async def ai_chat(req: AIChatRequest, _admin: AuthUser = Depends(get_admin_user)):
    """대화형 프롬프트 엔지니어링. 사용자 ↔ GPT-5.5 멀티턴 대화로 요구사항 정제 후
    ```prompt 코드블록으로 최종 영문 프롬프트 제안. 사용자 확인 후 ai-generate 호출."""
    oc = get_openclaw()
    if not oc.configured:
        raise HTTPException(status_code=503, detail="OpenClaw 게이트웨이가 설정되지 않았습니다.")

    try:
        reply = await oc.chat_with_history(
            messages=[m.model_dump() for m in req.messages],
            reference_image_description=req.reference_image_description,
        )
    except OpenClawError as e:
        raise HTTPException(status_code=502, detail=f"대화 실패: {e}")

    final_prompt = _extract_prompt_block(reply)
    return AIChatResponse(reply=reply, final_prompt=final_prompt)


@router.post("/analyze-reference")
async def analyze_reference_image(
    file: UploadFile = File(...),
    _admin: AuthUser = Depends(get_admin_user),
):
    """참고 이미지 → ollama LLaVA → 영문 묘사. 채팅 진입 전 한 번만 호출."""
    vision = get_vision()
    if not vision.configured:
        raise HTTPException(status_code=503, detail="Ollama LLaVA 서버가 설정되지 않았습니다.")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="이미지 크기는 10MB 이하만 가능합니다.")

    try:
        description = await vision.describe_image(image_bytes)
    except OllamaVisionError as e:
        logger.error(f"LLaVA describe error: {e}")
        raise HTTPException(status_code=502, detail=f"이미지 분석 실패: {e}")

    return {"description": description, "model": vision.model}


# ══════════════════════════════════════════════════
# 참고 이미지 + img2img 콜라주 합성 (한국 음식 인식 약점 우회)
# ══════════════════════════════════════════════════
def _compose_reference_collage(images_bytes: List[bytes], target_size: tuple = (512, 512)) -> bytes:
    """N장의 참고 이미지를 1장의 콜라주로 합성.
    크기 결정: 512×512 — Flux model CPU offload 모드에서 1024×1024 img2img 가
    step 당 100s+ 로 매우 느림 (매 step VAE encode/decode + GPU↔CPU transfer 누적).
    512 면 step 당 10-15s. 결과를 더 크게 원하면 [HD/4K 업그레이드] 버튼 (Real-ESRGAN) 사용.
    Flux img2img init_image 로 사용 → LLaVA 묘사 부정확 / Flux 한국 음식 인식 약점을
    실제 이미지 픽셀로 우회. 단순한 균등 분할:
      n=1 → resize 만; n=2 → 좌우; n=3 → 가로 3분할; n=4 → 2x2; n≥5 → ⌈√n⌉ × ⌈n/cols⌉ 그리드."""
    import math
    from PIL import Image as PILImage
    pil_images = [PILImage.open(BytesIO(b)).convert("RGB") for b in images_bytes]
    n = len(pil_images)

    if n == 1:
        out = pil_images[0].resize(target_size, PILImage.LANCZOS)
    elif n == 2:
        w, h = target_size[0] // 2, target_size[1]
        out = PILImage.new("RGB", target_size, (255, 255, 255))
        for i, img in enumerate(pil_images):
            out.paste(img.resize((w, h), PILImage.LANCZOS), (i * w, 0))
    elif n == 3:
        w, h = target_size[0] // 3, target_size[1]
        out = PILImage.new("RGB", target_size, (255, 255, 255))
        for i, img in enumerate(pil_images):
            out.paste(img.resize((w, h), PILImage.LANCZOS), (i * w, 0))
    elif n == 4:
        w, h = target_size[0] // 2, target_size[1] // 2
        out = PILImage.new("RGB", target_size, (255, 255, 255))
        for i, img in enumerate(pil_images):
            row, col = i // 2, i % 2
            out.paste(img.resize((w, h), PILImage.LANCZOS), (col * w, row * h))
    else:
        cols = math.ceil(math.sqrt(n))
        rows = math.ceil(n / cols)
        w, h = target_size[0] // cols, target_size[1] // rows
        out = PILImage.new("RGB", target_size, (255, 255, 255))
        for i, img in enumerate(pil_images):
            row, col = i // cols, i % cols
            out.paste(img.resize((w, h), PILImage.LANCZOS), (col * w, row * h))

    buf = BytesIO()
    out.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@router.post("/ai-generate-with-refs")
async def ai_generate_with_refs(
    prompt: str = Form(...),
    name: str = Form("AI 생성 이미지"),
    category: str = Form("김밥류"),
    strength: float = Form(0.55),  # effective_steps = ceil(steps*strength) 작게 유지
    steps: int = Form(4),
    files: List[UploadFile] = File(...),
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    """N장 참고 이미지를 콜라주로 합성 → Flux img2img init_image → 새 이미지 생성.
    LLaVA 텍스트 묘사 대신 실제 이미지 픽셀을 baseline 으로 써서 한국 음식 등
    텍스트 인식이 약한 케이스에서 의도와 일치하는 결과를 얻기 위함."""
    if not files:
        raise HTTPException(status_code=400, detail="참고 이미지가 1장 이상 필요합니다.")
    if len(files) > 6:
        raise HTTPException(status_code=400, detail="참고 이미지는 최대 6장까지 가능합니다.")

    flux = get_flux()
    if not flux.configured:
        raise HTTPException(status_code=503, detail="Flux 이미지 서버가 설정되지 않았습니다.")

    # 1) 모든 참고 이미지 읽기
    images_bytes: list[bytes] = []
    for f in files:
        b = await f.read()
        if len(b) > 10 * 1024 * 1024:
            raise HTTPException(status_code=400, detail=f"{f.filename}: 이미지 크기는 10MB 이하만 가능합니다.")
        images_bytes.append(b)

    # 2) 콜라주 합성
    try:
        init_bytes = _compose_reference_collage(images_bytes)
    except Exception as e:
        logger.error(f"collage compose error: {e}")
        raise HTTPException(status_code=500, detail=f"참고 이미지 합성 실패: {e}")

    # 3) Flux img2img 호출 (영문 프롬프트는 채팅에서 이미 정제됨)
    try:
        image_bytes, headers = await flux.img2img(
            prompt=prompt,
            image_bytes=init_bytes,
            filename="reference_collage.png",
            content_type="image/png",
            strength=min(max(strength, 0.3), 0.85),
            steps=steps,
        )
    except FluxImageError as e:
        if "다른 작업 중" in str(e):
            raise HTTPException(status_code=429, detail=str(e))
        logger.error(f"Flux img2img with refs error: {e}")
        raise HTTPException(status_code=502, detail=f"이미지 생성 실패: {e}")

    # 4) storage 업로드
    storage = get_storage()
    timestamp = int(datetime.now().timestamp() * 1000)
    storage_key = f"delivery_images/ai_refs_{timestamp}.png"
    stored_url = storage.upload_file(BytesIO(image_bytes), storage_key, "image/png")

    # 5) DB
    img = DeliveryImage(
        business_id=bid,
        name=name,
        category=category,
        image_url=stored_url,
        storage_key=storage_key,
        source="ai_generated",
    )
    session.add(img)
    session.commit()
    session.refresh(img)

    return {
        "status": "success",
        "data": {
            "id": img.id,
            "name": img.name,
            "category": img.category,
            "image_url": img.image_url,
            "source": img.source,
            "provider": "openclaw+flux+refs",
            "ref_count": len(images_bytes),
            "strength": strength,
            "generation_time": headers.get("x-generation-time", ""),
        },
    }


# ── AI 상태 확인 ──
@router.get("/ai-status")
async def ai_status(_admin: AuthUser = Depends(get_admin_user)):
    oc = get_openclaw()
    flux = get_flux()
    oc_health = await oc.health()
    flux_health = await flux.health()
    enabled = bool(oc_health.get("reachable") and flux_health.get("reachable"))
    return {
        "status": "success",
        "ai_enabled": enabled,
        "provider": "openclaw+flux" if enabled else None,
        "provider_name": "OpenClaw GPT-5.5 + Flux.1-schnell" if enabled else "사용 불가",
        "openclaw": oc_health,
        "flux": flux_health,
    }


# ── 이미지 URL 프록시 (CORS 우회) ──
@router.get("/proxy-image")
async def proxy_image(url: str, _admin: AuthUser = Depends(get_admin_user)):
    """외부 이미지 URL을 프록시하여 CORS 문제 없이 프론트엔드에서 로드"""
    import httpx
    if not url.startswith(("http://", "https://")):
        raise HTTPException(status_code=400, detail="유효하지 않은 URL")
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                raise HTTPException(status_code=400, detail="이미지가 아닙니다")
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=400, detail="이미지를 불러올 수 없습니다")
