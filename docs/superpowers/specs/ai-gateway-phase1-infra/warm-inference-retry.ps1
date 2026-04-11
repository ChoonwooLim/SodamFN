# Warm inference retry - extended timeout for cold model load
$ErrorActionPreference = 'Continue'

$promptFile = Join-Path $PSScriptRoot 'test-prompt.json'
$body = Get-Content -Raw -Encoding UTF8 $promptFile
$bytes = [System.Text.Encoding]::UTF8.GetBytes($body)

Write-Host "Sending request to Ollama (timeout 300s)..." -ForegroundColor Yellow
$startTime = Get-Date
try {
    $resp = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' `
        -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' `
        -TimeoutSec 300 -ErrorAction Stop
    $elapsed = (Get-Date) - $startTime
    $tokPerSec = if ($resp.eval_count -and $resp.eval_duration) {
        [math]::Round($resp.eval_count / ($resp.eval_duration / 1e9), 1)
    } else { 0 }
    Write-Host ""
    Write-Host "---RESPONSE---" -ForegroundColor Green
    Write-Host $resp.response
    Write-Host ""
    Write-Host ("Elapsed: {0:N2}s | Tokens: {1} | Speed: {2} tok/s" -f $elapsed.TotalSeconds, $resp.eval_count, $tokPerSec) -ForegroundColor Cyan
    Write-Host "PASS" -ForegroundColor Green
} catch {
    $elapsed = (Get-Date) - $startTime
    Write-Host ("FAIL after {0:N2}s: {1}" -f $elapsed.TotalSeconds, $_.Exception.Message) -ForegroundColor Red
}
