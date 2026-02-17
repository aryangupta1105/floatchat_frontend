# FloatChat Complete Architecture & Workflow Documentation

**Date**: December 3, 2025  
**Version**: 1.0  
**Project**: FloatChat - Ocean AI Platform with ARGO Float Data Integration

---

## Table of Contents
1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Complete Query Flow](#complete-query-flow)
4. [Backend Architecture (TypeScript/Fastify)](#backend-architecture-typescriptfastify)
5. [Legacy Backend (Node.js/Express)](#legacy-backend-nodejs-express)
6. [MCP Server Architecture](#mcp-server-architecture)
7. [Ingestion System](#ingestion-system)
8. [Vector Database & RAG](#vector-database--rag)
9. [Chat History & Storage](#chat-history--storage)
10. [Personalized Alerts System](#personalized-alerts-system)
11. [Subscription & Notification System](#subscription--notification-system)
12. [Frontend Integration Points](#frontend-integration-points)
13. [What's Missing & TODO](#whats-missing--todo)

---

## System Overview

### Architecture Diagram
```
┌─────────────────┐
│   Frontend      │
│  (React/Vue)    │
└────────┬────────┘
         │
         ▼
    ┌────────────────────────────────────────┐
    │   Fastify Backend (TypeScript)         │
    │  - Authentication (JWT)                │
    │  - Chat Management                     │
    │  - Tool Orchestration                  │
    │  - Alert Management                    │
    │  - Subscription Management             │
    └────────┬─────────────────────┬─────────┘
             │                     │
             ▼                     ▼
    ┌──────────────────┐  ┌────────────────────┐
    │  MCP Server      │  │  Python Services   │
    │  (Node.js)       │  │  - RAG Pipeline    │
    │  - 22 Tools      │  │  - Embeddings      │
    │  - SQL Queries   │  │  - LLM Interface   │
    │  - ARGO APIs     │  └────────────────────┘
    └──────────┬───────┘
               │
               ▼
    ┌──────────────────────────────────────┐
    │   Data Layer                         │
    │  - PostgreSQL (ARGO data)            │
    │  - MongoDB (Chat, Alerts, Users)     │
    │  - ChromaDB (Vector Embeddings)      │
    │  - Redis (Job Queue)                 │
    └──────────────────────────────────────┘
```

---

## Technology Stack

### Frontend
- React or Vue.js
- Real-time WebSocket/SSE for chat streaming
- Charts library (Plotly/D3) for data visualization

### Fastify Backend (Production)
- **Framework**: Fastify 5.0.0 with TypeScript 5.6.3
- **Database**: MongoDB 8.5.0 + Mongoose 8.5.0
- **Authentication**: JWT (@fastify/jwt 9.0.1) + bcryptjs 2.4.3
- **Job Queue**: BullMQ 4.10.0 + Redis (ioredis 5.4.1)
- **HTTP Client**: Axios 1.7.2
- **Validation**: Zod 3.23.8
- **Logging**: Pino 9.1.0
- **Monitoring**: Prometheus (prom-client 15.0.0)
- **API Docs**: Swagger (@fastify/swagger 8.14.0)

### Express Backend (Legacy)
- Express.js 4.18.2
- MongoDB with Mongoose 7.5.0
- Manual JWT handling with jsonwebtoken 9.0.0
- Basic CORS setup

### MCP Server
- Node.js with 22 specialized tools
- Direct PostgreSQL for ARGO data queries
- Tool discovery and execution

### Python Services
- FastAPI or Flask for RAG pipeline
- SentenceTransformers for embeddings
- ChromaDB for vector storage
- Ollama or API for LLM calls
- Pandas for data processing

---

## Complete Query Flow

### 1. User Submits Query from Frontend

```
Frontend sends:
POST /api/chat/process
{
  "question": "Show me the temperature profile for float 2901545 in the last 30 days"
}
```

### 2. Backend Receives & Processes (Fastify)

**File**: `src/modules/chat/chat.controller.ts`

```typescript
static async processChat(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user.sub;  // JWT extracted by middleware
  const text = request.body.question;
  
  // Step 1: Save user question to chat history
  await ChatService.addUserMessage(conversationId, userId, text);
  
  // Step 2: Trigger RAG pipeline
  const ragResult = await RAGService.search(text);
  // Returns: { context: "...", metadata: {...} }
  
  // Step 3: Send to LLM for understanding
  const llmResponse = await RAGService.generate({
    query: text,
    context: ragResult.context
  });
  // Returns: { text: "answer", tool_call?: { name, args } }
  
  // Step 4: Route based on LLM response
  if (!llmResponse.tool_call) {
    // Simple text response - no tool needed
    const aiMsg = await ChatService.addAssistantMessage(conversationId, {
      role: "assistant",
      content: { text: llmResponse.text }
    });
    return reply.send({ message: aiMsg, type: "text" });
  }
  
  // Step 5: LLM wants to call a tool
  const toolName = llmResponse.tool_call.name;        // e.g., "temperature_depth_chart"
  const toolArgs = llmResponse.tool_call.arguments;   // e.g., { float_id, depth_range }
  
  // Step 6: Call tool through MCP Server
  const toolResult = await ToolsService.callTool(toolName, toolArgs);
  // MCP executes the tool and returns structured data
  
  // Step 7: Send tool result back to LLM for formatting
  const finalResponse = await RAGService.generateResponse({
    tool_result: toolResult,
    original_query: text
  });
  // LLM formats data into human-readable form
  
  // Step 8: Save to chat history
  await ChatService.addAssistantMessage(conversationId, {
    role: "assistant",
    type: "tool_result",
    content: { text: finalResponse },
    tool_call: { name: toolName, args: toolArgs },
    tool_result: toolResult
  });
  
  // Step 9: Return to frontend
  return reply.send({
    message: aiMsg,
    type: "tool_result",
    visualization: detectVisualizationType(toolResult),
    data: toolResult
  });
}
```

### 3. RAG Pipeline (Python Service)

**Files**: `vectordb/`, `ingestion/`

```python
# RAG Search Process:
1. Convert user question to embeddings using SentenceTransformer
2. Query ChromaDB vector store for semantic similarity
3. Retrieve top-K relevant context chunks from ingested ARGO summaries
4. Format context with relevant floats, profiles, statistics

# LLM Generation:
1. Send [user_query + RAG_context] to LLM (Gemini, Claude, etc.)
2. LLM decides:
   - Direct text answer
   - Need to call MCP tool with specific parameters
3. Return { text: "...", tool_call?: {name, args} }
```

### 4. MCP Tool Execution

**File**: `floatchat-mcp/server/tools/*.js`

```javascript
// When LLM calls: temperature_depth_chart
// Tool receives: { float_id: "2901545", depth_range: [0, 2000] }

Tool Process:
1. Query PostgreSQL ARGO database:
   SELECT depth, temperature FROM profiles 
   WHERE platform_number = 2901545 
   AND depth BETWEEN 0 AND 2000

2. Format data for visualization:
   {
     float_id: "2901545",
     data: [
       { depth: 0, temperature: 22.5 },
       { depth: 100, temperature: 18.3 },
       ...
     ],
     metadata: { cycle: 45, date: "2024-12-03" }
   }

3. Return structured response
```

### 5. Response Path Back to Frontend

```
MCP Tool Result
    ↓
[LLM Formats Response]
    ↓
Backend adds to Chat History (MongoDB)
    ↓
Frontend receives with visualization config
    ↓
Frontend renders chart/table/map based on type
```

---

## Backend Architecture (TypeScript/Fastify)

### Directory Structure

```
backend/
├── src/
│   ├── config/
│   │   ├── env.ts              # Zod environment validation schema
│   │   │                        # Variables: NODE_ENV, MONGO_URI, REDIS_HOST, 
│   │   │                        # JWT_SECRET, MCP_SERVER_URL, RAG_SERVER_URL,
│   │   │                        # VECTOR_SERVER_URL, INGEST_SERVICE_URL, MCP_TIMEOUT_MS
│   │   └── logger.ts           # Pino structured logging with request correlation
│   │
│   ├── plugins/                # Fastify plugins (auto-loaded)
│   │   ├── cors.ts             # CORS for frontend communication
│   │   ├── jwt.ts              # JWT decorator with module augmentation
│   │   ├── rateLimit.ts        # 100 req/15min per IP
│   │   ├── metrics.ts          # Prometheus endpoint at /metrics
│   │   └── swagger.ts          # Swagger UI at /documentation
│   │
│   ├── db/
│   │   └── mongo/
│   │       ├── connection.ts   # MongoDB connection pool, retry logic
│   │       └── models/
│   │           ├── User.ts              # User { email, password_hash, firstName, interests, roles }
│   │           ├── Session.ts           # Session { user_id, refresh_token_hash, device_info, expires_at }
│   │           ├── AlertRule.ts         # AlertRule { user_id, type, condition_ast, frequency, channels }
│   │           ├── Notification.ts      # Notification { user_id, type, status, channels, logs }
│   │           ├── Subscription.ts      # Subscription { user_id, float_id, region, alert_frequency }
│   │           ├── Conversation.ts      # Conversation { user_id, title, message_count, tags }
│   │           └── Message.ts           # Message { conversation_id, user_id, role, text, tool_call, rag_context }
│   │
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.service.ts        # register(), login(), refresh(), logout(), me()
│   │   │   │                           # Features: password hashing, refresh token rotation, 
│   │   │   │                           # session tracking, all-devices logout
│   │   │   ├── auth.controller.ts     # FastifyRequest/Reply handlers
│   │   │   └── auth.routes.ts         # POST /auth/register, /auth/login, /auth/refresh, /auth/logout, GET /auth/me
│   │   │
│   │   ├── chat/
│   │   │   ├── chat.service.ts        # createConversation(), addUserMessage(), addAssistantMessage(),
│   │   │   │                           # processChat() (RAG→LLM→Tool), getMessages(), getConversations()
│   │   │   ├── chat.controller.ts     # Route handlers for chat operations
│   │   │   └── chat.routes.ts         # POST /chat/message, GET /chat/history, WebSocket /chat/stream
│   │   │
│   │   ├── tools/
│   │   │   ├── tools.service.ts       # callTool(name, args) - MCP proxy with retry logic
│   │   │   ├── tools.controller.ts    # List available tools, get tool schema
│   │   │   ├── tools.routes.ts        # GET /tools, POST /tools/call
│   │   │   └── toolSchemas.ts         # 22 Zod schemas for tool validation
│   │   │                               # Tools: sql_query, nearest_float, profile_summary, 
│   │   │                               # temperature_depth_chart, anomaly_detection, polygon_query, etc.
│   │   │
│   │   ├── rag/
│   │   │   ├── rag.service.ts         # search(query), generate(context), generateResponse()
│   │   │   │                           # Proxies to Python RAG service (FastAPI/Flask)
│   │   │   └── rag.routes.ts          # POST /rag/search, /rag/generate
│   │   │
│   │   ├── alerts/
│   │   │   ├── alerts.service.ts      # createRule(), getUserRules(), getRule(), updateRule(),
│   │   │   │                           # deleteRule(), triggerEvaluation()
│   │   │   ├── alerts.controller.ts   # CRUD handlers
│   │   │   ├── alerts.routes.ts       # REST endpoints for alert management
│   │   │   └── alerts.processor.ts    # BullMQ job: evaluate rules, detect anomalies
│   │   │
│   │   ├── subscriptions/
│   │   │   ├── subscriptions.service.ts  # subscribe(), getSubscriptions(), unsubscribe()
│   │   │   ├── subscriptions.controller.ts
│   │   │   └── subscriptions.routes.ts
│   │   │
│   │   ├── notifications/
│   │   │   ├── notifications.service.ts  # createNotification(), listUserNotifications()
│   │   │   │                             # Mark as read, delete notifications
│   │   │   ├── notifications.controller.ts
│   │   │   ├── notifications.routes.ts
│   │   │   └── notifications.processor.ts # BullMQ job: email/SMS/push/webhook delivery
│   │   │
│   │   ├── ingest/
│   │   │   ├── ingest.service.ts      # triggerIngestion(), listSourceFiles(), getIngestionStatus()
│   │   │   ├── ingest.controller.ts
│   │   │   └── ingest.routes.ts       # Endpoints to trigger Python ingestion pipeline
│   │   │
│   │   ├── vector/
│   │   │   ├── vector.service.ts      # triggerVectorRebuild(), getVectorStats()
│   │   │   ├── vector.controller.ts
│   │   │   ├── vector.routes.ts
│   │   │   └── vector.processor.ts    # BullMQ job: update ChromaDB with new embeddings
│   │   │
│   │   ├── users/
│   │   │   ├── users.service.ts       # getProfile(), updateProfile(), deleteAccount()
│   │   │   ├── users.controller.ts
│   │   │   └── users.routes.ts
│   │   │
│   │   └── mcp/
│   │       └── mcp.client.ts          # MCPClient.callTool() with timeout handling
│   │
│   ├── jobs/
│   │   ├── queue.ts                   # Initialize alertsQueue, notificationsQueue, vectorQueue
│   │   │                               # Redis connection: { host, port, retryStrategy }
│   │   └── processors/
│   │       ├── alerts.processor.ts    # Handle alert evaluation jobs
│   │       ├── notifications.processor.ts  # Handle notification delivery jobs
│   │       └── vector.processor.ts    # Handle vector DB rebuild jobs
│   │
│   ├── utils/
│   │   ├── http.ts                    # Axios wrapper with exponential backoff retry
│   │   ├── response.ts                # standardResponse({ success, data, error })
│   │   ├── error.ts                   # Custom error classes: UnauthorizedError, ValidationError, etc.
│   │   └── constants.ts               # App constants, limits, timeouts
│   │
│   ├── types/
│   │   ├── index.d.ts                 # FastifyInstance extensions, global types
│   │   └── Express.d.ts               # Express request extensions
│   │
│   ├── index.ts                       # Application entry point
│   ├── app.ts                         # Fastify server factory
│   └── server.ts                      # Start server, handle graceful shutdown
│
├── tests/                             # Jest test suite
├── .env.example                       # Template for environment variables
├── package.json                       # Dependencies (all pinned versions)
├── tsconfig.json                      # TypeScript strict mode enabled
├── Dockerfile                         # Multi-stage Docker build
└── docker-compose.yml                 # Local dev setup: Fastify, MongoDB, Redis
```

### Key Services

#### Authentication Service (`auth.service.ts`)
```typescript
- register(email, password, name)
  → Hash password with bcryptjs (12 rounds)
  → Create User + Session document
  → Return access_token + refresh_token
  → Password hash NEVER returned to client

- login(email, password)
  → Verify password against stored hash
  → Create new Session with refresh_token_hash
  → Return tokens without sensitive data

- refresh(refresh_token)
  → Validate token against Session hash
  → Invalidate old session
  → Create new session with new tokens
  → Support for token rotation

- logout(all_devices?)
  → If all_devices: delete all user sessions
  → Else: delete current session only

- me()
  → Return authenticated user profile
  → Exclude password_hash field
```

#### Chat Service (`chat.service.ts`)
```typescript
- createConversation(userId, title)
  → Create Conversation document
  → Return with empty message_count

- addUserMessage(conversationId, userId, text)
  → Create Message with role="user"
  → Increment message_count
  → Set last_message_at timestamp

- addAssistantMessage(conversationId, payload)
  → Create Message with role="assistant"
  → Store tool_call if LLM called tool
  → Store rag_context from retrieval
  → Increment message_count

- processChat(conversationId, userId, text)
  → 1. Save user message
  → 2. RAG search for context
  → 3. LLM generation with context
  → 4. If tool_call needed: call MCP tool
  → 5. Save tool result
  → 6. Return final response with visualization type

- getConversations(userId)
  → List all conversations sorted by last_message_at

- getMessages(conversationId, userId)
  → Verify user owns conversation
  → Return messages sorted by createdAt
```

#### Tools Service (`tools.service.ts`)
```typescript
- callTool(toolName, args)
  → 1. Validate args against Zod schema
  → 2. POST to MCP_SERVER_URL/run-tool/{toolName}
  → 3. Handle timeout: MCP_TIMEOUT_MS (default 20s)
  → 4. Retry with exponential backoff on failure
  → 5. Parse response, throw if error
  → Return typed result (using as any for compatibility)

- listAvailableTools()
  → Query MCP server for tool manifest
  → Return { name, description, schema } for each

- validateToolInput(toolName, input)
  → Use toolSchemas.ts to validate
  → 22 tools with specific Zod schemas
```

#### Alerts Service (`alerts.service.ts`)
```typescript
- createRule(userId, { type, float_id, region_polygon, frequency, channels, notify })
  → Create AlertRule document
  → Set enabled=true, user_id ownership
  → Enqueue "evaluate_rule" job immediately

- getUserRules(userId)
  → Return all AlertRules for user
  → Sort by createdAt desc

- updateRule(ruleId, userId, data)
  → Verify ownership
  → Update fields
  → Re-enqueue evaluation job

- deleteRule(ruleId, userId)
  → Verify ownership
  → Soft delete or hard delete

- triggerEvaluation(ruleId)
  → Enqueue manual evaluation job
```

#### Alerts Processor (`alerts.processor.ts` - BullMQ Job Handler)
```typescript
- handleAlertEvaluation(job_data)
  → Retrieve AlertRule from DB
  → Based on rule.type:
    
    IF float-based:
      → Call MCP tool: profile_summary(float_id)
      → Call MCP tool: anomaly_detection(float_id)
      → Check if anomaly_score > threshold OR alert_condition
    
    ELIF region-based:
      → Call MCP tool: polygon_query(region_polygon)
      → Check if floats detected in region
    
    ELIF custom_query:
      → Call MCP tool: sql_query(custom_query)
      → Check if results returned
  
  → If triggered:
    → Update rule.last_triggered_at
    → Create Notification via NotificationsService
    → Choose channel based on notify preferences
    → Enqueue notification delivery job
```

#### Notifications Service & Processor
```typescript
- createNotification(userId, title, message, type, channel, meta)
  → Create Notification document
  → Set status="pending", attempts=0
  → Enqueue "notification_delivery" job
  → Return notification

- Delivery Processor (BullMQ):
  → Increment attempts
  → If channels.email: send via SMTP/SendGrid/SES
  → If channels.sms: send via Twilio
  → If channels.push: send via Firebase/APNs
  → If channels.webhook: POST to webhook_url
  → On success: status="sent", delivered_at=now
  → On error: status="failed", retry next cycle
```

---

## Legacy Backend (Node.js Express)

**Location**: `floatchat/floatchat_backend/`

### Purpose
Old Express backend still running in production. Plans to migrate to Fastify TypeScript backend.

### Structure
```
floatchat_backend/
├── server.js                    # Express server entry point
├── routes/
│   ├── auth.js                  # POST /api/auth/register, /login
│   ├── chat.js                  # POST /api/chat/process, GET /api/chat/history
│   └── visuals.js               # POST /api/visuals/detect
├── controllers/
│   ├── authController.js        # Manual JWT handling
│   ├── chatController.js        # processQuery(), getHistory()
│   └── visualsController.js     # Auto-detect visualization type
├── middleware/
│   └── auth.js                  # JWT verification middleware
├── models/
│   ├── User.js                  # MongoDB User schema
│   ├── ChatHistory.js           # Chat { user, question, response, meta }
│   └── Visualization.js         # Store visualization preferences
├── utils/
│   └── mcp.js                   # MCP client: runQueryFromNL(nlQuestion)
├── config/
│   └── db.js                    # MongoDB connection
└── package.json                 # Dependencies: express, mongoose, axios
```

### Chat Flow (Legacy)
```
POST /api/chat/process { question }
    ↓
chatController.processQuery()
    ↓
Save question to ChatHistory
    ↓
runQueryFromNL(question)  [calls MCP]
    ↓
MCP returns SQL result
    ↓
Auto-detect visualization type
    ↓
Save response to ChatHistory
    ↓
Return to frontend with data
```

### Limitations of Legacy Backend
- Manual JWT token handling (no refresh token rotation)
- No structured logging
- No rate limiting
- No monitoring/metrics
- No type safety (plain JavaScript)
- No job queue for async tasks
- Limited error handling
- No request validation

---

## MCP Server Architecture

**Location**: `floatchat/floatchat-mcp/server/`

### Purpose
Model Context Protocol server that exposes 22 ARGO-specific tools for LLM to call.

### Structure
```
floatchat-mcp/
├── server/
│   ├── server.js                    # MCP server entry point, tool registration
│   ├── dbClient.js                  # PostgreSQL connection pool (Railway DB)
│   ├── manifest.json                # Tool discovery metadata
│   └── tools/                       # Individual tool implementations
│       ├── sqlQueryTool.js          # Execute arbitrary SQL
│       ├── nearestFloatTool.js      # Find closest float to coordinates
│       ├── profileSummary.js        # Get profile statistics
│       ├── temperatureDepthChart.js # T vs depth data
│       ├── salinityTimeSeries.js    # Salinity vs time
│       ├── anomalyDetectionTool.js  # Detect anomalous profiles
│       ├── floatTrajectoryTool.js   # Get float path over time
│       ├── locationToFloatIdTool.js # Reverse lookup
│       ├── metaDataTool.js          # Platform metadata
│       ├── bgcSummaryTool.js        # Biogeochemical data
│       ├── multiFloatCompareTool.js # Compare multiple floats
│       ├── seasonalClimatologyTool.js
│       ├── vectorSearchTool.js      # Semantic search
│       ├── netcdfExportTool.js      # Export to NetCDF
│       ├── profileExportTool.js     # Export profile
│       ├── polygonQueryTool.js      # Query region within polygon
│       ├── depthRangeTool.js        # Query depth range
│       ├── qcFlagTool.js            # Quality control flags
│       ├── argoCycleOverviewTool.js # Cycle information
│       ├── timeWindowQueryTool.js   # Time range query
│       ├── regionalStatsTool.js     # Regional statistics
│       └── listFloatsTools.js       # List all available floats
│
├── package.json                     # Dependencies: jsonrpc, pg, axios
└── manifest.json                    # Tool descriptions for tool discovery
```

### Tool Anatomy

Each tool follows pattern:
```javascript
// temperatureDepthChart.js
module.exports = async (params) => {
  const { float_id, depth_range } = params;
  
  // Query database
  const query = `
    SELECT depth, temperature 
    FROM profiles 
    WHERE platform_number = $1 
    AND depth BETWEEN $2 AND $3
    ORDER BY depth ASC
  `;
  
  const result = await dbClient.query(query, [float_id, ...depth_range]);
  
  // Format response
  return {
    float_id,
    data: result.rows,
    count: result.rowCount,
    unit: "Celsius",
    depth_unit: "meters"
  };
};
```

### MCP Communication Protocol

```
Backend → MCP:
POST /run-tool/temperature_depth_chart
{
  "input": {
    "float_id": "2901545",
    "depth_range": [0, 2000]
  }
}

MCP Response:
{
  "float_id": "2901545",
  "data": [
    { "depth": 0, "temperature": 22.5 },
    { "depth": 50, "temperature": 21.2 },
    ...
  ],
  "count": 45,
  "unit": "Celsius"
}
```

---

## Ingestion System

**Location**: `floatchat/ingestion/`

### Purpose
Convert raw NetCDF ARGO files into processed database records and vector embeddings.

### Files

```
ingestion/
├── ingest.py                        # Main ingestion orchestrator
├── db_utils.py                      # PostgreSQL connection, data loading
├── INGESTION_DOCUMENTATION.md       # Detailed ingestion guide
├── processed/                       # Output: 42+ .nc files
│   ├── D1900042_001.nc
│   ├── D1900042_002.nc
│   └── ...
├── source_files/                    # Input: raw NetCDF files
└── parquet/                         # Intermediate: Parquet exports
```

### Ingestion Pipeline

```python
1. LOAD NetCDF FILES
   → Read raw ARGO .nc files from source_files/
   → Extract: profiles, metadata, measurements

2. PARSE DATA
   → For each profile:
     - Extract: temperature, salinity, pressure, coordinates, time
     - Run QC checks
     - Filter out bad profiles

3. GENERATE SUMMARIES
   → Use statistical models (e.g., auto_stats)
   → Create natural-language profile summary
   → Extract key statistics: mean, std, min, max temps

4. STORE IN POSTGRESQL
   → profile_meta table: float info, location, time
   → profile_summaries table: text + JSON summaries
   → profile_data table: raw depth-value pairs

5. GENERATE EMBEDDINGS
   → Convert summaries to vector embeddings
   → Use SentenceTransformers model
   → Store in ChromaDB with metadata

6. INDEX & OPTIMIZE
   → Create database indexes for fast queries
   → Index ChromaDB for semantic search
```

### Configuration

```python
DATABASE_URL = "postgresql://user:pass@host/railway"

MODELS = {
    "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
    "summary_models": ["auto_stats", "anomaly_detector"],
    "chunk_size": 512  # tokens per embedding
}
```

---

## Vector Database & RAG

**Location**: `floatchat/vectordb/`

### Purpose
Provide semantic search over ARGO profile summaries using embeddings.

### Architecture

```
vectordb/
├── build_vector_db.py               # Create ChromaDB from PostgreSQL
├── rag_search.py                    # Search semantic similarity
├── test_query.py                    # Test RAG responses
├── test_metadata.py                 # Validate stored metadata
├── check_models.py                  # Verify embedding models
├── list_collections.py              # ChromaDB administration
├── chroma_vector_db/                # ChromaDB data directory
│   ├── chroma.sqlite                # Vector store
│   ├── index/                       # HNSW index for fast search
│   └── embeddings/                  # Stored embeddings
└── __pycache__/
```

### RAG Pipeline (Python Service)

```python
# 1. SEARCH PROCESS

def rag_search(user_query):
    # Convert query to embedding
    query_embedding = embedding_model.encode(user_query)
    
    # Search ChromaDB for similar summaries
    results = chroma_collection.query(
        query_embeddings=[query_embedding],
        n_results=5,  # Top 5
        where_filter=None  # Optional filters: time, location, float_id
    )
    
    # Retrieve context chunks
    context = ""
    for result in results:
        context += result["document"] + "\n"
        context += f"[Metadata: {result['metadata']}]\n\n"
    
    return {
        "context": context,
        "retrieved_chunks": results,
        "relevance_scores": results["distances"]
    }


# 2. LLM GENERATION

def rag_generate(query, context):
    prompt = f"""
    User Query: {query}
    
    Relevant Context from Database:
    {context}
    
    Based on the context, answer the user's query.
    If you need to call a tool to get more data, respond with:
    TOOL_CALL: tool_name | argument1 | argument2
    
    Otherwise, provide a direct answer.
    """
    
    response = llm.generate(prompt)  # Call LLM API
    
    if response.startswith("TOOL_CALL:"):
        # Parse tool call
        parts = response.split("|")
        return {
            "tool_call": {
                "name": parts[0].replace("TOOL_CALL:", "").strip(),
                "arguments": parse_args(parts[1:])
            }
        }
    else:
        return {
            "text": response,
            "tool_call": None
        }
```

### LLM Interface

```
POST /api/rag/search
{ "query": "temperature profile for float 2901545" }

Response:
{
  "context": "Float 2901545 profile summary...",
  "metadata": { 
    "float_ids": ["2901545"],
    "coordinates": [[20.5, 35.2]],
    "time_range": ["2024-11-01", "2024-12-03"]
  }
}

POST /api/rag/generate
{
  "query": "temperature profile...",
  "context": "..." 
}

Response:
{
  "text": "The temperature profile shows...",
  "tool_call": {
    "name": "temperature_depth_chart",
    "arguments": { "float_id": "2901545" }
  }
}
```

---

## Chat History & Storage

### Chat Schema (MongoDB)

```javascript
Conversation {
  _id: ObjectId,
  user_id: ObjectId,          // Reference to User
  title: String,              // "Argo Float Analysis"
  description: String,        // Optional summary
  
  message_count: Number,      // For pagination
  last_message_at: Date,      // For sorting
  
  tags: [String],             // For organization
  source: String,             // "chat", "alert_insight", etc.
  
  is_archived: Boolean,
  is_deleted: Boolean,        // Soft delete
  
  createdAt: Date,
  updatedAt: Date
}

Message {
  _id: ObjectId,
  conversation_id: ObjectId,  // Reference to Conversation
  user_id: ObjectId,          // null for assistant messages
  
  role: "user" | "assistant" | "tool",
  text: String,               // Message content
  
  // For tracking tool usage
  tool_call: {
    name: String,             // e.g., "temperature_depth_chart"
    args: Object,             // Tool arguments
    result: Object,           // Tool execution result
    started_at: Date,
    finished_at: Date,
    success: Boolean,
    error_message: String
  },
  
  // For tracking RAG retrieval
  rag_context: {
    retrieved_docs: [String], // Document IDs from vector DB
    vector_score: Number,     // Semantic similarity score
    query_embedding: [Number] // The embedding used
  },
  
  // For attachments
  attachments: [{
    type: "image" | "file" | "geojson" | "netcdf",
    url: String,
    metadata: Object
  }],
  
  // Metrics
  metadata: {
    tokens_in: Number,        // Prompt tokens
    tokens_out: Number,       // Completion tokens
    latency_ms: Number,       // Response time
    model: String             // LLM model used
  },
  
  is_partial: Boolean,        // For streaming
  sequence_index: Number,     // Order in stream
  
  createdAt: Date,
  updatedAt: Date
}
```

### Storage Pattern

```
1. User sends question
   → Create Message { role: "user", text: question }

2. LLM processes
   → If tool needed: create Message { role: "assistant", tool_call: {...} }
   → MCP executes tool

3. Tool returns result
   → Create Message { role: "assistant", tool_call: { ...result } }

4. Chat history retrieval
   → GET /api/chat/{conversationId}/messages
   → Sort by createdAt
   → Include all context for replay/analysis

5. Search chat history
   → Query MongoDB text index on Message.text
   → Or use vector search if summarized
```

---

## Personalized Alerts System

### Alert Types

#### 1. Float-Based Alerts
```typescript
AlertRule {
  user_id: ObjectId,
  name: "Monitor Float 2901545",
  type: "float",
  float_id: "2901545",
  
  // Alert condition
  condition_ast: {
    op: "OR",
    conditions: [
      { metric: "anomaly_score", operator: ">", value: 0.8 },
      { metric: "temperature_gradient", operator: ">", value: 5.0 }
    ]
  },
  
  // Frequency & throttling
  frequency: "hourly",        // How often to check
  throttle_minutes: 60,       // Min time between alerts
  
  // Notification channels
  channels: { email, sms, push, webhook },
  webhook_url: String,
  
  // Status
  enabled: Boolean,
  last_triggered_at: Date,
  
  // Metadata
  created_at: Date,
  updated_at: Date
}
```

#### 2. Region-Based Alerts
```typescript
AlertRule {
  user_id: ObjectId,
  name: "Monitor Atlantic Region",
  type: "region",
  
  region_polygon: {
    type: "Polygon",
    coordinates: [[[lon, lat], [lon, lat], ...]]  // GeoJSON
  },
  
  // When triggered: N floats detected in region
  alert_threshold: { floats_detected: 3 }
  
  // Rest same as float-based
}
```

#### 3. Custom Query Alerts
```typescript
AlertRule {
  user_id: ObjectId,
  name: "Temperature Anomalies",
  type: "custom_query",
  
  custom_query: """
    SELECT float_id, depth, temperature 
    FROM profiles 
    WHERE temperature > 25 AND depth < 100
  """,
  
  // Trigger if query returns > 0 rows
  alert_threshold: { result_rows: 0, operator: ">" }
}
```

### Alert Evaluation Flow (BullMQ Job)

**Processor**: `src/jobs/processors/alerts.processor.ts`

```
Scheduled every hour (or manually triggered):
    ↓
For each enabled AlertRule:
    ↓
    ├─ If float-based:
    │  ├─ Call MCP: profile_summary(float_id)
    │  ├─ Call MCP: anomaly_detection(float_id)
    │  └─ Check: anomaly_score > 0.7?
    │
    ├─ If region-based:
    │  ├─ Call MCP: polygon_query(region_polygon)
    │  └─ Check: floats_detected > threshold?
    │
    └─ If custom_query:
       ├─ Call MCP: sql_query(custom_query)
       └─ Check: result_rows > threshold?
    
    If TRIGGERED:
    ├─ Update: last_triggered_at = now
    ├─ Check throttle: skip if triggered < throttle_minutes ago
    ├─ Determine notification channel from notify preferences
    ├─ Create Notification document
    └─ Enqueue notification_delivery job
```

### Notification Delivery (BullMQ Job)

```
For each Notification with status="pending":
    ↓
    Increment attempts counter
    
    For each enabled channel:
    ├─ Email:
    │  └─ Send via SMTP/SendGrid/SES
    │
    ├─ SMS:
    │  └─ Send via Twilio API
    │
    ├─ Push:
    │  └─ Send via Firebase Cloud Messaging
    │
    └─ Webhook:
       └─ POST to webhook_url with notification data
    
    If ALL channels succeeded:
    ├─ status = "sent"
    ├─ delivered_at = now
    └─ Save to DB
    
    Else if attempts < MAX_RETRIES:
    ├─ Keep status = "pending"
    └─ Re-enqueue for retry (exponential backoff)
    
    Else:
    ├─ status = "failed"
    └─ Log failure for debugging
```

---

## Subscription & Notification System

### Subscription Model

```typescript
Subscription {
  user_id: ObjectId,
  
  // What to subscribe to
  type: "float" | "region" | "query",
  
  // Float subscription
  float_id?: String,
  float_metadata?: {
    platform_number: Number,
    location: { lat, lon }
  },
  
  // Region subscription
  region_polygon?: GeoJSON,
  region_name?: String,
  
  // Custom query
  query?: String,
  
  // Alert frequency
  alert_frequency: "real-time" | "daily" | "weekly",
  digest_time?: String,  // "09:00 UTC"
  
  // Notification preferences
  notify_via: {
    email: Boolean,
    sms: Boolean,
    push: Boolean,
    webhook: Boolean
  },
  
  // Status
  is_active: Boolean,
  created_at: Date,
  updated_at: Date
}
```

### Notification Workflow

```
1. Alert triggered
   ↓
2. Create Notification:
   - user_id from alert owner
   - title: "Alert: [Alert Name]"
   - message: Human-readable summary
   - type: "alert"
   - status: "pending"
   - channels: From alert notify preferences
   
3. Enqueue delivery job
   ↓
4. BullMQ processor handles delivery
   - Rate limited: not more than once per minute
   - Retries: exponential backoff up to 3 times
   - Logs: track delivery attempts
   
5. Update status
   - "sent": successfully delivered
   - "failed": all retries exhausted
   - "cancelled": user unsubscribed
```

---

## Frontend Integration Points

### API Endpoints

```
AUTH:
POST   /api/auth/register          { email, password, name }
POST   /api/auth/login             { email, password }
POST   /api/auth/refresh           { refresh_token }
POST   /api/auth/logout            { all_devices? }
GET    /api/auth/me                (authenticated)

CHAT:
POST   /api/chat/process           { question }
GET    /api/chat/conversations     (authenticated)
GET    /api/chat/{id}/messages     (authenticated)
POST   /api/chat/{id}/message      { content } (authenticated)
WS     /api/chat/stream            (WebSocket for real-time)

TOOLS:
GET    /api/tools                  List all tools
POST   /api/tools/call             { name, args }

RAG:
POST   /api/rag/search             { query }
POST   /api/rag/generate           { query, context }

ALERTS:
POST   /api/alerts                 { type, float_id, ... }
GET    /api/alerts                 (list user's alerts)
PUT    /api/alerts/{id}            { ...update }
DELETE /api/alerts/{id}
POST   /api/alerts/{id}/trigger    (manual trigger)

SUBSCRIPTIONS:
POST   /api/subscriptions          { type, float_id, ... }
GET    /api/subscriptions          (list)
DELETE /api/subscriptions/{id}

NOTIFICATIONS:
GET    /api/notifications          (list unread)
POST   /api/notifications/{id}/mark-read
DELETE /api/notifications/{id}

INGEST:
POST   /api/ingest/trigger         (start ingestion)
GET    /api/ingest/status          (check progress)
GET    /api/ingest/files           (list available files)
```

### Frontend Response Format

```typescript
// Successful response
{
  "success": true,
  "data": { ... },
  "timestamp": "2024-12-03T10:30:00Z"
}

// Error response
{
  "success": false,
  "error": "Error message",
  "code": "VALIDATION_ERROR",
  "details": { ... }
}

// Chat response with visualization
{
  "success": true,
  "data": {
    "message": {
      "id": "msg_123",
      "role": "assistant",
      "text": "The temperature profile shows...",
      "tool_call": {
        "name": "temperature_depth_chart",
        "result": { ... }
      }
    },
    "visualization": {
      "type": "profile",  // or "map", "timeseries", "table"
      "data": { ... },
      "config": { ... }
    }
  }
}
```

---

## What's Missing & TODO

### High Priority (Blocking Production)

- [ ] **Frontend Implementation**
  - [ ] React/Vue component for chat interface
  - [ ] Real-time message streaming (WebSocket/SSE)
  - [ ] Chart rendering library integration
  - [ ] Map visualization for float locations
  - [ ] Profile visualization (depth vs temperature)

- [ ] **Authentication UI**
  - [ ] Login/register pages
  - [ ] JWT token storage (httpOnly cookies recommended)
  - [ ] Logout functionality
  - [ ] Token refresh handling

- [ ] **Chat History UI**
  - [ ] Conversation list
  - [ ] Message display with streaming
  - [ ] Tool result visualization
  - [ ] Search/filter conversations

- [ ] **Error Handling & Validation**
  - [ ] Input validation for all endpoints (Zod schemas in place)
  - [ ] Comprehensive error messages
  - [ ] Graceful fallback UI for failures

### Medium Priority

- [ ] **Notification Delivery Channels**
  - [ ] Email service integration (SendGrid/SES/SMTP)
  - [ ] SMS service integration (Twilio)
  - [ ] Push notification service (Firebase Cloud Messaging)
  - [ ] Webhook endpoint testing framework

- [ ] **RAG Service Completion**
  - [ ] Full Python FastAPI service with embeddings
  - [ ] LLM API integration (Gemini, Claude, or local Ollama)
  - [ ] Prompt optimization for tool calling
  - [ ] Response formatting for visualization

- [ ] **Alert Evaluation Enhancement**
  - [ ] Support more complex condition AST
  - [ ] Anomaly detection algorithm refinement
  - [ ] Threshold learning (adaptive alerts)
  - [ ] Alert deduplication

- [ ] **Monitoring & Observability**
  - [ ] Prometheus metrics dashboard (Grafana)
  - [ ] Distributed tracing (Jaeger)
  - [ ] Health check endpoints
  - [ ] Log aggregation (ELK stack or similar)

### Lower Priority (Nice-to-Have)

- [ ] **Performance Optimization**
  - [ ] Database query optimization
  - [ ] Caching layer (Redis for frequently accessed data)
  - [ ] GraphQL API as alternative to REST
  - [ ] Request batching for multiple tools

- [ ] **Advanced Features**
  - [ ] Multi-user collaboration on shared analysis
  - [ ] Scheduled reports
  - [ ] Data export (CSV, NetCDF, GeoJSON)
  - [ ] Custom visualization builder
  - [ ] Alert pattern learning

- [ ] **Testing**
  - [ ] Unit tests for services
  - [ ] Integration tests for API endpoints
  - [ ] End-to-end tests for workflows
  - [ ] Load testing

- [ ] **Deployment**
  - [ ] Kubernetes deployment configs
  - [ ] CI/CD pipeline (GitHub Actions)
  - [ ] Infrastructure as Code (Terraform)
  - [ ] Multi-region setup

---

## Architecture Decision Records

### Why Fastify over Express?
- Performance: 2x faster
- Type safety: Full TypeScript support
- Plugin system: Easier middleware management
- Built-in schema validation
- Production-ready out of box

### Why MongoDB + PostgreSQL?
- **PostgreSQL**: For structured ARGO data, complex queries, geospatial queries
- **MongoDB**: For flexible chat history, user preferences, alert configurations
- **ChromaDB**: Vector store for semantic search

### Why BullMQ + Redis?
- Reliable job queue with retry logic
- Visual monitoring dashboard
- Exponential backoff
- Job scheduling support
- Better than cron for distributed systems

### Why JWT + Refresh Tokens?
- Stateless authentication
- Refresh tokens: short-lived access tokens + long-lived refresh tokens
- Token rotation: automatically invalidate old tokens
- Support for "logout all devices"
- Secure: access token short-lived, refresh token hashed in DB

---

## Quick Start Development

```bash
# Backend
cd backend
npm install
npm run dev  # Starts on :3000

# MongoDB + Redis local setup
docker-compose up

# MCP Server
cd floatchat-mcp
npm install
npm start  # Starts on :4000

# Python RAG Service
cd vectordb
python -m pip install -r requirements.txt
python app.py  # Flask/FastAPI on :5001

# Legacy Express backend (optional)
cd floatchat_backend
npm install
npm run dev  # Starts on :5000
```

---

## Conclusion

FloatChat is a sophisticated AI platform for ocean data analysis, combining:
- **Structured chat interface** for natural language queries
- **Tool integration** via MCP for ARGO-specific data operations
- **RAG pipeline** for context-aware LLM responses
- **Alert system** for personalized oceanographic monitoring
- **Multi-channel notifications** for user engagement

The architecture is designed for scalability, with clear separation of concerns, proper authentication, and enterprise-grade job processing. The next phase focuses on frontend implementation and deploying the Python RAG service.

---

**Document Generated**: December 3, 2025  
**Status**: Ready for team handoff to ChatGPT for feature development  
**Next Steps**: Frontend UI implementation, RAG service deployment, alert testing
