# ============================================================
# Phase C - AppData cache cleanup
# EXCLUDED: UnrealEngine Zen, Google DriveFS cache
# ============================================================
$ErrorActionPreference = 'Continue'

function Get-CFreeGB { [math]::Round((Get-PSDrive C).Free / 1GB, 2) }

function Get-SizeGB {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    $s = (Get-ChildItem $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    return [math]::Round($s / 1GB, 2)
}

function Fast-Delete {
    param([string]$Path, [string]$Label)

    Write-Host ""
    Write-Host "--- $Label ---" -ForegroundColor Yellow
    Write-Host "    $Path"

    if (-not (Test-Path $Path)) {
        Write-Host "    (already gone)" -ForegroundColor Gray
        return
    }

    $before = Get-SizeGB -Path $Path
    Write-Host "    Size before: $before GB"

    # Fast deletion via robocopy /MIR from empty dir
    $emptyDir = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
    New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
    robocopy $emptyDir $Path /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /MT:16 /R:1 /W:1 | Out-Null
    Remove-Item $Path -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue

    if (Test-Path $Path) {
        $after = Get-SizeGB -Path $Path
        Write-Host "    Partial deletion: $after GB remaining (some files locked)" -ForegroundColor Yellow
    } else {
        Write-Host "    Deleted" -ForegroundColor Green
    }
}

# ------------------------------------------------------------
$before_free = Get-CFreeGB
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase C Cleanup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "C: free BEFORE: $before_free GB" -ForegroundColor Yellow

# Safe targets (UE Zen EXCLUDED)
Fast-Delete -Path 'C:\Users\choon\AppData\Local\pip' `
            -Label '[1/7] pip cache'

Fast-Delete -Path 'C:\Users\choon\AppData\Local\CapCut\User Data\Cache' `
            -Label '[2/7] CapCut render/thumbnail cache'

Fast-Delete -Path 'C:\Users\choon\AppData\Local\npm-cache' `
            -Label '[3/7] npm package cache'

Fast-Delete -Path 'C:\Users\choon\AppData\Local\NVIDIA\DXCache' `
            -Label '[4/7] NVIDIA DirectX shader cache'

Fast-Delete -Path 'C:\Users\choon\AppData\Local\CapCut\User Data\CEF' `
            -Label '[5/7] CapCut CEF browser cache'

# Conditional targets (DriveFS EXCLUDED)
Fast-Delete -Path 'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\OptGuideOnDeviceModel' `
            -Label '[6/7] Chrome on-device AI model (will re-download if needed)'

# CapCut old versions - keep only latest 8.3.0.3497
Write-Host ""
Write-Host "--- [7/7] CapCut old versions (keep 8.3.0.3497 only) ---" -ForegroundColor Yellow
$capcutApps = 'C:\Users\choon\AppData\Local\CapCut\Apps'
if (Test-Path $capcutApps) {
    $oldVersions = Get-ChildItem $capcutApps -Directory | Where-Object { $_.Name -ne '8.3.0.3497' }
    foreach ($v in $oldVersions) {
        Write-Host "    Removing: $($v.FullName)"
        $emptyDir = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
        robocopy $emptyDir $v.FullName /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /MT:16 /R:1 /W:1 | Out-Null
        Remove-Item $v.FullName -Recurse -Force -ErrorAction SilentlyContinue
        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
    }
    Write-Host "    Remaining CapCut app versions:"
    Get-ChildItem $capcutApps -Directory | Select-Object Name | Format-Table -AutoSize
}

# ------------------------------------------------------------
$after_free = Get-CFreeGB
$reclaimed = [math]::Round($after_free - $before_free, 2)

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase C Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("C: free BEFORE : {0,8} GB" -f $before_free)
Write-Host ("C: free AFTER  : {0,8} GB" -f $after_free)
Write-Host ("Reclaimed      : {0,8} GB" -f $reclaimed) -ForegroundColor Green
