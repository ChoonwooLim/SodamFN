# Probe network to find the new Linux AI server that's LAN-connected
# Run: powershell.exe -NoProfile -ExecutionPolicy Bypass -File probe-new-linux.ps1
$ErrorActionPreference = 'Continue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " New Linux Server Discovery Probe" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1] IPv4 addresses on this host" -ForegroundColor Yellow
Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } |
    Select-Object InterfaceAlias, IPAddress, PrefixLength |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[2] Default gateways" -ForegroundColor Yellow
Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue |
    Select-Object InterfaceAlias, NextHop, RouteMetric |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[3] ARP (neighbors) - Reachable / Stale only" -ForegroundColor Yellow
Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.State -in 'Reachable','Stale','Permanent' -and $_.IPAddress -notlike '224.*' -and $_.IPAddress -notlike '239.*' -and $_.IPAddress -notlike '255.*' -and $_.IPAddress -ne '0.0.0.0' } |
    Sort-Object InterfaceAlias, IPAddress |
    Select-Object InterfaceAlias, IPAddress, LinkLayerAddress, State |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[4] Ping test against known hosts" -ForegroundColor Yellow
$candidates = @('192.168.219.100','192.168.219.101','192.168.219.102','192.168.219.103','192.168.219.104','192.168.219.105','192.168.0.1','192.168.1.1','10.0.0.1')
foreach ($ip in $candidates) {
    $ok = Test-Connection -ComputerName $ip -Count 1 -Quiet -TimeoutSeconds 1 -ErrorAction SilentlyContinue
    $status = if ($ok) { 'UP  ' } else { 'down' }
    $color  = if ($ok) { 'Green' } else { 'DarkGray' }
    Write-Host ("    {0}  {1}" -f $status, $ip) -ForegroundColor $color
}

Write-Host ""
Write-Host "[5] Listening ports (candidates for AI services)" -ForegroundColor Yellow
Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalPort -in 11434, 22, 8000, 8080, 8100, 8101, 8102 } |
    Select-Object LocalAddress, LocalPort, @{Name='Proc';Expression={(Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue).ProcessName}} |
    Sort-Object LocalPort |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
