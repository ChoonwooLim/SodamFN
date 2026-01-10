import sys
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from routers import stats, ocr, expense, hr, upload, payroll

from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Sodam Profit API")

# Ensure uploads directory exists
os.makedirs("uploads", exist_ok=True)
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Allow CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(stats.router, prefix="/api")
app.include_router(hr.router, prefix="/api/hr")
app.include_router(payroll.router, prefix="/api/payroll")
app.include_router(ocr.router, prefix="/api")
app.include_router(expense.router, prefix="/api")
app.include_router(upload.router, prefix="/api")

@app.get("/")
def read_root():
    return {"message": "SodamFN Backend is running"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
