$ErrorActionPreference = 'SilentlyContinue'
$base = 'C:\Users\choon\generative-models'

if (-not (Test-Path $base)) {
    Write-Host "Not found: $base"
    exit
}

Write-Host "=== Top-level structure ===" -ForegroundColor Cyan
Get-ChildItem $base -Force | Select-Object Mode, Name, @{N='Type';E={if($_.PSIsContainer){'DIR'}else{'FILE'}}} | Format-Table -AutoSize

Write-Host ""
Write-Host "=== Has venv / .git / requirements.txt? ==="
'venv exists      : {0}' -f (Test-Path "$base\venv")
'.venv exists     : {0}' -f (Test-Path "$base\.venv")
'.git exists      : {0}' -f (Test-Path "$base\.git")
'requirements.txt : {0}' -f (Test-Path "$base\requirements.txt")
'setup.py         : {0}' -f (Test-Path "$base\setup.py")
'README exists    : {0}' -f ((Test-Path "$base\README.md") -or (Test-Path "$base\README.txt"))

Write-Host ""
Write-Host "=== Subdirs by size ==="
Get-ChildItem $base -Directory -Force | ForEach-Object {
    $s = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    [PSCustomObject]@{
        Name = $_.Name
        SizeGB = [math]::Round($s/1GB, 3)
    }
} | Sort-Object SizeGB -Descending | Format-Table -AutoSize
