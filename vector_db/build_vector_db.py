"""
Create ONE combined vector DB:
- Each document = one profile_key
- Each document includes both core & BGC statistics
"""

import pandas as pd
import psycopg2
from sentence_transformers import SentenceTransformer
from chromadb import PersistentClient
from collections import defaultdict
import numpy as np
import time

import os
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Prefer DATABASE_URL_PUBLIC (public proxy for local dev) over DATABASE_URL (Railway internal)
DATABASE_URL = os.environ.get("DATABASE_URL_PUBLIC") or os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_DSN") or ""
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not set. Add it to .env or export it.")

VECTOR_DB_PATH = "./floatchat/vectordb/chroma_vector_db"

# -------------------------------------------------------
# Helper: last updated timestamp in file_metadata table
# -------------------------------------------------------
def get_latest_db_timestamp():
    conn = psycopg2.connect(DATABASE_URL)
    cur = conn.cursor()

    cur.execute("SELECT MAX(updated_at) FROM file_metadata;")
    ts = cur.fetchone()[0]

    conn.close()

    return ts.timestamp() if ts else 0


# -------------------------------------------------------
# FULL VECTOR DB BUILD
# -------------------------------------------------------
def full_build():
    print("🔵 FULL BUILD STARTED — Connecting to DB...")
    conn = psycopg2.connect(DATABASE_URL)

    sql_core = """
    SELECT 
        cl.profile_key,
        cl.level_index,
        cl.pressure,
        cl.temperature,
        cl.temperature_adjusted,
        cl.salinity,
        cl.salinity_adjusted,
        pm.raw_attrs->>'PLATFORM_NUMBER' AS platform_number,
        pm.raw_attrs->>'CYCLE_NUMBER' AS cycle,
        pm.raw_attrs->>'LATITUDE' AS latitude,
        pm.raw_attrs->>'LONGITUDE' AS longitude,
        pm.raw_attrs->>'JULD' AS juld
    FROM core_levels cl
    LEFT JOIN file_metadata pm
        ON cl.profile_key = pm.profile_key
    ORDER BY cl.profile_key, cl.level_index;
    """

    core_df = pd.read_sql(sql_core, conn)

    sql_bgc = """
    SELECT 
        bgc.profile_key,
        bgc.level_index,
        bgc.doxy,
        bgc.chla,
        bgc.bbp700
    FROM bgc_levels bgc
    ORDER BY bgc.profile_key, bgc.level_index;
    """

    bgc_df = pd.read_sql(sql_bgc, conn)
    conn.close()

    print(f"✔ Loaded {len(core_df)} core rows")
    print(f"✔ Loaded {len(bgc_df)} bgc rows")

    # ------------------------------------------
    # Normalizing fields
    # ------------------------------------------
    core_df["latitude"] = pd.to_numeric(core_df["latitude"], errors="coerce")
    core_df["longitude"] = pd.to_numeric(core_df["longitude"], errors="coerce")
    core_df["cycle"] = pd.to_numeric(core_df["cycle"], errors="coerce")
    core_df["juld"] = core_df["juld"].astype(str)

    profiles = defaultdict(lambda: {
        "pressure": [],
        "temp": [],
        "temp_adj": [],
        "sal": [],
        "sal_adj": [],
        "lat": None, "lon": None, "cycle": None, "platform": None, "juld": None,
        "bgc": {"doxy": [], "chla": [], "bbp700": []}
    })

    # Fill core data
    for _, row in core_df.iterrows():
        p = profiles[row["profile_key"]]

        p["pressure"].append(row["pressure"])
        p["temp"].append(row["temperature"])
        p["temp_adj"].append(row["temperature_adjusted"])
        p["sal"].append(row["salinity"])
        p["sal_adj"].append(row["salinity_adjusted"])

        p["lat"] = row["latitude"]
        p["lon"] = row["longitude"]
        p["cycle"] = row["cycle"]
        p["platform"] = row["platform_number"]
        p["juld"] = row["juld"]

    # Fill BGC data
    for _, row in bgc_df.iterrows():
        if row["profile_key"] in profiles:
            p = profiles[row["profile_key"]]["bgc"]
            p["doxy"].append(row["doxy"])
            p["chla"].append(row["chla"])
            p["bbp700"].append(row["bbp700"])

    # Summary helper
    def summary(arr):
        arr = [x for x in arr if x is not None and not pd.isna(x)]
        if not arr:
            return "no data"
        return f"min={min(arr)}, max={max(arr)}, mean={round(sum(arr)/len(arr),4)}"

    documents = []
    ids = []
    metadatas = []

    for pk, d in profiles.items():
        text = (
            f"Profile {pk} from platform {d['platform']}, cycle {d['cycle']}. "
            f"Location lat={d['lat']}, lon={d['lon']}, time={d['juld']}. "
            f"Pressure stats: {summary(d['pressure'])}. "
            f"Temperature stats: {summary(d['temp'])}. "
            f"Adjusted temperature: {summary(d['temp_adj'])}. "
            f"Salinity stats: {summary(d['sal'])}. "
            f"Adjusted salinity: {summary(d['sal_adj'])}. "
        )

        if d["bgc"]["doxy"] or d["bgc"]["chla"] or d["bgc"]["bbp700"]:
            text += (
                f"BGC DOXY: {summary(d['bgc']['doxy'])}. "
                f"CHLA: {summary(d['bgc']['chla'])}. "
                f"BBP700: {summary(d['bgc']['bbp700'])}. "
            )

        documents.append(text)
        ids.append(str(pk))

        metadatas.append({
            "platform": d["platform"],
            "cycle": d["cycle"],
            "latitude": d["lat"],
            "longitude": d["lon"],
            "juld": d["juld"],
            "has_bgc": any(len(d["bgc"][k]) > 0 for k in d["bgc"])
        })

    print(f"✔ Created {len(documents)} combined documents")

    print("Encoding embeddings...")
    encoder = SentenceTransformer("all-mpnet-base-v2")
    embeddings = encoder.encode(documents, convert_to_numpy=True).tolist()

    print("✔ Embeddings ready")

    # Save to ChromaDB
    client = PersistentClient(path=VECTOR_DB_PATH)

    collection = client.get_or_create_collection(
        name="argo_profiles",
        metadata={"hnsw:space": "cosine"}
    )

    collection.upsert(ids=ids, documents=documents, embeddings=embeddings, metadatas=metadatas)

    print("🎉 FULL VECTOR DB BUILD COMPLETE")


# -------------------------------------------------------
# INCREMENTAL BUILD (stub for now)
# -------------------------------------------------------
def incremental_build():
    print("⚠ Incremental build not implemented — running full build instead.")
    full_build()
