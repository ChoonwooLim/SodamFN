# Test gemma4:e4b with Korean prompt via Ollama API
$body = @{
    model  = 'gemma4:e4b'
    prompt = '안녕하세요. 당신은 어떤 모델인가요? 한국어로 간단히 2~3문장으로 답해주세요.'
    stream = $false
} | ConvertTo-Json -Compress

Write-Host '=== Sending request... ==='
$start = Get-Date
$r = Invoke-RestMethod -Uri 'http://localhost:11434/api/generate' `
    -Method Post `
    -Body ([System.Text.Encoding]::UTF8.GetBytes($body)) `
    -ContentType 'application/json; charset=utf-8'
$elapsed = (Get-Date) - $start

Write-Host ''
Write-Host '=== Response ==='
Write-Host $r.response
Write-Host ''
Write-Host '=== Metrics ==='
'Total elapsed    : {0:N2} s' -f $elapsed.TotalSeconds
'eval_count       : {0}' -f $r.eval_count
'eval_duration    : {0:N2} s' -f ($r.eval_duration / 1e9)
'prompt_eval_count: {0}' -f $r.prompt_eval_count
'tokens/s         : {0:N2}' -f ($r.eval_count / ($r.eval_duration / 1e9))
