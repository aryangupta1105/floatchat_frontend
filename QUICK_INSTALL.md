# Quick Installation Commands

Run these commands to install all dependencies for FloatChat:

## 1. Express Backend (Windows PowerShell)

```powershell
# Navigate to backend
cd "C:\Users\aarya\sih\floatchat\floatchat_backend"

# Install Node.js dependencies
npm install

# This installs:
# - Production: axios, express, mongoose, jwt, bcrypt, helmet, joi, winston, rate-limit, etc.
# - Dev: nodemon, eslint, prettier, jest, supertest
```

**Expected time**: 2-3 minutes  
**Result**: ~400 MB in node_modules/

---

## 2. Python VectorDB/RAG Service

```powershell
# Navigate to vectordb
cd "C:\Users\aarya\sih\floatchat\vectordb"

# Activate virtual environment (if exists)
venv\Scripts\activate

# If no venv, create it
python -m venv venv
venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt

# This installs:
# - Core: numpy, pandas, xarray, pyarrow
# - Vector DB: chromadb, sentence-transformers
# - Web: fastapi, uvicorn, pydantic
# - LLM: google-generativeai, openai
# - Database: psycopg2-binary
```

**Expected time**: 5-10 minutes (first time may be slower)  
**Result**: ~3-4 GB in venv/

---

## 3. Python Ingestion Service

```powershell
# Navigate to ingestion
cd "C:\Users\aarya\sih\floatchat\ingestion"

# Activate virtual environment (if exists)
venv\Scripts\activate

# If no venv, create it
python -m venv venv
venv\Scripts\activate

# Install Python packages
pip install -r requirements.txt

# This installs:
# - Core: numpy, pandas, xarray, netCDF4
# - Web: fastapi, uvicorn, pydantic
# - Database: psycopg2-binary, sqlalchemy
# - Queue: celery, redis
# - Testing: pytest
```

**Expected time**: 3-5 minutes  
**Result**: ~2-3 GB in venv/ (shares many packages with vectordb)

---

## After Installation

### Test Express Backend
```powershell
cd "C:\Users\aarya\sih\floatchat\floatchat_backend"
npm run dev
# Should see: "Server running on port 5000"
```

### Test Python VectorDB
```powershell
cd "C:\Users\aarya\sih\floatchat\vectordb"
venv\Scripts\activate
uvicorn rag_api:app --reload
# Should see: "Uvicorn running on http://127.0.0.1:8000"
```

### Test Python Ingestion
```powershell
cd "C:\Users\aarya\sih\floatchat\ingestion"
venv\Scripts\activate
python ingest.py --help
# Should see available commands
```

---

## If Installation Fails

### npm install fails
```powershell
# Clear cache
npm cache clean --force

# Reinstall
npm install

# Or try with legacy peer deps
npm install --legacy-peer-deps
```

### Python NumPy error (Windows)
```powershell
# Use pre-built wheels instead
pip install --only-binary :all: numpy pandas

# Or install all from file
pip install -r requirements.txt --only-binary :all:
```

### Uvicorn not found
```powershell
# Make sure venv is activated
venv\Scripts\activate

# Reinstall uvicorn
pip install --force-reinstall uvicorn[standard]
```

---

## Configuration After Installation

### 1. Create .env file
```powershell
cd floatchat_backend
cp .env.example .env
# Edit .env with your configuration
```

### 2. Update Requirements
```powershell
# For production, lock versions
pip freeze > requirements.txt
npm list > package-versions.txt
```

---

## Verify Installation

```powershell
# Check Node.js
node --version          # Should be v16+
npm --version           # Should be v8+
npm list --depth=0      # See installed packages

# Check Python
python --version        # Should be 3.9+
pip list | Select-Object -First 20  # See installed packages
```

---

## Total Installation Summary

| Component | Time | Size | Command |
|-----------|------|------|---------|
| Express Backend | 2-3 min | 400 MB | `npm install` |
| Python VectorDB | 5-10 min | 3-4 GB | `pip install -r requirements.txt` |
| Python Ingestion | 3-5 min | 2-3 GB | `pip install -r requirements.txt` |
| **TOTAL** | **10-18 min** | **5-7 GB** | **All 3 above** |

**Total Time**: ~15-20 minutes for first complete installation

---

## All Set! 🎉

Once installed, you can:

1. Start the Express backend: `npm run dev`
2. Start the RAG service: `uvicorn rag_api:app --reload`
3. Start MCP server (if needed): `npm run dev`
4. Access API: http://localhost:5000
5. Access RAG: http://localhost:8000/docs

---

**Generated**: December 3, 2025  
**Status**: Ready to run! ✅
