@echo off
REM ============================================================
REM AI Gateway Phase 1 - System Environment Variables
REM ============================================================
REM
REM Registers 4 SYSTEM-wide environment variables so that
REM HuggingFace / Ollama services use D:\SodamAI\models\ as the
REM unified storage root.
REM
REM IMPORTANT:
REM   - Must be run as ADMINISTRATOR (for /M machine-wide scope)
REM   - New terminals / services pick up the changes.
REM     Already-running processes must be restarted.
REM   - Reboot recommended after running.
REM
REM Rollback: see 03-rollback-env-vars.bat (generated below)
REM ============================================================

setlocal

echo.
echo ============================================================
echo  Registering system environment variables
echo ============================================================

REM --- Save current values for rollback ---
set ROLLBACK=%~dp0rollback-env-vars.bat
echo @echo off > "%ROLLBACK%"
echo REM Auto-generated rollback script (restores previous env var values) >> "%ROLLBACK%"

for %%V in (HF_HOME HF_HUB_CACHE TRANSFORMERS_CACHE OLLAMA_MODELS) do (
    for /f "tokens=3*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v %%V 2^>nul ^| findstr /i %%V') do (
        echo setx /M %%V "%%A %%B" >> "%ROLLBACK%"
    )
)

echo [INFO] Rollback script saved: %ROLLBACK%
echo.

REM --- Set new values ---
echo [1/4] HF_HOME             = D:\SodamAI\models\huggingface
setx /M HF_HOME "D:\SodamAI\models\huggingface"

echo [2/4] HF_HUB_CACHE        = D:\SodamAI\models\huggingface\hub
setx /M HF_HUB_CACHE "D:\SodamAI\models\huggingface\hub"

echo [3/4] TRANSFORMERS_CACHE  = D:\SodamAI\models\huggingface\hub
setx /M TRANSFORMERS_CACHE "D:\SodamAI\models\huggingface\hub"

echo [4/4] OLLAMA_MODELS       = D:\SodamAI\models\ollama
setx /M OLLAMA_MODELS "D:\SodamAI\models\ollama"

echo.
echo ============================================================
echo  [SUCCESS] All 4 variables registered.
echo ============================================================
echo.
echo  Next steps:
echo    1) REBOOT the PC (or at minimum open a new terminal)
echo    2) Verify with: echo %%HF_HOME%%
echo    3) Run python check in 04-verification.md
echo.

endlocal
pause
