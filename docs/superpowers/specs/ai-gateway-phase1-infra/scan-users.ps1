# Drill down C:\Users\choon
$ErrorActionPreference = 'SilentlyContinue'
$results = @()

$baseFolder = 'C:\Users\choon'
$folders = Get-ChildItem $baseFolder -Directory -Force | Where-Object {
    $_.LinkType -ne 'Junction' -and $_.LinkType -ne 'SymbolicLink'
}

foreach ($folder in $folders) {
    Write-Host "Scanning: $($folder.Name)..." -ForegroundColor Yellow
    $size = (Get-ChildItem $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($size / 1GB, 2)
    if ($sizeGB -gt 0.1) {
        $results += [PSCustomObject]@{
            Folder = $folder.Name
            SizeGB = $sizeGB
        }
    }
}

Write-Host ""
Write-Host "=== C:\Users\choon (>0.1GB) ===" -ForegroundColor Cyan
$results | Sort-Object SizeGB -Descending | Format-Table -AutoSize
