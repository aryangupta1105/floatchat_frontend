# Quick Start Guide - FloatChat Backend

## Start the Server

```bash
cd floatchat/backend_5.0
npm run dev
```

Expected output:
```
[INFO] ✅ MongoDB connected successfully
[INFO] 🚀 Server running on port 5000
[INFO] Starting alert scheduler (every 30 minutes)
```

---

## Test the API (Using curl)

### 1. Health Check
```bash
curl http://localhost:5000/health
```

### 2. Sign Up
```bash
curl -X POST http://localhost:5000/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"Test123456"}'
```

Save the `token` from response.

### 3. Query with Token
```bash
TOKEN="your_token_here"

curl -X POST http://localhost:5000/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"question":"What is average temperature at 1000m?","mode":"auto"}'
```

---

## All Available Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/health` | GET | ❌ | Health check |
| `/signup` | POST | ❌ | Create account |
| `/login` | POST | ❌ | Get token |
| `/query` | POST | ✅ | Smart query (auto-classify) |
| `/history` | GET | ✅ | Get chat history |
| `/test/status` | GET | ❌ | Test endpoint status |
| `/test/echo` | POST | ❌ | Debug JSON parsing |

---

## Integration with Other Services

### RAG Service (Port 8000)
Automatically called when question is classified as "data_query"
- Generates SQL from natural language
- Uses semantic search

### Ingestion Service (Port 8100)  
Available via `/api/ingest/*` endpoints
- Manual trigger: `POST /api/ingest/run`
- Check status: `GET /api/ingest/status`
- Automatic scheduler: Every 6 hours

---

## Environment Variables (.env)

**Critical:**
- `DATABASE_URL` - MongoDB connection
- `POSTGRES_DSN` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `LLM_API_KEY` - Groq API key

**Optional:**
- `PORT` - Server port (default: 5000)
- `RAG_SERVICE_URL` - RAG service (default: http://localhost:8000)
- `INGEST_SERVICE_URL` - Ingestion service (default: http://localhost:8100)

---

## Troubleshooting

### Server won't start
```
[ERROR] MongoDB connection timeout
```
Check: Is DATABASE_URL set? Is MongoDB Atlas accessible?

### Route not found (404)
```
Route not found: POST /query
```
Make sure token is provided and request path is correct:
- `/query` requires `Authorization: Bearer <token>` header
- No auth needed for `/health`, `/signup`, `/login`

### JSON parse error
```
Unexpected token... is not valid JSON
```
Ensure JSON is properly formatted:
```bash
# Good
curl ... -d '{"key":"value"}'

# Bad  
curl ... -d '{key:value}'
```

---

## Files Modified Today

1. **server.js** - Added MongoDB initialization
2. **app.js** - Added route mounting and JSON recovery
3. **routes/chat.routes.js** - Added auth middleware
4. **controllers/chatController.js** - Direct service imports
5. **controllers/alertsController.js** - Direct service imports
6. **services/alertService.js** - Direct service imports
7. **config/mongodb.js** - New MongoDB connection file
8. **routes/test.routes.js** - New debug endpoints

---

## Status Summary

✅ **Server:** Running  
✅ **MongoDB:** Connected  
✅ **PostgreSQL:** Connected  
✅ **Auth:** Working  
✅ **Query:** Working  
✅ **Error Handling:** Implemented  

**Everything is ready!** 🚀

