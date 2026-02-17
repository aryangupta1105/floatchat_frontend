# FloatChat Backend Integration Testing Guide

## Quick Start Verification Checklist

### Step 1: Verify All Services Are Running

```bash
# Check Main Backend (Node.js)
curl -s http://localhost:5000/health || echo "❌ Backend not running"

# Check RAG Service (Python)
curl -s http://localhost:8000/health || echo "❌ RAG not running"

# Check Ingestion Service (Python)
curl -s http://localhost:8100/health || echo "❌ Ingestion not running"
```

Expected output:
```json
✅ Main Backend (5000): "ok"
✅ RAG Service (8000): "ok"
✅ Ingestion Service (8100): "ok"
```

---

### Step 2: Verify Database Connections

#### PostgreSQL (ARGO Data)

```bash
# Test connection from ingestion service
curl -X POST http://localhost:8100/ingest/status | jq .

# Expected: Returns ingestion status including connection validation
```

#### MongoDB (Chat History & Users)

```bash
# Verify MongoDB connection status
# Check logs of main backend for connection messages
docker logs floatchat-backend 2>&1 | grep -i "mongo"
```

---

### Step 3: Test Authentication Flow

#### Register New User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'
```

Expected response:
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "user_123",
      "email": "test@example.com",
      "username": "testuser"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### Save Token & Test Login

```bash
# Save token
TOKEN="<token_from_register_or_login>"

# Login
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "TestPassword123!"
  }'

# Get profile (protected route)
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/auth/me
```

---

### Step 4: Test Query Routing (Core Feature)

#### Test Auto-Classification (Conceptual Query)

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is an Argo float?",
    "mode": "auto"
  }'
```

**Expected behavior:**
- Auto-classifies as "conceptual"
- Calls LLM directly (no SQL generation)
- Returns natural language explanation
- No raw_rows or sql in response

**Sample response:**
```json
{
  "ok": true,
  "data": {
    "type": "conceptual",
    "mode": "auto",
    "question": "What is an Argo float?",
    "answer": "An Argo float is a robotic oceanographic instrument...",
    "sql": null,
    "raw_rows": [],
    "meta": {
      "durationMs": 1240,
      "classified_as": "conceptual"
    }
  }
}
```

#### Test Auto-Classification (Data Query)

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me temperature profiles at 1000m depth",
    "mode": "auto"
  }'
```

**Expected behavior:**
- Auto-classifies as "data_query"
- Calls RAG service → generates SQL
- Executes SQL against PostgreSQL
- Returns data + LLM explanation
- Includes sql and raw_rows in response

**Sample response:**
```json
{
  "ok": true,
  "data": {
    "type": "data_query",
    "mode": "auto",
    "question": "Show me temperature profiles at 1000m depth",
    "answer": "Found 456 profiles with temperature data at ~1000m depth...",
    "sql": "SELECT platform_number, cycle, temperature FROM core_levels WHERE depth BETWEEN 950 AND 1050...",
    "raw_rows": [
      {"platform_number": "1900042", "cycle": 1, "temperature": 18.5},
      {"platform_number": "1900043", "cycle": 2, "temperature": 17.8}
    ],
    "meta": {
      "durationMs": 523,
      "classified_as": "data_query"
    }
  }
}
```

#### Test Forced Mode (Data Query)

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is an Argo float?",
    "mode": "data_query"
  }'
```

**Expected behavior:**
- Forces data_query mode (ignores auto-classification)
- Attempts to call RAG service
- May fail or return empty results (question is conceptual, not data)
- Still returns sql attempt

#### Test Forced Mode (Conceptual)

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is the average temperature at 100m?",
    "mode": "conceptual"
  }'
```

**Expected behavior:**
- Forces conceptual mode
- Calls LLM directly (no RAG)
- LLM attempts to answer from general knowledge
- No SQL or actual data rows

---

### Step 5: Test Ingestion API

#### Trigger Manual Ingestion

```bash
# No token needed for ingestion API

curl -X POST http://localhost:8100/ingest/run \
  -H "Content-Type: application/json" \
  -d '{
    "process_all": true,
    "no_db": false
  }'
```

**Expected response (if files available):**
```json
{
  "status": "success",
  "took_seconds": 45.23,
  "summary": {
    "processed_profiles": 10,
    "rows_written": 1250,
    "errors": []
  }
}
```

**Expected response (if ingestion already running):**
```json
{
  "ok": false,
  "error": {
    "message": "Ingestion already in progress",
    "code": "INGEST_RUNNING"
  }
}
```

#### Check Ingestion Status

```bash
curl http://localhost:8100/ingest/status
```

**Expected response:**
```json
{
  "ok": true,
  "data": {
    "status": "idle",
    "is_running": false,
    "last_started_at": "2025-01-15T10:30:00Z",
    "last_finished_at": "2025-01-15T10:45:32Z",
    "last_runtime_seconds": 45.32,
    "summary": {
      "processed_profiles": 10,
      "rows_written": 1250,
      "errors": []
    }
  }
}
```

---

### Step 6: Test Chat History (Protected Route)

```bash
TOKEN="<your_jwt_token>"

# Create a chat entry by asking a question
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show profiles with DOXY > 100",
    "mode": "auto"
  }'

# Retrieve chat history
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/chat/history?limit=5"
```

**Expected response:**
```json
{
  "ok": true,
  "data": {
    "history": [
      {
        "id": "chat_id_1",
        "question": "Show profiles with DOXY > 100",
        "answer": "Found 234 profiles...",
        "timestamp": "2025-01-15T10:30:00Z",
        "durationMs": 523,
        "type": "data_query"
      }
    ]
  }
}
```

---

### Step 7: Test Alert Management (Protected Route)

#### Create Alert

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/alerts/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Temperature Alert",
    "variable": "TEMP",
    "condition": "above",
    "threshold": 25.0,
    "depth_range": [100, 500],
    "platform": "1900042",
    "notification_channel": "email",
    "frequency": 30
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "alert": {
      "id": "alert_123",
      "user_id": "user_123",
      "name": "High Temperature Alert",
      "is_active": true
    }
  }
}
```

#### List Alerts

```bash
TOKEN="<your_jwt_token>"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/alerts?limit=10"
```

#### Delete Alert

```bash
TOKEN="<your_jwt_token>"
ALERT_ID="alert_123"

curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/alerts/$ALERT_ID"
```

---

### Step 8: Test Anomaly Detection

```bash
TOKEN="<your_jwt_token>"

curl -X POST http://localhost:5000/api/anomalies/detect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variable": "TEMP",
    "platform": "1900042",
    "date_from": "2023-01-01",
    "date_to": "2023-12-31",
    "method": "zscore",
    "threshold": 2.0
  }'
```

**Expected response:**
```json
{
  "ok": true,
  "data": {
    "variable": "TEMP",
    "method": "zscore",
    "total_points": 5432,
    "anomalies_detected": 47,
    "anomalies": [
      {
        "profile_key": "1900042:5",
        "depth": 1000,
        "value": 25.1,
        "expected_range": [18.0, 22.0],
        "zscore": 2.3,
        "severity": "medium"
      }
    ],
    "statistics": {
      "mean": 19.5,
      "std": 2.1
    }
  }
}
```

---

### Step 9: Test Visualization

```bash
TOKEN="<your_jwt_token>"

curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/visualization/profile?profile_key=1900042:5&variables=TEMP,PSAL,DOXY"
```

**Expected response:**
```json
{
  "ok": true,
  "data": {
    "profile_key": "1900042:5",
    "series": [
      {
        "name": "Temperature",
        "unit": "°C",
        "variable": "TEMP",
        "points": [
          {"depth": 0, "value": 23.1, "qc": "1"},
          {"depth": 10, "value": 22.7, "qc": "1"}
        ]
      }
    ]
  }
}
```

---

## Diagnostic Commands

### Check Service Logs

```bash
# Main Backend
docker logs floatchat-backend | tail -50

# RAG Service
docker logs floatchat-rag | tail -50

# Ingestion Service
docker logs floatchat-ingestion | tail -50
```

### Verify Environment Variables

```bash
# Check main backend env
docker exec floatchat-backend env | grep -E "RAG_|INGEST_|JWT_|DATABASE"

# Check ingestion env
docker exec floatchat-ingestion env | grep -E "INGEST_|POSTGRES"
```

### Test Database Connectivity

```bash
# PostgreSQL (from any container with psql)
docker exec floatchat-ingestion psql -h postgres -U postgres -d argo_bio -c "SELECT COUNT(*) FROM profile_meta;"

# MongoDB (from main backend)
docker exec floatchat-backend node -e "
  const mongoose = require('mongoose');
  mongoose.connect(process.env.DATABASE_URL).then(
    () => console.log('✅ MongoDB connected'),
    e => console.log('❌ MongoDB error:', e.message)
  );
"
```

### Manual SQL Query Test

```bash
# Test if query orchestrator can generate SQL
curl -X POST http://localhost:8000/rag \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Average temperature at 100m depth"
  }'
```

---

## Performance Testing

### Test Query Response Time

```bash
TOKEN="<your_jwt_token>"

# Measure time for conceptual query (should be ~1-2 seconds)
time curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "What is Argo?", "mode": "auto"}' | jq .

# Measure time for data query (should be ~1-3 seconds)
time curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question": "Show temperature profiles", "mode": "auto"}' | jq .
```

### Load Test (Simple)

```bash
# Install Apache Bench if not available
# apt-get install apache2-utils

# 100 requests, 10 concurrent
ab -n 100 -c 10 http://localhost:5000/health

# Measure ingestion API
ab -n 10 -c 1 -p /dev/null \
  -H "Content-Type: application/json" \
  http://localhost:8100/ingest/status
```

---

## Scheduler Verification

### Check if Scheduler is Running

```bash
# Check env var
docker exec floatchat-ingestion env | grep INGEST_SCHEDULER

# Look for scheduler log messages
docker logs floatchat-ingestion | grep -i "schedul"

# Check last ingestion run
curl http://localhost:8100/ingest/status | jq .data.last_started_at
```

### Test with Short Interval

To verify scheduler works without waiting 6 hours:

```bash
# Set scheduler interval to 1 minute (60 seconds)
docker exec floatchat-ingestion /bin/bash -c "
  export INGEST_SCHEDULER_INTERVAL_SECONDS=60
  # Restart service for env to take effect
"

# Monitor logs
docker logs -f floatchat-ingestion | grep -i "schedul"

# After 1+ minute, check status changed
curl http://localhost:8100/ingest/status | jq .
```

---

## Troubleshooting

### Issue: "RAG service unreachable"

```bash
# Check RAG_SERVICE_URL in main backend
docker exec floatchat-backend env | grep RAG_SERVICE_URL

# Verify RAG service is running
curl http://localhost:8000/health

# Check network connectivity between containers
docker exec floatchat-backend curl http://rag:8000/health
```

### Issue: "Ingestion already in progress" (stuck)

```bash
# Check ingestion service status
curl http://localhost:8100/ingest/status | jq .data.is_running

# If stuck, restart service
docker restart floatchat-ingestion

# Check logs for errors
docker logs floatchat-ingestion | tail -100
```

### Issue: "Invalid JWT token"

```bash
# Verify JWT_SECRET matches across services
docker exec floatchat-backend env | grep JWT_SECRET

# Generate new token by logging in again
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "..."}' | jq .data.token

# Use new token in requests
```

### Issue: "PostgreSQL connection failed"

```bash
# Test PostgreSQL directly
docker exec floatchat-ingestion psql "$POSTGRES_DSN" -c "SELECT 1"

# Check DSN format
echo $POSTGRES_DSN

# Verify tables exist
docker exec floatchat-ingestion psql "$POSTGRES_DSN" -c "\dt"
```

### Issue: "MongoDB connection failed"

```bash
# Check MongoDB URI
docker exec floatchat-backend env | grep DATABASE_URL

# Check if MongoDB is running
docker ps | grep mongo

# Test connection with mongosh
docker run -it mongo mongosh "mongodb+srv://..."
```

---

## Success Criteria

All tests should pass:

- [ ] Health check: All 3 services return "ok"
- [ ] Auth: Register → login → get profile
- [ ] Auto-classification: Conceptual question returns type="conceptual"
- [ ] Auto-classification: Data question returns type="data_query" with SQL
- [ ] Query modes: Can force "data_query" and "conceptual" modes
- [ ] Ingestion: Manual trigger returns success or "already running"
- [ ] Chat history: Returns previous queries
- [ ] Alerts: Can create, list, update, delete alerts
- [ ] Anomalies: Detect endpoint returns anomalies
- [ ] Visualization: Profile visualization data returns correctly
- [ ] Scheduler: Last ingestion time updates periodically

---

## Next Steps if Issues Found

1. **Review Logs:** Check Docker logs for all 3 services
2. **Environment:** Verify all env vars are set correctly
3. **Network:** Confirm containers can reach each other
4. **Database:** Validate PostgreSQL and MongoDB connectivity
5. **Code:** Check if recent changes have syntax errors
6. **Restart:** Restart services: `docker-compose down && docker-compose up -d`

---

**Testing Guide Version:** 1.0
**Last Updated:** 2025-01-15
