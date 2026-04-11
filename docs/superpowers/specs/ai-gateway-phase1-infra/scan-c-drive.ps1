# Fast C: drive top-level folder size scan (skips c:\WORK)
$ErrorActionPreference = 'SilentlyContinue'
$results = @()

# Top-level folders
$topFolders = Get-ChildItem C:\ -Directory -Force | Where-Object { $_.Name -ne 'WORK' }

foreach ($folder in $topFolders) {
    Write-Host "Scanning: $($folder.FullName)..." -ForegroundColor Yellow
    $start = Get-Date
    $size = (Get-ChildItem $folder.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    $elapsed = (Get-Date) - $start
    $sizeGB = [math]::Round($size / 1GB, 2)
    $results += [PSCustomObject]@{
        Folder   = $folder.Name
        SizeGB   = $sizeGB
        Scan_s   = [math]::Round($elapsed.TotalSeconds, 1)
    }
}

Write-Host ""
Write-Host "=== C: Top Folders (excluding C:\WORK) ===" -ForegroundColor Cyan
$results | Sort-Object SizeGB -Descending | Format-Table -AutoSize
