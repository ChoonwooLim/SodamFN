$ErrorActionPreference = 'SilentlyContinue'

function Scan-Folder {
    param([string]$Path, [double]$MinGB = 0.1)
    if (-not (Test-Path $Path)) { return }
    Write-Host ""
    Write-Host "=== $Path ===" -ForegroundColor Cyan
    Get-ChildItem $Path -Directory -Force -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.LinkType) { return }
        $s = (Get-ChildItem $_.FullName -Recurse -File -Force -ErrorAction SilentlyContinue |
              Measure-Object -Property Length -Sum).Sum
        $gb = [math]::Round($s / 1GB, 2)
        if ($gb -ge $MinGB) {
            [PSCustomObject]@{
                Folder = $_.Name
                SizeGB = $gb
            }
        }
    } | Sort-Object SizeGB -Descending | Format-Table -AutoSize
}

# 1. UnrealEngine - mostly DDC / shader cache (safe to wipe)
Scan-Folder -Path 'C:\Users\choon\AppData\Local\UnrealEngine' -MinGB 0.5

# 2. CapCut - contains project data AND cache
Scan-Folder -Path 'C:\Users\choon\AppData\Local\CapCut' -MinGB 0.5

# 3. Google (Chrome) - cache is safe, user data is not
Scan-Folder -Path 'C:\Users\choon\AppData\Local\Google' -MinGB 0.5
Scan-Folder -Path 'C:\Users\choon\AppData\Local\Google\Chrome' -MinGB 0.5
Scan-Folder -Path 'C:\Users\choon\AppData\Local\Google\Chrome\User Data' -MinGB 0.5

# 4. pip - entire folder is safe to delete
Write-Host ""
Write-Host "=== pip cache (entire folder is safe) ===" -ForegroundColor Cyan
$pipPath = 'C:\Users\choon\AppData\Local\pip'
if (Test-Path $pipPath) {
    $s = (Get-ChildItem $pipPath -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
    '{0}: {1:N2} GB (all safe)' -f $pipPath, ($s/1GB)
}

# 5. Microsoft - need to see what's inside
Scan-Folder -Path 'C:\Users\choon\AppData\Local\Microsoft' -MinGB 0.5

# 6. NVIDIA
Scan-Folder -Path 'C:\Users\choon\AppData\Local\NVIDIA' -MinGB 0.2
