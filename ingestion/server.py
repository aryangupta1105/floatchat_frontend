#!/usr/bin/env python3
"""
Canonical Ingestion API Server (Flask)

Endpoints:
- GET  /health          Health check
- POST /ingest/run      Manual ingestion trigger
- GET  /ingest/status   Status and last run info
- GET  /ingest/list     List .nc files in source directory

Features:
- Background scheduler: auto-ingest every 6 hours (configurable)
- Thread-safe state tracking
- Environment-variable-based configuration (no hardcoded credentials)
"""

from flask import Flask, request, jsonify
import os
import traceback
import time
import threading
from datetime import datetime
import logging

# Load .env if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Import ingestion core
import ingest as ing

# ============================================
# Flask app setup
# ============================================
app = Flask(__name__)
app.logger.setLevel(logging.INFO)

# ============================================
# Configuration (all from env vars)
# ============================================
SOURCE_DIR = os.getenv("SOURCE_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "source_files"))
PROCESSED_DIR = os.getenv("PROCESSED_DIR", os.path.join(SOURCE_DIR, "processed"))

# ============================================
# Global state (thread-safe)
# ============================================
_state_lock = threading.Lock()

LAST_INGEST_SUMMARY = None
LAST_INGEST_TIME = None
LAST_INGEST_START = None
LAST_INGEST_END = None
LAST_INGEST_ERROR = None
INGEST_IS_RUNNING = False

# Scheduler config
SCHEDULER_THREAD = None
SCHEDULER_ENABLED = os.getenv("INGEST_SCHEDULER_ENABLED", "true").lower() in ("true", "1", "yes")
SCHEDULER_INTERVAL_SECONDS = int(os.getenv("INGEST_SCHEDULER_INTERVAL_SECONDS", 21600))  # 6 hours


# ============================================
# Helper: List .nc files
# ============================================
def _list_nc_files_in_source():
    """List .nc files in the configured SOURCE_DIR."""
    if not os.path.isdir(SOURCE_DIR):
        return []
    files = [
        os.path.join(SOURCE_DIR, f)
        for f in os.listdir(SOURCE_DIR)
        if f.lower().endswith(".nc")
    ]
    return sorted(files)


# ============================================
# Helper: Run ingestion internally
# ============================================
def run_ingestion_internal(
    nc_path=None,
    dir_path=None,
    process_all=True,
    no_db=False,
    force=False,
    reprocess=False,
    dsn=None
):
    """
    Internal function to run ingestion with provided params.
    Updates global state variables.
    Returns: (success: bool, summary: dict, error: str or None)
    """
    global LAST_INGEST_SUMMARY, LAST_INGEST_TIME, LAST_INGEST_START
    global LAST_INGEST_END, LAST_INGEST_ERROR, INGEST_IS_RUNNING

    with _state_lock:
        INGEST_IS_RUNNING = True
        LAST_INGEST_START = datetime.utcnow().isoformat() + "Z"
        LAST_INGEST_END = None
        LAST_INGEST_ERROR = None

    try:
        # Determine file list
        if nc_path:
            files = ing.list_nc_files(nc_path, process_all=False)
        elif dir_path:
            files = ing.list_nc_files(dir_path, process_all=process_all)
        else:
            files = ing.list_nc_files(None, process_all=process_all)

        if not files:
            with _state_lock:
                INGEST_IS_RUNNING = False
                LAST_INGEST_END = datetime.utcnow().isoformat() + "Z"
            return False, {}, "No .nc files found"

        # Build args object (mimics argparse namespace)
        class Args:
            pass

        args = Args()
        args.verify = False
        args.create_tables = True
        args.dry_run = False
        args.no_db = no_db
        args.force = force
        args.reprocess = reprocess
        args.diff_out = None

        # Pick DSN: explicit > env-based DEFAULT_DSN
        if not no_db and not dsn:
            dsn = ing.DEFAULT_DSN

        # Run ingestion
        start = time.time()
        summary = ing.process_files(files, dsn if not no_db else None, args)
        elapsed = time.time() - start

        # Update state
        with _state_lock:
            LAST_INGEST_SUMMARY = summary
            LAST_INGEST_TIME = elapsed
            LAST_INGEST_END = datetime.utcnow().isoformat() + "Z"
            INGEST_IS_RUNNING = False

        app.logger.info(f"Ingestion completed in {elapsed:.2f}s: {summary}")
        return True, summary, None

    except Exception as e:
        app.logger.error(f"Ingestion error: {e}\n{traceback.format_exc()}")
        with _state_lock:
            LAST_INGEST_ERROR = str(e)
            LAST_INGEST_END = datetime.utcnow().isoformat() + "Z"
            INGEST_IS_RUNNING = False
        return False, {}, str(e)


# ============================================
# Background Scheduler
# ============================================
def scheduler_worker():
    """Background thread that runs ingestion every SCHEDULER_INTERVAL_SECONDS."""
    app.logger.info(f"Ingestion scheduler started (interval: {SCHEDULER_INTERVAL_SECONDS}s)")

    while SCHEDULER_ENABLED:
        try:
            app.logger.info("Running scheduled ingestion...")
            run_ingestion_internal(
                nc_path=None,
                dir_path=None,
                process_all=True,
                no_db=False,
                force=False,
                reprocess=False,
                dsn=None  # will use DEFAULT_DSN from env
            )
            app.logger.info("Scheduled ingestion completed")
        except Exception as e:
            app.logger.error(f"Scheduler error: {e}\n{traceback.format_exc()}")

        # Sleep for interval (check every 60s if scheduler is still enabled)
        remaining = SCHEDULER_INTERVAL_SECONDS
        while remaining > 0 and SCHEDULER_ENABLED:
            sleep_time = min(60, remaining)
            time.sleep(sleep_time)
            remaining -= sleep_time


def start_scheduler():
    """Start background scheduler thread."""
    global SCHEDULER_THREAD

    if not SCHEDULER_ENABLED:
        app.logger.info("Ingestion scheduler disabled via INGEST_SCHEDULER_ENABLED=false")
        return

    if SCHEDULER_THREAD is not None and SCHEDULER_THREAD.is_alive():
        app.logger.warning("Scheduler thread already running")
        return

    SCHEDULER_THREAD = threading.Thread(target=scheduler_worker, daemon=True)
    SCHEDULER_THREAD.start()
    app.logger.info("Scheduler thread started")


# ============================================
# Flask Routes
# ============================================

@app.get("/health")
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "Ingestion Pipeline",
        "scheduler_enabled": SCHEDULER_ENABLED,
        "scheduler_interval_seconds": SCHEDULER_INTERVAL_SECONDS
    }), 200


@app.post("/ingest/run")
def ingest_run():
    """
    Manually trigger ingestion.

    Request body (all optional):
    {
        "nc": "path/to/file.nc",
        "dir": "path/to/dir",
        "dsn": "postgresql://...",
        "process_all": true,
        "no_db": false,
        "force": false,
        "reprocess": false
    }
    """
    if INGEST_IS_RUNNING:
        return jsonify({
            "status": "error",
            "error": "Ingestion already in progress"
        }), 409

    try:
        data = request.get_json() or {}

        nc_path = data.get("nc")
        dir_path = data.get("dir")
        process_all = data.get("process_all", True)
        dsn = data.get("dsn")
        no_db = data.get("no_db", False)
        force = data.get("force", False)
        reprocess = data.get("reprocess", False)

        success, summary, error = run_ingestion_internal(
            nc_path=nc_path,
            dir_path=dir_path,
            process_all=process_all,
            no_db=no_db,
            force=force,
            reprocess=reprocess,
            dsn=dsn
        )

        if success:
            return jsonify({
                "status": "success",
                "took_seconds": LAST_INGEST_TIME,
                "summary": summary
            }), 200
        else:
            return jsonify({
                "status": "error",
                "error": error
            }), 500

    except Exception as e:
        app.logger.error(f"Ingest run error: {e}\n{traceback.format_exc()}")
        return jsonify({
            "status": "error",
            "error": str(e)
        }), 500


@app.get("/ingest/status")
def ingest_status():
    """Get current ingestion status and last run info."""
    with _state_lock:
        status = "running" if INGEST_IS_RUNNING else ("error" if LAST_INGEST_ERROR else "idle")
        return jsonify({
            "status": status,
            "is_running": INGEST_IS_RUNNING,
            "last_started_at": LAST_INGEST_START,
            "last_finished_at": LAST_INGEST_END,
            "last_runtime_seconds": LAST_INGEST_TIME,
            "summary": LAST_INGEST_SUMMARY,
            "last_error": LAST_INGEST_ERROR
        }), 200


@app.get("/ingest/list")
def ingest_list():
    """List .nc files currently in SOURCE_DIR."""
    files = _list_nc_files_in_source()
    return jsonify({
        "count": len(files),
        "files": [os.path.basename(f) for f in files]
    }), 200


# ============================================
# App startup
# ============================================
if __name__ == "__main__":
    # Start background scheduler
    start_scheduler()

    # Run Flask server
    port = int(os.getenv("INGEST_PORT", 8100))
    debug = os.getenv("FLASK_DEBUG", "false").lower() in ("true", "1", "yes")

    app.logger.info(f"Starting Ingestion API on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
