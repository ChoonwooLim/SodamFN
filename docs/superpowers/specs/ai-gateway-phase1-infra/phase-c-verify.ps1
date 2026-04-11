$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== C: Drive State ===" -ForegroundColor Cyan
Get-PSDrive C | Select-Object `
    @{N='Used(GB)';E={[math]::Round($_.Used/1GB,2)}},
    @{N='Free(GB)';E={[math]::Round($_.Free/1GB,2)}},
    @{N='Total(GB)';E={[math]::Round(($_.Used+$_.Free)/1GB,2)}} |
    Format-Table -AutoSize

Write-Host ""
Write-Host "=== Junction State Verification ===" -ForegroundColor Cyan
$junctions = @(
    'C:\Users\choon\.ollama\models',
    'C:\Movies',
    'C:\Users\choon\generative-models',
    'C:\Users\choon\Downloads'
)
foreach ($j in $junctions) {
    $i = Get-Item $j -Force -ErrorAction SilentlyContinue
    if ($i) {
        "{0,-45} {1,-12} -> {2}" -f $j, $i.LinkType, ($i.Target -join ',')
    } else {
        "{0} MISSING" -f $j
    }
}

Write-Host ""
Write-Host "=== Environment Variables ===" -ForegroundColor Cyan
@('HF_HOME','HF_HUB_CACHE','TRANSFORMERS_CACHE','OLLAMA_MODELS') | ForEach-Object {
    $val = [Environment]::GetEnvironmentVariable($_, 'Machine')
    "{0,-22} = {1}" -f $_, $val
}
