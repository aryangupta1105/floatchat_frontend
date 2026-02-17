# server.py
import time
import json
from flask import Flask, request, jsonify

# Add vector DB folder to import path
import sys
import os
sys.path.append(os.path.abspath("./vectordb"))

from rag_search import rag_answer
from build_vector_db import full_build, incremental_build, get_latest_db_timestamp

# -----------------------------------------------------
# Flask App
# -----------------------------------------------------
app = Flask(__name__)

VECTOR_LAST_UPDATED = 0

# -----------------------------------------------------
# Helper: Detect if new DB rows exist
# -----------------------------------------------------
def needs_rebuild():
    global VECTOR_LAST_UPDATED
    try:
        latest_ts = get_latest_db_timestamp()
        print("Latest DB timestamp:", latest_ts)
    except Exception as e:
        print("Error reading timestamp:", e)
        return False

    if latest_ts > VECTOR_LAST_UPDATED:
        print("🔄 New data found, rebuild needed.")
        return True

    return False


# -----------------------------------------------------
# FULL BUILD ENDPOINT
# -----------------------------------------------------
@app.route("/build-full", methods=["POST"])
def build_full_api():
    global VECTOR_LAST_UPDATED

    try:
        print("⚙ Starting FULL vector DB rebuild...")
        full_build()
        VECTOR_LAST_UPDATED = time.time()
        print("✅ Full rebuild completed.")
        return jsonify({"status": "success", "message": "Full build completed."})

    except Exception as e:
        return jsonify({"status": "error", "message": str(e)}), 500


# -----------------------------------------------------
# RAG ENDPOINT
# -----------------------------------------------------
@app.route("/rag", methods=["POST"])
def rag_api():
    global VECTOR_LAST_UPDATED

    data = request.get_json()
    if not data or "query" not in data:
        return jsonify({"error": "Missing 'query' field"}), 400

    query = data["query"]
    print("\n📥 Incoming RAG query:", query)

    try:
        # Auto incremental rebuild
        if needs_rebuild():
            print("⚙ Running incremental vector DB update...")
            incremental_build()
            VECTOR_LAST_UPDATED = time.time()
            print("✅ Incremental update finished.")

        # RAG pipeline
        sql = rag_answer(query)
        return jsonify({"status": "success", "sql": sql})

    except Exception as e:
        print("❌ ERROR:", e)
        return jsonify({"status": "error", "message": str(e)}), 500


# -----------------------------------------------------
# HEALTH CHECK
# -----------------------------------------------------
@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "service": "FloatChat Flask RAG API"})


# -----------------------------------------------------
# RUN SERVER (NO UVICORN)
# -----------------------------------------------------
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)
