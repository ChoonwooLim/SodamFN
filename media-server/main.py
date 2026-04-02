"""
소담김밥 미디어 서버
- 모든 이미지/미디어 파일을 중앙 집중 관리
- FastAPI + StaticFiles 기반
- GET  /files/{path}   — 파일 서빙
- POST /upload          — 파일 업로드
- DELETE /files/{path}  — 파일 삭제
- GET  /health          — 상태 확인
"""
import os
import shutil
import logging
from pathlib import Path
from datetime import datetime

from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Header
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# ── 설정 ──
MEDIA_ROOT = os.getenv("MEDIA_ROOT", "/home/stevenlim/WORK/media-files")
API_KEY = os.getenv("MEDIA_API_KEY", "sodam-media-2026")
PORT = int(os.getenv("MEDIA_PORT", "8200"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger("media-server")

app = FastAPI(title="Sodam Media Server", docs_url="/docs")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-File-Size", "X-File-Path"],
)

# 미디어 루트 생성
Path(MEDIA_ROOT).mkdir(parents=True, exist_ok=True)
for sub in ["products", "branding", "uploads/delivery_images", "uploads/logos",
            "uploads/product_images", "uploads/staff_docs", "icons"]:
    Path(MEDIA_ROOT, sub).mkdir(parents=True, exist_ok=True)


def _verify_key(x_api_key: str = Header(None)):
    """업로드/삭제 시 API 키 검증"""
    if x_api_key != API_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")


def _safe_path(rel_path: str) -> Path:
    """경로 탈출 방지"""
    full = Path(MEDIA_ROOT, rel_path).resolve()
    if not str(full).startswith(str(Path(MEDIA_ROOT).resolve())):
        raise HTTPException(status_code=400, detail="Invalid path")
    return full


# ── 파일 서빙 (GET) ──
@app.get("/files/{file_path:path}")
async def get_file(file_path: str):
    full = _safe_path(file_path)
    if not full.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(full)


# ── 파일 업로드 (POST) ──
@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    path: str = Form(...),
    x_api_key: str = Header(None),
):
    _verify_key(x_api_key)

    full = _safe_path(path)
    full.parent.mkdir(parents=True, exist_ok=True)

    with open(full, "wb") as f:
        shutil.copyfileobj(file.file, f)

    file_size = full.stat().st_size
    logger.info(f"Uploaded: {path} ({file_size} bytes)")

    return JSONResponse(
        content={"status": "success", "path": path, "size": file_size},
        headers={"X-File-Size": str(file_size), "X-File-Path": path},
    )


# ── 파일 삭제 (DELETE) ──
@app.delete("/files/{file_path:path}")
async def delete_file(file_path: str, x_api_key: str = Header(None)):
    _verify_key(x_api_key)

    full = _safe_path(file_path)
    if not full.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    full.unlink()
    logger.info(f"Deleted: {file_path}")
    return {"status": "success"}


# ── 디렉토리 목록 ──
@app.get("/list/{dir_path:path}")
async def list_dir(dir_path: str = ""):
    full = _safe_path(dir_path) if dir_path else Path(MEDIA_ROOT)
    if not full.is_dir():
        raise HTTPException(status_code=404, detail="Directory not found")

    items = []
    for item in sorted(full.iterdir()):
        rel = str(item.relative_to(MEDIA_ROOT)).replace("\\", "/")
        items.append({
            "name": item.name,
            "path": rel,
            "type": "dir" if item.is_dir() else "file",
            "size": item.stat().st_size if item.is_file() else None,
        })
    return {"status": "success", "path": dir_path, "items": items}


# ── 헬스 체크 ──
@app.get("/health")
async def health():
    total, used, free = shutil.disk_usage(MEDIA_ROOT)
    return {
        "status": "ok",
        "media_root": MEDIA_ROOT,
        "disk_total_gb": round(total / 1e9, 1),
        "disk_used_gb": round(used / 1e9, 1),
        "disk_free_gb": round(free / 1e9, 1),
    }


@app.get("/")
async def root():
    return {
        "service": "Sodam Media Server",
        "endpoints": ["/files/{path}", "/upload", "/list/{path}", "/health"],
    }


# ── 정적 파일 마운트 (폴백) ──
app.mount("/static", StaticFiles(directory=MEDIA_ROOT), name="static")

if __name__ == "__main__":
    logger.info(f"Media server starting on port {PORT}, root: {MEDIA_ROOT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
