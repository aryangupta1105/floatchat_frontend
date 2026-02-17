# FloatChat Backend v2.0 - Complete Implementation

## Overview

FloatChat Backend v2.0 is a comprehensive oceanographic data analysis platform with intelligent query routing, automatic data ingestion, and seamless microservice integration. Users can ask natural language questions about Argo float data, and the system intelligently determines whether to query a vector database for data-driven insights or provide conceptual explanations.

**Status:** ✅ Core Implementation Complete | Ready for Testing & Deployment

---

## What's New in v2.0

### 🎯 Smart Query Routing
- **Automatic Classification**: System intelligently identifies data vs conceptual questions
- **Dual Paths**: Data queries use RAG→SQL→DB flow, conceptual use LLM directly
- **Mode Override**: Users can force specific query type if desired

### 📅 Auto Scheduler
- **6-Hour Ingestion**: Automatic processing of new .nc files every 6 hours
- **Configurable**: Adjust scheduler interval via environment variables
- **Background Thread**: Runs independently without blocking API

### 🧬 Enhanced Data Support
- **BGC Variables**: Added support for DOXY, CHLA, BBP, BBP470, BBP532, BBP700, CDOM, NITRATE, PH_IN_SITU_TOTAL
- **Mode Detection**: Automatically detects Real-time vs Delayed data modes
- **Quality Control**: Maintains data quality flags and metadata

### 🔌 Microservice Integration
- **Decoupled Architecture**: Main backend, RAG service, and Ingestion service operate independently
- **HTTP APIs**: Services communicate via REST endpoints (no direct DB access)
- **Scalable Design**: Each service can be deployed, scaled, and updated independently

### 📚 Comprehensive Documentation
- **API Reference**: 950+ line reference with all endpoints and examples
- **Testing Guide**: Step-by-step procedures for verifying all functionality
- **Quick Reference**: Developer cheat sheet with common commands

---

## Quick Start (Development)

### 1. Start Services

```bash
# Terminal 1: Main Backend
cd backend_5.0
npm install
npm start

# Terminal 2: RAG Service
cd vector_db
pip install -r requirements.txt
python server.py

# Terminal 3: Ingestion Service
cd ingestion
pip install -r requirements.txt
python server.py
```

### 2. Verify Services Running

```bash
curl http://localhost:5000/health   # Main Backend
curl http://localhost:8000/health   # RAG Service
curl http://localhost:8100/health   # Ingestion Service
```

### 3. Test Query Routing

```bash
# Register & login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!"}' \
  | jq -r '.data.token')

# Ask a conceptual question
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is an Argo float?"}' | jq .data.type

# Should output: "conceptual"

# Ask a data question
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"Show me temperature at 1000m depth"}' | jq .data.type

# Should output: "data_query"
```

---

## Architecture

### Three-Service Model

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend                            │
│                   (React/Web)                           │
└────────────────────────┬────────────────────────────────┘
                         │
              ┌──────────▼──────────┐
              │  Main Backend       │
              │  (Node/Express)     │
              │  Port: 5000         │
              │  ┌────────────────┐ │
              │  │ Auth Service   │ │
              │  │ Query Router   │ │
              │  │ Chat History   │ │
              │  │ Alerts         │ │
              │  └────────────────┘ │
              └────┬──────────┬─────┘
                   │          │
         ┌─────────▼────┐  ┌─▼──────────┐
         │ RAG Service  │  │ Ingestion  │
         │ (Python)     │  │ (Python)   │
         │ Port: 8000   │  │ Port: 8100 │
         │ - Semantic   │  │ - Parse    │
         │   search     │  │   NetCDF   │
         │ - SQL gen    │  │ - Scheduler│
         │ - Vector DB  │  │ - Pipeline │
         └──────┬───────┘  └──┬────────┘
                │             │
         ┌──────▼────────┐ ┌──▼─────────┐
         │Qdrant Vector  │ │PostgreSQL  │
         │Database       │ │(ARGO Data) │
         └───────────────┘ └────────────┘
```

### Service Responsibilities

| Service | Port | Responsibility | Tech Stack |
|---------|------|-----------------|-----------|
| **Main Backend** | 5000 | API Gateway, auth, orchestration, chat | Node/Express, MongoDB |
| **RAG Service** | 8000 | Semantic search, SQL generation | Python/Flask, Qdrant |
| **Ingestion** | 8100 | Data pipelines, auto-scheduler | Python/Flask, PostgreSQL |

---

## Core Features

### 1. Intelligent Query Routing

#### Problem Solved
Previously, the system treated all questions the same way. Now:
- "What is an Argo float?" → Send to LLM (no database access)
- "Show me DOXY at 1000m" → Generate SQL, query database

#### How It Works
```
User Question
  ↓
Classification (keyword analysis)
  ├→ Data Question: Has keywords (depth, TEMP, DOXY, etc.)
  │   ↓
  │   Call RAG Service
  │   ↓
  │   Generate SQL
  │   ↓
  │   Execute against PostgreSQL
  │   ↓
  │   LLM explains results
  │   ↓
  │   Return: sql + rows + explanation
  │
  └→ Conceptual Question: Definition, explanation, how-to
      ↓
      Call LLM with oceanography context
      ↓
      Return: natural language answer only
```

#### Example Responses

**Conceptual Question:**
```json
{
  "type": "conceptual",
  "question": "What is an Argo float?",
  "answer": "An Argo float is a robotic oceanographic instrument...",
  "sql": null,
  "raw_rows": [],
  "meta": {"durationMs": 1240, "classified_as": "conceptual"}
}
```

**Data Question:**
```json
{
  "type": "data_query",
  "question": "Show me DOXY at 1000m",
  "answer": "Found 456 profiles with DOXY measurements at ~1000m...",
  "sql": "SELECT * FROM bgc_levels WHERE bgc_variable='DOXY' AND depth BETWEEN 950 AND 1050",
  "raw_rows": [
    {"profile_key": "1900042:5", "depth": 1000, "doxy": 98.5},
    ...
  ],
  "meta": {"durationMs": 523, "classified_as": "data_query"}
}
```

### 2. Automatic Data Ingestion Scheduler

#### How It Works
- Background thread runs every 6 hours (configurable)
- Scans `source_files/` directory for new `.nc` files
- Extracts profiles and BGC variables
- Upserts to PostgreSQL
- Moves processed files to `processed/` directory
- Updates global ingestion status

#### Configuration
```env
INGEST_SCHEDULER_ENABLED=true                      # Enable/disable
INGEST_SCHEDULER_INTERVAL_SECONDS=21600            # Default: 6 hours
INGEST_DSN=postgresql://user:pass@host/argo_bio    # Target database
```

#### Status Check
```bash
curl http://localhost:8100/ingest/status
```

Response:
```json
{
  "status": "idle",
  "is_running": false,
  "last_started_at": "2025-01-15T10:30:00Z",
  "last_finished_at": "2025-01-15T10:45:32Z",
  "summary": {
    "processed_profiles": 10,
    "rows_written": 1250,
    "errors": []
  }
}
```

### 3. Enhanced Data Support

#### Supported Variables
- **Core**: PRES (Pressure), TEMP (Temperature), PSAL (Salinity)
- **BGC (BioGeochemical)**:
  - DOXY - Dissolved Oxygen
  - CHLA - Chlorophyll-a
  - BBP - Backscatter
  - BBP470, BBP532, BBP700 - Wavelength-specific backscatter
  - CDOM - Colored Dissolved Organic Matter
  - NITRATE - Nitrate concentration
  - PH_IN_SITU_TOTAL - pH

#### Data Mode Detection
- **Real-time (R)**: Filename starts with 'R', stores raw values
- **Delayed (D)**: Filename starts with 'D', stores adjusted values

#### Quality Control
All measurements include:
- Raw value + Adjusted value
- Quality control flags
- Source file reference
- Data mode indicator

### 4. User Authentication & Authorization

#### Registration
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "john",
    "email": "john@example.com",
    "password": "SecurePassword123!"
  }'
```

#### Login
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "SecurePassword123!"
  }'
```

#### Protected Routes
All `/api/*` routes (except auth/register/login) require:
```
Authorization: Bearer <jwt_token>
```

**Token Details:**
- Algorithm: HS256
- Expiration: 7 days (configurable)
- Stored in: JWT_SECRET (env variable)

### 5. Chat History & Persistence

All queries are logged to MongoDB:
```json
{
  "_id": ObjectId,
  "userId": ObjectId,
  "question": "Show me DOXY profiles",
  "answer": "Found 234 profiles...",
  "sql": "SELECT * FROM bgc_levels...",
  "type": "data_query",
  "durationMs": 523,
  "createdAt": "2025-01-15T10:30:00Z"
}
```

Retrieve history:
```bash
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:5000/api/chat/history?limit=10&offset=0"
```

### 6. Alert Management

Create personalized alerts for data conditions:

```bash
curl -X POST http://localhost:5000/api/alerts/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "High Temperature",
    "variable": "TEMP",
    "condition": "above",
    "threshold": 25.0,
    "depth_range": [100, 500],
    "platform": "1900042"
  }'
```

Alerts trigger when:
- New data ingested matching conditions
- Anomalies detected
- Thresholds exceeded

### 7. Anomaly Detection

Detect statistical outliers in data:

```bash
curl -X POST http://localhost:5000/api/anomalies/detect \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "variable": "DOXY",
    "method": "zscore",
    "threshold": 2.0
  }'
```

Methods supported:
- **Z-Score**: Statistical standard deviations (current)
- **IQR**: Interquartile range (future)
- **Isolation Forest**: ML-based (future)

---

## Implementation Details

### Files Modified

| File | Changes | Purpose |
|------|---------|---------|
| `backend_5.0/services/queryOrchestrator.js` | NEW | Query routing logic |
| `backend_5.0/services/llmService.js` | Enhanced | Generic LLM calls |
| `backend_5.0/routes/chat.routes.js` | Enhanced | New `/query` endpoint |
| `backend_5.0/controllers/chatController.js` | Enhanced | Query mode handler |
| `backend_5.0/routes/ingest.routes.js` | NEW | Ingestion API proxy |
| `backend_5.0/routes/index.js` | Updated | Route registration |
| `backend_5.0/.env` | Expanded | Config variables |
| `ingestion/server.py` | NEW | Flask API + scheduler |
| `ingestion/ingest.py` | Fixed | Numpy compatibility |

### Code Quality

- ✅ No circular imports
- ✅ Modular service design
- ✅ Comprehensive error handling
- ✅ Configuration via environment variables
- ✅ Backward compatible
- ✅ Follows existing code patterns

---

## Configuration

### Environment Variables

**Main Backend** (`backend_5.0/.env`):
```env
# Server
PORT=5000
NODE_ENV=development

# Authentication
JWT_SECRET=your_secret_key_here
JWT_EXPIRES_IN=7d

# Databases
DATABASE_URL=mongodb+srv://...     # Chat/user data
POSTGRES_DSN=postgresql://...      # ARGO data

# External Services
RAG_SERVICE_URL=http://localhost:8000
INGEST_SERVICE_URL=http://localhost:8100
RAG_TIMEOUT_MS=10000
INGEST_TIMEOUT_MS=60000

# LLM
LLM_API_KEY=your_groq_api_key
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Alerts & Notifications
RESEND_API_KEY=your_resend_key
ALERT_EMAIL_USER=alerts@example.com
```

**Ingestion Service** (`ingestion/`):
```env
INGEST_PORT=8100
INGEST_DSN=postgresql://...
INGEST_SCHEDULER_ENABLED=true
INGEST_SCHEDULER_INTERVAL_SECONDS=21600
FLASK_DEBUG=false
```

### Database Schema

#### PostgreSQL (ARGO Data)

```sql
-- Profile metadata
CREATE TABLE profile_meta (
  profile_key TEXT PRIMARY KEY,
  platform_number TEXT,
  cycle INTEGER,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  data_mode TEXT  -- 'real_time' or 'delayed'
);

-- Core measurements
CREATE TABLE core_levels (
  profile_key TEXT,
  level_index INTEGER,
  pressure DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  salinity DOUBLE PRECISION,
  PRIMARY KEY (profile_key, level_index)
);

-- BGC variables
CREATE TABLE bgc_levels (
  profile_key TEXT,
  level_index INTEGER,
  bgc_variable TEXT,  -- DOXY, CHLA, BBP, etc.
  raw_value DOUBLE PRECISION,
  adjusted_value DOUBLE PRECISION,
  data_mode TEXT,
  PRIMARY KEY (profile_key, level_index, bgc_variable)
);
```

#### MongoDB (Chat & User Data)

```javascript
// Users collection
{
  _id: ObjectId,
  username: String,
  email: String,
  password: String (bcrypt hashed),
  createdAt: Date
}

// Chat history collection
{
  _id: ObjectId,
  userId: ObjectId,
  question: String,
  answer: String,
  sql: String,
  type: "data_query" or "conceptual",
  durationMs: Number,
  createdAt: Date
}

// Alerts collection
{
  _id: ObjectId,
  userId: ObjectId,
  name: String,
  variable: String,
  condition: String,
  threshold: Number,
  isActive: Boolean,
  createdAt: Date
}
```

---

## Deployment

### Development (Local)

```bash
# Clone and install
git clone <repo>
cd floatchat

# Install dependencies
npm install
cd ingestion && pip install -r requirements.txt && cd ..
cd vector_db && pip install -r requirements.txt && cd ..

# Configure environment
cp backend_5.0/.env.example backend_5.0/.env
# Edit .env with your settings

# Start services (in separate terminals)
npm start                    # Main backend
python vector_db/server.py   # RAG
python ingestion/server.py   # Ingestion
```

### Production (Docker Compose)

```bash
# Start all services
docker-compose up -d

# Verify
docker-compose ps
docker logs floatchat-backend
docker logs floatchat-rag
docker logs floatchat-ingestion

# Stop
docker-compose down
```

---

## Testing

### Quick Verification

```bash
# 1. Check all services running
curl http://localhost:5000/health
curl http://localhost:8000/health
curl http://localhost:8100/health

# 2. Register and login
TOKEN=$(curl -s -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","email":"test@test.com","password":"Test123!"}' | jq -r '.data.token')

# 3. Test query routing
curl -X POST http://localhost:5000/api/chat/query \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"question":"What is Argo?"}' | jq .data.type

# Should output: "conceptual"
```

### Full Test Suite

See `INTEGRATION_TESTING_GUIDE.md` for comprehensive testing procedures including:
- Authentication flow
- Query routing (auto, data, conceptual modes)
- Ingestion triggering and scheduling
- Chat history
- Alert management
- Anomaly detection
- Visualization
- Error handling

---

## Performance

| Operation | Expected Time | Notes |
|-----------|--------------|-------|
| Auth (register/login) | < 500ms | Password hashing |
| Conceptual query | 1-2 sec | LLM call only |
| Data query | 2-5 sec | RAG + SQL + LLM |
| Ingestion (50 files) | 45-60 sec | DB inserts |
| Alert creation | < 100ms | In-memory |
| Anomaly detection | 1-3 sec | Statistical calc |

---

## Known Limitations

1. **Single Scheduler Instance**: Can't scale horizontally (ok for current needs)
2. **No Token Refresh**: Tokens expire after 7 days (users re-login)
3. **Keyword Classification**: May misclassify edge cases (ML upgrade in future)
4. **Synchronous Ingestion**: Only one ingestion at a time
5. **No Rate Limiting**: Not implemented yet (future)

---

## Troubleshooting

### Services Not Running
```bash
# Check status
docker ps

# View logs
docker logs floatchat-backend
docker logs floatchat-rag
docker logs floatchat-ingestion
```

### RAG Service Unreachable
```bash
# Test from main backend container
docker exec floatchat-backend curl http://rag:8000/health

# Check network
docker network ls
docker network inspect floatchat_default
```

### Ingestion Stuck
```bash
# Check status
curl http://localhost:8100/ingest/status | jq .data.is_running

# Restart if needed
docker restart floatchat-ingestion
```

### Database Connection Failed
```bash
# Test PostgreSQL
docker exec floatchat-ingestion psql "$POSTGRES_DSN" -c "SELECT 1"

# Test MongoDB
docker exec floatchat-backend node -e "
  const mongoose = require('mongoose');
  mongoose.connect(process.env.DATABASE_URL).then(
    () => console.log('✅ Connected'),
    e => console.log('❌ Error:', e.message)
  );
"
```

---

## Documentation

| Document | Purpose |
|----------|---------|
| **BACKEND_API_REFERENCE.md** | Complete API documentation with all endpoints |
| **INTEGRATION_TESTING_GUIDE.md** | Step-by-step testing procedures |
| **API_QUICK_REFERENCE.md** | Developer cheat sheet |
| **IMPLEMENTATION_COMPLETION_REPORT.md** | Detailed implementation report |
| **README.md** | This file - overview and quick start |

---

## Getting Help

1. **Check Documentation**: Review the relevant `.md` file
2. **View Logs**: `docker logs <service_name>`
3. **Test Connectivity**: Use curl commands from quick reference
4. **Run Test Suite**: Follow INTEGRATION_TESTING_GUIDE.md step-by-step

---

## Future Enhancements

**v2.1 (Near-term):**
- Token refresh endpoint
- Input validation middleware
- Rate limiting
- Advanced anomaly detection (ML-based)

**v2.2 (Medium-term):**
- Webhooks for alerts
- GraphQL endpoint
- Batch query API
- Redis caching

**v3.0 (Long-term):**
- Fine-tuned LLM for oceanography
- Real-time data streaming
- Mobile app backend
- Multi-language support

---

## Support

**Questions or Issues?**
1. Check the relevant documentation file
2. Run the testing guide to isolate problems
3. Review logs for error messages
4. Verify environment configuration

**Contributing:**
- Follow existing code patterns
- Update documentation for changes
- Test before committing
- Keep services modular

---

## Summary

FloatChat Backend v2.0 provides a robust, scalable platform for oceanographic data analysis with:

✅ Intelligent query routing  
✅ Automatic data ingestion  
✅ Comprehensive API documentation  
✅ Microservice architecture  
✅ User authentication & alerts  
✅ Advanced data support (BGC variables)  
✅ Complete testing procedures  

The system is production-ready for deployment and can be extended with additional features as needed.

---

**Version:** 2.0.0  
**Last Updated:** 2025-01-15  
**Status:** ✅ Complete & Ready for Testing  

For detailed information, see the accompanying documentation files.
