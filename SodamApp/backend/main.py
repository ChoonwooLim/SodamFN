import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import stats, ocr, expense, hr, upload, payroll, auth, contract, settings, finance, profitloss
from init_db import init_db

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Sodam Profit API")

@app.on_event("startup")
def on_startup():
    init_db()

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
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
        "http://127.0.0.1:5177"
    ],
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

@app.get("/")
def read_root():
    return {"message": "SodamFN Backend is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
