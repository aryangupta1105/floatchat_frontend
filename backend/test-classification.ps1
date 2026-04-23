#!/usr/bin/env powershell
# Test script for smart query classification

Write-Host "`n╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        FloatChat Query Classification Test                   ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$testQueries = @(
    @{
        question = "What is the average salinity at depth 100m in 2023?"
        expectedType = "data_query"
        description = "Data Query: Specific measurement request"
    },
    @{
        question = "What is an argofloat and how is it different from satellite observations?"
        expectedType = "conceptual"
        description = "Conceptual: Definition and comparison"
    },
    @{
        question = "What is the maximum temperature between 50m and 150m depth?"
        expectedType = "data_query"
        description = "Data Query: Specific depth range analysis"
    },
    @{
        question = "Explain how Argo floats measure ocean parameters"
        expectedType = "conceptual"
        description = "Conceptual: Method explanation"
    },
    @{
        question = "How many temperature profiles were collected in 2023?"
        expectedType = "data_query"
        description = "Data Query: Count request"
    },
    @{
        question = "What are the differences between salinity and conductivity?"
        expectedType = "conceptual"
        description = "Conceptual: Definition/difference"
    }
)

$results = @()

foreach ($test in $testQueries) {
    Write-Host "Test: $($test.description)" -ForegroundColor Yellow
    Write-Host "Question: $($test.question)" -ForegroundColor Gray
    
    $body = @{
        question = $test.question
        mode = "auto"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:5000/query" `
            -Method POST `
            -Headers @{"Content-Type"="application/json"} `
            -Body $body `
            -ErrorAction Stop
        
        $data = $response.Content | ConvertFrom-Json
        $classifiedAs = $data.meta.classified_as
        $isCorrect = $classifiedAs -eq $test.expectedType
        
        $statusColor = if ($isCorrect) { "Green" } else { "Red" }
        $statusIcon = if ($isCorrect) { "✓" } else { "✗" }
        
        Write-Host "$statusIcon Expected: $($test.expectedType), Got: $classifiedAs" -ForegroundColor $statusColor
        Write-Host "  Answer preview: $($data.answer.Substring(0, [Math]::Min(80, $data.answer.Length)))..." -ForegroundColor Gray
        Write-Host ""
        
        $results += @{
            question = $test.question
            expected = $test.expectedType
            actual = $classifiedAs
            correct = $isCorrect
        }
    }
    catch {
        Write-Host "✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host ""
    }
}

# Summary
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                      Test Summary                             ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

$passCount = ($results | Where-Object { $_.correct }).Count
$totalCount = $results.Count
$passPercentage = if ($totalCount -gt 0) { [Math]::Round(($passCount / $totalCount) * 100) } else { 0 }

Write-Host "Passed: $passCount / $totalCount ($passPercentage%)" -ForegroundColor $(if ($passPercentage -eq 100) { "Green" } else { "Yellow" })
Write-Host ""

if ($passCount -eq $totalCount) {
    Write-Host "✓ All tests passed! Query classification is working correctly." -ForegroundColor Green
} else {
    Write-Host "Failed classifications:" -ForegroundColor Yellow
    $results | Where-Object { -not $_.correct } | ForEach-Object {
        Write-Host "  - Expected: $($_.expected), Got: $($_.actual)" -ForegroundColor Yellow
        Write-Host "    Question: $($_.question)" -ForegroundColor Gray
    }
}
