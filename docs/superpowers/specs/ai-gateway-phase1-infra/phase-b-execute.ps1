# ============================================================
# Phase B - Junction-based safe migration
# ============================================================
# Strategy: For each target folder,
#   1) robocopy /E /COPY:DAT source -> destination (on D:)
#   2) Verify byte counts match
#   3) Delete original folder (original is now "free")
#   4) Create junction at original path -> D: destination
#   5) Verify junction
# ============================================================
$ErrorActionPreference = 'Continue'

function Get-CFreeGB {
    [math]::Round((Get-PSDrive C).Free / 1GB, 2)
}

function Get-SizeGB {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    $s = (Get-ChildItem $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    return [math]::Round($s / 1GB, 2)
}

function Move-WithJunction {
    param(
        [string]$Source,
        [string]$Destination,
        [string]$Label
    )

    Write-Host "============================================================" -ForegroundColor Cyan
    Write-Host " $Label" -ForegroundColor Cyan
    Write-Host "   Source : $Source" -ForegroundColor Gray
    Write-Host "   Dest   : $Destination" -ForegroundColor Gray
    Write-Host "============================================================" -ForegroundColor Cyan

    if (-not (Test-Path $Source)) {
        Write-Host "  ERROR: Source does not exist. Skipping." -ForegroundColor Red
        return
    }

    # Check source is not already a junction
    $item = Get-Item $Source -Force
    if ($item.LinkType) {
        Write-Host "  SKIP: Source is already a $($item.LinkType)." -ForegroundColor Yellow
        return
    }

    $srcSizeGB = Get-SizeGB -Path $Source
    Write-Host "  Source size: $srcSizeGB GB"

    # Step 1: Ensure parent of destination exists
    $destParent = Split-Path $Destination -Parent
    if (-not (Test-Path $destParent)) {
        New-Item -ItemType Directory -Path $destParent -Force | Out-Null
    }

    # Step 2: Robocopy
    Write-Host "  [1/4] Copying via robocopy..." -ForegroundColor Yellow
    $logFile = Join-Path (Split-Path $PSCommandPath -Parent) ("phase-b-" + [System.IO.Path]::GetFileName($Source) + ".log")
    $rc = robocopy $Source $Destination /E /COPY:DAT /DCOPY:DAT /R:2 /W:5 /MT:16 /NP /NFL /NDL /NJH /LOG:$logFile
    $rcExit = $LASTEXITCODE
    if ($rcExit -ge 8) {
        Write-Host "  ROBOCOPY FAILED with exit $rcExit. See $logFile" -ForegroundColor Red
        return
    }
    Write-Host "  Robocopy exit: $rcExit (0-7 = success)" -ForegroundColor Green

    # Step 3: Verify byte count on destination
    $dstSizeGB = Get-SizeGB -Path $Destination
    Write-Host "  [2/4] Verifying destination size..."
    Write-Host "    Source: $srcSizeGB GB  |  Destination: $dstSizeGB GB"
    if ([math]::Abs($srcSizeGB - $dstSizeGB) -gt 0.5) {
        Write-Host "  WARNING: Size mismatch > 0.5 GB. Not proceeding with deletion." -ForegroundColor Red
        return
    }
    Write-Host "  Size match OK" -ForegroundColor Green

    # Step 4: Delete original
    Write-Host "  [3/4] Deleting source folder..."
    try {
        # Use robocopy empty trick for fast deletion of deep trees
        $emptyDir = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
        New-Item -ItemType Directory -Path $emptyDir -Force | Out-Null
        robocopy $emptyDir $Source /MIR /NFL /NDL /NJH /NJS /NC /NS /NP /MT:16 | Out-Null
        Remove-Item $Source -Recurse -Force -ErrorAction Stop
        Remove-Item $emptyDir -Force -ErrorAction SilentlyContinue
        Write-Host "  Source deleted" -ForegroundColor Green
    } catch {
        Write-Host "  ERROR during deletion: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  (Destination copy is intact at $Destination)" -ForegroundColor Yellow
        return
    }

    # Step 5: Create junction
    Write-Host "  [4/4] Creating junction..."
    try {
        New-Item -ItemType Junction -Path $Source -Target $Destination | Out-Null
        $j = Get-Item $Source -Force
        if ($j.LinkType -eq 'Junction') {
            Write-Host "  Junction created: $Source -> $Destination" -ForegroundColor Green
        } else {
            Write-Host "  WARNING: Junction creation may have failed" -ForegroundColor Red
        }
    } catch {
        Write-Host "  ERROR creating junction: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host "  C: free now: $(Get-CFreeGB) GB"
    Write-Host ""
}

# ============================================================
# Main execution
# ============================================================
$before = Get-CFreeGB
Write-Host "C: free BEFORE Phase B: $before GB" -ForegroundColor Yellow
Write-Host ""

# Target 1: C:\Movies (no venv, simple media files)
Move-WithJunction `
    -Source 'C:\Movies' `
    -Destination 'D:\Movies' `
    -Label 'Target 1: C:\Movies'

# Target 2: generative-models (contains Python venv - MUST use junction)
Move-WithJunction `
    -Source 'C:\Users\choon\generative-models' `
    -Destination 'D:\SodamAI\generative-models' `
    -Label 'Target 2: generative-models (contains venv)'

# Target 3: Downloads (user shell folder)
Move-WithJunction `
    -Source 'C:\Users\choon\Downloads' `
    -Destination 'D:\UserData\Downloads' `
    -Label 'Target 3: Downloads'

$after = Get-CFreeGB
$reclaimed = [math]::Round($after - $before, 2)

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase B Summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ("C: free BEFORE : {0,8} GB" -f $before)
Write-Host ("C: free AFTER  : {0,8} GB" -f $after)
Write-Host ("Reclaimed      : {0,8} GB" -f $reclaimed) -ForegroundColor Green
