# Wider 10.0.0.0/24 sweep + full ARP wake
$ErrorActionPreference = 'Continue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 10.0.0.0/24 wide sweep + ARP wake" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

# Flush ARP
Write-Host ""
Write-Host "[1] Flushing ARP for 10.0.0.0/24..." -ForegroundColor Yellow
Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '10.0.0.*' -and $_.State -ne 'Permanent' } |
    Remove-NetNeighbor -Confirm:$false -ErrorAction SilentlyContinue
Write-Host "    done"

# Parallel ping sweep 10.0.0.2 - 10.0.0.254
Write-Host ""
Write-Host "[2] Parallel ping sweep 10.0.0.2 - 10.0.0.254" -ForegroundColor Yellow
$jobs = @()
for ($i = 2; $i -le 254; $i++) {
    $ip = "10.0.0.$i"
    $jobs += Start-Job -ScriptBlock {
        param($ip)
        if (Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue) { $ip }
    } -ArgumentList $ip
}
$alive = $jobs | Wait-Job -Timeout 25 | Receive-Job
$jobs | Remove-Job -Force -ErrorAction SilentlyContinue
$alive = $alive | Where-Object { $_ } | Sort-Object { [int]($_.Split('.')[-1]) }

if ($alive) {
    Write-Host "    Alive hosts:" -ForegroundColor White
    foreach ($a in $alive) { Write-Host ("      $a") -ForegroundColor Green }
} else {
    Write-Host "    (no hosts responded to ping)" -ForegroundColor DarkGray
}

# Show ARP table after sweep (may contain unreachable entries as 'Incomplete')
Write-Host ""
Write-Host "[3] Full ARP entries on Ethernet 3 (InterfaceIndex) after sweep" -ForegroundColor Yellow
$ifIdx = (Get-NetIPAddress -IPAddress '10.0.0.1' -ErrorAction SilentlyContinue).InterfaceIndex
Write-Host "    Interface index: $ifIdx"
Get-NetNeighbor -AddressFamily IPv4 -InterfaceIndex $ifIdx -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '10.0.0.*' } |
    Sort-Object { [int]($_.IPAddress.Split('.')[-1]) } |
    Select-Object IPAddress, LinkLayerAddress, State |
    Format-Table -AutoSize

# Try raw ARP request via cmd arp tool (may show different info)
Write-Host ""
Write-Host "[4] Legacy 'arp -a -N 10.0.0.1'" -ForegroundColor Yellow
arp -a -N 10.0.0.1

# Port probe on any discovered hosts
if ($alive) {
    Write-Host ""
    Write-Host "[5] Port probe SSH(22) + Ollama(11434)" -ForegroundColor Yellow
    foreach ($ip in $alive) {
        $ssh = $false; $oll = $false
        $t1 = New-Object System.Net.Sockets.TcpClient
        $i1 = $t1.BeginConnect($ip, 22, $null, $null)
        if ($i1.AsyncWaitHandle.WaitOne(800, $false) -and $t1.Connected) { $ssh = $true; $t1.EndConnect($i1) }
        $t1.Close()
        $t2 = New-Object System.Net.Sockets.TcpClient
        $i2 = $t2.BeginConnect($ip, 11434, $null, $null)
        if ($i2.AsyncWaitHandle.WaitOne(800, $false) -and $t2.Connected) { $oll = $true; $t2.EndConnect($i2) }
        $t2.Close()
        Write-Host ("    {0,-16}  ssh={1,-5}  ollama={2,-5}" -f $ip, $ssh, $oll)
    }
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
