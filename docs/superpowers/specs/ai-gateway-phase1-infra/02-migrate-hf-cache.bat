@echo off
REM ============================================================
REM AI Gateway Phase 1 - HuggingFace Cache Migration
REM C:\Users\choon\.cache\huggingface  ->  D:\SodamAI\models\huggingface
REM ============================================================
REM
REM [SAFETY] This script uses robocopy /COPY first (NOT /MOVE).
REM          Original files remain intact until you manually verify
REM          and run the cleanup step at the bottom.
REM
REM Usage:
REM   1) Close ALL AI services (Wan2GP, ComfyUI, SodamAI services)
REM   2) Run this script as ADMINISTRATOR (right-click -> Run as admin)
REM   3) Wait for completion (10~30 min on SSD)
REM   4) Verify with 04-verification.md
REM   5) (Optional) Uncomment and run the cleanup block at the bottom
REM ============================================================

setlocal
set SRC=C:\Users\choon\.cache\huggingface
set DST=D:\SodamAI\models\huggingface

echo.
echo ============================================================
echo  HuggingFace Cache Migration
echo ============================================================
echo  Source      : %SRC%
echo  Destination : %DST%
echo ============================================================
echo.

if not exist "%SRC%" (
    echo [ERROR] Source folder does not exist: %SRC%
    exit /b 1
)

if not exist "%DST%" (
    echo [INFO] Creating destination folder...
    mkdir "%DST%"
)

echo [INFO] Starting robocopy (COPY mode, keeps originals)...
echo.

robocopy "%SRC%" "%DST%" /E /COPY:DAT /DCOPY:DAT /R:2 /W:5 /MT:16 /NP /TEE /LOG:"%~dp0migrate-hf-cache.log"

set RC=%ERRORLEVEL%

echo.
echo ============================================================
echo  robocopy finished with exit code: %RC%
echo ============================================================
echo  (Codes 0-7 = success. 8+ = error.)
echo.

if %RC% GEQ 8 (
    echo [ERROR] Migration failed. Check migrate-hf-cache.log
    exit /b %RC%
)

echo [SUCCESS] Copy complete.
echo.
echo Next steps:
echo   1) Run 03-set-env-vars.bat to register env vars
echo   2) Reboot or open a new terminal
echo   3) Verify with 04-verification.md
echo   4) After verification, manually delete the source:
echo        rmdir /S /Q "%SRC%"
echo.

endlocal
pause
