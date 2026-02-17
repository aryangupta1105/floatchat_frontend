# FloatChat Express Backend - Complete Architecture & Production-Ready Guide

**Date**: December 3, 2025  
**Version**: 2.0  
**Project**: FloatChat - Ocean AI Platform with ARGO Float Data Integration  
**Backend**: Express.js (Node.js) - Friend's Production Backend  
**Focus**: Making enterprise-grade, production-ready, complete workflow integration

---

## Table of Contents
1. [System Overview & Current State](#system-overview--current-state)
2. [Complete FloatChat Workflow](#complete-floatchat-workflow)
3. [Current Backend Architecture](#current-backend-architecture)
4. [Production-Ready Enhancements](#production-ready-enhancements)
5. [Chat History & Storage System](#chat-history--storage-system)
6. [Personalized Alerts System](#personalized-alerts-system)
7. [MCP Server Integration](#mcp-server-integration)
8. [RAG Pipeline Integration](#rag-pipeline-integration)
9. [Vector Database & Semantic Search](#vector-database--semantic-search)
10. [Missing Features & Implementation Roadmap](#missing-features--implementation-roadmap)
11. [Database Schemas](#database-schemas)
12. [API Endpoints Reference](#api-endpoints-reference)
13. [Error Handling & Validation](#error-handling--validation)
14. [Security Best Practices](#security-best-practices)

---

## System Overview & Current State

### Current Architecture (As-Is)

```
┌─────────────────┐
│   Frontend      │
│  (React/Vue)    │
└────────┬────────┘
         │ POST /api/chat/process
         │ { question: "..." }
         ▼
┌──────────────────────────────────────┐
│  Express Backend (Friend's)          │
│  - Basic Auth (JWT)                  │
│  - Chat Processing                   │
│  - History Storage                   │
│  - MCP Client Integration            │
└────────┬─────────────────────────────┘
         │ Calls: sql_query tool
         ▼
┌──────────────────────────────────────┐
│  MCP Server (Node.js)                │
│  - 22 ARGO Data Tools                │
│  - PostgreSQL Interface              │
└────────┬─────────────────────────────┘
         │ Query/Data
         ▼
┌──────────────────────────────────────┐
│  PostgreSQL (Railway)                │
│  - ARGO Profile Data                 │
│  - Metadata                          │
└──────────────────────────────────────┘
```

### What Works Now
✅ User authentication (signup/login with JWT)  
✅ Basic chat processing (accepts question, calls MCP sql_query tool)  
✅ Chat history storage (MongoDB)  
✅ MCP integration (calls one tool: sql_query)  
✅ Auto visualization detection (maps profiles based on columns)  

### What's Missing (Critical)
❌ RAG pipeline integration (semantic search)  
❌ LLM integration (intelligent tool selection)  
❌ Multi-tool orchestration (only using sql_query)  
❌ Proper error handling & validation  
❌ Refresh token rotation  
❌ Alert system  
❌ Subscription management  
❌ Notification delivery system  
❌ Input validation (Joi/Yup)  
❌ Rate limiting  
❌ Structured logging  
❌ Request correlation IDs  

---

## Complete FloatChat Workflow

### Step-by-Step End-to-End Flow

```
USER SENDS QUERY
├─ Frontend: "Show me temperature anomalies in the Atlantic"
└─ POST /api/chat/process { question }
   ↓
BACKEND RECEIVES & AUTHENTICATES
├─ Verify JWT token
├─ Extract user ID
└─ Validate question not empty
   ↓
SAVE INITIAL STATE
├─ Create ChatHistory document
├─ Set status: "processing"
└─ Save user question
   ↓
RAG SEARCH (Python Service)
├─ Convert question to embedding
│  └─ Using: SentenceTransformers model
├─ Query ChromaDB for relevant context
│  └─ Find top-5 similar profile summaries
├─ Retrieve ARGO metadata
│  └─ Float IDs, locations, dates in results
└─ Return: { context, metadata, scores }
   ↓
LLM GENERATION (Claude/Gemini/Ollama)
├─ Input: [user_question + RAG_context]
├─ LLM decides:
│  ├─ Option A: Direct text answer
│  ├─ Option B: Call specific tool(s)
│  │           ├─ anomaly_detection(float_ids)
│  │           ├─ polygon_query(region)
│  │           └─ temperature_depth_chart(float_id)
│  └─ Return: { text?, tool_calls?: [...] }
   ↓
INTELLIGENT TOOL ORCHESTRATION
├─ If no tools needed:
│  └─ Use LLM response as-is, skip MCP
├─ If tools needed:
│  ├─ For each tool_call:
│  │  ├─ Validate arguments
│  │  ├─ Call MCP tool via runQueryFromNL()
│  │  ├─ Receive structured data
│  │  └─ Add to tool_results[]
│  └─ Send tool_results back to LLM for formatting
   ↓
LLM FORMATS FINAL RESPONSE
├─ Takes tool results
├─ Formats as human-readable text
├─ Suggests visualization type
└─ Return: { text, visualization_type, data }
   ↓
BACKEND PROCESSES RESPONSE
├─ Detect visualization type from data
│  ├─ If lat+lon: type="map"
│  ├─ If depth+temperature: type="profile"
│  ├─ If time+value: type="timeseries"
│  └─ Else: type="table"
├─ Update ChatHistory
│  ├─ Set response content
│  ├─ Store tool_calls used
│  ├─ Store tool_results
│  └─ Set status: "completed"
└─ Return to frontend
   ↓
FRONTEND RENDERS
├─ Display text response
├─ Render visualization based on type
├─ Show used tools/sources
└─ Save to browser history
```

---

## Current Backend Architecture

### Project Structure

```
floatchat_backend/
├── server.js                        # Express app entry point
├── package.json                     # Dependencies
├── .env                             # Environment variables
├── .env.example                     # Example env template
│
├── routes/                          # API route definitions
│   ├── auth.js                      # POST /api/auth/signup, /api/auth/login
│   ├── chat.js                      # POST /api/chat/process, GET /api/chat/history
│   └── visuals.js                   # POST /api/visuals/detect
│
├── controllers/                     # Business logic handlers
│   ├── authController.js            # signup(), login(), me()
│   │   └─ Issues JWT token
│   │   └─ Hash passwords with bcrypt
│   ├── chatController.js            # processQuery(), getHistory()
│   │   └─ Calls MCP via runQueryFromNL()
│   │   └─ Detects visualization type
│   │   └─ Stores chat history
│   └── visualsController.js         # detectVisualizationType()
│
├── models/                          # MongoDB schemas
│   ├── User.js                      # { name, email, passwordHash }
│   ├── ChatHistory.js               # { user, question, response, meta }
│   └── Visualization.js             # { user, config }
│
├── middleware/                      # Express middleware
│   └── auth.js                      # JWT verification
│       └─ Extracts user from token
│       └─ Attaches to req.user
│
├── utils/                           # Utility functions
│   └── mcp.js                       # runQueryFromNL(question, user)
│       └─ Calls MCP server
│       └─ Handles MCP response parsing
│       └─ Auto-detects visualization
│
├── config/                          # Configuration
│   └── db.js                        # MongoDB connection
│
└── .gitignore                       # Git ignore rules
```

### Key Files Explained

#### `server.js` - Express App Entry Point
```javascript
// Current implementation
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const connectDB = require("./config/db");

const app = express();
connectDB();

app.use(cors());
app.use(bodyParser.json({ limit: "10mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/visuals", visualsRoutes);

app.listen(PORT);
```

**Issues**:
- No error handling middleware
- No request logging
- No rate limiting
- No request validation
- No request correlation IDs
- No health check endpoint

**Enhanced Version Needed**:
```javascript
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const morgan = require("morgan");

const app = express();

// Security
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN }));

// Parsing
app.use(bodyParser.json({ limit: "50mb" }));

// Logging
app.use(morgan("combined"));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});
app.use("/api/", limiter);

// Health check
app.get("/health", (req, res) => res.json({ status: "ok" }));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/subscriptions", subscriptionRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: err.message });
});

app.listen(PORT);
```

#### `controllers/chatController.js` - Core Chat Processing

**Current Flow**:
```javascript
processQuery:
1. Save question to DB
2. Call MCP tool (sql_query only)
3. Detect visualization type
4. Save response
5. Return to frontend
```

**Missing Flow**:
```javascript
processQuery should:
1. Validate input ✗
2. Save question ✓
3. Call RAG service ✗ (for semantic search)
4. Call LLM ✗ (for intelligent routing)
5. Determine which tool(s) to use ✗
6. Call MCP tool(s) ✓ (partially)
7. Format response ✗
8. Save complete conversation ✗
9. Return visualization + data ✓ (partially)
```

#### `utils/mcp.js` - MCP Client

**Current Implementation**:
```javascript
// Only calls sql_query tool
// Hard-coded tool name
// Minimal error handling
```

**Should Be**:
```javascript
// Smart tool selection
// Dynamic tool calling based on LLM decision
// Retry logic & timeout handling
// Tool input validation
// Response parsing for each tool type
```

---

## Production-Ready Enhancements

### 1. Add Input Validation (Joi/Yup)

**File to Create**: `middleware/validation.js`

```javascript
const Joi = require("joi");

const schemas = {
  signup: Joi.object({
    name: Joi.string().required(),
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  processQuery: Joi.object({
    question: Joi.string().min(3).max(1000).required(),
    conversationId: Joi.string().optional(),
    userId: Joi.string().required()
  })
};

module.exports = (schemaName) => {
  return (req, res, next) => {
    const { error, value } = schemas[schemaName].validate(req.body);
    if (error) {
      return res.status(400).json({ 
        error: error.details[0].message 
      });
    }
    req.validated = value;
    next();
  };
};
```

**Usage**:
```javascript
router.post("/process", 
  auth, 
  validate("processQuery"), 
  processQuery
);
```

### 2. Add Structured Logging

**File to Create**: `utils/logger.js`

```javascript
const winston = require("winston");

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.json(),
  defaultMeta: { service: "floatchat-backend" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" })
  ]
});

if (process.env.NODE_ENV !== "production") {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

### 3. Add Request Correlation IDs

**File to Create**: `middleware/requestId.js`

```javascript
const { v4: uuid } = require("uuid");

module.exports = (req, res, next) => {
  req.id = uuid();
  res.set("X-Request-ID", req.id);
  next();
};
```

### 4. Add Refresh Token System

**Enhanced Auth Controller**:

```javascript
// Add to User model:
refreshTokens: [{ token_hash: String, device: String, expiresAt: Date }]

// In authController.js:
exports.login = async (req, res) => {
  // ... verify credentials ...
  
  const accessToken = jwt.sign(
    { id: user._id },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }  // Short-lived
  );
  
  const refreshToken = jwt.sign(
    { id: user._id },
    process.env.REFRESH_SECRET,
    { expiresIn: "7d" }   // Long-lived
  );
  
  // Hash and store refresh token
  const tokenHash = bcrypt.hash(refreshToken, 10);
  user.refreshTokens.push({
    token_hash: tokenHash,
    device: req.headers["user-agent"],
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
  });
  await user.save();
  
  res.json({ accessToken, refreshToken });
};

exports.refresh = async (req, res) => {
  const { refreshToken } = req.body;
  
  try {
    const decoded = jwt.verify(refreshToken, process.env.REFRESH_SECRET);
    const user = await User.findById(decoded.id);
    
    // Verify token exists and not expired
    const storedToken = user.refreshTokens.find(t => 
      bcrypt.compare(refreshToken, t.token_hash)
    );
    
    if (!storedToken || storedToken.expiresAt < Date.now()) {
      return res.status(401).json({ error: "Invalid refresh token" });
    }
    
    // Generate new tokens
    const newAccessToken = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );
    
    res.json({ accessToken: newAccessToken });
  } catch (err) {
    res.status(401).json({ error: "Invalid refresh token" });
  }
};
```

### 5. Add Error Handling Middleware

**File to Create**: `middleware/errorHandler.js`

```javascript
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

module.exports = {
  AppError,
  
  asyncHandler: (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  },
  
  errorMiddleware: (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    logger.error({
      requestId: req.id,
      statusCode,
      message,
      stack: err.stack,
      url: req.url
    });
    
    res.status(statusCode).json({
      success: false,
      error: message,
      requestId: req.id
    });
  }
};
```

---

## Chat History & Storage System

### Enhanced ChatHistory Schema

```javascript
const chatSchema = new mongoose.Schema({
  user: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  
  // Current conversation
  conversationId: {
    type: String,
    index: true
  },
  
  // Message content
  question: { 
    type: String, 
    required: true 
  },
  
  response: {
    content: String,
    visualizationType: String,      // "map", "profile", "timeseries", "table"
    hasVisualization: Boolean,
    data: mongoose.Schema.Types.Mixed
  },
  
  // RAG context used
  ragContext: {
    query: String,
    retrievedDocs: [String],
    scores: [Number],
    timestamp: Date
  },
  
  // Tools called
  toolsCalled: [{
    name: String,                   // "temperature_depth_chart"
    arguments: mongoose.Schema.Types.Mixed,
    result: mongoose.Schema.Types.Mixed,
    duration: Number,               // ms
    success: Boolean,
    error: String
  }],
  
  // LLM interaction
  llmUsed: {
    model: String,                  // "gpt-4", "claude-3", "gemini"
    tokensIn: Number,
    tokensOut: Number,
    latency: Number
  },
  
  // Metadata
  meta: {
    userAgent: String,
    ipAddress: String,
    duration: Number,               // total processing time
    updatedAt: Date
  },
  
  status: {
    type: String,
    enum: ["pending", "processing", "completed", "error"],
    default: "pending"
  },
  
  tags: [String],                   // For organization
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Indexes for performance
chatSchema.index({ user: 1, createdAt: -1 });
chatSchema.index({ conversationId: 1 });
chatSchema.index({ status: 1 });
```

### Conversation-Based Chat History

```javascript
// New model: Conversation.js
const conversationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  title: String,                    // User-given or AI-generated
  description: String,
  
  messages: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "ChatMessage"
  }],
  
  summary: String,                  // Auto-generated summary
  
  tags: [String],
  
  createdAt: Date,
  updatedAt: Date
});

// New model: ChatMessage.js
const messageSchema = new mongoose.Schema({
  conversation: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Conversation" 
  },
  
  type: {
    type: String,
    enum: ["user_message", "assistant_response", "tool_call", "tool_result"]
  },
  
  content: String,
  
  // For tool calls
  toolName: String,
  toolArguments: mongoose.Schema.Types.Mixed,
  toolResult: mongoose.Schema.Types.Mixed,
  
  // For RAG context
  ragContext: {
    query: String,
    docs: [String],
    scores: [Number]
  },
  
  metadata: {
    duration: Number,
    tokens: Number,
    model: String
  },
  
  createdAt: Date
});
```

---

## Personalized Alerts System

### Alert Types Architecture

```javascript
// New Model: AlertRule.js

const alertSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  
  name: String,
  description: String,
  
  type: {
    type: String,
    enum: ["float", "region", "custom", "threshold"],
    required: true
  },
  
  // Float-based alert
  floatAlert: {
    floatId: String,
    metrics: [String],              // ["temperature", "salinity"]
    threshold: mongoose.Schema.Types.Mixed  // { metric: "temp", op: ">", value: 25 }
  },
  
  // Region-based alert
  regionAlert: {
    polygon: {
      type: "Polygon",
      coordinates: [[[Number, Number]]]  // GeoJSON format
    },
    floatCountThreshold: Number
  },
  
  // Custom query alert
  customAlert: {
    query: String,
    resultThreshold: Number
  },
  
  // Notification preferences
  notify: {
    email: Boolean,
    sms: Boolean,
    push: Boolean,
    webhook: { enabled: Boolean, url: String }
  },
  
  // Frequency
  frequency: {
    type: String,
    enum: ["real-time", "hourly", "daily", "weekly"],
    default: "daily"
  },
  
  throttleMinutes: { type: Number, default: 60 },  // Min time between alerts
  
  // Status
  enabled: { type: Boolean, default: true },
  lastTriggeredAt: Date,
  
  createdAt: Date,
  updatedAt: Date
});
```

### Alert Evaluation Engine

**File to Create**: `services/alertService.js`

```javascript
class AlertService {
  static async evaluateAllAlerts() {
    const alerts = await AlertRule.find({ enabled: true });
    
    for (const alert of alerts) {
      try {
        await this.evaluateAlert(alert);
      } catch (err) {
        logger.error({ alertId: alert._id, err });
      }
    }
  }
  
  static async evaluateAlert(alert) {
    let triggered = false;
    let context = {};
    
    // Check throttle
    if (alert.lastTriggeredAt) {
      const timeSinceLastTrigger = Date.now() - alert.lastTriggeredAt;
      if (timeSinceLastTrigger < alert.throttleMinutes * 60 * 1000) {
        return;  // Skip if throttled
      }
    }
    
    // Evaluate based on type
    if (alert.type === "float") {
      ({ triggered, context } = await this.evaluateFloatAlert(alert));
    } 
    else if (alert.type === "region") {
      ({ triggered, context } = await this.evaluateRegionAlert(alert));
    }
    else if (alert.type === "custom") {
      ({ triggered, context } = await this.evaluateCustomAlert(alert));
    }
    
    if (triggered) {
      alert.lastTriggeredAt = new Date();
      await alert.save();
      
      // Create notification
      await NotificationService.createNotification({
        userId: alert.user,
        alertId: alert._id,
        title: `Alert: ${alert.name}`,
        context
      });
    }
  }
  
  static async evaluateFloatAlert(alert) {
    const { floatId, threshold, metrics } = alert.floatAlert;
    
    // Call MCP to get latest profile
    const result = await callMCPTool("profile_summary", { floatId });
    
    // Check if threshold exceeded
    for (const metric of metrics) {
      if (result[metric] > threshold.value) {
        return {
          triggered: true,
          context: { metric, value: result[metric], threshold: threshold.value }
        };
      }
    }
    
    return { triggered: false };
  }
  
  static async evaluateRegionAlert(alert) {
    const { polygon, floatCountThreshold } = alert.regionAlert;
    
    // Call MCP to find floats in region
    const result = await callMCPTool("polygon_query", { polygon });
    
    if (result.floats.length > floatCountThreshold) {
      return {
        triggered: true,
        context: { floatsFound: result.floats.length, threshold: floatCountThreshold }
      };
    }
    
    return { triggered: false };
  }
  
  static async evaluateCustomAlert(alert) {
    const { query, resultThreshold } = alert.customAlert;
    
    // Call MCP with custom SQL
    const result = await callMCPTool("sql_query", { query });
    
    if (result.rows.length > resultThreshold) {
      return {
        triggered: true,
        context: { rowsFound: result.rows.length, threshold: resultThreshold }
      };
    }
    
    return { triggered: false };
  }
}

module.exports = AlertService;
```

---

## MCP Server Integration

### Current MCP Client (`utils/mcp.js`)

**Problems**:
- Only calls sql_query tool
- No retry logic
- No timeout handling
- No input validation
- Hard-coded tool selection
- Limited error messages

### Enhanced MCP Client

**File**: `utils/mcpClient.js`

```javascript
const axios = require("axios");
const logger = require("./logger");

class MCPClient {
  constructor() {
    this.baseUrl = process.env.MCP_URL || "http://localhost:4000";
    this.timeout = process.env.MCP_TIMEOUT || 30000;
    this.maxRetries = 3;
  }
  
  async callTool(toolName, args, retries = 0) {
    try {
      logger.info({ toolName, args }, "Calling MCP tool");
      
      const payload = {
        jsonrpc: "2.0",
        id: Date.now(),
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args
        }
      };
      
      const response = await axios.post(
        `${this.baseUrl}/mcp`,
        payload,
        { timeout: this.timeout }
      );
      
      const result = response.data?.result?.content?.[0]?.text;
      
      if (!result) {
        throw new Error("No response from MCP");
      }
      
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch {
        parsed = { raw: result };
      }
      
      logger.info({ toolName, success: true }, "MCP tool succeeded");
      return parsed;
      
    } catch (err) {
      logger.error({ toolName, error: err.message, retries }, "MCP tool failed");
      
      if (retries < this.maxRetries) {
        // Exponential backoff
        const delayMs = Math.pow(2, retries) * 1000;
        await new Promise(resolve => setTimeout(resolve, delayMs));
        return this.callTool(toolName, args, retries + 1);
      }
      
      throw err;
    }
  }
  
  async listTools() {
    try {
      const response = await axios.get(`${this.baseUrl}/tools`);
      return response.data.tools || [];
    } catch (err) {
      logger.error("Failed to list MCP tools");
      return [];
    }
  }
}

module.exports = new MCPClient();
```

### Smart Tool Orchestration

**File to Create**: `services/toolOrchestrator.js`

```javascript
const mcpClient = require("../utils/mcpClient");

class ToolOrchestrator {
  // Map of tools and their expected parameters
  static toolDefinitions = {
    "temperature_depth_chart": {
      params: ["float_id", "depth_range"],
      description: "Get temperature vs depth profile"
    },
    "anomaly_detection": {
      params: ["float_id"],
      description: "Detect anomalies in float data"
    },
    "polygon_query": {
      params: ["polygon"],
      description: "Query floats within polygon"
    },
    "profile_summary": {
      params: ["float_id"],
      description: "Get profile summary statistics"
    },
    "sql_query": {
      params: ["query"],
      description: "Execute SQL query"
    }
    // ... add all 22 tools
  };
  
  // LLM decides which tools to call based on user question
  static async orchestrateToolCalls(question, llmResponse) {
    // llmResponse contains: { text, toolCalls: [{name, args}, ...] }
    
    if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
      return { text: llmResponse.text, tools: [] };
    }
    
    const toolResults = [];
    
    for (const toolCall of llmResponse.toolCalls) {
      try {
        // Validate tool name
        if (!this.toolDefinitions[toolCall.name]) {
          logger.warn({ tool: toolCall.name }, "Unknown tool requested");
          continue;
        }
        
        // Validate parameters
        const expectedParams = this.toolDefinitions[toolCall.name].params;
        const providedParams = Object.keys(toolCall.args);
        
        if (!expectedParams.every(p => providedParams.includes(p))) {
          logger.error({ tool: toolCall.name, expected: expectedParams, provided: providedParams });
          continue;
        }
        
        // Call MCP tool
        const result = await mcpClient.callTool(toolCall.name, toolCall.args);
        
        toolResults.push({
          toolName: toolCall.name,
          args: toolCall.args,
          result,
          status: "success"
        });
        
      } catch (err) {
        logger.error({ tool: toolCall.name, err });
        
        toolResults.push({
          toolName: toolCall.name,
          args: toolCall.args,
          error: err.message,
          status: "failed"
        });
      }
    }
    
    return {
      text: llmResponse.text,
      tools: toolResults
    };
  }
}

module.exports = ToolOrchestrator;
```

---

## RAG Pipeline Integration

### Python RAG Service Overview

**Location**: `floatchat/vectordb/` + `floatchat/ingestion/`

**What It Does**:
```
1. User Question
   ↓
2. Convert to Embedding (SentenceTransformers)
   ↓
3. Semantic Search (ChromaDB)
   ↓
4. Retrieve Top-K Similar Profiles
   ↓
5. Extract Metadata (Float IDs, Locations, Dates)
   ↓
6. Format as Context
   ↓
7. Return to Backend
```

### Backend Integration

**File to Create**: `services/ragService.js`

```javascript
const axios = require("axios");

class RAGService {
  constructor() {
    this.ragUrl = process.env.RAG_SERVICE_URL || "http://localhost:5001";
  }
  
  async search(query, filters = {}) {
    try {
      const response = await axios.post(`${this.ragUrl}/search`, {
        query,
        topK: 5,
        filters  // { timeRange, region, floatIds }
      });
      
      return {
        context: response.data.context,
        documents: response.data.documents,
        scores: response.data.scores,
        metadata: response.data.metadata
      };
    } catch (err) {
      logger.error({ err }, "RAG search failed");
      throw err;
    }
  }
  
  async generate(query, context) {
    // Send to LLM for intelligent routing
    try {
      const response = await axios.post(`${this.ragUrl}/generate`, {
        query,
        context,
        model: process.env.LLM_MODEL || "gpt-4"
      });
      
      return {
        text: response.data.text,
        toolCalls: response.data.toolCalls,
        reasoning: response.data.reasoning
      };
    } catch (err) {
      logger.error({ err }, "LLM generation failed");
      throw err;
    }
  }
}

module.exports = new RAGService();
```

---

## Vector Database & Semantic Search

### ChromaDB Setup

**File**: `floatchat/vectordb/build_vector_db.py`

```python
import chromadb
from sentence_transformers import SentenceTransformer
import psycopg2
import pandas as pd

# Initialize ChromaDB
client = chromadb.PersistentClient(path="./chroma_vector_db")
collection = client.get_or_create_collection(
    name="argo_profiles",
    metadata={"hnsw:space": "cosine"}
)

# Initialize embedding model
embedder = SentenceTransformer("all-MiniLM-L6-v2")

# Load data from PostgreSQL
conn = psycopg2.connect(os.getenv("DATABASE_URL"))
profiles = pd.read_sql(
    "SELECT profile_id, summary_text, metadata FROM profiles LIMIT 10000",
    conn
)

# Generate embeddings and store
for idx, row in profiles.iterrows():
    embedding = embedder.encode(row["summary_text"])
    collection.upsert(
        ids=[str(row["profile_id"])],
        embeddings=[embedding],
        documents=[row["summary_text"]],
        metadatas=[row["metadata"]]
    )

print("✓ Vector DB built successfully")
```

---

## Missing Features & Implementation Roadmap

### Phase 1: Core Production Features (Week 1-2)

**Priority: CRITICAL**

- [ ] **Input Validation**
  - Add Joi schema validation for all endpoints
  - Validate question length, format
  - Validate API parameters

- [ ] **Error Handling**
  - Global error middleware
  - Specific error classes
  - Error logging with request IDs

- [ ] **Security Enhancements**
  - Add helmet.js for HTTP headers
  - Implement CORS properly
  - Add rate limiting
  - Password requirements (min 8 chars, special chars)
  - SQL injection prevention

- [ ] **Token Management**
  - Implement refresh tokens
  - Token rotation
  - Device tracking
  - Logout all devices

- [ ] **Logging & Monitoring**
  - Winston.js structured logging
  - Request correlation IDs
  - Error tracking (Sentry)
  - Performance metrics

### Phase 2: Complete Workflow (Week 2-3)

**Priority: HIGH**

- [ ] **RAG Integration**
  - Connect to Python RAG service
  - Semantic search on user queries
  - Context retrieval
  - Score calculation

- [ ] **LLM Integration**
  - Connect to OpenAI/Claude/Gemini API
  - Prompt engineering for tool selection
  - Response formatting
  - Token counting

- [ ] **Multi-Tool Orchestration**
  - Intelligent tool selection
  - Multi-step tool workflows
  - Tool result aggregation
  - Fallback strategies

- [ ] **Chat History Enhancement**
  - Conversation-based storage
  - Message threading
  - Context preservation
  - Search/filter conversations

### Phase 3: Alerts & Subscriptions (Week 3-4)

**Priority: MEDIUM**

- [ ] **Alert System**
  - Alert rule creation/management
  - Float-based alerts
  - Region-based alerts
  - Custom query alerts
  - Evaluation engine (cron job or Bull queue)

- [ ] **Subscription System**
  - Float subscriptions
  - Region subscriptions
  - Query subscriptions
  - Subscription management UI

- [ ] **Notification System**
  - Email notifications (SendGrid/SMTP)
  - SMS notifications (Twilio)
  - Push notifications (Firebase)
  - Webhook callbacks

### Phase 4: Enterprise Features (Week 4+)

**Priority: MEDIUM-LOW**

- [ ] **Database Optimization**
  - Indexing strategy
  - Query optimization
  - Connection pooling
  - Caching layer (Redis)

- [ ] **Testing**
  - Unit tests (Jest)
  - Integration tests
  - E2E tests
  - Load testing

- [ ] **Deployment**
  - Docker containerization
  - Docker Compose for local dev
  - CI/CD pipeline (GitHub Actions)
  - Environment management

- [ ] **Documentation**
  - API documentation (Swagger)
  - Code documentation
  - Setup guide
  - Deployment guide

---

## Database Schemas

### User Schema

```javascript
const userSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  passwordHash: { type: String, required: true },
  
  // Profile
  preferences: {
    defaultVisualization: { type: String, default: "table" },
    emailNotifications: { type: Boolean, default: true },
    timezone: { type: String, default: "UTC" }
  },
  
  // Refresh tokens for device tracking
  refreshTokens: [{
    tokenHash: String,
    device: String,           // User-Agent
    expiresAt: Date
  }],
  
  // Social
  interests: [String],        // Ocean science interests
  
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});
```

### ChatHistory Schema (Enhanced)

```javascript
const chatHistorySchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  
  conversationId: { type: String, index: true },
  
  question: { type: String, required: true },
  
  response: {
    content: String,
    visualizationType: String,
    hasVisualization: Boolean,
    data: Schema.Types.Mixed
  },
  
  ragContext: {
    query: String,
    retrievedDocs: [String],
    scores: [Number],
    timestamp: Date
  },
  
  toolsCalled: [{
    name: String,
    arguments: Schema.Types.Mixed,
    result: Schema.Types.Mixed,
    duration: Number,
    success: Boolean,
    error: String
  }],
  
  meta: {
    duration: Number,
    updatedAt: Date
  },
  
  status: { type: String, enum: ["pending", "completed", "error"] },
  
  createdAt: { type: Date, default: Date.now }
}, { timestamps: true });

chatHistorySchema.index({ user: 1, createdAt: -1 });
```

### AlertRule Schema

```javascript
const alertRuleSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  
  name: String,
  type: { type: String, enum: ["float", "region", "custom"] },
  
  floatAlert: {
    floatId: String,
    metrics: [String],
    threshold: Schema.Types.Mixed
  },
  
  regionAlert: {
    polygon: { type: "Polygon", coordinates: [[[Number, Number]]] },
    floatCountThreshold: Number
  },
  
  customAlert: {
    query: String,
    resultThreshold: Number
  },
  
  notify: {
    email: Boolean,
    sms: Boolean,
    push: Boolean,
    webhook: { enabled: Boolean, url: String }
  },
  
  frequency: { type: String, enum: ["real-time", "hourly", "daily", "weekly"] },
  throttleMinutes: Number,
  enabled: { type: Boolean, default: true },
  lastTriggeredAt: Date,
  
  createdAt: Date,
  updatedAt: Date
});
```

---

## API Endpoints Reference

### Authentication

```
POST /api/auth/signup
Body: { name, email, password }
Response: { token, user, refreshToken }

POST /api/auth/login
Body: { email, password }
Response: { token, user, refreshToken }

POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken }

GET /api/auth/me
Headers: Authorization: Bearer {token}
Response: { user }

POST /api/auth/logout
Body: { allDevices?: boolean }
Response: { success }
```

### Chat

```
POST /api/chat/process
Body: { question, conversationId? }
Headers: Authorization: Bearer {token}
Response: {
  content: string,
  visualizationType: "table|map|profile|timeseries",
  hasVisualization: boolean,
  data: object,
  toolsCalled: [...],
  ragContext: {...}
}

GET /api/chat/history
Headers: Authorization: Bearer {token}
Response: { history: [...] }

GET /api/chat/conversations
Headers: Authorization: Bearer {token}
Response: { conversations: [...] }

GET /api/chat/{conversationId}/messages
Headers: Authorization: Bearer {token}
Response: { messages: [...] }
```

### Alerts

```
POST /api/alerts
Body: { type, name, floatAlert|regionAlert|customAlert, notify, frequency }
Response: { alert }

GET /api/alerts
Response: { alerts: [...] }

PUT /api/alerts/{id}
Body: { ...updates }
Response: { alert }

DELETE /api/alerts/{id}
Response: { success }

POST /api/alerts/{id}/trigger
Response: { triggered, context }
```

### Subscriptions

```
POST /api/subscriptions
Body: { type, floatId|polygon|query, alertFrequency }
Response: { subscription }

GET /api/subscriptions
Response: { subscriptions: [...] }

DELETE /api/subscriptions/{id}
Response: { success }
```

---

## Error Handling & Validation

### Standardized Error Response

```javascript
{
  "success": false,
  "error": "Descriptive error message",
  "code": "ERROR_CODE",
  "details": {...},
  "requestId": "uuid"
}
```

### Validation Examples

```javascript
// Question validation
Joi.object({
  question: Joi.string()
    .min(3)
    .max(1000)
    .required()
    .messages({
      "string.empty": "Question cannot be empty",
      "string.min": "Question must be at least 3 characters",
      "string.max": "Question must be at most 1000 characters"
    })
})

// Alert creation validation
Joi.object({
  type: Joi.string().valid("float", "region", "custom").required(),
  name: Joi.string().required(),
  floatAlert: Joi.when("type", {
    is: "float",
    then: Joi.object({
      floatId: Joi.string().required(),
      metrics: Joi.array().items(Joi.string()).required(),
      threshold: Joi.object().required()
    }).required()
  }),
  notify: Joi.object({
    email: Joi.boolean(),
    sms: Joi.boolean(),
    push: Joi.boolean(),
    webhook: Joi.object({ enabled: Joi.boolean(), url: Joi.string().uri() })
  })
})
```

---

## Security Best Practices

### 1. Password Security

```javascript
// Use bcrypt with salt rounds: 10-12
const saltRounds = 10;
const hashedPassword = await bcrypt.hash(password, saltRounds);

// Never return password in responses
user.toObject();
delete user.passwordHash;
return user;
```

### 2. JWT Security

```javascript
// Short-lived access tokens (15 minutes)
const accessToken = jwt.sign(payload, secret, { expiresIn: "15m" });

// Long-lived refresh tokens (7 days)
const refreshToken = jwt.sign(payload, refreshSecret, { expiresIn: "7d" });

// Store refresh token hash, not plain token
const tokenHash = await bcrypt.hash(refreshToken, 10);
```

### 3. Input Validation

```javascript
// Always validate and sanitize input
const sanitized = DOMPurify.sanitize(userInput);

// Prevent SQL injection
// Use parameterized queries:
db.query("SELECT * FROM users WHERE email = $1", [email]);

// NOT:
db.query(`SELECT * FROM users WHERE email = '${email}'`);
```

### 4. CORS & HTTPS

```javascript
const cors = require("cors");

app.use(cors({
  origin: process.env.CORS_ORIGIN,  // Specific domains, not "*"
  credentials: true,                 // Allow cookies
  methods: ["GET", "POST", "PUT", "DELETE"]
}));

// Enforce HTTPS in production
if (process.env.NODE_ENV === "production") {
  app.use((req, res, next) => {
    if (req.header("x-forwarded-proto") !== "https") {
      res.redirect(`https://${req.header("host")}${req.url}`);
    } else {
      next();
    }
  });
}
```

### 5. Rate Limiting

```javascript
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 100,                   // max 100 requests per window
  message: "Too many requests",
  keyGenerator: (req) => req.user?.id || req.ip
});

app.use("/api/", limiter);
```

---

## Quick Implementation Checklist

### Immediate Actions (Today)

- [ ] Add input validation middleware
- [ ] Add error handling middleware  
- [ ] Add request correlation IDs
- [ ] Add structured logging
- [ ] Add rate limiting

### This Week

- [ ] Implement refresh token system
- [ ] Connect to RAG service
- [ ] Connect to LLM API
- [ ] Implement tool orchestration
- [ ] Add test cases

### Next Week

- [ ] Implement alert system
- [ ] Implement subscription system
- [ ] Implement notification system
- [ ] Add database indexes
- [ ] Performance testing

---

## Deployment Checklist

```
Pre-Production:
- [ ] All environment variables set in .env
- [ ] Database credentials secure (use secrets manager)
- [ ] JWT secrets strong (32+ chars)
- [ ] CORS origin configured
- [ ] Logging configured (no console.log in production)
- [ ] Error tracking (Sentry) configured
- [ ] Rate limiting tested
- [ ] All dependencies updated and audited

Docker Deployment:
- [ ] Dockerfile created
- [ ] Docker-compose for local dev
- [ ] Health check endpoint /health
- [ ] Graceful shutdown handling
- [ ] Memory/CPU limits configured

Monitoring:
- [ ] Error tracking (Sentry/Rollbar)
- [ ] Performance monitoring (New Relic/DataDog)
- [ ] Uptime monitoring
- [ ] Log aggregation (ELK/Datadog)
```

---

## References & External Systems

### MCP Server Structure

```
floatchat-mcp/server/
├── server.js              # Server entry, tool registration
├── dbClient.js            # PostgreSQL connection pool
├── manifest.json          # Tool metadata
└── tools/                 # 22 individual tools
    ├── sqlQueryTool.js
    ├── nearestFloatTool.js
    ├── profileSummary.js
    ├── temperatureDepthChart.js
    ├── anomalyDetectionTool.js
    ├── polygonQueryTool.js
    ├── vectorSearchTool.js
    └── ... (16 more tools)
```

### Ingestion System Structure

```
ingestion/
├── ingest.py              # Main orchestrator
├── db_utils.py            # PostgreSQL utilities
├── processed/             # Output: 42+ .nc files
├── source_files/          # Input: raw NetCDF
└── parquet/               # Intermediate exports
```

### Vector Database Structure

```
vectordb/
├── build_vector_db.py     # ChromaDB creation
├── rag_search.py          # Semantic search logic
├── chroma_vector_db/      # ChromaDB data
├── test_query.py          # Testing RAG responses
└── test_metadata.py       # Metadata validation
```

---

## Conclusion

Your Express backend is a solid foundation. To make it production-ready and complete the FloatChat workflow, focus on:

1. **Immediate** (This week):
   - Input validation & error handling
   - Security enhancements
   - Logging & monitoring

2. **Short-term** (Next 2 weeks):
   - RAG integration
   - LLM integration
   - Multi-tool orchestration

3. **Medium-term** (Next month):
   - Alert system
   - Subscription system
   - Notification delivery

The documentation above provides exact code examples you can copy-paste. Start with Phase 1, validate with your team, then move to Phase 2.

---

**Document Created**: December 3, 2025  
**Status**: Ready for implementation  
**Next Step**: Start with Phase 1 (Input Validation & Error Handling)  
**Questions?**: Reference the code examples provided in each section
