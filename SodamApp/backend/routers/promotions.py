"""
매장 홍보물 AI 제작 API
- 포스터/배너, SNS, 배달앱 이미지 AI 생성
- 나레이션(TTS) 생성
- 배경음악 생성
"""
import os
import json
import asyncio
import logging
import httpx
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response, StreamingResponse
from typing import Optional
from sqlmodel import Session, select
from database import engine, get_session
from models import PromoContent
from services.storage_service import get_storage
from routers.auth import get_admin_user, get_tenant_bid
from services.promotion_service import (
    POSTER_PRESETS, SNS_PRESETS, DELIVERY_PRESETS, TTS_PRESETS, MUSIC_PRESETS,
    get_all_presets, _find_image_preset, _build_image_prompt, _save_content_to_storage,
    ImageGenRequest, TTSGenRequest, MusicGenRequest,
)

logger = logging.getLogger("promotions")
router = APIRouter(prefix="/api/promotions", tags=["promotions"])


# ─────────────────────────────────────────────
# AI Service URLs
# ─────────────────────────────────────────────
def _gpu_url():
    return os.getenv("AI_GPU_SERVER_URL", "http://localhost:8100")

def _tts_url():
    return os.getenv("TTS_SERVER_URL", "http://localhost:8101")

def _music_url():
    return os.getenv("MUSIC_SERVER_URL", "http://localhost:8102")


# ─────────────────────────────────────────────
# Endpoints
# ─────────────────────────────────────────────

@router.get("/presets")
def get_presets(user=Depends(get_admin_user)):
    """전체 프리셋 목록 반환"""
    return get_all_presets()


@router.post("/generate-image")
async def generate_image(req: ImageGenRequest, user=Depends(get_admin_user)):
    """프리셋 기반 홍보 이미지 생성 (GPU 서버)"""
    # 프리셋 찾기
    all_img = POSTER_PRESETS + SNS_PRESETS + DELIVERY_PRESETS
    preset = next((p for p in all_img if p["id"] == req.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    # 프롬프트 구성
    prompt = req.custom_prompt or preset["prompt"]
    if req.product_name:
        prompt = f"{req.product_name}, {prompt}"
    if req.store_name:
        prompt = f"{prompt}, restaurant name: {req.store_name}"

    style = req.style or preset.get("style", "natural")
    width = req.width or preset.get("width", 1024)
    height = req.height or preset.get("height", 1024)

    gpu_server = _gpu_url()
    logger.info(f"Image gen: preset={req.preset_id} style={style} {width}x{height}")

    try:
        async with httpx.AsyncClient(timeout=180.0) as client:
            resp = await client.post(f"{gpu_server}/generate", json={
                "prompt": prompt,
                "style": style,
                "width": width,
                "height": height,
                "steps": 4,
                "upscale": 2,
            })
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"GPU 서버 오류: {resp.status_code}")
            return Response(
                content=resp.content,
                media_type="image/png",
                headers={"X-Preset-Id": req.preset_id},
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="GPU 서버에 연결할 수 없습니다")
    except httpx.ReadTimeout:
        raise HTTPException(status_code=504, detail="이미지 생성 시간 초과")


@router.post("/generate-tts")
async def generate_tts(req: TTSGenRequest, user=Depends(get_admin_user)):
    """프리셋 기반 나레이션 생성 (Edge-TTS)"""
    preset = next((p for p in TTS_PRESETS if p["id"] == req.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    # 스크립트 구성
    text = req.custom_text or preset["script"].replace("{store_name}", req.store_name)
    voice = req.voice or preset.get("voice", "ko-KR-SunHiNeural")

    tts_server = _tts_url()
    logger.info(f"TTS gen: preset={req.preset_id} voice={voice} len={len(text)}")

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.post(f"{tts_server}/tts", json={
                "text": text,
                "voice": voice,
                "speed": req.speed,
            })
            if resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"TTS 서버 오류: {resp.status_code}")
            return Response(
                content=resp.content,
                media_type="audio/mpeg",
                headers={
                    "X-Preset-Id": req.preset_id,
                    "X-Voice": voice,
                },
            )
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="TTS 서버에 연결할 수 없습니다")


@router.post("/generate-music")
async def generate_music(req: MusicGenRequest, user=Depends(get_admin_user)):
    """프리셋 기반 배경음악 생성 (ACE-Step)"""
    preset = next((p for p in MUSIC_PRESETS if p["id"] == req.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    prompt = req.custom_prompt or preset.get("prompt", "")
    tags = preset.get("tags", "")
    duration = req.duration or preset.get("duration", 30)

    music_server = _music_url()
    logger.info(f"Music gen: preset={req.preset_id} duration={duration}s")

    try:
        import asyncio

        # 1) 태스크 등록
        async with httpx.AsyncClient(timeout=30.0) as client:
            task_resp = await client.post(f"{music_server}/release_task", json={
                "caption": prompt,
                "lyrics": "[inst]",
                "task_id": None,
                "instrumental": True,
                "duration": duration,
                "tags": tags,
            })
            if task_resp.status_code != 200:
                raise HTTPException(status_code=502, detail=f"음악 서버 태스크 생성 실패: {task_resp.status_code}")

            task_data = task_resp.json()
            job_id = task_data.get("data", {}).get("task_id") or task_data.get("data", {}).get("job_id")
            if not job_id:
                raise HTTPException(status_code=502, detail="음악 서버에서 작업 ID를 받지 못했습니다")

        # 2) 결과 폴링 (최대 5분)
        for i in range(60):
            await asyncio.sleep(5)
            async with httpx.AsyncClient(timeout=30.0) as client:
                poll_resp = await client.post(f"{music_server}/query_result", json={
                    "task_id": [job_id],
                })
                if poll_resp.status_code != 200:
                    continue
                result = poll_resp.json()
                results = result.get("data", {}).get("results", [])
                if results and results[0].get("status") == "completed":
                    audio_path = results[0].get("audio_path", "")
                    if audio_path:
                        # 오디오 파일 다운로드
                        audio_resp = await client.get(
                            f"{music_server}/v1/audio",
                            params={"path": audio_path},
                        )
                        if audio_resp.status_code == 200:
                            return Response(
                                content=audio_resp.content,
                                media_type="audio/wav",
                                headers={"X-Preset-Id": req.preset_id},
                            )
                elif results and results[0].get("status") == "failed":
                    error_msg = results[0].get("error", "알 수 없는 오류")
                    raise HTTPException(status_code=500, detail=f"음악 생성 실패: {error_msg}")

        raise HTTPException(status_code=504, detail="음악 생성 시간 초과 (5분)")

    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="음악 서버에 연결할 수 없습니다")


# ─────────────────────────────────────────────
# SSE 스트리밍 생성 (실시간 진행 상태 피드백)
# ─────────────────────────────────────────────

def _sse(event: str, data: dict) -> str:
    """SSE 이벤트 포맷"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


@router.post("/generate-image-stream")
async def generate_image_stream(req: ImageGenRequest, user=Depends(get_admin_user)):
    """이미지 생성 + 실시간 진행 상태 SSE 스트림 + 자동 저장"""
    preset = _find_image_preset(req.preset_id)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    bid = get_tenant_bid(user)
    prompt = _build_image_prompt(req, preset)
    style = req.style or preset.get("style", "natural")
    width = req.width or preset.get("width", 1024)
    height = req.height or preset.get("height", 1024)
    category = "poster"
    for cat, presets_list in [("poster", POSTER_PRESETS), ("sns", SNS_PRESETS), ("delivery", DELIVERY_PRESETS)]:
        if any(p["id"] == req.preset_id for p in presets_list):
            category = cat
            break

    async def stream():
        yield _sse("progress", {"step": "generating", "message": "AI 이미지 생성 중...", "progress": 10})

        try:
            async with httpx.AsyncClient(timeout=180.0) as client:
                yield _sse("progress", {"step": "generating", "message": "GPU 서버에서 이미지 렌더링 중...", "progress": 30})
                resp = await client.post(f"{_gpu_url()}/generate", json={
                    "prompt": prompt, "style": style,
                    "width": width, "height": height,
                    "steps": 4, "upscale": 2,
                })
                if resp.status_code != 200:
                    yield _sse("error", {"message": f"GPU 서버 오류: {resp.status_code}"})
                    return
                image_bytes = resp.content
        except httpx.ConnectError:
            yield _sse("error", {"message": "GPU 서버에 연결할 수 없습니다"})
            return
        except httpx.ReadTimeout:
            yield _sse("error", {"message": "이미지 생성 시간 초과 (3분)"})
            return

        yield _sse("progress", {"step": "saving", "message": "서버에 저장 중...", "progress": 80})

        try:
            url, storage_key = _save_content_to_storage(image_bytes, category, req.preset_id, "png")
        except Exception as e:
            yield _sse("error", {"message": f"저장 실패: {str(e)}"})
            return

        with Session(engine) as session:
            record = PromoContent(
                business_id=bid, category=category,
                preset_id=req.preset_id, preset_name=preset["name"],
                content_type="image", file_url=url,
                storage_key=storage_key, file_format="png",
                file_size=len(image_bytes),
            )
            session.add(record)
            session.commit()
            session.refresh(record)

        yield _sse("complete", {
            "file_url": url, "id": record.id,
            "preset_name": preset["name"], "category": category,
            "content_type": "image", "file_format": "png",
            "file_size": len(image_bytes),
            "created_at": record.created_at.isoformat(),
        })

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/generate-tts-stream")
async def generate_tts_stream(req: TTSGenRequest, user=Depends(get_admin_user)):
    """TTS 나레이션 생성 + SSE 스트림 + 자동 저장"""
    preset = next((p for p in TTS_PRESETS if p["id"] == req.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    bid = get_tenant_bid(user)
    text = req.custom_text or preset["script"].replace("{store_name}", req.store_name)
    voice = req.voice or preset.get("voice", "ko-KR-SunHiNeural")

    async def stream():
        yield _sse("progress", {"step": "generating", "message": "나레이션 음성 합성 중...", "progress": 20})

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                resp = await client.post(f"{_tts_url()}/tts", json={
                    "text": text, "voice": voice, "speed": req.speed,
                })
                if resp.status_code != 200:
                    yield _sse("error", {"message": f"TTS 서버 오류: {resp.status_code}"})
                    return
                audio_bytes = resp.content
        except httpx.ConnectError:
            yield _sse("error", {"message": "TTS 서버에 연결할 수 없습니다"})
            return

        yield _sse("progress", {"step": "saving", "message": "서버에 저장 중...", "progress": 80})

        try:
            url, storage_key = _save_content_to_storage(audio_bytes, "tts", req.preset_id, "mp3")
        except Exception as e:
            yield _sse("error", {"message": f"저장 실패: {str(e)}"})
            return

        with Session(engine) as session:
            record = PromoContent(
                business_id=bid, category="tts",
                preset_id=req.preset_id, preset_name=preset["name"],
                content_type="audio", file_url=url,
                storage_key=storage_key, file_format="mp3",
                file_size=len(audio_bytes),
            )
            session.add(record)
            session.commit()
            session.refresh(record)

        yield _sse("complete", {
            "file_url": url, "id": record.id,
            "preset_name": preset["name"], "category": "tts",
            "content_type": "audio", "file_format": "mp3",
            "file_size": len(audio_bytes),
            "created_at": record.created_at.isoformat(),
        })

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.post("/generate-music-stream")
async def generate_music_stream(req: MusicGenRequest, user=Depends(get_admin_user)):
    """배경음악 생성 + SSE 스트림 (실시간 폴링 상태) + 자동 저장"""
    preset = next((p for p in MUSIC_PRESETS if p["id"] == req.preset_id), None)
    if not preset:
        raise HTTPException(status_code=400, detail=f"프리셋을 찾을 수 없습니다: {req.preset_id}")

    bid = get_tenant_bid(user)
    prompt = req.custom_prompt or preset.get("prompt", "")
    tags = preset.get("tags", "")
    duration = req.duration or preset.get("duration", 30)

    async def stream():
        yield _sse("progress", {"step": "submitting", "message": "음악 생성 작업 등록 중...", "progress": 5})

        # 1) 태스크 등록
        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                task_resp = await client.post(f"{_music_url()}/release_task", json={
                    "caption": prompt, "lyrics": "[inst]",
                    "task_id": None, "instrumental": True,
                    "duration": duration, "tags": tags,
                })
                if task_resp.status_code != 200:
                    yield _sse("error", {"message": f"음악 서버 태스크 생성 실패: {task_resp.status_code}"})
                    return
                task_data = task_resp.json()
                job_id = task_data.get("data", {}).get("task_id") or task_data.get("data", {}).get("job_id")
                if not job_id:
                    yield _sse("error", {"message": "음악 서버에서 작업 ID를 받지 못했습니다"})
                    return
        except httpx.ConnectError:
            yield _sse("error", {"message": "음악 서버에 연결할 수 없습니다"})
            return

        yield _sse("progress", {"step": "composing", "message": "AI가 음악을 작곡하고 있습니다...", "progress": 10})

        # 2) 결과 폴링 (최대 5분, 5초 간격)
        audio_bytes = None
        for i in range(60):
            await asyncio.sleep(5)
            poll_progress = min(10 + int((i / 60) * 75), 85)
            elapsed = (i + 1) * 5
            yield _sse("progress", {
                "step": "composing",
                "message": f"음악 작곡 중... ({elapsed}초 경과)",
                "progress": poll_progress,
            })

            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    poll_resp = await client.post(f"{_music_url()}/query_result", json={"task_id": [job_id]})
                    if poll_resp.status_code != 200:
                        continue
                    result = poll_resp.json()
                    results = result.get("data", {}).get("results", [])
                    if not results:
                        continue

                    status = results[0].get("status", "")
                    if status == "completed":
                        audio_path = results[0].get("audio_path", "")
                        if audio_path:
                            yield _sse("progress", {"step": "downloading", "message": "오디오 파일 다운로드 중...", "progress": 88})
                            audio_resp = await client.get(f"{_music_url()}/v1/audio", params={"path": audio_path})
                            if audio_resp.status_code == 200:
                                audio_bytes = audio_resp.content
                                break
                    elif status == "failed":
                        error_msg = results[0].get("error", "알 수 없는 오류")
                        yield _sse("error", {"message": f"음악 생성 실패: {error_msg}"})
                        return
            except Exception:
                continue

        if audio_bytes is None:
            yield _sse("error", {"message": "음악 생성 시간 초과 (5분)"})
            return

        # 3) 스토리지 저장
        yield _sse("progress", {"step": "saving", "message": "서버에 저장 중...", "progress": 92})

        try:
            url, storage_key = _save_content_to_storage(audio_bytes, "music", req.preset_id, "wav")
        except Exception as e:
            yield _sse("error", {"message": f"저장 실패: {str(e)}"})
            return

        with Session(engine) as session:
            record = PromoContent(
                business_id=bid, category="music",
                preset_id=req.preset_id, preset_name=preset["name"],
                content_type="audio", file_url=url,
                storage_key=storage_key, file_format="wav",
                file_size=len(audio_bytes),
            )
            session.add(record)
            session.commit()
            session.refresh(record)

        yield _sse("complete", {
            "file_url": url, "id": record.id,
            "preset_name": preset["name"], "category": "music",
            "content_type": "audio", "file_format": "wav",
            "file_size": len(audio_bytes),
            "created_at": record.created_at.isoformat(),
        })

    return StreamingResponse(stream(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


@router.get("/ai-status")
async def ai_status(user=Depends(get_admin_user)):
    """모든 AI 서비스 상태 확인"""
    status = {"gpu": None, "tts": None, "music": None}

    async with httpx.AsyncClient(timeout=5.0) as client:
        # GPU 서버
        try:
            r = await client.get(f"{_gpu_url()}/health")
            status["gpu"] = {"online": True, **r.json()} if r.status_code == 200 else {"online": False}
        except Exception:
            status["gpu"] = {"online": False}

        # TTS 서버
        try:
            r = await client.get(f"{_tts_url()}/health")
            status["tts"] = {"online": True, **r.json()} if r.status_code == 200 else {"online": False}
        except Exception:
            status["tts"] = {"online": False}

        # 음악 서버
        try:
            r = await client.get(f"{_music_url()}/health")
            d = r.json() if r.status_code == 200 else {}
            status["music"] = {"online": True, **(d.get("data", d))} if r.status_code == 200 else {"online": False}
        except Exception:
            status["music"] = {"online": False}

    return status


# ─────────────────────────────────────────────
# 생성 결과 영구 저장 / 목록 / 삭제
# ─────────────────────────────────────────────

@router.post("/save")
async def save_content(
    category: str = Form(...),
    preset_id: str = Form(...),
    preset_name: str = Form(...),
    content_type: str = Form(...),  # image | audio
    file_format: str = Form("png"),
    file: UploadFile = File(...),
    user=Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """생성된 콘텐츠를 스토리지에 영구 저장"""
    bid = get_tenant_bid(user)
    file_bytes = await file.read()
    file_size = len(file_bytes)

    try:
        url, storage_key = _save_content_to_storage(file_bytes, category, preset_id, file_format)
    except Exception as e:
        logger.error(f"Storage upload failed: {e}")
        raise HTTPException(status_code=500, detail=f"파일 저장 실패: {str(e)}")

    record = PromoContent(
        business_id=bid,
        category=category,
        preset_id=preset_id,
        preset_name=preset_name,
        content_type=content_type,
        file_url=url,
        storage_key=storage_key,
        file_format=file_format,
        file_size=file_size,
    )
    session.add(record)
    session.commit()
    session.refresh(record)

    return {
        "id": record.id,
        "file_url": record.file_url,
        "preset_name": record.preset_name,
        "category": record.category,
        "content_type": record.content_type,
        "file_format": record.file_format,
        "file_size": record.file_size,
        "created_at": record.created_at.isoformat(),
    }


@router.get("/history")
def list_history(
    category: Optional[str] = None,
    limit: int = 30,
    user=Depends(get_admin_user),
    session: Session = Depends(get_session),
):
    """저장된 홍보물 히스토리 조회"""
    bid = get_tenant_bid(user)
    stmt = select(PromoContent).order_by(PromoContent.created_at.desc())
    if bid:
        stmt = stmt.where(PromoContent.business_id == bid)
    if category:
        stmt = stmt.where(PromoContent.category == category)
    stmt = stmt.limit(limit)
    items = session.exec(stmt).all()

    return [
        {
            "id": item.id,
            "category": item.category,
            "preset_id": item.preset_id,
            "preset_name": item.preset_name,
            "content_type": item.content_type,
            "file_url": item.file_url,
            "file_format": item.file_format,
            "file_size": item.file_size,
            "created_at": item.created_at.isoformat(),
        }
        for item in items
    ]


@router.delete("/history/{content_id}")
def delete_content(content_id: int, user=Depends(get_admin_user), session: Session = Depends(get_session)):
    """저장된 홍보물 삭제"""
    bid = get_tenant_bid(user)
    item = session.get(PromoContent, content_id)
    if not item:
        raise HTTPException(status_code=404, detail="콘텐츠를 찾을 수 없습니다")
    if bid and item.business_id != bid:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 스토리지에서 파일 삭제
    if item.storage_key:
        try:
            storage = get_storage()
            storage.delete_file(item.storage_key)
        except Exception as e:
            logger.warning(f"Storage delete failed: {e}")

    session.delete(item)
    session.commit()

    return {"ok": True}
