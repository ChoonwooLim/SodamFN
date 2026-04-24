import sys
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import stats, ocr, expense, hr, upload, payroll, auth, contract, settings, finance, profitloss, products, revenue, purchase, purchase_requests, emergency_contacts, announcements, suggestions, staff_chat, deploy, distribute, superadmin
from init_db import init_db

from fastapi.staticfiles import StaticFiles

from fastapi.middleware.gzip import GZipMiddleware

logger = logging.getLogger("sodam")

# --- Lifespan (replaces deprecated on_event) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    os.makedirs("uploads", exist_ok=True)
    yield
    # Shutdown (cleanup if needed)

app = FastAPI(title="Sodam Profit API", lifespan=lifespan)

# --- Global Exception Handler ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error on {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "서버 내부 오류가 발생했습니다. 관리자에게 문의하세요."}
    )

# Enable Gzip compression for responses > 1KB
app.add_middleware(GZipMiddleware, minimum_size=1000)

# Ensure uploads directory exists
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Allow CORS for local development and production
FRONTEND_URL = os.getenv("FRONTEND_URL", "")

cors_origins = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:5177",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:5174",
    "http://127.0.0.1:5175",
    "http://127.0.0.1:5176",
    "http://127.0.0.1:5177",
    # Cloudflare Pages / Orbitron production
    "https://sodam-staff.pages.dev",
    "https://sodamfn.twinverse.org",
]

# Add custom frontend URL from environment if set
if FRONTEND_URL:
    cors_origins.append(FRONTEND_URL)

STAFF_APP_URL = os.getenv("STAFF_APP_URL", "")
if STAFF_APP_URL:
    cors_origins.append(STAFF_APP_URL)

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router, prefix="/api")
app.include_router(hr.router, prefix="/api/hr")
app.include_router(payroll.router, prefix="/api/payroll")
app.include_router(finance.router, prefix="/api/finance")
app.include_router(ocr.router, prefix="/api")
app.include_router(expense.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")
app.include_router(contract.router, prefix="/api/contracts")
app.include_router(settings.router)
app.include_router(profitloss.router)
app.include_router(products.router)
app.include_router(revenue.router, prefix="/api/revenue")
app.include_router(purchase.router)
app.include_router(purchase_requests.router, prefix="/api")
app.include_router(emergency_contacts.router, prefix="/api")
app.include_router(announcements.router, prefix="/api")
app.include_router(suggestions.router, prefix="/api")
app.include_router(staff_chat.router, prefix="/api")
app.include_router(deploy.router, prefix="/api")
app.include_router(distribute.router, prefix="/api")

from routers import inventory_check
from routers import store_applications
from routers import delivery_images
from routers import promotions
app.include_router(inventory_check.router, prefix="/api")
app.include_router(superadmin.router, prefix="/api/superadmin")
app.include_router(store_applications.router, prefix="/api/store-applications")
app.include_router(delivery_images.router)
app.include_router(promotions.router)

from routers import worklog
app.include_router(worklog.router, prefix="/api/superadmin")

from routers import business_docs
app.include_router(business_docs.router, prefix="/api")

from routers import fax
app.include_router(fax.router, prefix="/api")

from routers import notifications
app.include_router(notifications.router, prefix="/api")

from routers import biz_check
app.include_router(biz_check.router, prefix="/api")

from routers import bank_sync
app.include_router(bank_sync.router, prefix="/api")

@app.get("/api/media/{path:path}")
async def serve_media(path: str):
    """미디어 서버 파일 프록시 (mixed content / 외부 접근 해결)"""
    media_url = os.getenv("MEDIA_SERVER_URL", "")
    if not media_url:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=404, content={"detail": "Media server not configured"})
    import httpx
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(f"{media_url}/files/{path}")
        if resp.status_code != 200:
            from fastapi.responses import JSONResponse
            return JSONResponse(status_code=resp.status_code, content={"detail": "File not found"})
    from fastapi.responses import Response
    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "application/octet-stream"),
        headers={"Cache-Control": "public, max-age=86400"},
    )

@app.get("/api/health")
def health_check():
    """배포 환경 진단용 health 엔드포인트"""
    from database import DATABASE_URL
    from sqlmodel import Session, text
    from database import engine
    # DB URL 마스킹 (비밀번호 숨김)
    masked_url = DATABASE_URL
    if "@" in masked_url:
        prefix = masked_url.split("://")[0]
        after_at = masked_url.split("@")[1]
        masked_url = f"{prefix}://***:***@{after_at}"
    # DB 연결 테스트
    db_ok = False
    db_error = None
    try:
        with Session(engine) as s:
            s.exec(text("SELECT 1"))
            db_ok = True
    except Exception as e:
        db_error = str(e)
    return {
        "status": "ok" if db_ok else "error",
        "database_url": masked_url,
        "database_connected": db_ok,
        "database_error": db_error,
        "superadmin_configured": bool(os.getenv("SUPERADMIN_PASSWORD")),
    }

@app.get("/")
def read_root():
    return {"message": "SodamFN Backend is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
