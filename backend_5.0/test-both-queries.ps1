# Test script for both conceptual and data queries

$baseUrl = "http://localhost:5000"
$token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiNjczNzA1YjVmN2I3ZTI4ZGZkZDVhYTY1Iiwicm9sZSI6InVzZXIiLCJpYXQiOjE3MzM3NDc3NjksImV4cCI6MTczNDM1MjU2OX0.4xd3Y_7xyeHSC1r3sP8nR4zQ1vW2xY9aB6cD5eF8gH0"

Write-Host "=== Testing Conceptual Query ===" -ForegroundColor Green
Write-Host "Question: what variables does an argo profile typically measure?" -ForegroundColor Yellow

$conceptualQuery = @{
    question = "what variables does an argo profile typically measure?"
    mode = "auto"
} | ConvertTo-Json

$conceptualResponse = Invoke-RestMethod -Uri "$baseUrl/query" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $conceptualQuery

Write-Host "Response type: $($conceptualResponse.type)" -ForegroundColor Cyan
Write-Host "Answer: $($conceptualResponse.answer)" -ForegroundColor White
Write-Host ""

Write-Host "=== Testing Data Query (Location) ===" -ForegroundColor Green
Write-Host "Question: is there any argo data available in the bay of bengal in 2002 if yes fetch it?" -ForegroundColor Yellow

$dataQuery = @{
    question = "is there any argo data available in the bay of bengal in 2002 if yes fetch it?"
    mode = "auto"
} | ConvertTo-Json

$dataResponse = Invoke-RestMethod -Uri "$baseUrl/query" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $dataQuery

Write-Host "Response type: $($dataResponse.type)" -ForegroundColor Cyan
Write-Host "SQL: $($dataResponse.sql)" -ForegroundColor White
Write-Host "Answer: $($dataResponse.answer)" -ForegroundColor White
Write-Host "Row count: $($dataResponse.raw_rows.Count)" -ForegroundColor Cyan
Write-Host ""

Write-Host "=== Testing Another Conceptual Query ===" -ForegroundColor Green
Write-Host "Question: explain how argo floats work" -ForegroundColor Yellow

$conceptual2Query = @{
    question = "explain how argo floats work"
    mode = "auto"
} | ConvertTo-Json

$conceptual2Response = Invoke-RestMethod -Uri "$baseUrl/query" `
    -Method POST `
    -Headers @{
        "Authorization" = "Bearer $token"
        "Content-Type" = "application/json"
    } `
    -Body $conceptual2Query

Write-Host "Response type: $($conceptual2Response.type)" -ForegroundColor Cyan
Write-Host "Answer: $($conceptual2Response.answer)" -ForegroundColor White
