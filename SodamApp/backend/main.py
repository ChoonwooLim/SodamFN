import sys
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import stats, ocr, expense, hr, upload, payroll, auth, contract, settings, finance, profitloss, products, revenue, purchase, purchase_requests, emergency_contacts, announcements
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
    # Render production
    "https://sodam-frontend.onrender.com",
    "https://sodamfn-frontend.onrender.com",
    "https://sodamfn.onrender.com",
]

# Add custom frontend URL from environment if set
if FRONTEND_URL:
    cors_origins.append(FRONTEND_URL)

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

@app.get("/")
def read_root():
    return {"message": "SodamFN Backend is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
