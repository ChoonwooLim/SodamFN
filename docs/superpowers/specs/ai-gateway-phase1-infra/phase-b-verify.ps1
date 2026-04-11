$ErrorActionPreference = 'SilentlyContinue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Junction verification" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$junctions = @(
    'C:\Users\choon\.ollama\models',
    'C:\Movies',
    'C:\Users\choon\generative-models',
    'C:\Users\choon\Downloads'
)

foreach ($j in $junctions) {
    if (Test-Path $j) {
        $item = Get-Item $j -Force
        $status = if ($item.LinkType -eq 'Junction') { "OK" } else { "NOT_JUNCTION" }
        $target = if ($item.Target) { $item.Target -join ',' } else { "(none)" }
        "{0,-40} {1,-13} -> {2}" -f $item.FullName, $status, $target
    } else {
        "{0,-40} MISSING" -f $j
    }
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " D: usage (all migrated content)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$dFolders = @(
    'D:\SodamAI\models\huggingface',
    'D:\SodamAI\models\ollama',
    'D:\SodamAI\generative-models',
    'D:\Movies',
    'D:\UserData\Downloads'
)

$total = 0
foreach ($f in $dFolders) {
    if (Test-Path $f) {
        $s = (Get-ChildItem $f -Recurse -File -Force -ErrorAction SilentlyContinue |
              Measure-Object -Property Length -Sum).Sum
        $gb = [math]::Round($s / 1GB, 2)
        $total += $gb
        "{0,-45} {1,10} GB" -f $f, $gb
    }
}
Write-Host ("{0,-45} {1,10} GB" -f "TOTAL", [math]::Round($total, 2))

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Drive summary" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
$c = Get-PSDrive C
$d = Get-PSDrive D
"C: used = {0,8:N2} GB   free = {1,8:N2} GB" -f ($c.Used/1GB), ($c.Free/1GB)
"D: used = {0,8:N2} GB   free = {1,8:N2} GB" -f ($d.Used/1GB), ($d.Free/1GB)
