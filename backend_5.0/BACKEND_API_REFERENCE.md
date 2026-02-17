# FloatChat Backend API Reference

## Overview

FloatChat is a distributed system for oceanographic data analysis combining three main components:

1. **Main Backend** (Node.js/Express) - Gateway API, authentication, orchestration
2. **Ingestion Service** (Python/Flask) - NetCDF file processing, data ingestion, 6-hour scheduler
3. **RAG Service** (Python/Flask) - Vector database for semantic search, SQL generation

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Web)                         │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
        ┌──────────────────────────────────────────┐
        │  Main Backend (Port 5000)                │
        │  - Authentication (JWT)                  │
        │  - Chat/Query Orchestration              │
        │  - Alerts & Notifications                │
        │  - Visualization Endpoints               │
        │  - Proxy: Ingest & RAG Services          │
        └─────┬──────────────────────────┬─────────┘
              │                          │
      ┌───────▼──────────┐      ┌────────▼─────────┐
      │ RAG Service      │      │ Ingest Service   │
      │ (Port 8000)      │      │ (Port 8100)      │
      │ - /rag           │      │ - /ingest/run    │
      │ - /build-full    │      │ - /ingest/status │
      │ - /health        │      │ - Scheduler      │
      └───────┬──────────┘      │ - /health        │
              │                 └────────┬─────────┘
              │                          │
      ┌───────▼──────────┐      ┌────────▼──────────┐
      │ Qdrant Vector DB │      │ PostgreSQL (RAF)  │
      │ (Semantic Search)│      │ - Profiles        │
      │                  │      │ - BGC Variables   │
      └──────────────────┘      │ - Summaries       │
                                └───────────────────┘
```

---

## 1. Main Backend API (Port 5000)

### 1.1 Authentication Routes

#### POST /api/auth/register
Create a new user account.

**Request:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (Success 201):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "user": {
      "id": "user_id_123",
      "email": "john@example.com",
      "username": "john_doe"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error 400):**
```json
{
  "ok": false,
  "error": {
    "message": "Email already registered",
    "code": "EMAIL_EXISTS"
  }
}
```

**Notes:**
- Passwords are hashed with bcrypt (10 rounds)
- JWT tokens expire after 7 days (configurable via `JWT_EXPIRES_IN`)
- Email must be unique

---

#### POST /api/auth/login
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePassword123!"
}
```

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "user": {
      "id": "user_id_123",
      "email": "john@example.com"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Response (Error 401):**
```json
{
  "ok": false,
  "error": {
    "message": "Invalid email or password",
    "code": "AUTH_FAILED"
  }
}
```

**Notes:**
- Returns JWT for use in subsequent requests
- Store token in client (localStorage / sessionStorage)
- Include in `Authorization: Bearer <token>` header

---

#### GET /api/auth/me
Get current authenticated user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "user": {
      "id": "user_id_123",
      "email": "john@example.com",
      "username": "john_doe",
      "createdAt": "2025-01-15T10:30:00Z"
    }
  }
}
```

**Response (Error 401):**
```json
{
  "ok": false,
  "error": {
    "message": "Unauthorized",
    "code": "UNAUTHORIZED"
  }
}
```

---

### 1.2 Chat & Query Routes

#### POST /api/chat/query
Intelligent query routing with auto-classification.

**Request:**
```json
{
  "question": "What is the average temperature at depth 100m in 2023?",
  "mode": "auto"
}
```

**Parameters:**
- `question` (string, required): User question
- `mode` (string, optional): "auto" (default), "data_query", or "conceptual"

**Response (Data Query 200):**
```json
{
  "ok": true,
  "data": {
    "type": "data_query",
    "mode": "auto",
    "question": "What is the average temperature at depth 100m in 2023?",
    "answer": "Based on the data, the average temperature at 100m depth in 2023 was 18.3°C across all profiles...",
    "sql": "SELECT AVG(temperature) FROM core_levels WHERE depth BETWEEN 95 AND 105 AND YEAR(timestamp) = 2023",
    "raw_rows": [
      { "avg": 18.3, "count": 456 }
    ],
    "error": null,
    "meta": {
      "durationMs": 523,
      "classified_as": "data_query"
    }
  }
}
```

**Response (Conceptual Query 200):**
```json
{
  "ok": true,
  "data": {
    "type": "conceptual",
    "mode": "auto",
    "question": "What is an Argo float?",
    "answer": "An Argo float is a robotic oceanographic instrument that measures temperature, salinity, and other properties of the ocean. Each float profiles the water column from the surface to 2000m depth...",
    "sql": null,
    "raw_rows": [],
    "error": null,
    "meta": {
      "durationMs": 1240,
      "classified_as": "conceptual"
    }
  }
}
```

**Response (Error 400):**
```json
{
  "ok": false,
  "error": {
    "message": "Question is required and must be a string",
    "code": "INVALID_INPUT"
  }
}
```

**Behavior:**
- **mode="auto"**: Smart classification based on keywords and content
  - Data queries: mention specific variables, depth ranges, time periods
  - Conceptual queries: general knowledge, definitions, how-tos
- **mode="data_query"**: Forces RAG → SQL → DB query path
  - Calls RAG service to generate SQL
  - Executes SQL against Postgres
  - Returns structured data + LLM explanation
- **mode="conceptual"**: Forces direct LLM path
  - No database access
  - Uses system prompt for oceanography context
  - Pure natural language response

**Example Flows:**

Flow 1: Conceptual Question
```
User: "What is an Argo float?"
  ↓ (auto-classified as conceptual)
  ↓ LLM system prompt: "You are an oceanography expert"
  ↓ LLM generates explanation
Response: Natural language answer about Argo floats
```

Flow 2: Data Question
```
User: "Show me profiles where DOXY < 100 at 1000m depth"
  ↓ (auto-classified as data_query)
  ↓ Call RAG service → generate SQL
  ↓ Execute SQL: "SELECT * FROM bgc_levels WHERE bgc_variable='DOXY' AND depth_approx=1000..."
  ↓ Get DB rows
  ↓ LLM explains results
Response: SQL + rows + natural language summary
```

---

#### POST /api/chat/process
Legacy comprehensive query processing.

**Request:**
```json
{
  "question": "What are the anomalies in CHLA data?"
}
```

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "answer": "We detected 12 anomalies in CHLA data...",
    "sql": "SELECT * FROM bgc_levels WHERE bgc_variable='CHLA'...",
    "result": {
      "rowCount": 234,
      "columns": ["profile_key", "bgc_variable", "depth", "value"]
    },
    "visualization": {
      "type": "timeseries",
      "data": [...]
    },
    "anomalies": [
      {
        "type": "outlier",
        "severity": "high",
        "description": "Value 450 at depth 200m (expected ~100)"
      }
    ],
    "meta": {
      "durationMs": 1520,
      "source": {
        "rag": "chroma+gemini",
        "db": "postgres",
        "llm": "llama"
      }
    }
  }
}
```

**Notes:**
- Full-featured query processing with anomaly detection
- Returns visualization data for frontend charts
- Includes all intermediate steps (SQL, raw rows)

---

#### GET /api/chat/history
Retrieve user's chat history.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `limit` (optional, default 20): Max records to return
- `offset` (optional, default 0): Pagination offset

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "history": [
      {
        "id": "chat_id_1",
        "question": "What is temperature in 2023?",
        "answer": "The average temperature was...",
        "timestamp": "2025-01-15T10:30:00Z",
        "durationMs": 523,
        "type": "data_query"
      }
    ]
  }
}
```

---

### 1.3 Ingestion Control Routes

#### POST /api/ingest/run
Manually trigger file ingestion (proxied to ingestion service).

**Request:**
```json
{
  "nc": "optional/path/to/single_file.nc",
  "dir": "optional/path/to/dir",
  "dsn": "postgresql://...",
  "process_all": true,
  "no_db": false,
  "force": false,
  "reprocess": false
}
```

**Parameters:**
- `nc` (string, optional): Path to single .nc file
- `dir` (string, optional): Path to directory of .nc files
- `dsn` (string, optional): PostgreSQL connection string
- `process_all` (boolean, default true): Process all files in directory
- `no_db` (boolean, default false): Dry-run without database writes
- `force` (boolean, default false): Reprocess already-ingested files
- `reprocess` (boolean, default false): Force reprocessing

**Behavior:**
- If `nc` provided → ingest that single file
- If `dir` provided → ingest all files in directory
- If neither → ingest all files from `source_files/` directory
- If no files found → return 400 error

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "status": "success",
    "took_seconds": 45.32,
    "summary": {
      "processed_profiles": 10,
      "rows_written": 1250,
      "errors": []
    }
  }
}
```

**Response (In Progress 409):**
```json
{
  "ok": false,
  "error": {
    "message": "Ingestion already in progress",
    "code": "INGEST_RUNNING"
  }
}
```

**Response (Error 500):**
```json
{
  "ok": false,
  "error": {
    "message": "No .nc files found",
    "code": "INGEST_ERROR"
  }
}
```

---

#### GET /api/ingest/status
Get current and last ingestion status.

**Response (Success 200):**
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
    },
    "last_error": null
  }
}
```

**Status Values:**
- `"idle"`: No ingestion in progress, none previously run
- `"running"`: Ingestion currently in progress
- `"error"`: Last ingestion encountered an error

**Notes:**
- Returns null fields if ingestion never run
- `is_running` boolean for quick status check
- `summary` contains detailed counts from last run

---

### 1.4 Visualization Routes

#### GET /api/visualization/profile
Get visualization data for a single profile (time series, depth profile, etc).

**Query Parameters:**
- `profile_key` (string, required): e.g., "1900042:5"
- `variables` (string, optional): Comma-separated list of variables (TEMP, PSAL, CHLA, DOXY, etc.)
- `format` (string, optional, default "timeseries"): "timeseries", "depthprofile", "scatter"

**Response (Success 200):**
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
          { "depth": 0, "value": 23.1, "qc": "1" },
          { "depth": 10, "value": 22.7, "qc": "1" },
          { "depth": 50, "value": 18.4, "qc": "1" }
        ]
      },
      {
        "name": "Salinity",
        "unit": "PSU",
        "variable": "PSAL",
        "points": [
          { "depth": 0, "value": 35.2, "qc": "1" },
          { "depth": 10, "value": 35.3, "qc": "1" }
        ]
      }
    ]
  }
}
```

**Response (Error 404):**
```json
{
  "ok": false,
  "error": {
    "message": "Profile not found",
    "code": "NOT_FOUND"
  }
}
```

---

#### GET /api/visualization/profiles-comparison
Compare multiple profiles side-by-side.

**Query Parameters:**
- `profile_keys` (string, required): Comma-separated list (e.g., "1900042:1,1900042:2,1900042:3")
- `variables` (string, optional): Comma-separated variables to compare
- `format` (string, optional, default "comparison"): "comparison", "overlay"

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "profiles": [
      {
        "profile_key": "1900042:1",
        "depth_max": 2000,
        "series": [...]
      },
      {
        "profile_key": "1900042:2",
        "depth_max": 2000,
        "series": [...]
      }
    ]
  }
}
```

---

### 1.5 Anomaly Detection Routes

#### POST /api/anomalies/detect
Detect anomalies in dataset based on specified parameters.

**Request:**
```json
{
  "variable": "TEMP",
  "platform": "1900042",
  "date_from": "2023-01-01",
  "date_to": "2023-12-31",
  "method": "zscore",
  "threshold": 2.0
}
```

**Parameters:**
- `variable` (string, required): Variable to analyze (TEMP, PSAL, DOXY, CHLA, etc.)
- `platform` (string, optional): Float platform number filter
- `date_from`, `date_to` (string, optional): Date range ISO8601
- `method` (string, optional, default "zscore"): "zscore", "iqr", "isolation_forest"
- `threshold` (number, optional, default 2.0): Standard deviations for zscore

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "variable": "TEMP",
    "method": "zscore",
    "threshold": 2.0,
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
      "std": 2.1,
      "min": 10.3,
      "max": 28.2
    }
  }
}
```

**Response (Error 400):**
```json
{
  "ok": false,
  "error": {
    "message": "Variable not found",
    "code": "INVALID_VARIABLE"
  }
}
```

**Severity Levels:**
- `"low"`: |zscore| = 2-2.5σ
- `"medium"`: |zscore| = 2.5-3σ
- `"high"`: |zscore| > 3σ

---

#### GET /api/anomalies/summary
Get summary of recent anomalies.

**Query Parameters:**
- `limit` (number, optional, default 20): Max records
- `severity` (string, optional): Filter by "low", "medium", "high"
- `days` (number, optional, default 30): Look back N days

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "summary": {
      "total_anomalies": 312,
      "by_severity": {
        "low": 201,
        "medium": 89,
        "high": 22
      },
      "by_variable": {
        "TEMP": 120,
        "DOXY": 98,
        "CHLA": 94
      }
    },
    "recent": [
      {
        "id": "anom_1",
        "variable": "DOXY",
        "severity": "high",
        "detected_at": "2025-01-15T10:30:00Z",
        "profile_key": "1901378:42",
        "value": 5.2,
        "expected": 80.0
      }
    ]
  }
}
```

---

### 1.6 Alerts & Notifications Routes

#### POST /api/alerts/create
Create a personalized alert rule.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "name": "High Temperature Alert",
  "variable": "TEMP",
  "condition": "above",
  "threshold": 25.0,
  "depth_range": [100, 500],
  "platform": "1900042",
  "notification_channel": "email",
  "frequency": 30
}
```

**Parameters:**
- `name` (string, required): Alert name
- `variable` (string, required): Variable to monitor
- `condition` (string, required): "above", "below", "between", "equals"
- `threshold` (number, required): Trigger value
- `depth_range` (array, optional): [min_depth, max_depth]
- `platform` (string, optional): Specific platform filter
- `notification_channel` (string, optional, default "email"): "email", "sms", "webhook"
- `frequency` (number, optional, default 30): Check frequency in minutes

**Response (Success 201):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "alert": {
      "id": "alert_123",
      "user_id": "user_123",
      "name": "High Temperature Alert",
      "variable": "TEMP",
      "condition": "above",
      "threshold": 25.0,
      "is_active": true,
      "created_at": "2025-01-15T10:30:00Z"
    }
  }
}
```

**Response (Error 400):**
```json
{
  "ok": false,
  "error": {
    "message": "Invalid threshold value",
    "code": "VALIDATION_ERROR"
  }
}
```

---

#### GET /api/alerts
List user's alert rules.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `is_active` (boolean, optional): Filter active/inactive
- `limit` (number, optional, default 20): Max records

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "alerts": [
      {
        "id": "alert_123",
        "name": "High Temperature Alert",
        "variable": "TEMP",
        "condition": "above",
        "threshold": 25.0,
        "is_active": true,
        "last_triggered": "2025-01-15T09:30:00Z",
        "trigger_count": 3
      }
    ]
  }
}
```

---

#### DELETE /api/alerts/:alert_id
Delete an alert rule.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "message": "Alert deleted"
  }
}
```

---

#### PATCH /api/alerts/:alert_id
Update an alert rule.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "threshold": 26.0,
  "is_active": false
}
```

**Response (Success 200):**
```json
{
  "ok": true,
  "data": {
    "success": true,
    "alert": {
      "id": "alert_123",
      "threshold": 26.0,
      "is_active": false
    }
  }
}
```

---

## 2. Ingestion Service API (Port 8100, Python/Flask)

### 2.1 Health Check

#### GET /health
Service health status.

**Response (200):**
```json
{
  "status": "ok",
  "service": "Ingestion Pipeline",
  "scheduler_enabled": true,
  "scheduler_interval_seconds": 21600
}
```

---

### 2.2 Ingestion Management

#### POST /ingest/run
Manually trigger ingestion with optional parameters.

**Request Body:**
```json
{
  "nc": "path/to/file.nc",
  "dir": "path/to/dir",
  "dsn": "postgresql://...",
  "process_all": true,
  "no_db": false,
  "force": false,
  "reprocess": false
}
```

**Response (Success 200):**
```json
{
  "status": "success",
  "took_seconds": 45.23,
  "summary": {
    "processed_profiles": 10,
    "rows_written": 1250,
    "errors": [
      {
        "file": "path/to/bad_file.nc",
        "error": "Invalid NetCDF format"
      }
    ]
  }
}
```

**Response (In Progress 409):**
```json
{
  "status": "error",
  "error": "Ingestion already in progress"
}
```

**Behavior:**
- Extracts NetCDF profiles (PRES, TEMP, PSAL, BGC variables)
- Detects file mode: Real-time (R*) vs Delayed (D*)
- Stores raw/adjusted values based on mode
- Moves processed files to `processed/` directory
- Returns detailed error log for failed files

**File Processing Logic:**
- Real-time mode (filename starts with 'R'): Store raw values
- Delayed mode (filename starts with 'D'): Store adjusted values
- BGC Variables extracted: DOXY, CHLA, BBP, BBP470, BBP532, BBP700, CDOM, NITRATE, PH_IN_SITU_TOTAL

---

#### GET /ingest/status
Get current and last ingestion status.

**Response (200):**
```json
{
  "status": "idle",
  "is_running": false,
  "last_started_at": "2025-01-15T10:30:00Z",
  "last_finished_at": "2025-01-15T10:45:32Z",
  "last_runtime_seconds": 45.32,
  "summary": {
    "processed_profiles": 10,
    "rows_written": 1250,
    "errors": []
  },
  "last_error": null
}
```

**Status Fields:**
- `status`: "idle", "running", or "error"
- `is_running`: Boolean flag
- `last_started_at`, `last_finished_at`: ISO8601 timestamps (UTC)
- `last_runtime_seconds`: Duration of last ingestion
- `summary`: Counts and error details from last run
- `last_error`: Error message if last run failed

---

### 2.3 Scheduler Configuration

The ingestion service includes a background scheduler that:

**Behavior:**
- Runs every 6 hours (configurable via `INGEST_SCHEDULER_INTERVAL_SECONDS`)
- Automatically processes all new .nc files from `source_files/` directory
- Updates global status state
- Logs exceptions without crashing

**Configuration (via Environment Variables):**
```env
INGEST_SCHEDULER_ENABLED=true         # Enable/disable scheduler
INGEST_SCHEDULER_INTERVAL_SECONDS=21600  # Default: 6 hours
INGEST_PORT=8100                      # Flask port
INGEST_DSN=postgresql://...           # Default DB connection
```

**Scheduler Workflow:**
```
Every 6 hours:
  1. Set INGEST_IS_RUNNING = True
  2. Get all .nc files from source_files/
  3. For each file:
     a. Extract profile & BGC variables
     b. Detect file mode (R/D)
     c. Upsert to PostgreSQL
     d. Move file to processed/
  4. Update LAST_INGEST_SUMMARY
  5. Set INGEST_IS_RUNNING = False
  6. Log completion or errors
```

---

## 3. RAG Service API (Port 8000, Python/Flask)

### 3.1 Health Check

#### GET /health
Service health status.

**Response (200):**
```json
{
  "status": "ok",
  "service": "RAG Vector Database"
}
```

---

### 3.2 RAG Endpoints

#### POST /rag
Generate SQL from natural language query.

**Request:**
```json
{
  "query": "What is the average temperature at 100m depth in profiles from 2023?"
}
```

**Response (Success 200):**
```json
{
  "status": "success",
  "sql": "SELECT AVG(temperature) as avg_temp, COUNT(*) as count FROM core_levels WHERE depth BETWEEN 95 AND 105 AND YEAR(profile_date) = 2023",
  "semantic_context": [
    {
      "variable": "temperature",
      "operation": "average",
      "depth_range": [95, 105],
      "time_range": ["2023-01-01", "2023-12-31"]
    }
  ]
}
```

**Response (Error 400):**
```json
{
  "status": "error",
  "message": "Unable to generate SQL from query"
}
```

**Notes:**
- Uses vector database (Qdrant/Chroma) for semantic search
- LLM generates SQL based on retrieved context
- SQL can be executed directly against PostgreSQL
- Includes semantic context for debugging/explanation

---

#### POST /build-full
Trigger full vector database rebuild.

**Request:**
```json
{
  "force": false
}
```

**Parameters:**
- `force` (boolean, optional): Force rebuild even if DB exists

**Response (Async 202):**
```json
{
  "status": "building",
  "message": "Full vector database build started",
  "estimated_duration_seconds": 300
}
```

**Response (Error 409):**
```json
{
  "status": "error",
  "message": "Build already in progress"
}
```

**Notes:**
- Asynchronous operation (returns 202 Accepted)
- Rebuilds all embeddings from profile data
- Can take significant time on large datasets

---

#### GET /build-status
Get status of ongoing build operation.

**Response (200):**
```json
{
  "status": "building",
  "progress": 65.5,
  "estimated_time_remaining_seconds": 100,
  "profiles_processed": 500,
  "profiles_total": 764
}
```

---

## 4. Database Schema Reference

### PostgreSQL Tables (Ingestion Service Writes)

#### profile_meta
Metadata for each float profile.

```sql
CREATE TABLE profile_meta (
  profile_key TEXT PRIMARY KEY,
  platform_number TEXT,
  cycle INTEGER,
  juld TIMESTAMP WITH TIME ZONE,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  pi_name TEXT,
  project_name TEXT,
  source_filename TEXT,
  source_file TEXT,
  data_mode TEXT,  -- 'real_time' or 'delayed'
  raw_attrs JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

#### core_levels
Core oceanographic measurements per profile level.

```sql
CREATE TABLE core_levels (
  profile_key TEXT,
  level_index INTEGER,
  pressure DOUBLE PRECISION,
  depth DOUBLE PRECISION,
  temperature DOUBLE PRECISION,
  temperature_adjusted DOUBLE PRECISION,
  salinity DOUBLE PRECISION,
  salinity_adjusted DOUBLE PRECISION,
  pres_qc TEXT,
  temp_qc TEXT,
  sal_qc TEXT,
  source_filename TEXT,
  source_file TEXT,
  raw_metadata JSONB,
  PRIMARY KEY (profile_key, level_index)
);
```

#### bgc_levels
Biogeochemical variables per profile level.

```sql
CREATE TABLE bgc_levels (
  profile_key TEXT,
  level_index INTEGER,
  bgc_variable TEXT,  -- DOXY, CHLA, BBP, CDOM, NITRATE, PH_IN_SITU_TOTAL, etc.
  raw_value DOUBLE PRECISION,
  adjusted_value DOUBLE PRECISION,
  qc_flag TEXT,
  source_filename TEXT,
  source_file TEXT,
  data_mode TEXT,
  raw_metadata JSONB,
  PRIMARY KEY (profile_key, level_index, bgc_variable)
);
```

#### profile_summaries
AI-generated summaries and insights.

```sql
CREATE TABLE profile_summaries (
  profile_key TEXT,
  summary_id SERIAL PRIMARY KEY,
  model_name TEXT,  -- 'auto_stats', 'gpt-4', etc.
  summary_text TEXT,
  summary_json JSONB,
  summary_generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
```

### MongoDB Collections (Main Backend)

#### users
User accounts (authentication).

```javascript
{
  _id: ObjectId,
  username: String,
  email: String (unique),
  password: String (hashed with bcrypt),
  createdAt: Date,
  updatedAt: Date
}
```

#### chat_histories
Chat conversation history.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  question: String,
  answer: String,
  sql: String,
  status: String, // "received", "processing", "completed", "error"
  ragContext: String,
  resultSummary: Object,
  anomalies: Array,
  visualizationType: String,
  finalAnswer: String,
  durationMs: Number,
  createdAt: Date
}
```

#### alerts
User-defined alert rules.

```javascript
{
  _id: ObjectId,
  userId: ObjectId (ref: users),
  name: String,
  variable: String,
  condition: String, // "above", "below", "between"
  threshold: Number,
  depthRange: [Number, Number],
  platform: String,
  notificationChannel: String, // "email", "sms", "webhook"
  frequency: Number, // minutes
  isActive: Boolean,
  lastTriggered: Date,
  triggerCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

---

## 5. Error Handling

All endpoints follow this error response format:

```json
{
  "ok": false,
  "error": {
    "message": "Human-readable error message",
    "code": "ERROR_CODE",
    "statusCode": 400
  }
}
```

### Common Error Codes

| Code | Status | Meaning |
|------|--------|---------|
| `INVALID_INPUT` | 400 | Required field missing or invalid format |
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token |
| `FORBIDDEN` | 403 | User lacks permission |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Operation already in progress (e.g., ingestion) |
| `VALIDATION_ERROR` | 400 | Input validation failed |
| `AUTH_FAILED` | 401 | Login credentials incorrect |
| `EMAIL_EXISTS` | 400 | Email already registered |
| `LLM_ERROR` | 500 | LLM service error |
| `RAG_ERROR` | 500 | RAG service error |
| `INGEST_ERROR` | 500 | Ingestion service error |
| `SERVER_ERROR` | 500 | Internal server error |

---

## 6. Authentication

### JWT Token Usage

1. **Get Token:** Call POST /api/auth/login or /api/auth/register
2. **Include in Requests:** Add `Authorization: Bearer <token>` header
3. **Token Expiry:** Default 7 days (check `exp` claim)
4. **Refresh:** Re-login to get new token (currently no refresh endpoint)

### Protected Routes

Routes requiring authentication:
- GET /api/auth/me
- GET /api/chat/history
- POST /api/alerts/create
- GET /api/alerts
- DELETE /api/alerts/:id
- PATCH /api/alerts/:id

---

## 7. Example Workflows

### Workflow 1: Conceptual Question

```
1. User asks: "What is depth in Argo Float?"
2. Frontend: POST /api/chat/query with mode="auto"
3. Backend classifies as "conceptual" (no data keywords)
4. Backend calls LLM with oceanography system prompt
5. LLM returns definition and context
6. Response includes answer type="conceptual", no SQL or raw_rows
```

### Workflow 2: Data-Driven Query

```
1. User asks: "Show profiles where DOXY < 100 at 1000m depth in 2023"
2. Frontend: POST /api/chat/query with mode="auto"
3. Backend classifies as "data_query" (keywords: DOXY, depth, year)
4. Backend calls RAG service /rag endpoint → gets SQL string
5. Backend executes SQL on Postgres → gets rows
6. Backend calls LLM to explain results
7. Response includes:
   - type="data_query"
   - sql: actual SQL query
   - raw_rows: data from DB
   - answer: LLM-generated explanation
```

### Workflow 3: Automatic Ingestion

```
Every 6 hours:
1. Ingestion scheduler wakes up
2. Calls internal run_ingestion_internal() function
3. Lists all .nc files from source_files/
4. For each file:
   a. Extracts profiles and BGC variables
   b. Detects mode (R=real-time, D=delayed)
   c. Inserts into PostgreSQL tables
   d. Moves to processed/ directory
5. Updates LAST_INGEST_STATUS
6. Logs completion
```

### Workflow 4: User Alert Trigger

```
1. User creates alert: TEMP > 25°C at depth 100-500m
2. Alert stored in MongoDB with active=true
3. System periodically checks alerts (configurable)
4. When new data ingested matching condition:
   a. Anomaly detection identifies trigger
   b. Notification sent (email/SMS/webhook)
   c. Alert trigger_count incremented
   d. last_triggered timestamp updated
```

---

## 8. Configuration & Deployment

### Environment Variables (Main Backend)

```bash
# Server
PORT=5000
NODE_ENV=development|production

# JWT
JWT_SECRET=<random_string>
JWT_EXPIRES_IN=7d

# MongoDB
DATABASE_URL=mongodb+srv://...

# RAG Service
RAG_SERVICE_URL=http://localhost:8000
RAG_TIMEOUT_MS=10000

# Ingestion Service
INGEST_SERVICE_URL=http://localhost:8100
INGEST_TIMEOUT_MS=60000

# LLM
LLM_API_KEY=<key>
LLM_PROVIDER=llama|gpt4|claude
LLM_BASE_URL=https://api.groq.com/openai/v1
LLM_MODEL=llama-3.1-8b-instant

# Alerts
ALERT_EMAIL_USER=...
ALERT_EMAIL_PASS=...
RESEND_API_KEY=...
```

### Environment Variables (Ingestion Service)

```bash
# Flask
INGEST_PORT=8100
FLASK_DEBUG=false
INGEST_SERVICE_URL=http://localhost:8100

# Scheduler
INGEST_SCHEDULER_ENABLED=true
INGEST_SCHEDULER_INTERVAL_SECONDS=21600  # 6 hours

# Database
POSTGRES_DSN=postgresql://...
INGEST_DSN=postgresql://...  # Override default
```

### Docker Compose

```yaml
version: '3.8'

services:
  backend:
    image: floatchat-backend:latest
    ports:
      - "5000:5000"
    environment:
      PORT: 5000
      RAG_SERVICE_URL: http://rag:8000
      INGEST_SERVICE_URL: http://ingestion:8100
    depends_on:
      - mongo
      - rag
      - ingestion

  rag:
    image: floatchat-rag:latest
    ports:
      - "8000:8000"
    environment:
      POSTGRES_DSN: postgresql://...

  ingestion:
    image: floatchat-ingestion:latest
    ports:
      - "8100:8100"
    environment:
      INGEST_PORT: 8100
      INGEST_SCHEDULER_ENABLED: "true"
      POSTGRES_DSN: postgresql://...

  mongo:
    image: mongo:latest
    ports:
      - "27017:27017"

  postgres:
    image: postgres:15-alpine
    ports:
      - "5432:5432"
    environment:
      POSTGRES_PASSWORD: password
```

---

## 9. Performance & Limits

### Request/Response Size Limits
- JSON body limit: 2 MB
- Query timeout: 30 seconds (configurable)
- RAG service timeout: 10 seconds (configurable)
- Ingestion timeout: 60 seconds (configurable)

### Rate Limiting (Future)
- API rate: 100 req/min per user
- Chat queries: 10 req/min per user
- Ingestion: 1 active process at a time

### Query Result Limits
- Max rows returned: 1000 (can paginate)
- Chat history: 20 records per page
- Alert list: 50 alerts per user

---

## 10. Support & Debugging

### Logs Location
- Main Backend: `stdout` (use Docker logs)
- Ingestion: Flask logs in container
- RAG: Flask logs in container

### Health Check All Services

```bash
# Main Backend
curl http://localhost:5000/health

# Ingestion Service
curl http://localhost:8100/health

# RAG Service
curl http://localhost:8000/health
```

### Common Issues

| Issue | Solution |
|-------|----------|
| RAG service unreachable | Check `RAG_SERVICE_URL` env var, verify RAG container running |
| Ingestion failing | Check PostgreSQL connection, verify .nc file format |
| JWT token expired | User must log in again to get new token |
| Chat query hangs | Increase `RAG_TIMEOUT_MS`, check RAG service |

---

## 11. Versioning & Changelog

### Current Version: 2.0.0

**v2.0.0 Features:**
- ✅ Intelligent query routing (auto-classify data vs conceptual)
- ✅ 6-hour automatic ingestion scheduler
- ✅ BGC variable support (DOXY, CHLA, BBP, CDOM, NITRATE, pH)
- ✅ File mode detection (Real-time vs Delayed)
- ✅ Comprehensive authentication with JWT
- ✅ Alert creation and management
- ✅ Visualization generation
- ✅ Anomaly detection
- ✅ Chat history persistence
- ✅ Full API documentation

**Upcoming (v2.1.0):**
- Token refresh endpoint
- Advanced anomaly detection (ML-based)
- Webhooks for alerts
- GraphQL endpoint
- Batch query API

---

**Documentation Last Updated:** 2025-01-15
**Maintainers:** FloatChat Team
