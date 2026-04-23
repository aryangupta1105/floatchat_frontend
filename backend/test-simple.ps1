Write-Host "`n=== Testing Conceptual Query ===" -ForegroundColor Cyan

$body = @{
    question = "What is an argofloat and how is it different from satellite observations?"
    mode = "auto"
} | ConvertTo-Json

Write-Host "Sending conceptual query..." -ForegroundColor Yellow
$response = Invoke-WebRequest -Uri "http://localhost:5000/query" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $body `
    -ErrorAction SilentlyContinue

$data = $response.Content | ConvertFrom-Json
Write-Host "Type: $($data.type)" -ForegroundColor Green
Write-Host "Classification: $($data.meta.classified_as)" -ForegroundColor Green
Write-Host "Answer (first 200 chars): $($data.answer.Substring(0, 200))..." -ForegroundColor White
