# ============================================================
# Phase A Cleanup - C: drive safe deletion
# ============================================================
$ErrorActionPreference = 'Continue'

function Get-FolderSizeGB {
    param([string]$Path)
    if (-not (Test-Path $Path)) { return 0 }
    $s = (Get-ChildItem $Path -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    return [math]::Round(($s / 1GB), 2)
}

function Get-CFreeGB {
    [math]::Round((Get-PSDrive C).Free / 1GB, 2)
}

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Phase A Pre-Check" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$before_free = Get-CFreeGB
Write-Host "C: free before : $before_free GB"
Write-Host ""

Write-Host "--- Processes that might hold HF cache ---"
$procs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
    $_.ProcessName -match '^(python|wan|comfy|ollama)'
}
if ($procs) {
    $procs | Select-Object ProcessName, Id | Format-Table -AutoSize
} else {
    Write-Host "None running. Safe to proceed." -ForegroundColor Green
}
Write-Host ""

Write-Host "--- Target sizes ---"
$targets = @(
    @{ Label = 'HF cache (C:)';    Path = 'C:\Users\choon\.cache\huggingface' },
    @{ Label = 'Ollama backup';    Path = 'C:\Users\choon\.ollama\models_backup_20260411' },
    @{ Label = 'User Temp';        Path = 'C:\Users\choon\AppData\Local\Temp' },
    @{ Label = 'Windows Temp';     Path = 'C:\Windows\Temp' }
)
foreach ($t in $targets) {
    $size = Get-FolderSizeGB -Path $t.Path
    Write-Host ("{0,-22} : {1,6} GB  [{2}]" -f $t.Label, $size, $t.Path)
}
