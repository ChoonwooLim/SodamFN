$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== Running processes that might hold targeted caches ===" -ForegroundColor Cyan

$patterns = @('CapCut', 'chrome', 'msedge', 'python', 'node', 'nvcontainer', 'NVIDIA')
foreach ($pat in $patterns) {
    $procs = Get-Process -Name $pat -ErrorAction SilentlyContinue
    if ($procs) {
        Write-Host ""
        Write-Host "$pat" -ForegroundColor Yellow
        $procs | Select-Object ProcessName, Id | Format-Table -AutoSize
    }
}

# Also check CapCut specifically by exe name
$capcut = Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -like '*CapCut*' }
if ($capcut) {
    Write-Host "CapCut processes (by path):" -ForegroundColor Yellow
    $capcut | Select-Object Name, Id, Path | Format-Table -AutoSize
}
