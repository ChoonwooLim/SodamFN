"""
배달앱 이미지 관리 API
- CRUD: 이미지 목록, 업로드, 삭제
- AI: OpenAI DALL-E 기반 이미지 생성
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
    deleted = 0
    storage = get_storage()
    for img_id in req.ids:
        img = session.get(DeliveryImage, img_id)
        if img:
            if img.storage_key:
                storage.delete_file(img.storage_key)
            session.delete(img)
            deleted += 1
    session.commit()
    return {"status": "success", "deleted": deleted}


# ── AI 이미지 생성 ──
class AIGenerateRequest(BaseModel):
    prompt: str
    name: str = "AI 생성 이미지"
    category: str = "김밥류"
    style: str = "natural"  # natural, studio, minimal

STYLE_SUFFIXES = {
    "natural": "professional food photography, natural lighting, appetizing presentation, top-down angle, Korean restaurant style, clean white plate background",
    "studio": "studio food photography, dramatic lighting, dark background, professional plating, high-end restaurant quality, shallow depth of field",
    "minimal": "minimal flat lay food photography, bright clean background, modern styling, negative space, Instagram-worthy composition",
}

@router.post("/ai-generate")
async def ai_generate_image(
    req: AIGenerateRequest,
    session: Session = Depends(get_session),
    _admin: AuthUser = Depends(get_admin_user),
    bid=Depends(get_bid_from_token),
):
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(
            status_code=503,
            detail="OPENAI_API_KEY가 설정되지 않았습니다. .env 파일에 추가해주세요.",
        )

    style_suffix = STYLE_SUFFIXES.get(req.style, STYLE_SUFFIXES["natural"])
    full_prompt = f"{req.prompt}. {style_suffix}"

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key)
        response = client.images.generate(
            model="dall-e-3",
            prompt=full_prompt,
            size="1024x1024",
            quality="standard",
            n=1,
        )

        ai_image_url = response.data[0].url

        # AI 생성 이미지를 스토리지에 저장
        import httpx

        async with httpx.AsyncClient() as http_client:
            img_response = await http_client.get(ai_image_url)
            if img_response.status_code != 200:
                raise Exception("AI 이미지 다운로드 실패")

        from io import BytesIO

        storage = get_storage()
        timestamp = int(datetime.now().timestamp() * 1000)
        storage_key = f"delivery_images/ai_{timestamp}.png"
        file_data = BytesIO(img_response.content)
        stored_url = storage.upload_file(file_data, storage_key, "image/png")

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
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"AI image generation error: {e}")
        raise HTTPException(status_code=500, detail=f"AI 이미지 생성 실패: {str(e)}")


# ── AI 설정 상태 확인 ──
@router.get("/ai-status")
def ai_status(_admin: AuthUser = Depends(get_admin_user)):
    has_key = bool(os.getenv("OPENAI_API_KEY"))
    return {"status": "success", "ai_enabled": has_key}
