"""
배달앱 이미지 관리 API
- CRUD: 이미지 목록, 업로드, 삭제
- AI: 셀프호스팅 GPU (Flux.1-schnell) > Replicate > OpenAI 폴백
"""
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from routers.auth import get_admin_user
from models import User as AuthUser, DeliveryImage
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

STYLE_SUFFIXES = {
    "natural": "professional food photography, natural lighting, appetizing presentation, top-down angle, Korean restaurant style, clean white plate background",
    "studio": "studio food photography, dramatic lighting, dark background, professional plating, high-end restaurant quality, shallow depth of field",
    "minimal": "minimal flat lay food photography, bright clean background, modern styling, negative space, Instagram-worthy composition",
}

# ── 한국어 음식명 → 영어 설명 사전 (Flux.1-schnell 정확도 향상) ──
FOOD_TRANSLATIONS = {
    # 김밥류
    "김밥": "Korean gimbap (kimbap) sushi roll wrapped in seaweed with rice and fillings, sliced to show cross-section",
    "참치김밥": "Korean tuna gimbap roll with tuna mayo, rice, and vegetables wrapped in seaweed, sliced cross-section view",
    "불고기김밥": "Korean bulgogi beef gimbap roll with marinated beef, rice, and vegetables in seaweed wrap",
    "치즈김밥": "Korean cheese gimbap roll with melted cheese, rice, and vegetables in seaweed wrap",
    "소담김밥": "Korean premium gimbap roll with assorted fillings, rice, and vegetables in seaweed",
    "꼬마김밥": "Korean mini gimbap (kkoma gimbap) bite-sized rolls, cute small seaweed rice rolls",
    "스팸김밥": "Korean spam gimbap roll with grilled spam, rice, and vegetables in seaweed",
    "야채김밥": "Korean vegetable gimbap roll with various fresh vegetables, rice, in seaweed wrap",
    "당근라페김밥": "Korean carrot rapé gimbap with shredded carrot, rice in seaweed wrap",
    "멸치김밥": "Korean anchovy gimbap roll with stir-fried anchovies, rice in seaweed",
    # 분식류
    "떡볶이": "Korean tteokbokki, spicy stir-fried rice cakes in red gochujang sauce",
    "치즈떡볶이": "Korean cheese tteokbokki, spicy rice cakes topped with melted mozzarella cheese",
    "라면": "Korean Shin Ramyeon style instant noodles in small aluminum pot, curly yellow instant noodle in red spicy broth, with egg and chopped green onions on top, typical Korean convenience store ramyeon",
    "치즈라면": "Korean Shin Ramyeon style instant noodles with a square yellow American cheese slice melting on top, curly yellow instant noodle in small aluminum pot, red spicy broth, Korean convenience store cheese ramyeon",
    "라볶이": "Korean rabokki, spicy rice cakes mixed with curly yellow instant ramen noodles in gochujang sauce",
    "순대": "Korean sundae (blood sausage), sliced to show glass noodle filling, served with salt",
    "어묵": "Korean fish cake (eomuk) skewers in warm broth",
    "튀김": "Korean fried snacks (twigim), assorted tempura-style fried vegetables and seafood",
    "유부초밥": "Korean inari sushi (yubu chobap), seasoned fried tofu pouches stuffed with rice",
    "삶은계란": "Korean boiled eggs, halved to show yolk, simple side dish",
    # 주먹밥류
    "주먹밥": "Korean rice ball (jumeokbap), triangle or round shaped onigiri-style rice ball",
    "스팸주먹밥": "Korean spam rice ball with grilled spam inside, wrapped in seaweed",
    "불고기주먹밥": "Korean bulgogi rice ball with marinated beef, triangle shaped",
    "참치주먹밥": "Korean tuna mayo rice ball, triangle shaped wrapped in seaweed",
    # 음료류
    "생수": "bottled water, clear plastic water bottle",
    "콜라": "Coca-Cola can or glass with ice",
    "사이다": "Korean Chilsung Cider, clear lemon-lime soda",
    "커피": "iced Americano coffee in clear cup",
    # 세트메뉴
    "소담세트": "Korean meal set with gimbap rolls, tteokbokki, and sundae on tray",
}


def _translate_prompt(korean_prompt: str) -> str:
    """한국어 프롬프트를 영어로 변환하여 Flux 모델 정확도 향상"""
    prompt = korean_prompt.strip()

    # 1. Check exact match first
    if prompt in FOOD_TRANSLATIONS:
        return FOOD_TRANSLATIONS[prompt]

    # 2. Check if any food name is contained in the prompt
    translated_parts = []
    remaining = prompt
    for kr_name, en_desc in sorted(FOOD_TRANSLATIONS.items(), key=lambda x: len(x[0]), reverse=True):
        if kr_name in remaining:
            translated_parts.append(en_desc)
            remaining = remaining.replace(kr_name, "", 1)

    if translated_parts:
        # Combine translations with any remaining Korean context hints
        result = ", ".join(translated_parts)
        remaining = remaining.strip().strip(",").strip()
        if remaining:
            result += f", ({remaining})"
        return result

    # 3. No match - add generic Korean food context
    return f"Korean food dish: {prompt}, appetizing Korean cuisine"


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

    translated = _translate_prompt(req.prompt)
    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{translated}. {style_suffix}"
    if req.reference_description:
        full_prompt = f"{translated}, similar style to: {req.reference_description}. {style_suffix}"
    if req.negative_prompt:
        full_prompt += f". Avoid: {req.negative_prompt}"

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

    translated = _translate_prompt(req.prompt)
    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{translated}. {style_suffix}"
    if req.reference_description:
        full_prompt = f"{translated}, similar style to: {req.reference_description}. {style_suffix}"
    if req.negative_prompt:
        full_prompt += f". Avoid: {req.negative_prompt}"

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
