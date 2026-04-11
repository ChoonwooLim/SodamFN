# ============================================================
# Phase A Cleanup - Execution
# ============================================================
$ErrorActionPreference = 'Continue'

function Get-CFreeGB {
    [math]::Round((Get-PSDrive C).Free / 1GB, 2)
}

$before_free = Get-CFreeGB
Write-Host "C: free BEFORE: $before_free GB" -ForegroundColor Yellow
Write-Host ""

# ------------------------------------------------------------
# Step 1: Delete C:\Users\choon\.cache\huggingface
# ------------------------------------------------------------
Write-Host "[1/5] Deleting C:\Users\choon\.cache\huggingface..." -ForegroundColor Cyan
if (Test-Path 'C:\Users\choon\.cache\huggingface') {
    # Use robocopy /PURGE trick for fast deletion of deep trees
    $emptyDir = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
    robocopy $emptyDir 'C:\Users\choon\.cache\huggingface' /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /MT:16 | Out-Null
    Remove-Item 'C:\Users\choon\.cache\huggingface' -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
    Write-Host "  Done" -ForegroundColor Green
} else {
    Write-Host "  Already gone" -ForegroundColor Gray
}
Write-Host "  C: free now: $(Get-CFreeGB) GB"
Write-Host ""

# ------------------------------------------------------------
# Step 2: Delete C:\Users\choon\.ollama\models_backup_20260411
# ------------------------------------------------------------
Write-Host "[2/5] Deleting C:\Users\choon\.ollama\models_backup_20260411..." -ForegroundColor Cyan
if (Test-Path 'C:\Users\choon\.ollama\models_backup_20260411') {
    $emptyDir = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
    robocopy $emptyDir 'C:\Users\choon\.ollama\models_backup_20260411' /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /MT:16 | Out-Null
    Remove-Item 'C:\Users\choon\.ollama\models_backup_20260411' -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
    Write-Host "  Done" -ForegroundColor Green
} else {
    Write-Host "  Already gone" -ForegroundColor Gray
}
Write-Host "  C: free now: $(Get-CFreeGB) GB"
Write-Host ""

# ------------------------------------------------------------
# Step 3: Clean C:\Users\choon\AppData\Local\Temp
# ------------------------------------------------------------
Write-Host "[3/5] Cleaning User Temp (in-use files will be skipped)..." -ForegroundColor Cyan
Get-ChildItem 'C:\Users\choon\AppData\Local\Temp' -Force -ErrorAction SilentlyContinue |
    ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
Write-Host "  Done"
Write-Host "  C: free now: $(Get-CFreeGB) GB"
Write-Host ""

# ------------------------------------------------------------
# Step 4: Clean C:\Windows\Temp (needs admin)
# ------------------------------------------------------------
Write-Host "[4/5] Cleaning Windows Temp (in-use files will be skipped)..." -ForegroundColor Cyan
Get-ChildItem 'C:\Windows\Temp' -Force -ErrorAction SilentlyContinue |
    ForEach-Object {
        Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue
    }
Write-Host "  Done"
Write-Host "  C: free now: $(Get-CFreeGB) GB"
Write-Host ""

# ------------------------------------------------------------
# Step 5: Empty Recycle Bin
# ------------------------------------------------------------
Write-Host "[5/5] Emptying Recycle Bin..." -ForegroundColor Cyan
try {
    Clear-RecycleBin -Force -ErrorAction Stop
    Write-Host "  Done" -ForegroundColor Green
} catch {
    Write-Host "  Skipped: $($_.Exception.Message)" -ForegroundColor Gray
}
Write-Host "  C: free now: $(Get-CFreeGB) GB"
Write-Host ""

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------
$after_free = Get-CFreeGB
$reclaimed = [math]::Round($after_free - $before_free, 2)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase A Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("C: free BEFORE : {0,8} GB" -f $before_free)
Write-Host ("C: free AFTER  : {0,8} GB" -f $after_free)
Write-Host ("Reclaimed      : {0,8} GB" -f $reclaimed) -ForegroundColor Green
