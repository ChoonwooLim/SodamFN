# Scan .cache subfolders
$ErrorActionPreference = 'SilentlyContinue'
$results = @()

$base = 'C:\Users\choon\.cache'
$folders = Get-ChildItem $base -Directory -Force

foreach ($f in $folders) {
    $size = (Get-ChildItem $f.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    $sizeGB = [math]::Round($size / 1GB, 3)
    if ($sizeGB -gt 0.001) {
        $results += [PSCustomObject]@{
            Folder = $f.Name
            SizeGB = $sizeGB
        }
    }
}

Write-Host "=== C:\Users\choon\.cache breakdown ===" -ForegroundColor Cyan
$results | Sort-Object SizeGB -Descending | Format-Table -AutoSize
