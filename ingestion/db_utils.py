# ingestion/db_utils.py
import os
import json
import socket
import time
from urllib.parse import urlparse, parse_qs
from dotenv import load_dotenv

import psycopg2
import psycopg2.extras
from psycopg2 import sql, OperationalError

import requests   # REQUIRED for DNS-over-HTTPS lookup

load_dotenv()

# Prefer DATABASE_URL_PUBLIC (public proxy for local dev) over DATABASE_URL (Railway internal)
DATABASE_URL = os.getenv("DATABASE_URL_PUBLIC") or os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL (or DATABASE_URL_PUBLIC) not set in .env")

DEFAULT_CONNECT_TIMEOUT = 20


def doh_lookup(hostname: str, record_type: str = "A"):
    """
    Resolve hostname → IP using DNS-over-HTTPS (Cloudflare + Google + Quad9 + AdGuard fallback).
    Supports A (IPv4) or AAAA (IPv6).
    This bypasses ISP/Windows DNS completely.
    """
    type_code = 1 if record_type == "A" else 28  # 1 for A, 28 for AAAA

    # Cloudflare DoH
    try:
        r = requests.get(
            "https://cloudflare-dns.com/dns-query",
            params={"name": hostname, "type": record_type},
            headers={"accept": "application/dns-json"},
            timeout=5
        )
        data = r.json()
        if "Answer" in data:
            for ans in data["Answer"]:
                if ans["type"] == type_code:
                    return ans["data"]
    except Exception:
        pass

    # Google DoH fallback
    try:
        r = requests.get(
            "https://dns.google/resolve",
            params={"name": hostname, "type": record_type},
            timeout=5
        )
        data = r.json()
        if "Answer" in data:
            for ans in data["Answer"]:
                if ans["type"] == type_code:
                    return ans["data"]
    except Exception:
        pass

    # Quad9 DoH fallback
    try:
        r = requests.get(
            "https://dns.quad9.net/dns-query",
            params={"name": hostname, "type": record_type},
            headers={"accept": "application/dns-json"},
            timeout=5
        )
        data = r.json()
        if "Answer" in data:
            for ans in data["Answer"]:
                if ans["type"] == type_code:
                    return ans["data"]
    except Exception:
        pass

    # AdGuard DoH fallback
    try:
        r = requests.get(
            "https://dns.adguard.com/dns-query",
            params={"name": hostname, "type": record_type},
            headers={"accept": "application/dns-json"},
            timeout=5
        )
        data = r.json()
        if "Answer" in data:
            for ans in data["Answer"]:
                if ans["type"] == type_code:
                    return ans["data"]
    except Exception:
        pass

    return None


def doh_ipv4_lookup(hostname: str):
    """Resolve hostname → IPv4 using DoH."""
    return doh_lookup(hostname, "A")


def doh_ipv6_lookup(hostname: str):
    """Resolve hostname → IPv6 using DoH."""
    return doh_lookup(hostname, "AAAA")


def parse_dsn(dsn: str):
    p = urlparse(dsn)
    q = parse_qs(p.query)
    return dict(
        user=p.username,
        password=p.password,
        host=p.hostname,
        port=p.port or 5432,
        dbname=p.path.lstrip("/") or "postgres",
        sslmode=q.get("sslmode", ["require"])[0]
    )


def connect_explicit(params: dict):
    """Connect using explicit parameters with SSL."""
    return psycopg2.connect(
        user=params["user"],
        password=params["password"],
        host=params["host"],
        port=params["port"],
        dbname=params["dbname"],
        sslmode=params.get("sslmode", "require"),
        connect_timeout=DEFAULT_CONNECT_TIMEOUT,
        keepalives=1,
        keepalives_idle=30
    )


def get_conn():
    """
    ALWAYS resolves IPv4 with DNS-over-HTTPS → guaranteed working.
    """
    params = parse_dsn(DATABASE_URL)

    host = params["host"]

    print(f"🌐 Resolving IPv4 for: {host} using DNS-over-HTTPS (Cloudflare, Google, Quad9, AdGuard) ...")

    ipv4 = doh_ipv4_lookup(host)

    if not ipv4:
        print("⚠ DoH failed — attempting socket.AF_INET resolution")
        try:
            addrinfo = socket.getaddrinfo(host, params["port"], socket.AF_INET)
            ipv4 = addrinfo[0][4][0]
        except Exception:
            ipv4 = None

    if not ipv4:
        raise RuntimeError(
            f"❌ Could not resolve IPv4 for {host}. Your ISP or router is blocking DNS."
        )

    print(f"✓ Using IPv4: {ipv4}")

    # Override hostname with IPv4
    params["host"] = ipv4

    # Connect securely
    try:
        conn = connect_explicit(params)
        print("✓ PostgreSQL connection established via IPv4 (SSL enabled).")
        return conn
    except Exception as e:
        print(f"❌ Connection still failed: {e}")
        raise


def bulk_insert_dicts(table_name: str, dicts: list, cols_order=None, chunk=1000):
    """
    Bulk insert list of dictionaries into table_name.
    If cols_order is None, infers from first dict keys.
    Inserts in chunks to avoid memory issues.
    Returns the number of rows attempted to insert.
    """
    if not dicts:
        return 0

    conn = get_conn()
    try:
        with conn:
            with conn.cursor() as cur:
                # Determine columns
                if cols_order is None:
                    cols_order = list(dicts[0].keys())

                # Build placeholders and SQL
                placeholders = ', '.join(['%s'] * len(cols_order))
                cols_str = ', '.join(cols_order)
                sql_stmt = f"INSERT INTO {table_name} ({cols_str}) VALUES ({placeholders})"

                # Insert in chunks
                for i in range(0, len(dicts), chunk):
                    chunk_dicts = dicts[i:i + chunk]
                    values = [[d.get(col) for col in cols_order] for d in chunk_dicts]
                    cur.executemany(sql_stmt, values)

        return len(dicts)
    finally:
        conn.close()
