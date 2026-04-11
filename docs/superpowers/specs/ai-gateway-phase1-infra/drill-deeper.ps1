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
        $gb = [math]::Round($s / 1GB, 3)
        if ($gb -ge $MinGB) {
            [PSCustomObject]@{
                Folder = $_.Name
                SizeGB = $gb
            }
        }
    } | Sort-Object SizeGB -Descending | Format-Table -AutoSize
}

# UE DDC/shader cache usually at Common/DerivedDataCache or Common/Epic/UnrealEngine
Scan-Folder -Path 'C:\Users\choon\AppData\Local\UnrealEngine\Common' -MinGB 0.1
Scan-Folder -Path 'C:\Users\choon\AppData\Local\UnrealEngine\Common\DerivedDataCache' -MinGB 0.1
Scan-Folder -Path 'C:\Users\choon\AppData\Local\UnrealEngine\Common\Epic\UnrealEngine' -MinGB 0.1

# CapCut User Data breakdown
Scan-Folder -Path 'C:\Users\choon\AppData\Local\CapCut\User Data' -MinGB 0.2
Scan-Folder -Path 'C:\Users\choon\AppData\Local\CapCut\Apps' -MinGB 0.2

# Chrome Default breakdown
Scan-Folder -Path 'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default' -MinGB 0.2

# Chrome cache specific files (to confirm Cache folder exists)
Write-Host ""
Write-Host "=== Chrome Cache folders (direct) ===" -ForegroundColor Cyan
$chromeItems = @(
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\Cache',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\Code Cache',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\GPUCache',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\Service Worker',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\DawnGraphiteCache',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\DawnWebGPUCache',
    'C:\Users\choon\AppData\Local\Google\Chrome\User Data\Default\Shader Cache'
)
foreach ($p in $chromeItems) {
    if (Test-Path $p) {
        $s = (Get-ChildItem $p -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
        "{0,-70} {1,8:N2} GB" -f $p, ($s / 1GB)
    }
}
