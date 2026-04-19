"""Startup wrapper: imports FastAPI app from main.py and adds React SPA serving."""
import os

from main import app
from fastapi import Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException

STATIC = "/app/static"
STAFF_STATIC = "/app/staff-static"

# ── Cache-Control Middleware ──
# 브라우저가 새로고침 없이도 항상 최신 빌드를 받도록 설정
# - HTML / 루트: max-age=0 → 매번 서버에 재확인 (304로 빠르게 응답)
# - /assets/* (해시 포함 번들): 1년 캐시 (파일명이 바뀌면 자동 갱신)
# - 기타 정적 파일: max-age=0 → 매번 재확인
@app.middleware("http")
async def cache_control_middleware(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path

    # API, uploads, docs 등은 각자 고유 헤더 사용 → 건드리지 않음
    if path.startswith(("/api/", "/uploads/", "/docs", "/openapi", "/redoc")):
        return response

    # Vite 빌드 산출물: /assets/index-Ab3Cd4Ef.js 등 해시 포함 → 1년 immutable
    if "/assets/" in path:
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"
    else:
        # index.html, manifest.json, 아이콘 등 → 항상 서버 재확인
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"

    return response

# ── Staff App (served at /staff/) ──
if os.path.isdir(STAFF_STATIC) and os.path.isfile(os.path.join(STAFF_STATIC, "index.html")):
    # Mount staff-app known subdirectories
    for d in ["assets", "icons", "images"]:
        dp = os.path.join(STAFF_STATIC, d)
        if os.path.isdir(dp):
            app.mount(f"/staff/{d}", StaticFiles(directory=dp), name=f"staff-{d}")

    # Staff-app root-level static files
    for fname in ["manifest.json", "sw.js", "vite.svg", "_redirects"]:
        fpath = os.path.join(STAFF_STATIC, fname)
        if os.path.isfile(fpath):
            def make_staff_handler(p):
                def handler():
                    return FileResponse(p)
                handler.__name__ = f"serve_staff_{os.path.basename(p).replace('.', '_')}"
                return handler
            app.get(f"/staff/{fname}")(make_staff_handler(fpath))

    @app.get("/staff")
    @app.get("/staff/")
    def serve_staff_root():
        return FileResponse(os.path.join(STAFF_STATIC, "index.html"))

    @app.get("/staff/{path:path}")
    def serve_staff_spa(path: str):
        # Try to serve the exact file first
        static_file = os.path.join(STAFF_STATIC, path)
        if os.path.isfile(static_file):
            return FileResponse(static_file)
        # Otherwise serve staff index.html for SPA routing
        return FileResponse(os.path.join(STAFF_STATIC, "index.html"))

# ── Admin Frontend (served at /) ──
if os.path.isdir(STATIC) and os.path.isfile(os.path.join(STATIC, "index.html")):
    # Mount known static subdirectories first
    for d in ["assets", "icons", "recipes"]:
        dp = os.path.join(STATIC, d)
        if os.path.isdir(dp):
            app.mount(f"/{d}", StaticFiles(directory=dp), name=f"fe-{d}")

    # Remove the original root route (read_root) from main.py
    app.routes[:] = [
        r for r in app.routes
        if not (hasattr(r, 'path') and r.path == '/' and hasattr(r, 'methods') and 'GET' in r.methods)
    ]

    # Add root route to serve index.html
    @app.get("/")
    def serve_root():
        return FileResponse(os.path.join(STATIC, "index.html"))

    # Serve known static files at root level
    for fname in ["manifest.json", "sw.js", "vite.svg", "_redirects"]:
        fpath = os.path.join(STATIC, fname)
        if os.path.isfile(fpath):
            def make_handler(p):
                def handler():
                    return FileResponse(p)
                handler.__name__ = f"serve_{os.path.basename(p).replace('.', '_')}"
                return handler
            app.get(f"/{fname}")(make_handler(fpath))

    # Override 404 handler: serve static files or SPA fallback
    @app.exception_handler(404)
    async def spa_404_handler(request: Request, exc):
        path = request.url.path
        # Only handle GET requests for non-API paths
        if (request.method == "GET" and
            not path.startswith("/api/") and
            not path.startswith("/uploads/") and
            not path.startswith("/staff/") and
            not path.startswith("/docs") and
            not path.startswith("/openapi") and
            not path.startswith("/redoc")):
            # Check if the file exists in static directory
            static_file = os.path.join(STATIC, path.lstrip("/"))
            if os.path.isfile(static_file):
                return FileResponse(static_file)
            # Otherwise serve index.html for SPA routing
            return FileResponse(os.path.join(STATIC, "index.html"))
        # Otherwise return normal 404
        return JSONResponse(status_code=404, content={"detail": "Not Found"})

