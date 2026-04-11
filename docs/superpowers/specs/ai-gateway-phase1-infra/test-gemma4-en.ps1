# Output UTF-8 to console
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8

# Test gemma4:e4b with English prompt
$body = @{
    model  = 'gemma4:e4b'
    prompt = 'In one short paragraph, tell me what model you are and list 3 things you can help with.'
    stream = $false
} | ConvertTo-Json -Compress

Write-Host '=== Sending request (English) ==='
$r = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' `
    -Method Post `
    -Body $body `
    -ContentType 'application/json'

Write-Host ''
Write-Host '=== Response ==='
Write-Host $r.response
Write-Host ''
Write-Host '=== Metrics ==='
'eval_count       : {0}' -f $r.eval_count
'tokens/s         : {0:N2}' -f ($r.eval_count / ($r.eval_duration / 1e9))

# Now test Korean with explicit UTF-8 body
Write-Host ''
Write-Host '=== Sending request (Korean, UTF-8 bytes) ==='
$korPrompt = '한국어로 답해주세요. 당신의 이름과 잘하는 일 세 가지를 한 문단으로 소개해주세요.'
$body2 = @{
    model  = 'gemma4:e4b'
    prompt = $korPrompt
    stream = $false
} | ConvertTo-Json -Compress
$utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body2)

$r2 = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' `
    -Method Post `
    -Body $utf8Bytes `
    -ContentType 'application/json; charset=utf-8'

Write-Host ''
Write-Host '=== Korean Response ==='
Write-Host $r2.response
Write-Host ''
'Korean tokens/s  : {0:N2}' -f ($r2.eval_count / ($r2.eval_duration / 1e9))
