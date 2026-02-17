# ingest_api.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import threading
import subprocess
import os
import time
import datetime
import shutil
from typing import Optional, List, Dict, Any

app = FastAPI(title="NetCDF Ingest API")

# CONFIG: adjust if needed
SOURCE_DIR = os.environ.get("SOURCE_DIR", "./source_files")
PROCESSED_DIR = os.environ.get("PROCESSED_DIR", "./source_files/processed")
INGEST_SCRIPT = os.environ.get("INGEST_SCRIPT", "ingest.py")  # script file in same folder
PYTHON_BIN = os.environ.get("PYTHON_BIN", "python3")
POSTGRES_DSN = os.environ.get("DATABASE_URL_PUBLIC") or os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_DSN")  # prefer public proxy for local dev

# internal status
_status_lock = threading.Lock()
_status: Dict[str, Any] = {
    "state": "idle",            # idle, running, finished, error
    "started_at": None,
    "finished_at": None,
    "current_file": None,
    "processed_count": 0,
    "total_files": 0,
    "errors": [],               # list of {"file":..., "error":...}
    "last_log": "",             # last few lines of stdout/stderr
    "pid": None,
    "raw_output": ""            # keep limited output for debugging
}

# Keep background thread reference to avoid double-start
_ingest_thread: Optional[threading.Thread] = None


class StartIngestRequest(BaseModel):
    reprocess: bool = False   # pass --reprocess to script
    force: bool = False       # pass --force
    dsn: Optional[str] = None  # override DSN for this run (optional)
    verify: bool = False      # pass --verify
    process_all: bool = False # pass --process-all to ingest.py


def _safe_update(updates: Dict[str, Any]):
    with _status_lock:
        _status.update(updates)


def _append_error(err: Dict[str, Any]):
    with _status_lock:
        _status["errors"].append(err)


def _set_last_log(s: str, max_chars: int = 4000):
    with _status_lock:
        combined = (_status.get("raw_output", "") + "\n" + s)[-max_chars:]
        _status["raw_output"] = combined
        _status["last_log"] = combined.splitlines()[-30:]


def _list_nc_files_in_source() -> List[str]:
    if not os.path.isdir(SOURCE_DIR):
        return []
    files = []
    for f in os.listdir(SOURCE_DIR):
        if f.lower().endswith(".nc"):
            files.append(os.path.join(SOURCE_DIR, f))
    return sorted(files)


def _run_ingest_subprocess(args: List[str], status_updates_cb=None):
    """
    Run the ingest.py script as subprocess and capture output line-by-line.
    `args` should be list like: [python, ingest.py, --dir, SOURCE_DIR, ...]
    """
    proc = subprocess.Popen(
        args,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
        universal_newlines=True
    )
    _safe_update({"pid": proc.pid})
    # read output
    try:
        if proc.stdout is None:
            _set_last_log("No stdout from subprocess.")
            proc.wait()
            return_code = proc.returncode
        else:
            for line in proc.stdout:
                # strip trailing whitespace
                ln = line.rstrip("\n")
                _set_last_log(ln)
                # optional callback to parse progress out of lines
                if status_updates_cb:
                    try:
                        status_updates_cb(ln)
                    except Exception:
                        pass
            proc.wait()
            return_code = proc.returncode
    except Exception as e:
        proc.kill()
        _append_error({"file": None, "error": f"Subprocess read error: {e}"})
        return_code = 1
    return return_code


def _background_ingest_worker(req: StartIngestRequest):
    _safe_update({
        "state": "running",
        "started_at": datetime.datetime.utcnow().isoformat() + "Z",
        "finished_at": None,
        "processed_count": 0,
        "errors": [],
        "raw_output": "",
        "last_log": ""
    })

    try:
        # Ensure processed directory exists
        os.makedirs(PROCESSED_DIR, exist_ok=True)

        # Only pick files currently present in SOURCE_DIR at the start
        initial_files = _list_nc_files_in_source()
        _safe_update({"total_files": len(initial_files)})

        if len(initial_files) == 0:
            _set_last_log("No .nc files found in source directory.")
            _safe_update({"state": "finished", "finished_at": datetime.datetime.utcnow().isoformat() + "Z"})
            return

        # Build base command for ingest.py to process only files from SOURCE_DIR (it supports --dir)
        cmd = [PYTHON_BIN, INGEST_SCRIPT, "--dir", SOURCE_DIR]
        if req.process_all:
            cmd += ["--process-all"]
        if req.reprocess:
            cmd += ["--reprocess"]
        if req.force:
            cmd += ["--force"]
        if req.verify:
            cmd += ["--verify"]
        if req.dsn or POSTGRES_DSN:
            use_dsn = req.dsn or POSTGRES_DSN
            cmd += ["--dsn", use_dsn]

        # We'll parse ingest.py stdout to track which file is being processed and counts.
        def status_cb(line: str):
            # heuristics based on your ingest.py logs
            # e.g. lines like: "--- Processing /path/to/file.nc -> profile_key=XXX ---"
            if "Processing" in line and "-> profile_key" in line:
                # try to extract filename between "Processing " and " ->"
                try:
                    part = line.split("Processing", 1)[1].split("->", 1)[0].strip()
                    fname = os.path.basename(part)
                    _safe_update({"current_file": fname})
                except Exception:
                    pass
            # detect moves to processed/ (the script prints "Moving file to processed/." in your code)
            if "Moving file to processed/" in line or "Moving file to processed" in line:
                # increment processed count
                with _status_lock:
                    _status["processed_count"] = _status.get("processed_count", 0) + 1

            # detect skip (already processed)
            if "Skipping DB ingest for" in line:
                with _status_lock:
                    _status["processed_count"] = _status.get("processed_count", 0) + 1

            # detect errors in line
            if "Error:" in line or "Exception" in line or "Traceback" in line:
                # append short error line
                _append_error({"file": _status.get("current_file"), "error": line[:500]})

        rc = _run_ingest_subprocess(cmd, status_updates_cb=status_cb)

        if rc == 0:
            _safe_update({"state": "finished", "finished_at": datetime.datetime.utcnow().isoformat() + "Z"})
        else:
            _safe_update({"state": "error", "finished_at": datetime.datetime.utcnow().isoformat() + "Z"})
            _append_error({"file": None, "error": f"ingest.py exited with code {rc}"})
    except Exception as e:
        _append_error({"file": None, "error": f"Background exception: {e}"})
        _safe_update({"state": "error", "finished_at": datetime.datetime.utcnow().isoformat() + "Z"})
    finally:
        # clear pid
        _safe_update({"pid": None})
        # ensure current_file is cleared if finished
        _safe_update({"current_file": None})


@app.post("/ingest/start")
def start_ingest(req: StartIngestRequest):
    global _ingest_thread
    with _status_lock:
        if _status["state"] == "running" or (_ingest_thread is not None and _ingest_thread.is_alive()):
            raise HTTPException(status_code=409, detail="Ingestion already running")

    # snapshot of files; ensures only these files are intended to be processed
    initial_files = _list_nc_files_in_source()
    _safe_update({"total_files": len(initial_files)})

    # start background thread
    _ingest_thread = threading.Thread(target=_background_ingest_worker, args=(req,), daemon=True)
    _ingest_thread.start()
    return {"status": "started", "total_files": len(initial_files)}


@app.get("/ingest/status")
def get_status():
    with _status_lock:
        # return a copy to avoid mutation while serializing
        s = dict(_status)
        # convert last_log list to one string for easier Postman display
        if isinstance(s.get("last_log"), list):
            s["last_log"] = "\n".join(s["last_log"][-30:])
        return s


@app.get("/ingest/list")
def list_files():
    """List .nc files currently in SOURCE_DIR (useful to confirm which files will be ingested)."""
    files = _list_nc_files_in_source()
    return {"count": len(files), "files": [os.path.basename(f) for f in files]}


@app.post("/ingest/stop")
def stop_ingest():
    """
    Stops ingestion by attempting to kill the subprocess (best-effort).
    Note: this forcefully terminates the underlying ingest.py process but does not rollback DB entries.
    """
    pid = _status.get("pid")
    if pid is None:
        raise HTTPException(status_code=400, detail="No running ingestion process found")
    try:
        # kill the process
        os.kill(pid, 9)
        _safe_update({"state": "error", "finished_at": datetime.datetime.utcnow().isoformat() + "Z", "pid": None})
        return {"stopped": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop process: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("ingest_api:app", host="0.0.0.0", port=int(os.environ.get("PORT", 8000)), log_level="info")
