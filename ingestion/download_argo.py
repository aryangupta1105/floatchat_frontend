#!/usr/bin/env python3
"""
Argo FTP Downloader
Downloads .nc profile files from ftp.ifremer.fr/ifremer/argo/dac/

Usage examples:
  # Download all floats from a specific DAC:
  python download_argo.py --dac coriolis

  # Download a specific float:
  python download_argo.py --dac coriolis --float-id 6901254

  # Download from multiple DACs:
  python download_argo.py --dac coriolis aoml

  # Download ALL DACs (warning: very large):
  python download_argo.py --all

  # Limit files per float (useful for testing):
  python download_argo.py --dac coriolis --float-id 6901254 --limit 5

  # Only download *_prof.nc files (default), or all .nc files:
  python download_argo.py --dac coriolis --file-pattern prof
"""

import ftplib
import os
import argparse
import sys
import time

# ── Config ──────────────────────────────────────────────────────────────────
FTP_HOST = "ftp.ifremer.fr"
FTP_BASE = "/ifremer/argo/dac"
DEFAULT_OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "source_files")

# Known DACs on the Argo GDAC
ALL_DACS = [
    "aoml", "bodc", "coriolis", "csio", "csiro",
    "incois", "jma", "kma", "kordi", "meds", "nmdis"
]

FILE_PATTERNS = {
    "prof":  "_prof.nc",    # merged profile file (recommended)
    "traj":  "_traj.nc",    # trajectory
    "meta":  "_meta.nc",    # metadata
    "tech":  "_tech.nc",    # technical
    "all":   ".nc",         # every .nc file
}


# ── FTP helpers ──────────────────────────────────────────────────────────────
def ftp_connect():
    print(f"Connecting to {FTP_HOST} ...")
    ftp = ftplib.FTP(FTP_HOST, timeout=30)
    ftp.login()  # anonymous
    ftp.set_pasv(True)
    print("Connected (anonymous).")
    return ftp


def ftp_list_dirs(ftp, path):
    """Return list of subdirectory names under path."""
    entries = []
    try:
        ftp.cwd(path)
        ftp.retrlines("NLST", entries.append)
    except ftplib.error_perm:
        return []
    return entries


def ftp_list_files(ftp, path, suffix):
    """Return list of filenames ending with suffix under path."""
    entries = []
    try:
        ftp.cwd(path)
        ftp.retrlines("NLST", entries.append)
    except ftplib.error_perm:
        return []
    return [e for e in entries if e.endswith(suffix)]


def download_file(ftp, remote_path, local_path, retries=3):
    """Download a single file from FTP with retry logic."""
    os.makedirs(os.path.dirname(local_path), exist_ok=True)

    for attempt in range(1, retries + 1):
        try:
            with open(local_path, "wb") as f:
                ftp.retrbinary(f"RETR {remote_path}", f.write)
            return True
        except (ftplib.error_temp, EOFError, OSError) as e:
            print(f"  Attempt {attempt}/{retries} failed: {e}")
            if attempt < retries:
                time.sleep(2 * attempt)
                try:
                    ftp.pwd()  # check if connection alive
                except Exception:
                    print("  Reconnecting ...")
                    try:
                        ftp.quit()
                    except Exception:
                        pass
                    ftp = ftp_connect()
            else:
                return False
    return False


# ── Core download logic ───────────────────────────────────────────────────────
def download_float(ftp, dac, float_id, out_dir, suffix, limit=None):
    """Download .nc files for a single float from its /profiles/ subdirectory."""
    remote_dir = f"{FTP_BASE}/{dac}/{float_id}/profiles"
    files = ftp_list_files(ftp, remote_dir, suffix)

    if not files:
        print(f"  No files matching '*{suffix}' found for float {float_id}")
        return 0

    if limit:
        files = files[:limit]

    downloaded = 0
    for fname in files:
        local_path = os.path.join(out_dir, fname)
        if os.path.exists(local_path):
            print(f"  Skipping (exists): {fname}")
            continue

        remote_path = f"{remote_dir}/{fname}"
        print(f"  Downloading: {fname} ...", end=" ", flush=True)
        ok = download_file(ftp, remote_path, local_path)
        if ok:
            size_kb = os.path.getsize(local_path) / 1024
            print(f"OK ({size_kb:.1f} KB)")
            downloaded += 1
        else:
            print("FAILED")
            try:
                os.remove(local_path)
            except Exception:
                pass

    return downloaded


def download_dac(ftp, dac, out_dir, suffix, float_ids=None, limit=None):
    """Download files for all (or specified) floats in a DAC."""
    dac_path = f"{FTP_BASE}/{dac}"
    print(f"\n=== DAC: {dac} ===")

    if float_ids:
        floats = float_ids
    else:
        print(f"Listing floats in {dac_path} ...")
        floats = ftp_list_dirs(ftp, dac_path)
        if not floats:
            print(f"  No floats found under {dac_path}")
            return 0
        print(f"  Found {len(floats)} floats.")

    total = 0
    for i, float_id in enumerate(floats, 1):
        print(f"[{i}/{len(floats)}] Float {float_id}")
        total += download_float(ftp, dac, float_id, out_dir, suffix, limit=limit)

    return total


# ── CLI ───────────────────────────────────────────────────────────────────────
def parse_args():
    p = argparse.ArgumentParser(description="Download Argo .nc files from ftp.ifremer.fr")
    p.add_argument("--dac", nargs="+", metavar="DAC",
                   help=f"DAC name(s) to download. Available: {', '.join(ALL_DACS)}")
    p.add_argument("--float-id", nargs="+", metavar="ID",
                   help="Specific float ID(s) to download (requires --dac with single DAC)")
    p.add_argument("--all", action="store_true",
                   help="Download from ALL DACs (very large, use with caution)")
    p.add_argument("--file-pattern", choices=list(FILE_PATTERNS.keys()), default="all",
                   help="Which file type to download (default: all = every .nc in /profiles/)")
    p.add_argument("--out-dir", default=DEFAULT_OUT_DIR,
                   help=f"Output directory (default: {DEFAULT_OUT_DIR})")
    p.add_argument("--limit", type=int, default=None,
                   help="Max files to download per float (useful for testing)")
    return p.parse_args()


def main():
    args = parse_args()

    if not args.dac and not args.all:
        print("ERROR: Specify --dac <name> or --all")
        print(f"Available DACs: {', '.join(ALL_DACS)}")
        sys.exit(1)

    if args.float_id and args.dac and len(args.dac) > 1:
        print("ERROR: --float-id can only be used with a single --dac")
        sys.exit(1)

    suffix = FILE_PATTERNS[args.file_pattern]
    dacs = ALL_DACS if args.all else args.dac
    out_dir = args.out_dir
    os.makedirs(out_dir, exist_ok=True)

    print(f"Output directory : {out_dir}")
    print(f"File pattern     : *{suffix}")
    print(f"DACs             : {dacs}")
    if args.float_id:
        print(f"Float IDs        : {args.float_id}")
    if args.limit:
        print(f"Limit per float  : {args.limit}")

    ftp = ftp_connect()
    total_downloaded = 0

    try:
        for dac in dacs:
            float_ids = args.float_id if (args.float_id and len(dacs) == 1) else None
            total_downloaded += download_dac(ftp, dac, out_dir, suffix,
                                             float_ids=float_ids, limit=args.limit)
    finally:
        try:
            ftp.quit()
        except Exception:
            pass

    print(f"\n=== DONE: {total_downloaded} file(s) downloaded to {out_dir} ===")


if __name__ == "__main__":
    main()
