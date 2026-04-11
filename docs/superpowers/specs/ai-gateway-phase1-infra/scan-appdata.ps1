$ErrorActionPreference = 'SilentlyContinue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AppData Top-Level Scan" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$appdata = 'C:\Users\choon\AppData'

foreach ($sub in @('Local', 'LocalLow', 'Roaming')) {
    $p = Join-Path $appdata $sub
    Write-Host ""
    Write-Host "--- $sub ---" -ForegroundColor Yellow
    $s = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    '{0} total: {1:N2} GB' -f $sub, ($s / 1GB)
}

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AppData\Local breakdown (>1 GB)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$results = @()
Get-ChildItem "$appdata\Local" -Directory -Force | ForEach-Object {
    # Skip junctions/symlinks
    if ($_.LinkType) { return }
    $s = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    $gb = [math]::Round($s / 1GB, 2)
    if ($gb -ge 1.0) {
        $results += [PSCustomObject]@{
            Folder = $_.Name
            SizeGB = $gb
        }
    }
}
$results | Sort-Object SizeGB -Descending | Format-Table -AutoSize

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " AppData\Roaming breakdown (>0.5 GB)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

$results2 = @()
Get-ChildItem "$appdata\Roaming" -Directory -Force | ForEach-Object {
    if ($_.LinkType) { return }
    $s = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
          Measure-Object -Property Length -Sum).Sum
    $gb = [math]::Round($s / 1GB, 2)
    if ($gb -ge 0.5) {
        $results2 += [PSCustomObject]@{
            Folder = $_.Name
            SizeGB = $gb
        }
    }
}
$results2 | Sort-Object SizeGB -Descending | Format-Table -AutoSize
