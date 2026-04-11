# ============================================================
# Post-GPU-Install Verification Script
# Run this FIRST in the new Claude Code session after installing
# the second RTX 3090 and rebooting.
# ============================================================
$ErrorActionPreference = 'Continue'

$results = @()
function Add-Result {
    param([string]$Check, [string]$Status, [string]$Detail)
    $script:results += [PSCustomObject]@{
        Check  = $Check
        Status = $Status
        Detail = $Detail
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AI Gateway Phase 1 - Post-GPU Verification" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# ------------------------------------------------------------
# 1. GPU detection (expect RTX 3090 x2)
# ------------------------------------------------------------
Write-Host "[1/7] GPU detection" -ForegroundColor Yellow
try {
    $gpuCsv = & nvidia-smi --query-gpu=index,name,memory.total,driver_version --format=csv,noheader 2>&1
    if ($LASTEXITCODE -ne 0) {
        Add-Result 'GPU detection' 'FAIL' 'nvidia-smi failed'
    } else {
        $gpuLines = $gpuCsv | Where-Object { $_ -match '\S' }
        $count = ($gpuLines | Measure-Object).Count
        $gpuLines | ForEach-Object { Write-Host "    $_" }
        if ($count -ge 2) {
            Add-Result 'GPU count' 'OK' "$count GPU(s) detected"
        } else {
            Add-Result 'GPU count' 'WARN' "Only $count GPU detected (expected 2)"
        }
    }
} catch {
    Add-Result 'GPU detection' 'FAIL' $_.Exception.Message
}

# ------------------------------------------------------------
# 2. System environment variables
# ------------------------------------------------------------
Write-Host ""
Write-Host "[2/7] System environment variables" -ForegroundColor Yellow
$expected = @{
    'HF_HOME'            = 'D:\SodamAI\models\huggingface'
    'HF_HUB_CACHE'       = 'D:\SodamAI\models\huggingface\hub'
    'TRANSFORMERS_CACHE' = 'D:\SodamAI\models\huggingface\hub'
    'OLLAMA_MODELS'      = 'D:\SodamAI\models\ollama'
}
foreach ($k in $expected.Keys) {
    $actual = [Environment]::GetEnvironmentVariable($k, 'Machine')
    Write-Host ("    {0,-22} = {1}" -f $k, $actual)
    if ($actual -eq $expected[$k]) {
        Add-Result "env:$k" 'OK' $actual
    } else {
        Add-Result "env:$k" 'FAIL' "expected=$($expected[$k]) actual=$actual"
    }
}

# ------------------------------------------------------------
# 3. Junctions
# ------------------------------------------------------------
Write-Host ""
Write-Host "[3/7] Junction verification" -ForegroundColor Yellow
$junctions = @{
    'C:\Users\choon\.ollama\models'    = 'D:\SodamAI\models\ollama'
    'C:\Movies'                        = 'D:\Movies'
    'C:\Users\choon\generative-models' = 'D:\SodamAI\generative-models'
    'C:\Users\choon\Downloads'         = 'D:\UserData\Downloads'
}
foreach ($j in $junctions.Keys) {
    $item = Get-Item $j -Force -ErrorAction SilentlyContinue
    if (-not $item) {
        Write-Host ("    {0,-45} MISSING" -f $j) -ForegroundColor Red
        Add-Result "junction:$j" 'FAIL' 'path missing'
        continue
    }
    if ($item.LinkType -ne 'Junction') {
        Write-Host ("    {0,-45} NOT A JUNCTION" -f $j) -ForegroundColor Red
        Add-Result "junction:$j" 'FAIL' 'not a junction'
        continue
    }
    $target = ($item.Target -join ',')
    Write-Host ("    {0,-45} -> {1}" -f $j, $target)
    if ($target -eq $junctions[$j]) {
        Add-Result "junction:$j" 'OK' $target
    } else {
        Add-Result "junction:$j" 'WARN' "target=$target expected=$($junctions[$j])"
    }
}

# ------------------------------------------------------------
# 4. D: drive structure
# ------------------------------------------------------------
Write-Host ""
Write-Host "[4/7] D: drive structure" -ForegroundColor Yellow
$dPaths = @(
    'D:\SodamAI\models\huggingface',
    'D:\SodamAI\models\ollama',
    'D:\SodamAI\generative-models',
    'D:\Movies',
    'D:\UserData\Downloads'
)
foreach ($p in $dPaths) {
    if (Test-Path $p) {
        $s = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue |
              Measure-Object -Property Length -Sum).Sum
        $gb = [math]::Round($s / 1GB, 2)
        Write-Host ("    {0,-45} {1,8} GB" -f $p, $gb)
        Add-Result "dpath:$p" 'OK' "$gb GB"
    } else {
        Write-Host ("    {0,-45} MISSING" -f $p) -ForegroundColor Red
        Add-Result "dpath:$p" 'FAIL' 'missing'
    }
}

# ------------------------------------------------------------
# 5. Ollama service
# ------------------------------------------------------------
Write-Host ""
Write-Host "[5/7] Ollama service" -ForegroundColor Yellow
$ollamaProc = Get-Process -Name 'ollama' -ErrorAction SilentlyContinue
if ($ollamaProc) {
    Write-Host "    Ollama process running (PID: $($ollamaProc.Id -join ','))"
    Add-Result 'ollama:process' 'OK' "PID $($ollamaProc.Id -join ',')"
} else {
    Write-Host "    Ollama process NOT running - attempting to start..." -ForegroundColor Yellow
    Start-Process -FilePath 'ollama' -ArgumentList 'serve' -WindowStyle Hidden -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
    $ollamaProc = Get-Process -Name 'ollama' -ErrorAction SilentlyContinue
    if ($ollamaProc) {
        Add-Result 'ollama:process' 'OK' 'Started'
    } else {
        Add-Result 'ollama:process' 'FAIL' 'Could not start Ollama'
    }
}

# API health
try {
    $tags = Invoke-RestMethod -Uri 'http://localhost:11434/api/tags' -TimeoutSec 5 -ErrorAction Stop
    $modelCount = ($tags.models | Measure-Object).Count
    Write-Host "    API responsive, $modelCount models available"
    $tags.models | ForEach-Object {
        $sizeGb = [math]::Round($_.size / 1GB, 2)
        Write-Host ("      - {0,-25} {1,6} GB" -f $_.name, $sizeGb)
    }
    Add-Result 'ollama:api' 'OK' "$modelCount models"

    # Verify gemma4:e4b is present
    if ($tags.models.name -contains 'gemma4:e4b') {
        Add-Result 'ollama:gemma4' 'OK' 'present'
    } else {
        Add-Result 'ollama:gemma4' 'FAIL' 'gemma4:e4b missing'
    }
} catch {
    Add-Result 'ollama:api' 'FAIL' $_.Exception.Message
}

# ------------------------------------------------------------
# 6. Gemma4 Korean inference test
# ------------------------------------------------------------
Write-Host ""
Write-Host "[6/7] Gemma4 Korean inference test" -ForegroundColor Yellow
$promptFile = Join-Path $PSScriptRoot 'test-prompt.json'
if (Test-Path $promptFile) {
    try {
        $body = Get-Content -Raw -Encoding UTF8 $promptFile
        $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $startTime = Get-Date
        $resp = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' `
            -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' `
            -TimeoutSec 60 -ErrorAction Stop
        $elapsed = (Get-Date) - $startTime
        $tokPerSec = if ($resp.eval_count -and $resp.eval_duration) {
            [math]::Round($resp.eval_count / ($resp.eval_duration / 1e9), 1)
        } else { 0 }
        Write-Host "    Response:" -ForegroundColor Green
        Write-Host "      $($resp.response)"
        Write-Host ("    Elapsed: {0:N2}s | Tokens: {1} | Speed: {2} tok/s" -f $elapsed.TotalSeconds, $resp.eval_count, $tokPerSec)
        Add-Result 'ollama:inference' 'OK' "$tokPerSec tok/s"
    } catch {
        Add-Result 'ollama:inference' 'FAIL' $_.Exception.Message
    }
} else {
    Add-Result 'ollama:inference' 'SKIP' 'test-prompt.json missing'
}

# ------------------------------------------------------------
# 7. C: drive free space
# ------------------------------------------------------------
Write-Host ""
Write-Host "[7/7] C: drive free space" -ForegroundColor Yellow
$c = Get-PSDrive C
$freeGB = [math]::Round($c.Free / 1GB, 2)
$usedGB = [math]::Round($c.Used / 1GB, 2)
Write-Host "    Free: $freeGB GB / Used: $usedGB GB"
if ($freeGB -ge 700) {
    Add-Result 'disk:C-free' 'OK' "$freeGB GB"
} else {
    Add-Result 'disk:C-free' 'WARN' "$freeGB GB (expected >=700)"
}

# ------------------------------------------------------------
# Summary
# ------------------------------------------------------------
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Verification Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$ok   = ($results | Where-Object { $_.Status -eq 'OK'   }).Count
$warn = ($results | Where-Object { $_.Status -eq 'WARN' }).Count
$fail = ($results | Where-Object { $_.Status -eq 'FAIL' }).Count
$skip = ($results | Where-Object { $_.Status -eq 'SKIP' }).Count

$results | Format-Table -AutoSize

Write-Host ""
Write-Host "  OK: $ok   WARN: $warn   FAIL: $fail   SKIP: $skip" -ForegroundColor $(if ($fail -eq 0) {'Green'} else {'Red'})
Write-Host ""
if ($fail -eq 0 -and $warn -eq 0) {
    Write-Host "  ALL GREEN. Ready to proceed with 'writing-plans' skill." -ForegroundColor Green
} elseif ($fail -eq 0) {
    Write-Host "  OK but with warnings. Review WARN items before proceeding." -ForegroundColor Yellow
} else {
    Write-Host "  FAILURES DETECTED. Fix before proceeding." -ForegroundColor Red
}
Write-Host ""
