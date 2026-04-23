# Test script for query endpoint

Write-Host "=== FloatChat Query API Test ===" -ForegroundColor Cyan

# Step 1: Signup
Write-Host "`n1. Signup..." -ForegroundColor Yellow
$signupBody = @{
    username = "querytest123"
    email = "querytest@test.com"
    password = "Test123456"
} | ConvertTo-Json

$signupResp = Invoke-WebRequest -Uri "http://localhost:5000/signup" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $signupBody `
    -ErrorAction SilentlyContinue

Write-Host "Signup Status: $($signupResp.StatusCode)" -ForegroundColor Green

# Step 2: Login
Write-Host "`n2. Login..." -ForegroundColor Yellow
$loginBody = @{
    email = "querytest@test.com"
    password = "Test123456"
} | ConvertTo-Json

$loginResp = Invoke-WebRequest -Uri "http://localhost:5000/login" `
    -Method POST `
    -Headers @{"Content-Type"="application/json"} `
    -Body $loginBody `
    -ErrorAction SilentlyContinue

$loginData = $loginResp.Content | ConvertFrom-Json
$token = $loginData.data.token

Write-Host "Login Status: $($loginResp.StatusCode)" -ForegroundColor Green
Write-Host "Token: $($token.Substring(0, 20))..." -ForegroundColor Green

# Step 3: Test conceptual query
Write-Host "`n3. Testing Conceptual Query..." -ForegroundColor Yellow
$conceptualQuery = @{
    question = "What is an argofloat and how is it different from satellite observations?"
    mode = "auto"
} | ConvertTo-Json

$conceptResp = Invoke-WebRequest -Uri "http://localhost:5000/query" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    } `
    -Body $conceptualQuery `
    -ErrorAction SilentlyContinue

$conceptData = $conceptResp.Content | ConvertFrom-Json
Write-Host "Query Type: $($conceptData.type)" -ForegroundColor Green
Write-Host "Answer: $($conceptData.answer)" -ForegroundColor Green

# Step 4: Test data query
Write-Host "`n4. Testing Data Query..." -ForegroundColor Yellow
$dataQuery = @{
    question = "What is the average temperature at depth 100m in 2023?"
    mode = "auto"
} | ConvertTo-Json

$dataResp = Invoke-WebRequest -Uri "http://localhost:5000/query" `
    -Method POST `
    -Headers @{
        "Content-Type" = "application/json"
        "Authorization" = "Bearer $token"
    } `
    -Body $dataQuery `
    -ErrorAction SilentlyContinue

$dataData = $dataResp.Content | ConvertFrom-Json
Write-Host "Query Type: $($dataData.type)" -ForegroundColor Green
Write-Host "Answer: $($dataData.answer)" -ForegroundColor Green
if ($dataData.raw_rows) {
    Write-Host "Rows Found: $($dataData.raw_rows.Count)" -ForegroundColor Green
}

Write-Host "`n=== Test Complete ===" -ForegroundColor Cyan
