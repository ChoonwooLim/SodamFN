# Focused probe on the 10.0.0.0/24 direct-link subnet
$ErrorActionPreference = 'Continue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Direct-link probe: 10.0.0.0/24" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Flush ARP for the direct-link interface so we get fresh data
Write-Host ""
Write-Host "[1] Flushing ARP entries for 10.0.0.0/24..." -ForegroundColor Yellow
try {
    Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -like '10.0.0.*' } |
        Remove-NetNeighbor -Confirm:$false -ErrorAction SilentlyContinue
    Write-Host "    done"
} catch {
    Write-Host "    skip: $($_.Exception.Message)"
}

# 2. Sweep ping 10.0.0.2 - 10.0.0.20 (most likely candidates)
Write-Host ""
Write-Host "[2] Ping sweep 10.0.0.2 - 10.0.0.20" -ForegroundColor Yellow
$found = @()
for ($i = 2; $i -le 20; $i++) {
    $ip = "10.0.0.$i"
    $ok = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
    if ($ok) {
        Write-Host ("    UP   $ip") -ForegroundColor Green
        $found += $ip
    }
}
if ($found.Count -eq 0) {
    Write-Host "    (no hosts responded)" -ForegroundColor DarkGray
}

# 3. Show fresh ARP for 10.0.0.0/24 (even unreachable pings populate ARP if the interface is up)
Write-Host ""
Write-Host "[3] Fresh ARP entries for 10.0.0.0/24" -ForegroundColor Yellow
Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '10.0.0.*' -and $_.State -in 'Reachable','Stale','Permanent','Probe' } |
    Sort-Object IPAddress |
    Select-Object IPAddress, LinkLayerAddress, State |
    Format-Table -AutoSize

# 4. For each found host, probe interesting ports
Write-Host ""
Write-Host "[4] Port probe on discovered hosts" -ForegroundColor Yellow
$ports = @(22, 11434, 8000, 8100, 80, 443)
foreach ($ip in $found) {
    Write-Host "  $ip" -ForegroundColor White
    foreach ($p in $ports) {
        $t = New-Object System.Net.Sockets.TcpClient
        $iar = $t.BeginConnect($ip, $p, $null, $null)
        $wait = $iar.AsyncWaitHandle.WaitOne(800, $false)
        if ($wait -and $t.Connected) {
            Write-Host ("    port {0,5}  OPEN" -f $p) -ForegroundColor Green
            $t.EndConnect($iar)
        } else {
            Write-Host ("    port {0,5}  closed" -f $p) -ForegroundColor DarkGray
        }
        $t.Close()
    }
}

# 5. Also check routes in case it's reachable via a different path
Write-Host ""
Write-Host "[5] Routes touching 10.0.0.0/24" -ForegroundColor Yellow
Get-NetRoute -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.DestinationPrefix -like '10.0.0.*' } |
    Select-Object InterfaceAlias, DestinationPrefix, NextHop, RouteMetric |
    Format-Table -AutoSize

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
