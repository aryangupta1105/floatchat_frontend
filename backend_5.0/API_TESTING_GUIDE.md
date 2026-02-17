# API Testing Guide

## Quick Start

### 1. Signup (Create Account)
```bash
curl -X POST http://localhost:5000/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Test123456"}'
```

**Response:**
```json
{
  "message": "Signup successful",
  "user": {
    "id": "...",
    "username": "testuser",
    "email": "test@example.com"
  },
  "token": "eyJhbGc..."
}
```

### 2. Login (Get Token)
```bash
curl -X POST http://localhost:5000/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123456"}'
```

**Response:**
```json
{
  "message": "Login successful",
  "user": {
    "id": "...",
    "username": "testuser",
    "email": "test@example.com"
  },
  "token": "eyJhbGc..."
}
```

### 3. Query Data (with token)
Save the token from signup or login, then:

```bash
TOKEN="<your_token_here>"

curl -X POST http://localhost:5000/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"What is the average temperature at 1000m depth?","mode":"auto"}'
```

**Response:**
```json
{
  "ok": true,
  "data": {
    "type": "data_query",
    "mode": "auto",
    "question": "What is the average temperature at 1000m depth?",
    "answer": "The average temperature at 1000m depth is...",
    "sql": "SELECT AVG(TEMP) FROM core_levels WHERE PRES >= 900 AND PRES <= 1100",
    "raw_rows": [...],
    "meta": {...}
  }
}
```

### 4. Test Endpoints (No Auth Required)

#### Health Check
```bash
curl http://localhost:5000/health
```

#### Test Echo (debug JSON parsing)
```bash
curl -X POST http://localhost:5000/test/echo \
  -H "Content-Type: application/json" \
  -d '{"test":"data"}'
```

#### Test Query (debug query parsing)
```bash
curl -X POST http://localhost:5000/test/query-test \
  -H "Content-Type: application/json" \
  -d '{"question":"test question","mode":"auto"}'
```

---

## PowerShell Testing Examples

### 1. Signup
```powershell
$body = @{
    username = "pwshuser"
    email = "pwsh@example.com"
    password = "Test123456"
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://localhost:5000/signup" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $body

$response.Content | ConvertFrom-Json
```

### 2. Login & Get Token
```powershell
$loginBody = @{
    email = "pwsh@example.com"
    password = "Test123456"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/login" `
  -Method POST `
  -Headers @{"Content-Type" = "application/json"} `
  -Body $loginBody

$loginData = $loginResponse.Content | ConvertFrom-Json
$TOKEN = $loginData.token
Write-Host "Token: $TOKEN"
```

### 3. Query with Token
```powershell
$queryBody = @{
    question = "What is the average temperature at 1000m?"
    mode = "auto"
} | ConvertTo-Json

$queryResponse = Invoke-WebRequest -Uri "http://localhost:5000/query" `
  -Method POST `
  -Headers @{
      "Content-Type" = "application/json"
      "Authorization" = "Bearer $TOKEN"
  } `
  -Body $queryBody

$queryResponse.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
```

---

## Endpoint Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/signup` | ❌ | Register new user |
| POST | `/login` | ❌ | Login and get token |
| POST | `/query` | ✅ | Intelligent query routing |
| POST | `/api/chat/query` | ✅ | Intelligent query routing (with prefix) |
| GET | `/health` | ❌ | Server health check |
| GET | `/test/status` | ❌ | Test endpoint status |
| POST | `/test/echo` | ❌ | Echo request body (for debugging) |
| POST | `/test/query-test` | ❌ | Test query parsing (no auth) |

---

## Common Errors

### "Invalid JSON"
- Use proper JSON formatting
- In curl: use single quotes and escape double quotes
- In PowerShell: use `ConvertTo-Json` to properly format

### "Unauthorized" (401)
- Missing `Authorization` header
- Token format should be: `Bearer <token>`
- Check token is not expired

### "Route not found" (404)
- Check the full path (remember `/api` prefix for API routes)
- Auth routes are at both `/signup` and `/api/auth/signup`
- Chat routes are at both `/query` and `/api/chat/query`

---

## Server Architecture

```
Client
  ↓ (HTTP POST with JSON body)
Express App (app.js)
  ↓ JSON parser middleware
  ↓ Auth middleware (if needed)
Route Handler
  ↓ (passthrough to controller)
Controller
  ↓ (business logic)
Service Layer
  ↓ (database/external API calls)
Response
```

