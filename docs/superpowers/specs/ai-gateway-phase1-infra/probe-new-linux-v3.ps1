# Probe v3: check link state + wider main LAN sweep
$ErrorActionPreference = 'Continue'

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Probe v3: link state + main LAN sweep" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "[1] Physical link status (all NICs)" -ForegroundColor Yellow
Get-NetAdapter |
    Select-Object Name, InterfaceDescription, Status, LinkSpeed, MediaConnectionState |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[2] NICs with their IPv4 + gateway" -ForegroundColor Yellow
Get-NetIPConfiguration |
    Where-Object { $_.IPv4Address -and $_.NetAdapter.Status -eq 'Up' } |
    ForEach-Object {
        [PSCustomObject]@{
            Alias   = $_.InterfaceAlias
            IPv4    = ($_.IPv4Address.IPAddress -join ',')
            Gateway = ($_.IPv4DefaultGateway.NextHop -join ',')
        }
    } |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[3] Ping sweep 192.168.219.2 - 192.168.219.254 (parallel)" -ForegroundColor Yellow
$jobs = @()
for ($i = 2; $i -le 254; $i++) {
    $ip = "192.168.219.$i"
    $jobs += Start-Job -ScriptBlock {
        param($ip)
        $ok = Test-Connection -ComputerName $ip -Count 1 -Quiet -ErrorAction SilentlyContinue
        if ($ok) { $ip }
    } -ArgumentList $ip
}
$results = $jobs | Wait-Job -Timeout 20 | Receive-Job
$jobs | Remove-Job -Force -ErrorAction SilentlyContinue

$alive = $results | Where-Object { $_ } | Sort-Object { [int]($_.Split('.')[-1]) }
Write-Host "    Alive hosts:" -ForegroundColor White
foreach ($a in $alive) { Write-Host ("      $a") -ForegroundColor Green }
if (-not $alive) { Write-Host "    (none)" -ForegroundColor DarkGray }

Write-Host ""
Write-Host "[4] Updated ARP for 192.168.219.0/24" -ForegroundColor Yellow
Get-NetNeighbor -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -like '192.168.219.*' -and $_.State -in 'Reachable','Stale' } |
    Sort-Object { [int]($_.IPAddress.Split('.')[-1]) } |
    Select-Object IPAddress, LinkLayerAddress, State |
    Format-Table -AutoSize

Write-Host ""
Write-Host "[5] Probe SSH(22) + Ollama(11434) on each alive host" -ForegroundColor Yellow
foreach ($ip in $alive) {
    $ssh = $false
    $oll = $false
    $t1 = New-Object System.Net.Sockets.TcpClient
    $i1 = $t1.BeginConnect($ip, 22, $null, $null)
    if ($i1.AsyncWaitHandle.WaitOne(500, $false) -and $t1.Connected) { $ssh = $true; $t1.EndConnect($i1) }
    $t1.Close()
    $t2 = New-Object System.Net.Sockets.TcpClient
    $i2 = $t2.BeginConnect($ip, 11434, $null, $null)
    if ($i2.AsyncWaitHandle.WaitOne(500, $false) -and $t2.Connected) { $oll = $true; $t2.EndConnect($i2) }
    $t2.Close()
    Write-Host ("    {0,-16}  ssh={1,-5}  ollama={2,-5}" -f $ip, $ssh, $oll)
}

Write-Host ""
Write-Host "Done." -ForegroundColor Cyan
