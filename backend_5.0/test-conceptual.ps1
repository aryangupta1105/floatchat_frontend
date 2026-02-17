$body = @{
    question = "What is an argofloat and how is it different from satellite observations?"
    mode = "auto"
} | ConvertTo-Json

Write-Host "Sending request..." -ForegroundColor Yellow
Write-Host "Body: $body`n" -ForegroundColor Gray

$response = Invoke-WebRequest -Uri "http://localhost:5000/query" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body `
    -ErrorAction SilentlyContinue

$data = $response.Content | ConvertFrom-Json

Write-Host "Response:" -ForegroundColor Green
Write-Host "Type: $($data.type)" -ForegroundColor Cyan
Write-Host "Classification: $($data.meta.classified_as)" -ForegroundColor Cyan
Write-Host "Answer: $($data.answer)" -ForegroundColor White
Write-Host "Duration: $($data.meta.durationMs)ms" -ForegroundColor Gray
