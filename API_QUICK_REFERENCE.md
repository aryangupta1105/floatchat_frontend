# FloatChat API Quick Reference

## Service URLs
```
Main Backend:    http://localhost:5000
RAG Service:     http://localhost:8000
Ingestion API:   http://localhost:8100
```

## Environment Setup
```bash
# Main Backend
export PORT=5000
export JWT_SECRET="your_secret_key"
export DATABASE_URL="mongodb+srv://..."
export POSTGRES_DSN="postgresql://..."
export RAG_SERVICE_URL="http://localhost:8000"
export INGEST_SERVICE_URL="http://localhost:8100"
export LLM_API_KEY="your_groq_key"
export INGEST_SCHEDULER_ENABLED="true"
export INGEST_SCHEDULER_INTERVAL_SECONDS="21600"

# RAG Service (port 8000)
# Runs on default, check vector_db/server.py

# Ingestion Service (port 8100)
export INGEST_PORT=8100
export INGEST_DSN="postgresql://..."
export INGEST_SCHEDULER_ENABLED="true"
export FLASK_DEBUG="false"
```

---

## Authentication

### Register
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "SecurePass123!"
  }' | jq .data.token
```

### Login
```bash
TOKEN=$(curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePass123!"
  }' | jq -r '.data.token')

echo $TOKEN
```

### Use Token
```bash
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/chat/history
```

---

## Core Queries

### Conceptual Question
```bash
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is an Argo float?",
    "mode": "auto"
  }' | jq .
```

**Response:** `type="conceptual"`, `sql=null`, natural language answer

### Data Question
```bash
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me DOXY profiles at 1000m depth",
    "mode": "auto"
  }' | jq .
```

**Response:** `type="data_query"`, includes `sql` and `raw_rows`

### Force Mode
```bash
# Force data_query mode
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is Argo?",
    "mode": "data_query"
  }' | jq .

# Force conceptual mode
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Show me DOXY at 500m",
    "mode": "conceptual"
  }' | jq .
```

---

## Ingestion Control

### Trigger Ingestion
```bash
curl -X POST http://localhost:8100/ingest/run \
  -H "Content-Type: application/json" \
  -d '{
    "process_all": true,
    "no_db": false
  }' | jq .
```

### Check Status
```bash
curl http://localhost:8100/ingest/status | jq .

# OR via main backend proxy
curl http://localhost:5000/api/ingest/status | jq .
```

### Health Checks
```bash
curl http://localhost:5000/health      # Main
curl http://localhost:8000/health      # RAG
curl http://localhost:8100/health      # Ingestion
```

---

## Alerts

### Create Alert
```bash
curl -X POST http://localhost:5000/api/alerts/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High TEMP Alert",
    "variable": "TEMP",
    "condition": "above",
    "threshold": 25.0,
    "depth_range": [100, 500],
    "platform": "1900042"
  }' | jq .
```

### List Alerts
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/alerts?limit=10" | jq .
```

### Delete Alert
```bash
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/alerts/ALERT_ID" | jq .
```

---

## Visualization

### Get Profile Data
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/visualization/profile?profile_key=1900042:5&variables=TEMP,PSAL,DOXY" | jq .
```

### Compare Profiles
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/visualization/profiles-comparison?profile_keys=1900042:1,1900042:2,1900042:3" | jq .
```

---

## Anomalies

### Detect Anomalies
```bash
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
  }' | jq .
```

### Summary
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/anomalies/summary?limit=10&severity=high" | jq .
```

---

## Chat History

### Get History
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/chat/history?limit=5&offset=0" | jq .
```

---

## Error Response Format

All errors follow this pattern:

```json
{
  "ok": false,
  "error": {
    "message": "Human-readable error",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

**Common Codes:**
- `INVALID_INPUT` - 400
- `UNAUTHORIZED` - 401  
- `NOT_FOUND` - 404
- `CONFLICT` - 409 (e.g., ingestion already running)
- `SERVER_ERROR` - 500

---

## Docker Commands

### Start All Services
```bash
docker-compose up -d
```

### Check Status
```bash
docker-compose ps
```

### View Logs
```bash
docker logs floatchat-backend
docker logs floatchat-rag
docker logs floatchat-ingestion
```

### Stop Services
```bash
docker-compose down
```

### Restart Service
```bash
docker restart floatchat-backend
```

---

## Variable Keywords for Auto-Classification

### Data Query (Will use RAG → SQL)
- profile, depth, pressure
- temperature, salinity, doxy, chla, bbp
- variance, anomaly, trend
- between X and Y
- at X meters
- where, from/to, platform, cycle

### Conceptual (Will use LLM only)
- what is, how, explain
- definition, history, background
- why, when, which, who

---

## Testing Examples

### Full Data Query Flow
```bash
# 1. Login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}' | jq -r '.data.token')

# 2. Ask data question
curl -s -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Show me DOXY at 1000m depth","mode":"auto"}' | jq .

# 3. Check history
curl -s -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/chat/history | jq .
```

### Scheduler Test
```bash
# Set to 1-minute interval for testing
export INGEST_SCHEDULER_INTERVAL_SECONDS=60

# Restart service
docker restart floatchat-ingestion

# Monitor logs
docker logs -f floatchat-ingestion | grep -i schedul
```

---

## Performance Benchmarks

| Operation | Expected Time |
|-----------|---------------|
| Register/Login | < 500ms |
| Conceptual query | 1-2 sec |
| Data query | 2-5 sec |
| Ingestion 50 files | 45-60 sec |
| Anomaly detection | 1-3 sec |

---

## Troubleshooting

### "RAG service unreachable"
```bash
docker exec floatchat-backend curl http://rag:8000/health
```

### "Already ingesting"
```bash
curl http://localhost:8100/ingest/status | jq .data.is_running
```

### "Token expired"
```bash
# Get new token
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"...","password":"..."}'
```

### Check Service Connectivity
```bash
# From main backend container
docker exec floatchat-backend curl http://rag:8000/health
docker exec floatchat-backend curl http://ingestion:8100/health

# From ingestion container  
docker exec floatchat-ingestion psql "$POSTGRES_DSN" -c "SELECT 1"
```

---

## Key Files

| Path | Purpose |
|------|---------|
| `backend_5.0/services/queryOrchestrator.js` | Query routing logic |
| `backend_5.0/services/llmService.js` | LLM calls |
| `backend_5.0/routes/ingest.routes.js` | Ingestion API proxy |
| `ingestion/server.py` | Flask API + scheduler |
| `ingestion/ingest.py` | Core NetCDF processing |
| `vector_db/server.py` | RAG service |
| `.env` | Configuration |

---

## Documentation Files

- `BACKEND_API_REFERENCE.md` - Complete API documentation
- `INTEGRATION_TESTING_GUIDE.md` - Step-by-step test procedures
- `IMPLEMENTATION_COMPLETION_REPORT.md` - Detailed implementation report
- `API_QUICK_REFERENCE.md` - This file

---

**Last Updated:** 2025-01-15  
**Version:** 2.0.0
