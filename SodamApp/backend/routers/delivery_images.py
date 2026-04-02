"""
배달앱 이미지 관리 API
- CRUD: 이미지 목록, 업로드, 삭제
- AI: 셀프호스팅 GPU (Flux.1-schnell) > Replicate > OpenAI 폴백
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from routers.auth import get_admin_user
from models import User as AuthUser, DeliveryImage, FoodTranslation
from sqlmodel import Session, select
from database import get_session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from tenant_filter import get_bid_from_token, apply_bid_filter
from services.storage_service import get_storage
import os
import logging

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
    bid=Depends(get_bid_from_token),
):
    img = session.get(DeliveryImage, image_id)
    if not img:
        raise HTTPException(status_code=404, detail="이미지를 찾을 수 없습니다.")

    # 스토리지에서 파일 삭제
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
    bid=Depends(get_bid_from_token),
):
    storage = get_storage()
    images = session.exec(
        select(DeliveryImage).where(DeliveryImage.id.in_(req.ids))
    ).all()
    for img in images:
        if img.storage_key:
            storage.delete_file(img.storage_key)
        session.delete(img)
    session.commit()
    return {"status": "success", "deleted": len(images)}


# ── AI 이미지 생성 ──
class AIGenerateRequest(BaseModel):
    prompt: str
    name: str = "AI 생성 이미지"
    category: str = "김밥류"
    style: str = "natural"  # natural, studio, minimal
    provider: str = "replicate"  # replicate, openai
    upscale: int = 4           # 1, 2, 4
    width: int = 512
    height: int = 512
    steps: int = 4
    seed: Optional[int] = None
    negative_prompt: Optional[str] = None
    reference_description: Optional[str] = None  # Text description of reference image
    skip_translation: bool = False  # True if prompt is already in English

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

# ── 한국어 음식명 → 영어 사전 (DB 기반, 캐시 사용) ──
_translation_cache: dict = {}
_cache_ts: float = 0

def _load_translations() -> dict:
    """DB에서 번역 사전 로드 (60초 캐시)"""
    global _translation_cache, _cache_ts
    import time
    now = time.time()
    if _translation_cache and (now - _cache_ts) < 60:
        return _translation_cache
    try:
        from database import engine
        with Session(engine) as session:
            rows = session.exec(
                select(FoodTranslation).where(FoodTranslation.is_active == True)
            ).all()
            _translation_cache = {r.korean: r.english for r in rows}
            _cache_ts = now
    except Exception as e:
        logger.warning(f"번역 사전 로드 실패, 캐시 사용: {e}")
    return _translation_cache


def _translate_prompt(korean_prompt: str) -> str:
    """한국어 프롬프트를 영어로 변환하여 Flux 모델 정확도 향상"""
    translations = _load_translations()
    prompt = korean_prompt.strip()

    # 1. Exact match
    if prompt in translations:
        return translations[prompt]

    # 2. Partial match (longest-first)
    translated_parts = []
    remaining = prompt
    for kr_name, en_desc in sorted(translations.items(), key=lambda x: len(x[0]), reverse=True):
        if kr_name in remaining:
            translated_parts.append(en_desc)
            remaining = remaining.replace(kr_name, "", 1)

    if translated_parts:
        result = ", ".join(translated_parts)
        remaining = remaining.strip().strip(",").strip()
        if remaining:
            result += f", ({remaining})"
        return result

    # 3. No match
    return f"Korean food dish: {prompt}, appetizing Korean cuisine"


def _build_prompt(translated: str, style: str, reference_description: str = None, negative_prompt: str = None) -> str:
    """최종 프롬프트 조합 - 음식 설명 우선, 스타일은 간결하게"""
    style_suffix = STYLE_SUFFIXES.get(style, STYLE_SUFFIXES["natural"])
    # 핵심: 음식 묘사가 최우선, 스타일은 짧게 뒤에
    parts = [translated, style_suffix]
    if reference_description:
        parts.insert(1, f"style reference: {reference_description}")
    prompt = ", ".join(parts)
    if negative_prompt:
        prompt += f". Avoid: {negative_prompt}"
    return prompt


def _get_ai_provider():
    """사용 가능한 AI 이미지 생성 프로바이더 확인 (우선순위: self-hosted > replicate > openai)"""
    gpu_server_url = os.getenv("AI_GPU_SERVER_URL")
    if gpu_server_url:
        return "self-hosted", gpu_server_url
    replicate_token = os.getenv("REPLICATE_API_TOKEN")
    openai_key = os.getenv("OPENAI_API_KEY")
    if replicate_token:
        return "replicate", replicate_token
    if openai_key:
        return "openai", openai_key
    return None, None


async def _generate_with_selfhosted(full_prompt: str, server_url: str, style: str = "natural", upscale: int = 4, width: int = 512, height: int = 512, steps: int = 4, seed: Optional[int] = None) -> bytes:
    """셀프호스팅 GPU 서버로 이미지 생성 (Flux.1-schnell + Real-ESRGAN 업스케일, 무료)"""
    import httpx

    payload = {
        "prompt": full_prompt,
        "style": style,
        "width": width,
        "height": height,
        "steps": steps,
        "upscale": upscale,
    }
    if seed is not None:
        payload["seed"] = seed

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{server_url}/generate",
            json=payload,
        )
        if response.status_code != 200:
            raise Exception(f"GPU 서버 오류: {response.status_code} {response.text[:200]}")
        return response.content  # PNG bytes


async def _generate_with_replicate(full_prompt: str, api_token: str) -> str:
    """Replicate API로 SDXL 이미지 생성 (비용: ~$0.005/장, 속도: 3~10초)"""
    import httpx

    async with httpx.AsyncClient(timeout=120.0) as client:
        # Replicate prediction 생성
        response = await client.post(
            "https://api.replicate.com/v1/predictions",
            headers={
                "Authorization": f"Bearer {api_token}",
                "Content-Type": "application/json",
            },
            json={
                "version": "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
                "input": {
                    "prompt": full_prompt,
                    "width": 1024,
                    "height": 1024,
                    "num_inference_steps": 4,
                    "guidance_scale": 0.0,
                    "num_outputs": 1,
                },
            },
        )
        if response.status_code != 201:
            raise Exception(f"Replicate API 오류: {response.status_code} {response.text}")

        prediction = response.json()
        prediction_url = prediction.get("urls", {}).get("get")

        if not prediction_url:
            raise Exception("Replicate prediction URL을 받지 못했습니다")

        # 폴링: 결과 대기 (최대 120초)
        for _ in range(60):
            poll = await client.get(
                prediction_url,
                headers={"Authorization": f"Bearer {api_token}"},
            )
            result = poll.json()
            status = result.get("status")

            if status == "succeeded":
                output = result.get("output")
                if isinstance(output, list) and output:
                    return output[0]
                raise Exception("Replicate 출력이 비어 있습니다")
            elif status == "failed":
                raise Exception(f"Replicate 생성 실패: {result.get('error', '알 수 없는 오류')}")

            import asyncio
            await asyncio.sleep(2)

        raise Exception("Replicate 생성 타임아웃 (120초 초과)")


async def _generate_with_openai(full_prompt: str, api_key: str) -> str:
    """OpenAI DALL-E 3로 이미지 생성 (비용: $0.04/장) — 비동기"""
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=api_key)
    response = await client.images.generate(
        model="dall-e-3",
        prompt=full_prompt,
        size="1024x1024",
        quality="standard",
        n=1,
    )
    return response.data[0].url


# ── 프롬프트 번역 (한국어 → 영어) ──
class TranslateRequest(BaseModel):
    prompt: str
    style: str = "natural"
    reference_description: Optional[str] = None
    negative_prompt: Optional[str] = None

@router.post("/translate-prompt")
def translate_prompt(req: TranslateRequest, _admin: AuthUser = Depends(get_admin_user)):
    translated = _translate_prompt(req.prompt)
    full_prompt = _build_prompt(translated, req.style, req.reference_description, req.negative_prompt)
    return {"translated": translated, "full_prompt": full_prompt}


@router.post("/ai-generate")
async def ai_generate_image(
    req: AIGenerateRequest,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    provider, api_key = _get_ai_provider()
    if not provider:
        raise HTTPException(
            status_code=503,
            detail="AI API 키가 설정되지 않았습니다. .env 파일에 REPLICATE_API_TOKEN 또는 OPENAI_API_KEY를 추가해주세요.",
        )

    if req.skip_translation:
        full_prompt = req.prompt
    else:
        translated = _translate_prompt(req.prompt)
        full_prompt = _build_prompt(translated, req.style, req.reference_description, req.negative_prompt)

    try:
        from io import BytesIO

        # 프로바이더별 이미지 생성
        if provider == "self-hosted":
            # GPU 서버에서 직접 PNG 바이너리 수신
            image_bytes = await _generate_with_selfhosted(
                full_prompt, api_key, req.style,
                upscale=req.upscale, width=req.width, height=req.height,
                steps=req.steps, seed=req.seed
            )
            storage = get_storage()
            timestamp = int(datetime.now().timestamp() * 1000)
            storage_key = f"delivery_images/ai_{timestamp}.png"
            file_data = BytesIO(image_bytes)
            stored_url = storage.upload_file(file_data, storage_key, "image/png")
        else:
            if provider == "replicate":
                ai_image_url = await _generate_with_replicate(full_prompt, api_key)
            else:
                ai_image_url = await _generate_with_openai(full_prompt, api_key)

            # 생성된 이미지를 스토리지에 저장
            import httpx

            async with httpx.AsyncClient(timeout=60.0) as http_client:
                img_response = await http_client.get(ai_image_url)
                if img_response.status_code != 200:
                    raise Exception("AI 이미지 다운로드 실패")

            storage = get_storage()
            timestamp = int(datetime.now().timestamp() * 1000)
            ext = "webp" if provider == "replicate" else "png"
            storage_key = f"delivery_images/ai_{timestamp}.{ext}"
            file_data = BytesIO(img_response.content)
            stored_url = storage.upload_file(file_data, storage_key, f"image/{ext}")

        # DB에 저장
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
                "provider": provider,
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI image generation error ({provider}): {e}")
        raise HTTPException(status_code=500, detail=f"AI 이미지 생성 실패: {str(e)}")


# ── AI 이미지 미리보기 (DB 저장 없이) ──
@router.post("/ai-preview")
async def ai_preview_image(
    req: AIGenerateRequest,
    _admin: AuthUser = Depends(get_admin_user),
):
    """AI 이미지 미리보기 (DB 저장 없이 이미지만 반환)"""
    provider, api_key = _get_ai_provider()
    if not provider:
        raise HTTPException(status_code=503, detail="AI API 키가 설정되지 않았습니다.")

    if req.skip_translation:
        full_prompt = req.prompt
    else:
        translated = _translate_prompt(req.prompt)
        full_prompt = _build_prompt(translated, req.style, req.reference_description, req.negative_prompt)

    try:
        if provider == "self-hosted":
            image_bytes = await _generate_with_selfhosted(
                full_prompt, api_key, req.style,
                upscale=req.upscale, width=req.width, height=req.height,
                steps=req.steps, seed=req.seed
            )
            from fastapi.responses import Response
            return Response(content=image_bytes, media_type="image/png")
        else:
            # For cloud providers, generate and return the URL
            if provider == "replicate":
                url = await _generate_with_replicate(full_prompt, api_key)
            else:
                url = await _generate_with_openai(full_prompt, api_key)
            return {"status": "success", "image_url": url, "provider": provider}
    except Exception as e:
        logger.error(f"AI preview error ({provider}): {e}")
        raise HTTPException(status_code=500, detail=f"AI 이미지 생성 실패: {str(e)}")


# ── 이미지 업스케일 (GPU 서버 프록시) ──
@router.post("/upscale")
async def upscale_image(
    file: UploadFile = File(...),
    scale: int = Form(4),
    _admin: AuthUser = Depends(get_admin_user),
):
    """이미지 업스케일 (GPU 서버 프록시)"""
    gpu_url = os.getenv("AI_GPU_SERVER_URL")
    if not gpu_url:
        raise HTTPException(status_code=503, detail="GPU 서버가 설정되지 않았습니다.")

    import httpx
    file_bytes = await file.read()

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"{gpu_url}/upscale",
            files={"file": (file.filename or "image.png", file_bytes, file.content_type or "image/png")},
            data={"scale": min(max(scale, 2), 4)},
        )
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"업스케일 실패: {response.text[:200]}")

    from fastapi.responses import Response
    return Response(
        content=response.content,
        media_type="image/png",
        headers={
            "X-Original-Size": response.headers.get("X-Original-Size", ""),
            "X-Output-Size": response.headers.get("X-Output-Size", ""),
            "X-Scale": response.headers.get("X-Scale", ""),
            "X-Upscale-Time": response.headers.get("X-Upscale-Time", ""),
        }
    )


# ── Image-to-Image 생성 (GPU 서버 프록시) ──
@router.post("/img2img")
async def img2img_generate(
    file: UploadFile = File(...),
    prompt: str = Form(...),
    strength: float = Form(0.75),
    steps: int = Form(4),
    seed: Optional[int] = Form(None),
    style: str = Form(""),
    _admin: AuthUser = Depends(get_admin_user),
):
    """이미지 + 프롬프트로 새 이미지 생성 (Image-to-Image)"""
    gpu_url = os.getenv("AI_GPU_SERVER_URL")
    if not gpu_url:
        raise HTTPException(status_code=503, detail="GPU 서버가 설정되지 않았습니다.")

    import httpx
    file_bytes = await file.read()

    form_data = {
        "prompt": prompt,
        "strength": str(min(max(strength, 0.1), 1.0)),
        "steps": str(steps),
        "style": style,
        "upscale": "1",
    }
    if seed is not None:
        form_data["seed"] = str(seed)

    async with httpx.AsyncClient(timeout=180.0) as client:
        response = await client.post(
            f"{gpu_url}/img2img",
            files={"file": (file.filename or "image.png", file_bytes, file.content_type or "image/png")},
            data=form_data,
        )
        if response.status_code == 429:
            raise HTTPException(status_code=429, detail="GPU 서버가 다른 작업 중입니다. 잠시 후 다시 시도해주세요.")
        if response.status_code != 200:
            raise HTTPException(status_code=500, detail=f"Img2Img 생성 실패: {response.text[:200]}")

    from fastapi.responses import Response
    return Response(
        content=response.content,
        media_type="image/png",
        headers={
            "X-Generation-Time": response.headers.get("X-Generation-Time", ""),
            "X-Seed": response.headers.get("X-Seed", ""),
            "X-Strength": response.headers.get("X-Strength", ""),
        },
    )


# ── AI 설정 상태 확인 ──
@router.get("/ai-status")
def ai_status(_admin: AuthUser = Depends(get_admin_user)):
    provider, _ = _get_ai_provider()
    return {
        "status": "success",
        "ai_enabled": provider is not None,
        "provider": provider,
        "provider_name": {"self-hosted": "셀프호스팅 GPU (Flux.1-schnell)", "replicate": "Replicate (SDXL Turbo)", "openai": "OpenAI (DALL-E 3)"}.get(provider, "없음"),
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
            from fastapi.responses import Response
            return Response(
                content=resp.content,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=3600"},
            )
    except httpx.HTTPError:
        raise HTTPException(status_code=400, detail="이미지를 불러올 수 없습니다")


# ══════════════════════════════════════════
# 음식 번역 사전 관리 CRUD
# ══════════════════════════════════════════

class FoodTranslationCreate(BaseModel):
    korean: str
    english: str
    category: str = "기타"

class FoodTranslationUpdate(BaseModel):
    korean: Optional[str] = None
    english: Optional[str] = None
    category: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/translations")
def list_translations(
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    rows = session.exec(
        select(FoodTranslation).order_by(FoodTranslation.category, FoodTranslation.korean)
    ).all()
    return [
        {
            "id": r.id, "korean": r.korean, "english": r.english,
            "category": r.category, "is_active": r.is_active,
            "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat(),
        }
        for r in rows
    ]

@router.post("/translations")
def create_translation(
    body: FoodTranslationCreate,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    existing = session.exec(
        select(FoodTranslation).where(FoodTranslation.korean == body.korean.strip())
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"'{body.korean}' 항목이 이미 존재합니다")
    entry = FoodTranslation(
        korean=body.korean.strip(),
        english=body.english.strip(),
        category=body.category,
    )
    session.add(entry)
    session.commit()
    session.refresh(entry)
    _invalidate_translation_cache()
    return {"id": entry.id, "korean": entry.korean, "english": entry.english, "category": entry.category}

@router.put("/translations/{tid}")
def update_translation(
    tid: int,
    body: FoodTranslationUpdate,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    entry = session.get(FoodTranslation, tid)
    if not entry:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다")
    if body.korean is not None:
        entry.korean = body.korean.strip()
    if body.english is not None:
        entry.english = body.english.strip()
    if body.category is not None:
        entry.category = body.category
    if body.is_active is not None:
        entry.is_active = body.is_active
    entry.updated_at = datetime.now()
    session.add(entry)
    session.commit()
    session.refresh(entry)
    _invalidate_translation_cache()
    return {"id": entry.id, "korean": entry.korean, "english": entry.english, "category": entry.category, "is_active": entry.is_active}

@router.delete("/translations/{tid}")
def delete_translation(
    tid: int,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
):
    entry = session.get(FoodTranslation, tid)
    if not entry:
        raise HTTPException(status_code=404, detail="항목을 찾을 수 없습니다")
    session.delete(entry)
    session.commit()
    _invalidate_translation_cache()
    return {"status": "deleted", "id": tid}

def _invalidate_translation_cache():
    global _translation_cache, _cache_ts
    _translation_cache = {}
    _cache_ts = 0
