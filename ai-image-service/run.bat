@echo off
REM SodamFN AI Image Service (Flux.1-schnell + Real-ESRGAN)
REM Port: 8100
cd /d "%~dp0"
call .venv\Scripts\activate.bat
python -m uvicorn main:app --host 0.0.0.0 --port 8100 --workers 1
