#!/usr/bin/env python3
"""
Robust NetCDF -> PostgreSQL ingestion script

Changes:
- bgc_levels schema extended with CDOM, NITRATE, PH_IN_SITU_TOTAL, BBP470, BBP532 (keeps bbp700)
- generic 'bbp' column removed completely
- upsert_bgc_levels updated to extract/derive BBP470 and BBP532; generic BBP removed
- core_levels unchanged
- DSN loaded from DATABASE_URL env var (no hardcoded credentials)
- Parquet export added alongside CSV
"""
import argparse
import os
import sys
import traceback
import hashlib
import time
from typing import Optional, Tuple, Dict, Any, List

import numpy as np
import xarray as xr
import pandas as pd
import datetime

# Load .env if present (optional, for local dev)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Optional DB driver
try:
    import psycopg2
    import psycopg2.extras
except Exception:
    psycopg2 = None

# TEOS-10 library for accurate pressure->depth conversion (required when DEPTH absent)
try:
    import gsw  # type: ignore
except Exception:
    gsw = None

# ----------------------
# Configuration
# ----------------------
DEFAULT_INSERT_BATCH = 500
# DSN loaded from environment variable — never hardcode credentials
# Prefer DATABASE_URL_PUBLIC (public proxy) for local dev; fall back to DATABASE_URL (Railway internal)
DEFAULT_DSN = os.environ.get("DATABASE_URL_PUBLIC") or os.environ.get("DATABASE_URL") or os.environ.get("DATABASE_DSN") or ""
AUTO_CREATE_TABLES = True
AUTO_INSERT_SUMMARY = True
AUTO_SUMMARY_MODEL_NAME = "auto_stats"
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# BGC variables (canonical tokens for detection)
BGC_VARIABLE_TOKENS = [
    "DOXY", "CHLA", "CHLA_FLUORESCENCE", "BBP700",
    "CDOM", "A_CDOM", "ACDOM", "NITRATE", "NO3", "PH_IN_SITU_TOTAL", "PH", "BBP470", "BBP532"
]

# Metadata fields you want saved explicitly
METADATA_FIELDS = [
    "DATA_TYPE", "FORMAT_VERSION", "HANDBOOK_VERSION",
    "REFERENCE_DATE_TIME", "DATE_CREATION", "DATE_UPDATE",
    "PLATFORM_NUMBER", "PROJECT_NAME", "PI_NAME", "DATA_CENTRE", "STATION_PARAMETERS"
]

# Default spectral slope fallbacks (best-effort)
DEFAULT_BBP_SPECTRAL_SLOPE = 0.7  # fallback eta (power-law) for bbp(λ)
DEFAULT_CDOM_SLOPE = 0.014        # typical CDOM spectral slope S (nm^-1)

# ----------------------
# Helpers
# ----------------------
def sanitize_dsn(dsn: str) -> str:
    if not dsn or "@" not in dsn:
        return dsn
    if "://" in dsn:
        scheme, rest = dsn.split("://", 1)
    else:
        scheme = ""
        rest = dsn
    last_at = rest.rfind('@')
    if last_at == -1:
        return dsn
    userinfo, hostpart = rest[:last_at], rest[last_at+1:]
    if "@" in userinfo:
        userinfo = userinfo.replace("@", "%40")
    return f"{scheme}://{userinfo}@{hostpart}" if scheme else f"{userinfo}@{hostpart}"

def make_json_serializable(obj):
    """Convert arrays/np scalars/datetimes to python primitives for JSONB storage."""
    if obj is None:
        return None
    if isinstance(obj, (bool, int, float, str)):
        return obj
    try:
        if isinstance(obj, (np.integer,)):
            return int(obj)
        if isinstance(obj, (np.floating,)):
            return float(obj)
        if isinstance(obj, (np.bool_,)):
            return bool(obj)
    except Exception:
        pass
    if isinstance(obj, (pd.Timestamp, datetime.datetime)):
        return pd.to_datetime(obj).isoformat()
    if isinstance(obj, (bytes, bytearray)):
        try:
            return obj.decode("utf-8", errors="replace")
        except Exception:
            return str(obj)
    if isinstance(obj, np.ndarray):
        if obj.ndim == 0:
            try:
                return make_json_serializable(obj.item())
            except Exception:
                return str(obj)
        try:
            return [make_json_serializable(x) for x in obj.reshape(-1).tolist()]
        except Exception:
            return [make_json_serializable(x) for x in obj.reshape(-1)]
    if isinstance(obj, dict):
        return {str(k): make_json_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [make_json_serializable(x) for x in list(obj)]
    try:
        return str(obj)
    except Exception:
        return None

def jsonwrap(obj):
    safe = make_json_serializable(obj)
    if psycopg2 is not None:
        return psycopg2.extras.Json(safe)
    return safe

def file_sha256(path: str, blocksize: int = 2**20) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while True:
            b = f.read(blocksize)
            if not b:
                break
            h.update(b)
    return h.hexdigest()

def pick_var_name(ds: xr.Dataset, base: str) -> Optional[str]:
    base_up = base.upper()
    if base_up == "PRES":
        candidates = ["PRES", "PRES_ADJUSTED", "DEPTH", "DEPTH_ADJUSTED"]
    else:
        candidates = [f"{base_up}_ADJUSTED", base_up, f"{base_up}_ADJUSTED_ERROR", f"{base_up}_ADJUSTED_QC"]
    for c in candidates:
        if c in ds.variables:
            return c
    lc = base.lower()
    for v in ds.variables:
        if v.lower() == lc:
            return v
    for v in ds.variables:
        if lc in v.lower():
            return v
    return None

def find_raw_and_adjusted(ds: xr.Dataset, base: str) -> Tuple[Optional[str], Optional[str]]:
    base_up = base.upper()
    raw = base_up if base_up in ds.variables else None
    adj = f"{base_up}_ADJUSTED" if f"{base_up}_ADJUSTED" in ds.variables else None
    if raw is None:
        cand = pick_var_name(ds, base)
        if cand:
            if 'ADJUST' in cand.upper():
                adj = cand
            else:
                raw = cand
    if adj and raw is None:
        for v in ds.variables:
            if v.upper().startswith(base_up) and 'ADJUST' not in v.upper():
                raw = v
                break
    if raw and adj and raw == adj:
        adj = None
    if raw is None:
        for v in ds.variables:
            if base.lower() in v.lower():
                raw = v
                break
    return raw, adj

def detect_bgc_in_ds(ds: xr.Dataset) -> List[str]:
    """Return list of variable names suspected to be BGC (case-insensitive token search)."""
    present = []
    for v in ds.variables:
        vn = v.upper()
        for token in BGC_VARIABLE_TOKENS:
            if token in vn:
                present.append(v)
                break
    return present

# ----------------------
# Robust normalizer
# ----------------------
def normalize_array(ds, varname):
    """
    Convert ds[varname] into a 1-D numpy array or an object array for text QC.
    - Masked arrays -> filled(np.nan)
    - Handles 0-d, bytes -> str arrays
    - Applies _FillValue / missing_value -> set to np.nan
    - Applies scale_factor / add_offset if present
    - Returns None for zero-length
    """
    try:
        if varname is None:
            return None
        if varname not in ds.variables:
            return None
        var = ds[varname]
        arr = var.values

        # Masked arrays
        try:
            import numpy.ma as ma
            if isinstance(arr, ma.MaskedArray):
                arr = arr.filled(np.nan)
        except Exception:
            pass

        # 0-d arrays -> 1-d
        if np.ndim(arr) == 0:
            try:
                arr = np.array([arr.item()]) if hasattr(arr, "item") else np.array([arr])
            except Exception:
                arr = np.array([arr])

        # bytes/fixed-str arrays -> decode to python strings
        if isinstance(arr, np.ndarray) and (arr.dtype.type is np.bytes_ or arr.dtype.type is np.str_ or arr.dtype.kind in ('S','U')):
            flat = []
            for x in arr.reshape(-1):
                if isinstance(x, (bytes, np.bytes_)):
                    try:
                        flat.append(x.decode("utf-8", errors="replace").strip())
                    except Exception:
                        flat.append(str(x))
                else:
                    flat.append(str(x))
            return np.array(flat, dtype=object).reshape(-1)

        # convert to numpy array
        a = np.array(arr, copy=True)
        if a.size == 0:
            return None

        # apply fill/missing attr
        # NOTE: must use `is None` – Python `or` treats 0/0.0 as falsy,
        # which would silently skip a legitimate fill-value of 0.
        fillv = None
        try:
            fillv = var.attrs.get("_FillValue", None)
            if fillv is None:
                fillv = var.attrs.get("missing_value", None)
        except Exception:
            fillv = None
        if fillv is not None:
            try:
                mask = (a == fillv)
                a = a.astype(np.float64, copy=False)
                a[mask] = np.nan
            except Exception:
                # fallback elementwise compare
                try:
                    a_list = a.reshape(-1).tolist()
                    a = np.array([np.nan if (x == fillv) else x for x in a_list])
                except Exception:
                    pass

        # scale/add offset
        try:
            scale = var.attrs.get("scale_factor", None)
            offset = var.attrs.get("add_offset", None)
            if scale is not None or offset is not None:
                a = a.astype(np.float64, copy=False)
                if scale is not None:
                    a = a * float(scale)
                if offset is not None:
                    a = a + float(offset)
        except Exception:
            pass

        # flatten multi-dim
        if a.ndim >= 2:
            a = a.reshape(-1)

        # try convert to float array
        try:
            af = a.astype(np.float64, copy=False)
            return af
        except Exception:
            # non numeric -> return strings/object array
            try:
                return np.array([str(x) for x in a.reshape(-1)], dtype=object)
            except Exception:
                return None
    except Exception:
        return None

# ----------------------
# Pressure -> depth helper (USING gsw)
# ----------------------
def pressure_to_depth(p_arr, latitude):
    """
    Convert pressure (in dbar) to depth (meters) using TEOS-10 (gsw.z_from_p).
    p_arr: numpy array (1-D) or list of pressures in dbar.
    latitude: scalar latitude (degrees)
    Returns numpy array of depths (meters) or raises if conversion impossible.
    """
    if p_arr is None:
        return None
    if gsw is None:
        raise RuntimeError("gsw library required for pressure->depth conversion. Install with 'pip install gsw'.")
    try:
        a = np.array(p_arr).reshape(-1).astype(float)
    except Exception:
        raise RuntimeError("Invalid pressure values for depth conversion.")
    if a.size == 0:
        return None
    try:
        z = gsw.z_from_p(a, float(latitude))
        depth = -z
        # convert non-finite to NaN
        depth = np.where(np.isfinite(depth), depth, np.nan)
        return depth
    except Exception as e:
        raise RuntimeError(f"gsw conversion failed: {e}")

# ----------------------
# Small helpers for calibration
# ----------------------
def _get_attr_case_insensitive(var_attrs: Dict[str,Any], names: List[str]):
    if not var_attrs:
        return None
    lower = {k.lower(): v for k, v in var_attrs.items()}
    for n in names:
        if n.lower() in lower:
            return lower[n.lower()]
    return None

def apply_linear_calibration(arr, var_attrs):
    """
    Apply linear calibration: result = (raw - dark) * scale + offset
    This follows the standard sensor calibration order:
      1. Subtract dark/background  (dark_count, dark_counts, dark_offset)
      2. Multiply by scale factor   (calibration_factor, scale, slope, gain)
      3. Add offset/intercept       (offset, intercept, cal_offset)
    Returns (calibrated_array, actually_applied: bool)
    """
    if arr is None:
        return None, False
    try:
        a = np.array(arr).astype(float).reshape(-1)
    except Exception:
        return arr, False

    # Separate dark (subtracted first) from additive offset
    dark = _get_attr_case_insensitive(var_attrs, ["dark_count", "dark_counts", "dark_offset", "dark_reference"])
    scale = _get_attr_case_insensitive(var_attrs, ["calibration_factor", "calibration_coeff", "cal_coeff", "scale", "slope", "gain"])
    offset = _get_attr_case_insensitive(var_attrs, ["offset", "intercept", "cal_offset"])

    if dark is None and scale is None and offset is None:
        return a, False  # nothing to apply

    try:
        # Step 1: subtract dark/background
        if dark is not None:
            a = a - float(dark)
        # Step 2: multiply by scale
        if scale is not None:
            a = a * float(scale)
        # Step 3: add additive offset
        if offset is not None:
            a = a + float(offset)
    except Exception:
        return a, False
    return a, True

def convert_o2_ml_per_L_to_umol_per_kg(arr_ml_per_L, temp_arr=None, psal_arr=None,
                                        pres_arr=None, lat=None, lon=None,
                                        default_density=1025.0):
    """
    Convert dissolved oxygen from mL/L to µmol/kg using TEOS-10 density.
    Formula: µmol/kg = mL/L × 44.6596 × (1000 / ρ_kg_m³)
    Uses actual pressure, latitude, longitude for accurate SA/CT/ρ via GSW.
    """
    if arr_ml_per_L is None:
        return None
    try:
        a = np.array(arr_ml_per_L).astype(float).reshape(-1)
    except Exception:
        return None

    # Best-effort density via TEOS-10
    density = None
    if gsw is not None and temp_arr is not None and psal_arr is not None:
        try:
            psal = np.array(psal_arr).reshape(-1).astype(float)
            temp = np.array(temp_arr).reshape(-1).astype(float)
            # Use actual pressure/lat/lon when available for accurate SA
            p = np.zeros_like(psal)
            if pres_arr is not None:
                try:
                    p = np.array(pres_arr).reshape(-1).astype(float)
                    # Truncate/pad to match psal length
                    if p.size < psal.size:
                        p = np.pad(p, (0, psal.size - p.size), constant_values=0)
                    elif p.size > psal.size:
                        p = p[:psal.size]
                except Exception:
                    p = np.zeros_like(psal)
            lat_v = float(lat) if lat is not None else 0.0
            lon_v = float(lon) if lon is not None else 0.0
            SA = gsw.SA_from_SP(psal, p, lon_v, lat_v)
            CT = gsw.CT_from_t(SA, temp, p)
            dens = gsw.rho(SA, CT, p)
            dens = np.where(np.isfinite(dens), dens, default_density)
            density = dens
        except Exception:
            density = None

    if density is None:
        density = default_density

    # 1 mL O₂ at STP = 44.6596 µmol
    ML_TO_UMOL = 44.6596
    try:
        d = np.array(density)
        if d.size == 1:
            result = a * ML_TO_UMOL * (1000.0 / float(d))
        else:
            result = a * ML_TO_UMOL * (1000.0 / d)
    except Exception:
        result = a * ML_TO_UMOL * (1000.0 / default_density)

    result = np.where(np.isfinite(result), result, np.nan)
    return result

def calibrate_bgc_arrays(bgc_arrays: Dict[str, Any], bgc_var_attrs: Dict[str, Dict[str,Any]], profile_meta: Dict[str,Any], profile_vars: Dict[str,Any]):
    """
    Best-effort calibration for BGC arrays.

    IMPORTANT: Standard Argo NetCDF files store data ALREADY in physical units.
    Calibration attributes (scale, dark_count, etc.) document what was applied at
    the instrument/processing level — they should NOT be re-applied.

    This function therefore:
      1. Applies linear calibration ONLY when sensor-specific attributes are found
         (e.g., dark_count for CHLA), using the correct formula: (raw - dark) * scale
      2. Performs DOXY unit conversion (mL/L → µmol/kg) using TEOS-10 density with
         actual pressure, latitude, and longitude for accuracy.
      3. Does NOT double-apply: each variable is calibrated through exactly ONE path.
    """
    out = {}
    temp_arr = profile_vars.get("TEMP_ADJ") if profile_vars.get("TEMP_ADJ") is not None else profile_vars.get("TEMP_RAW")
    psal_arr = profile_vars.get("PSAL_ADJ") if profile_vars.get("PSAL_ADJ") is not None else profile_vars.get("PSAL_RAW")
    pres_arr = profile_vars.get("PRES")

    # Extract lat/lon for accurate density computation
    lat = profile_meta.get("LATITUDE") if profile_meta else None
    lon = profile_meta.get("LONGITUDE") if profile_meta else None
    try:
        if isinstance(lat, (np.ndarray, list, tuple)):
            lat = float(np.array(lat).reshape(-1)[0])
        if isinstance(lon, (np.ndarray, list, tuple)):
            lon = float(np.array(lon).reshape(-1)[0])
    except Exception:
        lat = lon = None

    for name, arr in bgc_arrays.items():
        attrs = bgc_var_attrs.get(name, {}) if bgc_var_attrs is not None else {}
        calibrated = arr

        # ── Step 1: Generic linear calibration ──
        # Applied exactly ONCE; sensor-specific blocks below do NOT re-apply.
        try:
            linear, was_applied = apply_linear_calibration(calibrated, attrs)
            if was_applied and linear is not None:
                calibrated = linear
                print(f"[CAL] Applied linear calibration to {name}")
        except Exception as e:
            print(f"Warning: linear calibration failed for {name}: {e}")

        # ── Step 2: Detect units for unit conversions ──
        units = None
        try:
            units = attrs.get("units")
            if units is None:
                units = attrs.get("UNIT")
            if units is None:
                units = attrs.get("Units")
            if isinstance(units, bytes):
                units = units.decode("utf-8", errors="replace")
        except Exception:
            units = None
        unit_s = str(units).lower() if units is not None else ""

        # ── Step 3: DOXY unit conversion (mL/L → µmol/kg) ──
        # This is a UNIT conversion, not re-calibration.
        if "doxy" in name.lower() or "oxygen" in name.lower() or name.lower() == "o2":
            if "ml" in unit_s and ("l" in unit_s or "l-1" in unit_s or "/l" in unit_s):
                try:
                    conv = convert_o2_ml_per_L_to_umol_per_kg(
                        calibrated, temp_arr, psal_arr,
                        pres_arr=pres_arr, lat=lat, lon=lon
                    )
                    if conv is not None:
                        calibrated = conv
                        print(f"[UNIT] Converted DOXY '{name}' from mL/L to µmol/kg")
                except Exception as e:
                    print(f"Warning: DOXY conversion failed for {name}: {e}")

        # NOTE: CHLA and BBP sensor-specific recalibration is NOT applied here
        # because Argo NetCDF data is already in physical units.
        # The apply_linear_calibration above handles the rare case where
        # calibration attributes are present at the variable level.

        try:
            calibrated = np.array(calibrated).reshape(-1)
        except Exception:
            pass
        out[name] = calibrated
    return out

# ----------------------
# Spectral helpers (new)
# ----------------------
def compute_bbp_spectral_conversion(reference_arr, lambda_ref_nm: float, lambda_target_nm: float, eta: float):
    if reference_arr is None or lambda_ref_nm is None or lambda_target_nm is None:
        return None
    try:
        a = np.array(reference_arr).astype(float).reshape(-1)
    except Exception:
        return None
    try:
        factor = (float(lambda_target_nm) / float(lambda_ref_nm)) ** (-float(eta))
        result = a * factor
        result = np.where(np.isfinite(result), result, np.nan)
        return result
    except Exception:
        return None

def compute_cdom_at_wavelength(reference_arr, lambda_ref_nm: float, lambda_target_nm: float, S_slope: float):
    if reference_arr is None or lambda_ref_nm is None or lambda_target_nm is None:
        return None
    try:
        a = np.array(reference_arr).astype(float).reshape(-1)
    except Exception:
        return None
    try:
        delta = float(lambda_target_nm) - float(lambda_ref_nm)
        factor = np.exp(-float(S_slope) * delta)
        result = a * factor
        result = np.where(np.isfinite(result), result, np.nan)
        return result
    except Exception:
        return None

# ----------------------
# Extract profile
# ----------------------
def ensure_profile_key(nc_path: str, ds: xr.Dataset) -> str:
    fname = os.path.basename(nc_path)
    pk = fname
    try:
        if 'PLATFORM_NUMBER' in ds and 'CYCLE_NUMBER' in ds:
            p = ds['PLATFORM_NUMBER'].values
            c = ds['CYCLE_NUMBER'].values
            try:
                p0 = p.flatten()[0] if hasattr(p, "flatten") else p
                c0 = c.flatten()[0] if hasattr(c, "flatten") else c
                if isinstance(p0, (bytes, np.bytes_)):
                    p0 = p0.decode("utf-8", errors="replace").strip()
                pk = f"{str(p0)}:{int(c0)}"
            except Exception:
                pk = fname
    except Exception:
        pk = fname
    return pk

def extract_profile(nc_path: str) -> Dict[str, Any]:
    ds = xr.open_dataset(nc_path)
    try:
        pres_name = pick_var_name(ds, "PRES")
        depth_name = None
        if "DEPTH" in ds.variables:
            depth_name = "DEPTH"
        else:
            cand = pick_var_name(ds, "DEPTH")
            if cand and cand != pres_name:
                depth_name = cand
        if pres_name is None:
            pres_name = pick_var_name(ds, "DEPTH")
        if pres_name is None:
            raise RuntimeError(f"No PRES/DEPTH variable found in {nc_path}")
        temp_raw_name, temp_adj_name = find_raw_and_adjusted(ds, "TEMP")
        psal_raw_name, psal_adj_name = find_raw_and_adjusted(ds, "PSAL")
        PRES = normalize_array(ds, pres_name)
        DEPTH = normalize_array(ds, depth_name) if depth_name is not None else None
        TEMP_RAW = normalize_array(ds, temp_raw_name) if temp_raw_name else None
        TEMP_ADJ = normalize_array(ds, temp_adj_name) if temp_adj_name else None
        PSAL_RAW = normalize_array(ds, psal_raw_name) if psal_raw_name else None
        PSAL_ADJ = normalize_array(ds, psal_adj_name) if psal_adj_name else None
        PRES_QC = normalize_array(ds, "PRES_QC") if "PRES_QC" in ds.variables else None
        TEMP_QC = normalize_array(ds, "TEMP_QC") if "TEMP_QC" in ds.variables else None
        PSAL_QC = normalize_array(ds, "PSAL_QC") if "PSAL_QC" in ds.variables else None

        # NEW: adjusted values, errors, and adjusted QC for core variables
        PRES_ADJ = normalize_array(ds, "PRES_ADJUSTED") if "PRES_ADJUSTED" in ds.variables else None
        PRES_ADJ_ERR = normalize_array(ds, "PRES_ADJUSTED_ERROR") if "PRES_ADJUSTED_ERROR" in ds.variables else None
        PRES_ADJ_QC = normalize_array(ds, "PRES_ADJUSTED_QC") if "PRES_ADJUSTED_QC" in ds.variables else None
        TEMP_ADJ_ERR = normalize_array(ds, "TEMP_ADJUSTED_ERROR") if "TEMP_ADJUSTED_ERROR" in ds.variables else None
        TEMP_ADJ_QC = normalize_array(ds, "TEMP_ADJUSTED_QC") if "TEMP_ADJUSTED_QC" in ds.variables else None
        PSAL_ADJ_ERR = normalize_array(ds, "PSAL_ADJUSTED_ERROR") if "PSAL_ADJUSTED_ERROR" in ds.variables else None
        PSAL_ADJ_QC = normalize_array(ds, "PSAL_ADJUSTED_QC") if "PSAL_ADJUSTED_QC" in ds.variables else None
        offset_info = None
        for cand in ['PRES_ADJUSTED', 'DEPTH', 'DEPTH_ADJUSTED']:
            if cand in ds.variables and cand != pres_name:
                alt = normalize_array(ds, cand)
                if alt is None or PRES is None:
                    continue
                try:
                    pres_flat = np.array(PRES).reshape(-1)
                    alt_flat = np.array(alt).reshape(-1)
                    mask = np.isfinite(pres_flat) & np.isfinite(alt_flat)
                    if mask.sum() >= 5:
                        offset = float(np.mean(pres_flat[mask] - alt_flat[mask]))
                        offset_info = {"alt_name": cand, "offset_mean": offset, "n_points": int(mask.sum())}
                        break
                except Exception:
                    continue
        meta = {}
        for key in ['PLATFORM_NUMBER','CYCLE_NUMBER','JULD','JULD_LOCATION','LATITUDE','LONGITUDE',
                     'PI_NAME','PROJECT_NAME',
                     'JULD_QC','POSITION_QC','DATA_MODE','DIRECTION',
                     'PLATFORM_TYPE','WMO_INST_TYPE','FLOAT_SERIAL_NO',
                     'VERTICAL_SAMPLING_SCHEME','CONFIG_MISSION_NUMBER',
                     'POSITIONING_SYSTEM','DATA_STATE_INDICATOR','DC_REFERENCE',
                     'PARAMETER_DATA_MODE']:
            if key in ds.variables:
                try:
                    v = ds[key].values
                    if np.ndim(v) > 0:
                        v = v.flatten()[0]
                    if isinstance(v, (bytes, np.bytes_)):
                        v = v.decode("utf-8", errors="replace").strip()
                    meta[key] = v
                except Exception:
                    meta[key] = ds.attrs.get(key, None)
            else:
                meta[key] = ds.attrs.get(key, None)
        for k in METADATA_FIELDS:
            if k in ds.variables:
                try:
                    v = ds[k].values
                    if np.ndim(v) > 0:
                        v = v.flatten()[0]
                    if isinstance(v, (bytes, np.bytes_)):
                        v = v.decode("utf-8", errors="replace").strip()
                    meta[k] = v
                except Exception:
                    meta[k] = ds.attrs.get(k, None)
            else:
                meta[k] = ds.attrs.get(k, None)
        bgc_list = detect_bgc_in_ds(ds)
        bgc_arrays = {}
        bgc_attrs = {}
        for v in bgc_list:
            try:
                bgc_arrays[v] = normalize_array(ds, v)
                try:
                    bgc_attrs[v] = dict(ds[v].attrs)
                except Exception:
                    bgc_attrs[v] = {}
            except Exception:
                bgc_arrays[v] = None
                bgc_attrs[v] = {}
        profile_key = ensure_profile_key(nc_path, ds)
        source_file = os.path.abspath(nc_path)
        source_filename = os.path.basename(nc_path)
        ds.close()

        # Compute depth only if explicit DEPTH absent AND we can compute with gsw & latitude
        if DEPTH is None and PRES is not None:
            lat = meta.get("LATITUDE")
            try:
                if isinstance(lat, (np.ndarray, list, tuple)):
                    lat = float(np.array(lat).reshape(-1)[0])
                elif isinstance(lat, (np.bytes_, bytes)):
                    lat = float(lat.decode("utf-8", errors="replace"))
                elif lat is not None:
                    lat = float(lat)
            except Exception:
                lat = None

            if lat is None:
                raise RuntimeError(f"Latitude missing/invalid in file {source_filename}; required for TEOS-10 depth computation.")

            if gsw is None:
                raise RuntimeError("gsw library required for pressure->depth conversion. Install with 'pip install gsw' and re-run.")

            DEPTH = pressure_to_depth(PRES, latitude=lat)

        # calibrate bgc arrays (best-effort)
        try:
            profile_vars = {
                "TEMP_ADJ": TEMP_ADJ, "TEMP_RAW": TEMP_RAW,
                "PSAL_ADJ": PSAL_ADJ, "PSAL_RAW": PSAL_RAW,
                "PRES": PRES
            }
            calibrated_bgc = calibrate_bgc_arrays(bgc_arrays, bgc_attrs, meta, profile_vars)
            bgc_arrays = calibrated_bgc
        except Exception as e:
            print(f"Warning: BGC calibration step failed for {source_filename}: {e}")

        return {
            "nc_path": source_file,
            "nc_filename": source_filename,
            "profile_key": profile_key,
            "pres_name": pres_name,
            "depth_name": depth_name,
            "temp_raw_name": temp_raw_name,
            "temp_adj_name": temp_adj_name,
            "psal_raw_name": psal_raw_name,
            "psal_adj_name": psal_adj_name,
            "PRES": PRES,
            "DEPTH": DEPTH,
            "TEMP_RAW": TEMP_RAW,
            "TEMP_ADJ": TEMP_ADJ,
            "PSAL_RAW": PSAL_RAW,
            "PSAL_ADJ": PSAL_ADJ,
            "PRES_QC": PRES_QC,
            "TEMP_QC": TEMP_QC,
            "PSAL_QC": PSAL_QC,
            # NEW: adjusted values, errors, adjusted QC
            "PRES_ADJ": PRES_ADJ,
            "PRES_ADJ_ERR": PRES_ADJ_ERR,
            "PRES_ADJ_QC": PRES_ADJ_QC,
            "TEMP_ADJ_ERR": TEMP_ADJ_ERR,
            "TEMP_ADJ_QC": TEMP_ADJ_QC,
            "PSAL_ADJ_ERR": PSAL_ADJ_ERR,
            "PSAL_ADJ_QC": PSAL_ADJ_QC,
            "offset_info": offset_info,
            "meta": meta,
            "bgc_present": len(bgc_list) > 0,
            "bgc_vars": bgc_list,
            "bgc_arrays": bgc_arrays,
            "bgc_attrs": bgc_attrs
        }
    except Exception:
        ds.close()
        raise

# ----------------------
# DB utilities & schema (updated columns)
# ----------------------
def connect_db(dsn: str):
    if psycopg2 is None:
        raise RuntimeError("psycopg2 not installed. Install with pip install psycopg2-binary.")
    safe = sanitize_dsn(dsn) if dsn else dsn
    conn = psycopg2.connect(safe)
    conn.autocommit = False
    return conn

def ensure_tables(conn):
    cur = conn.cursor()
    cur.execute("""
    CREATE TABLE IF NOT EXISTS file_metadata (
        profile_key TEXT PRIMARY KEY,
        file_hash TEXT,
        source_filename TEXT,
        source_file TEXT,
        data_type TEXT,
        format_version TEXT,
        handbook_version TEXT,
        reference_date_time TEXT,
        date_creation TEXT,
        date_update TEXT,
        platform_number TEXT,
        project_name TEXT,
        pi_name TEXT,
        data_centre TEXT,
        -- NEW: critical queryable metadata
        cycle_number INTEGER,
        juld TIMESTAMP WITH TIME ZONE,
        juld_qc TEXT,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        position_qc TEXT,
        data_mode TEXT,
        direction TEXT,
        platform_type TEXT,
        wmo_inst_type TEXT,
        float_serial_no TEXT,
        vertical_sampling_scheme TEXT,
        config_mission_number INTEGER,
        station_parameters JSONB,
        raw_attrs JSONB,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS core_levels (
        profile_key TEXT,
        level_index INTEGER,
        pressure DOUBLE PRECISION,
        depth DOUBLE PRECISION,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        pres_variable TEXT,
        temperature DOUBLE PRECISION,
        temperature_adjusted DOUBLE PRECISION,
        salinity DOUBLE PRECISION,
        salinity_adjusted DOUBLE PRECISION,
        -- NEW: adjusted values + error bounds + separate adjusted QC
        pressure_adjusted DOUBLE PRECISION,
        pressure_adjusted_error DOUBLE PRECISION,
        pres_adjusted_qc TEXT,
        temperature_adjusted_error DOUBLE PRECISION,
        temp_adjusted_qc TEXT,
        salinity_adjusted_error DOUBLE PRECISION,
        sal_adjusted_qc TEXT,
        -- existing QC (raw)
        pres_qc TEXT,
        temp_qc TEXT,
        sal_qc TEXT,
        source_filename TEXT,
        source_file TEXT,
        raw_metadata JSONB,
        PRIMARY KEY (profile_key, level_index)
    );
    """)
    # bgc_levels extended with the requested new variables (only here), generic 'bbp' removed
    cur.execute("""
    CREATE TABLE IF NOT EXISTS bgc_levels (
        profile_key TEXT,
        level_index INTEGER,
        pressure DOUBLE PRECISION,
        depth DOUBLE PRECISION,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        pres_variable TEXT,
        doxy DOUBLE PRECISION,
        doxy_qc TEXT,
        doxy_adjusted DOUBLE PRECISION,
        doxy_adjusted_qc TEXT,
        doxy_dpres DOUBLE PRECISION,
        chla DOUBLE PRECISION,
        chla_qc TEXT,
        chla_adjusted DOUBLE PRECISION,
        chla_adjusted_qc TEXT,
        chla_dpres DOUBLE PRECISION,
        chla_fluorescence DOUBLE PRECISION,
        chla_fluorescence_qc TEXT,
        bbp700 DOUBLE PRECISION,
        bbp700_qc TEXT,
        bbp700_adjusted DOUBLE PRECISION,
        bbp700_adjusted_qc TEXT,
        bbp700_dpres DOUBLE PRECISION,
        -- NEW BBP spectral products
        bbp_470 DOUBLE PRECISION,
        bbp_470_qc TEXT,
        bbp_532 DOUBLE PRECISION,
        bbp_532_qc TEXT,
        -- NEW CDOM / NITRATE / PH fields
        cdom DOUBLE PRECISION,
        cdom_qc TEXT,
        nitrate DOUBLE PRECISION,
        nitrate_qc TEXT,
        nitrate_adjusted DOUBLE PRECISION,
        nitrate_adjusted_qc TEXT,
        nitrate_adjusted_error DOUBLE PRECISION,
        ph_in_situ_total DOUBLE PRECISION,
        ph_qc TEXT,
        -- NEW: DOXY error, O₂ sensor temperature, B-phase
        doxy_adjusted_error DOUBLE PRECISION,
        temp_doxy DOUBLE PRECISION,
        temp_doxy_qc TEXT,
        bphase_doxy DOUBLE PRECISION,
        bphase_doxy_qc TEXT,
        source_filename TEXT,
        source_file TEXT,
        raw_metadata JSONB,
        PRIMARY KEY (profile_key, level_index)
    );
    """)
    cur.execute("""
    CREATE TABLE IF NOT EXISTS profile_summaries (
        profile_key TEXT,
        summary_id SERIAL PRIMARY KEY,
        model_name TEXT,
        summary_text TEXT,
        summary_json JSONB,
        summary_generated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    """)

    # ── Schema migration: add new columns to existing tables if they don't exist ──
    _alter_stmts = [
        # file_metadata new columns
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS cycle_number INTEGER",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS juld TIMESTAMP WITH TIME ZONE",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS juld_qc TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS position_qc TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS data_mode TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS direction TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS platform_type TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS wmo_inst_type TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS float_serial_no TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS vertical_sampling_scheme TEXT",
        "ALTER TABLE file_metadata ADD COLUMN IF NOT EXISTS config_mission_number INTEGER",
        # core_levels new columns
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS pressure_adjusted DOUBLE PRECISION",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS pressure_adjusted_error DOUBLE PRECISION",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS pres_adjusted_qc TEXT",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS temperature_adjusted_error DOUBLE PRECISION",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS temp_adjusted_qc TEXT",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS salinity_adjusted_error DOUBLE PRECISION",
        "ALTER TABLE core_levels ADD COLUMN IF NOT EXISTS sal_adjusted_qc TEXT",
        # bgc_levels new columns
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS nitrate_adjusted DOUBLE PRECISION",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS nitrate_adjusted_qc TEXT",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS nitrate_adjusted_error DOUBLE PRECISION",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS doxy_adjusted_error DOUBLE PRECISION",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS temp_doxy DOUBLE PRECISION",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS temp_doxy_qc TEXT",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS bphase_doxy DOUBLE PRECISION",
        "ALTER TABLE bgc_levels ADD COLUMN IF NOT EXISTS bphase_doxy_qc TEXT",
    ]
    for stmt in _alter_stmts:
        try:
            cur.execute(stmt)
        except Exception:
            pass  # column already exists or table doesn't exist yet

    conn.commit()
    cur.close()

def profile_already_processed(conn, profile_key: str, file_hash: Optional[str]) -> bool:
    cur = conn.cursor()
    try:
        if file_hash:
            cur.execute("SELECT file_hash FROM file_metadata WHERE profile_key = %s LIMIT 1", (str(profile_key),))
            row = cur.fetchone()
            if row:
                existing_hash = row[0]
                if existing_hash == file_hash:
                    return True
                return False
        cur.execute("SELECT 1 FROM file_metadata WHERE profile_key = %s LIMIT 1", (str(profile_key),))
        exists = cur.fetchone() is not None
        return exists
    finally:
        cur.close()

def _meta_str(meta, key):
    """Extract a string metadata value, handling numpy/bytes types."""
    v = meta.get(key)
    if v is None:
        return None
    if isinstance(v, (bytes, np.bytes_)):
        return v.decode("utf-8", errors="replace").strip()
    if isinstance(v, (np.ndarray, list, tuple)):
        try:
            v = np.array(v).flatten()[0]
            if isinstance(v, (bytes, np.bytes_)):
                return v.decode("utf-8", errors="replace").strip()
        except Exception:
            pass
    return str(v)

def _meta_float(meta, key):
    """Extract a float metadata value, handling numpy/array types."""
    v = meta.get(key)
    if v is None:
        return None
    try:
        if isinstance(v, (np.ndarray, list, tuple)):
            v = float(np.array(v).reshape(-1)[0])
        else:
            v = float(v)
        return v if np.isfinite(v) else None
    except Exception:
        return None

def _meta_int(meta, key):
    """Extract an integer metadata value."""
    v = meta.get(key)
    if v is None:
        return None
    try:
        if isinstance(v, (np.ndarray, list, tuple)):
            v = np.array(v).reshape(-1)[0]
        return int(v)
    except Exception:
        return None

def _meta_timestamp(meta, key):
    """Extract a timestamp metadata value (JULD -> datetime)."""
    v = meta.get(key)
    if v is None:
        return None
    try:
        ts = pd.to_datetime(v)
        if pd.isna(ts):
            return None
        return ts.isoformat()
    except Exception:
        return None

def insert_or_update_file_metadata(cur, profile_key: str, file_hash: Optional[str], filename: str, filepath: str, meta: dict):
    upsert_sql = """
    INSERT INTO file_metadata
      (profile_key, file_hash, source_filename, source_file,
       data_type, format_version, handbook_version, reference_date_time,
       date_creation, date_update, platform_number, project_name,
       pi_name, data_centre,
       cycle_number, juld, juld_qc, latitude, longitude, position_qc,
       data_mode, direction, platform_type, wmo_inst_type,
       float_serial_no, vertical_sampling_scheme, config_mission_number,
       station_parameters, raw_attrs)
    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
    ON CONFLICT (profile_key) DO UPDATE SET
      file_hash=EXCLUDED.file_hash,
      source_filename=EXCLUDED.source_filename,
      source_file=EXCLUDED.source_file,
      data_type=EXCLUDED.data_type,
      format_version=EXCLUDED.format_version,
      handbook_version=EXCLUDED.handbook_version,
      reference_date_time=EXCLUDED.reference_date_time,
      date_creation=EXCLUDED.date_creation,
      date_update=EXCLUDED.date_update,
      platform_number=EXCLUDED.platform_number,
      project_name=EXCLUDED.project_name,
      pi_name=EXCLUDED.pi_name,
      data_centre=EXCLUDED.data_centre,
      cycle_number=EXCLUDED.cycle_number,
      juld=EXCLUDED.juld,
      juld_qc=EXCLUDED.juld_qc,
      latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude,
      position_qc=EXCLUDED.position_qc,
      data_mode=EXCLUDED.data_mode,
      direction=EXCLUDED.direction,
      platform_type=EXCLUDED.platform_type,
      wmo_inst_type=EXCLUDED.wmo_inst_type,
      float_serial_no=EXCLUDED.float_serial_no,
      vertical_sampling_scheme=EXCLUDED.vertical_sampling_scheme,
      config_mission_number=EXCLUDED.config_mission_number,
      station_parameters=EXCLUDED.station_parameters,
      raw_attrs=EXCLUDED.raw_attrs;
    """
    station_params = meta.get("STATION_PARAMETERS")
    station_json = psycopg2.extras.Json(make_json_serializable(station_params)) if station_params is not None and psycopg2 is not None else make_json_serializable(station_params)
    raw_json = psycopg2.extras.Json(make_json_serializable(meta)) if psycopg2 is not None else make_json_serializable(meta)
    cur.execute(upsert_sql, (
        str(profile_key), file_hash,
        str(filename) if filename is not None else None,
        str(filepath) if filepath is not None else None,
        _meta_str(meta, "DATA_TYPE"),
        _meta_str(meta, "FORMAT_VERSION"),
        _meta_str(meta, "HANDBOOK_VERSION"),
        _meta_str(meta, "REFERENCE_DATE_TIME"),
        _meta_str(meta, "DATE_CREATION"),
        _meta_str(meta, "DATE_UPDATE"),
        _meta_str(meta, "PLATFORM_NUMBER"),
        _meta_str(meta, "PROJECT_NAME"),
        _meta_str(meta, "PI_NAME"),
        _meta_str(meta, "DATA_CENTRE"),
        # NEW columns
        _meta_int(meta, "CYCLE_NUMBER"),
        _meta_timestamp(meta, "JULD"),
        _meta_str(meta, "JULD_QC"),
        _meta_float(meta, "LATITUDE"),
        _meta_float(meta, "LONGITUDE"),
        _meta_str(meta, "POSITION_QC"),
        _meta_str(meta, "DATA_MODE"),
        _meta_str(meta, "DIRECTION"),
        _meta_str(meta, "PLATFORM_TYPE"),
        _meta_str(meta, "WMO_INST_TYPE"),
        _meta_str(meta, "FLOAT_SERIAL_NO"),
        _meta_str(meta, "VERTICAL_SAMPLING_SCHEME"),
        _meta_int(meta, "CONFIG_MISSION_NUMBER"),
        station_json, raw_json
    ))

# ─── Module-level helpers for per-level value extraction ───
def numeric_at(arr, lvl):
    """Safely extract a numeric float from arr at index lvl; returns None on any failure."""
    if arr is None:
        return None
    try:
        a = np.array(arr).reshape(-1)
        if lvl < 0 or lvl >= a.size:
            return None
        v = a[lvl]
        if v is None:
            return None
        if isinstance(v, (np.floating, float, np.integer, int)):
            return float(v) if np.isfinite(v) else None
        if isinstance(v, (bytes, np.bytes_)):
            try:
                s = v.decode("utf-8", errors="replace").strip()
                return float(s) if s != "" else None
            except Exception:
                return None
        return float(v)
    except Exception:
        return None

def qc_at(arr, lvl):
    """Safely extract a QC string from arr at index lvl; returns None on failure."""
    if arr is None:
        return None
    try:
        a = np.array(arr).reshape(-1)
        if lvl < 0 or lvl >= a.size:
            return None
        v = a[lvl]
        if v is None:
            return None
        if isinstance(v, (bytes, np.bytes_)):
            return v.decode("utf-8", errors="replace").strip()
        return str(v)
    except Exception:
        return None

# ----------------------
# Upsert level data (core)
# ----------------------
def upsert_core_levels(cur, profile, batch_size=DEFAULT_INSERT_BATCH):
    pk = profile["profile_key"]
    PRES = profile.get("PRES")
    DEPTH = profile.get("DEPTH")
    TEMP_RAW = profile.get("TEMP_RAW")
    TEMP_ADJ = profile.get("TEMP_ADJ")
    PSAL_RAW = profile.get("PSAL_RAW")
    PSAL_ADJ = profile.get("PSAL_ADJ")
    PRES_QC = profile.get("PRES_QC")
    TEMP_QC = profile.get("TEMP_QC")
    PSAL_QC = profile.get("PSAL_QC")
    # NEW: adjusted values, errors, adjusted QC
    PRES_ADJ = profile.get("PRES_ADJ")
    PRES_ADJ_ERR = profile.get("PRES_ADJ_ERR")
    PRES_ADJ_QC = profile.get("PRES_ADJ_QC")
    TEMP_ADJ_ERR = profile.get("TEMP_ADJ_ERR")
    TEMP_ADJ_QC = profile.get("TEMP_ADJ_QC")
    PSAL_ADJ_ERR = profile.get("PSAL_ADJ_ERR")
    PSAL_ADJ_QC = profile.get("PSAL_ADJ_QC")
    lat_val = None
    lon_val = None
    try:
        lat_val = profile.get("meta", {}).get("LATITUDE")
        lon_val = profile.get("meta", {}).get("LONGITUDE")
        if isinstance(lat_val, (np.ndarray, list, tuple)):
            lat_val = float(np.array(lat_val).reshape(-1)[0])
        if isinstance(lon_val, (np.ndarray, list, tuple)):
            lon_val = float(np.array(lon_val).reshape(-1)[0])
    except Exception:
        lat_val = lon_val = None
    pres_variable = profile.get("pres_name")
    # determine n_levels robustly
    if PRES is not None:
        n_levels = int(np.array(PRES).size)
    else:
        lens = []
        for arr in (TEMP_RAW, TEMP_ADJ, PSAL_RAW, PSAL_ADJ, DEPTH):
            if arr is not None:
                try:
                    lens.append(int(np.array(arr).size))
                except Exception:
                    pass
        n_levels = int(max(lens)) if lens else 0
    insert_sql = """
    INSERT INTO core_levels
      (profile_key, level_index, pressure, depth, latitude, longitude, pres_variable,
       temperature, temperature_adjusted, salinity, salinity_adjusted,
       pressure_adjusted, pressure_adjusted_error, pres_adjusted_qc,
       temperature_adjusted_error, temp_adjusted_qc,
       salinity_adjusted_error, sal_adjusted_qc,
       pres_qc, temp_qc, sal_qc,
       source_filename, source_file, raw_metadata)
    VALUES %s
    ON CONFLICT (profile_key, level_index) DO UPDATE SET
      pressure=EXCLUDED.pressure,
      depth=EXCLUDED.depth,
      latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude,
      pres_variable=EXCLUDED.pres_variable,
      temperature=EXCLUDED.temperature,
      temperature_adjusted=EXCLUDED.temperature_adjusted,
      salinity=EXCLUDED.salinity,
      salinity_adjusted=EXCLUDED.salinity_adjusted,
      pressure_adjusted=EXCLUDED.pressure_adjusted,
      pressure_adjusted_error=EXCLUDED.pressure_adjusted_error,
      pres_adjusted_qc=EXCLUDED.pres_adjusted_qc,
      temperature_adjusted_error=EXCLUDED.temperature_adjusted_error,
      temp_adjusted_qc=EXCLUDED.temp_adjusted_qc,
      salinity_adjusted_error=EXCLUDED.salinity_adjusted_error,
      sal_adjusted_qc=EXCLUDED.sal_adjusted_qc,
      pres_qc=EXCLUDED.pres_qc,
      temp_qc=EXCLUDED.temp_qc,
      sal_qc=EXCLUDED.sal_qc,
      raw_metadata=EXCLUDED.raw_metadata;
    """
    rows = []
    written = 0
    for lvl in range(n_levels):
        pres_v = None
        try:
            if PRES is not None and lvl < np.array(PRES).size:
                pv = np.array(PRES).reshape(-1)[lvl]
                if np.isfinite(pv):
                    pres_v = float(pv)
        except Exception:
            pres_v = None
        depth_v = None
        try:
            if DEPTH is not None and lvl < np.array(DEPTH).size:
                dv = np.array(DEPTH).reshape(-1)[lvl]
                if np.isfinite(dv):
                    depth_v = float(dv)
            if depth_v is None and pres_v is not None:
                # compute depth per-level using gsw if available and lat exists
                if gsw is None:
                    depth_v = None
                else:
                    if lat_val is not None:
                        try:
                            darr = pressure_to_depth(np.array([pres_v]), latitude=lat_val)
                            if darr is not None and darr.size > 0 and np.isfinite(darr[0]):
                                depth_v = float(darr[0])
                            else:
                                depth_v = None
                        except Exception:
                            depth_v = None
                    else:
                        depth_v = None
        except Exception:
            depth_v = None
        temp_raw_v = None
        temp_adj_v = None
        try:
            if TEMP_RAW is not None and lvl < np.array(TEMP_RAW).size:
                tv = np.array(TEMP_RAW).reshape(-1)[lvl]
                if np.isfinite(tv):
                    temp_raw_v = float(tv)
            if TEMP_ADJ is not None and lvl < np.array(TEMP_ADJ).size:
                tav = np.array(TEMP_ADJ).reshape(-1)[lvl]
                if np.isfinite(tav):
                    temp_adj_v = float(tav)
            if temp_raw_v is None and temp_adj_v is not None:
                temp_raw_v = temp_adj_v
            if temp_adj_v is None and temp_raw_v is not None:
                temp_adj_v = temp_raw_v
        except Exception:
            temp_raw_v = temp_adj_v = None
        sal_raw_v = None
        sal_adj_v = None
        try:
            if PSAL_RAW is not None and lvl < np.array(PSAL_RAW).size:
                sv = np.array(PSAL_RAW).reshape(-1)[lvl]
                if np.isfinite(sv):
                    sal_raw_v = float(sv)
            if PSAL_ADJ is not None and lvl < np.array(PSAL_ADJ).size:
                sav = np.array(PSAL_ADJ).reshape(-1)[lvl]
                if np.isfinite(sav):
                    sal_adj_v = float(sav)
            if sal_raw_v is None and sal_adj_v is not None:
                sal_raw_v = sal_adj_v
            if sal_adj_v is None and sal_raw_v is not None:
                sal_adj_v = sal_raw_v
        except Exception:
            sal_raw_v = sal_adj_v = None
        pres_qc_v = None
        temp_qc_v = None
        sal_qc_v = None
        try:
            if PRES_QC is not None and lvl < np.array(PRES_QC).size:
                pv = np.array(PRES_QC).reshape(-1)[lvl]
                pres_qc_v = pv.decode("utf-8", errors="replace").strip() if isinstance(pv, (bytes, np.bytes_)) else str(pv)
        except Exception:
            pres_qc_v = None
        try:
            if TEMP_QC is not None and lvl < np.array(TEMP_QC).size:
                v = np.array(TEMP_QC).reshape(-1)[lvl]
                temp_qc_v = v.decode("utf-8", errors="replace").strip() if isinstance(v, (bytes, np.bytes_)) else str(v)
        except Exception:
            temp_qc_v = None
        try:
            if PSAL_QC is not None and lvl < np.array(PSAL_QC).size:
                v = np.array(PSAL_QC).reshape(-1)[lvl]
                sal_qc_v = v.decode("utf-8", errors="replace").strip() if isinstance(v, (bytes, np.bytes_)) else str(v)
        except Exception:
            sal_qc_v = None

        # NEW: adjusted values, errors, adjusted QC
        pres_adj_v = numeric_at(PRES_ADJ, lvl) if PRES_ADJ is not None else None
        pres_adj_err_v = numeric_at(PRES_ADJ_ERR, lvl) if PRES_ADJ_ERR is not None else None
        pres_adj_qc_v = qc_at(PRES_ADJ_QC, lvl) if PRES_ADJ_QC is not None else None
        temp_adj_err_v = numeric_at(TEMP_ADJ_ERR, lvl) if TEMP_ADJ_ERR is not None else None
        temp_adj_qc_v = qc_at(TEMP_ADJ_QC, lvl) if TEMP_ADJ_QC is not None else None
        sal_adj_err_v = numeric_at(PSAL_ADJ_ERR, lvl) if PSAL_ADJ_ERR is not None else None
        sal_adj_qc_v = qc_at(PSAL_ADJ_QC, lvl) if PSAL_ADJ_QC is not None else None

        raw_meta = {}
        raw_meta_json = psycopg2.extras.Json(make_json_serializable(raw_meta)) if psycopg2 is not None else make_json_serializable(raw_meta)
        rows.append((
            str(pk), int(lvl), pres_v, depth_v, lat_val, lon_val, str(pres_variable) if pres_variable is not None else None,
            temp_raw_v, temp_adj_v, sal_raw_v, sal_adj_v,
            pres_adj_v, pres_adj_err_v, pres_adj_qc_v,
            temp_adj_err_v, temp_adj_qc_v,
            sal_adj_err_v, sal_adj_qc_v,
            pres_qc_v, temp_qc_v, sal_qc_v,
            str(profile.get("nc_filename")) if profile.get("nc_filename") is not None else None,
            str(profile.get("nc_path")) if profile.get("nc_path") is not None else None,
            raw_meta_json
        ))
        if len(rows) >= batch_size:
            psycopg2.extras.execute_values(cur, insert_sql, rows, template=None, page_size=batch_size)
            written += len(rows)
            rows = []
    if rows:
        psycopg2.extras.execute_values(cur, insert_sql, rows, template=None, page_size=batch_size)
        written += len(rows)
    return written

# ----------------------
# Upsert bgc_levels (extended with requested fields; generic bbp removed)
# ----------------------
def upsert_bgc_levels(cur, profile, batch_size=DEFAULT_INSERT_BATCH):
    """
    Extended to handle CDOM, NITRATE, PH_IN_SITU_TOTAL, BBP470, BBP532.
    Uses bgc_arrays (already linear-calibrated by extract_profile/calibrate_bgc_arrays).
    Generic 'bbp' removed.
    """
    pk = profile["profile_key"]
    PRES = profile.get("PRES")
    DEPTH = profile.get("DEPTH")
    bgc_arrays = profile.get("bgc_arrays", {})
    bgc_attrs = profile.get("bgc_attrs", {}) or {}
    PRES_QC = profile.get("PRES_QC")
    lat_val = None
    lon_val = None
    try:
        lat_val = profile.get("meta", {}).get("LATITUDE")
        lon_val = profile.get("meta", {}).get("LONGITUDE")
        if isinstance(lat_val, (np.ndarray, list, tuple)):
            lat_val = float(np.array(lat_val).reshape(-1)[0])
        if isinstance(lon_val, (np.ndarray, list, tuple)):
            lon_val = float(np.array(lon_val).reshape(-1)[0])
    except Exception:
        lat_val = lon_val = None
    pres_variable = profile.get("pres_name")
    if PRES is not None:
        n_levels = int(np.array(PRES).size)
    else:
        lens = []
        for arr in (profile.get("TEMP_RAW"), profile.get("TEMP_ADJ"), profile.get("PSAL_RAW"), profile.get("PSAL_ADJ")):
            if arr is not None:
                try:
                    lens.append(int(np.array(arr).size))
                except Exception:
                    pass
        for arr in bgc_arrays.values():
            if arr is not None:
                try:
                    lens.append(int(np.array(arr).size))
                except Exception:
                    pass
        if DEPTH is not None:
            try:
                lens.append(int(np.array(DEPTH).size))
            except Exception:
                pass
        n_levels = int(max(lens)) if lens else 0

    def find_array(token):
        for k in bgc_arrays:
            if k.lower() == token.lower():
                return bgc_arrays[k]
        for k in bgc_arrays:
            if token.lower() in k.lower():
                return bgc_arrays[k]
        return None

    def first_found(*tokens):
        """Return the first non-None array from a list of token names.
        Cannot use `or` with numpy arrays (ambiguous truth value)."""
        for t in tokens:
            arr = find_array(t)
            if arr is not None:
                return arr
        return None

    # numeric_at() and qc_at() are now module-level functions

    insert_sql = """
    INSERT INTO bgc_levels
    (profile_key, level_index, pressure, depth, latitude, longitude, pres_variable,
     doxy, doxy_qc, doxy_adjusted, doxy_adjusted_qc, doxy_dpres,
     doxy_adjusted_error, temp_doxy, temp_doxy_qc, bphase_doxy, bphase_doxy_qc,
     chla, chla_qc, chla_adjusted, chla_adjusted_qc, chla_dpres, chla_fluorescence, chla_fluorescence_qc,
     bbp700, bbp700_qc, bbp700_adjusted, bbp700_adjusted_qc, bbp700_dpres,
     bbp_470, bbp_470_qc, bbp_532, bbp_532_qc,
     cdom, cdom_qc,
     nitrate, nitrate_qc, nitrate_adjusted, nitrate_adjusted_qc, nitrate_adjusted_error,
     ph_in_situ_total, ph_qc,
     source_filename, source_file, raw_metadata)
    VALUES %s
    ON CONFLICT (profile_key, level_index) DO UPDATE SET
      pressure=EXCLUDED.pressure,
      depth=EXCLUDED.depth,
      latitude=EXCLUDED.latitude,
      longitude=EXCLUDED.longitude,
      pres_variable=EXCLUDED.pres_variable,
      doxy=EXCLUDED.doxy,
      doxy_qc=EXCLUDED.doxy_qc,
      doxy_adjusted=EXCLUDED.doxy_adjusted,
      doxy_adjusted_qc=EXCLUDED.doxy_adjusted_qc,
      doxy_dpres=EXCLUDED.doxy_dpres,
      doxy_adjusted_error=EXCLUDED.doxy_adjusted_error,
      temp_doxy=EXCLUDED.temp_doxy,
      temp_doxy_qc=EXCLUDED.temp_doxy_qc,
      bphase_doxy=EXCLUDED.bphase_doxy,
      bphase_doxy_qc=EXCLUDED.bphase_doxy_qc,
      chla=EXCLUDED.chla,
      chla_qc=EXCLUDED.chla_qc,
      chla_adjusted=EXCLUDED.chla_adjusted,
      chla_adjusted_qc=EXCLUDED.chla_adjusted_qc,
      chla_dpres=EXCLUDED.chla_dpres,
      chla_fluorescence=EXCLUDED.chla_fluorescence,
      chla_fluorescence_qc=EXCLUDED.chla_fluorescence_qc,
      bbp700=EXCLUDED.bbp700,
      bbp700_qc=EXCLUDED.bbp700_qc,
      bbp700_adjusted=EXCLUDED.bbp700_adjusted,
      bbp700_adjusted_qc=EXCLUDED.bbp700_adjusted_qc,
      bbp700_dpres=EXCLUDED.bbp700_dpres,
      bbp_470=EXCLUDED.bbp_470,
      bbp_470_qc=EXCLUDED.bbp_470_qc,
      bbp_532=EXCLUDED.bbp_532,
      bbp_532_qc=EXCLUDED.bbp_532_qc,
      cdom=EXCLUDED.cdom,
      cdom_qc=EXCLUDED.cdom_qc,
      nitrate=EXCLUDED.nitrate,
      nitrate_qc=EXCLUDED.nitrate_qc,
      nitrate_adjusted=EXCLUDED.nitrate_adjusted,
      nitrate_adjusted_qc=EXCLUDED.nitrate_adjusted_qc,
      nitrate_adjusted_error=EXCLUDED.nitrate_adjusted_error,
      ph_in_situ_total=EXCLUDED.ph_in_situ_total,
      ph_qc=EXCLUDED.ph_qc,
      raw_metadata=EXCLUDED.raw_metadata;
    """

    rows = []
    written = 0

    # pre-find arrays to avoid repeated searching inside loop
    doxy_arr = find_array("DOXY")
    doxy_adj_arr = find_array("DOXY_ADJUSTED")
    doxy_qc_arr = find_array("DOXY_QC")
    doxy_adj_qc_arr = find_array("DOXY_ADJUSTED_QC")
    doxy_dpres_arr = first_found("DOXY_dPRES", "DOXY_DPRES")

    chla_arr = find_array("CHLA")
    chla_adj_arr = find_array("CHLA_ADJUSTED")
    chla_qc_arr = find_array("CHLA_QC")
    chla_adj_qc_arr = find_array("CHLA_ADJUSTED_QC")
    chla_dpres_arr = find_array("CHLA_dPRES")
    chla_fluo_arr = find_array("CHLA_FLUORESCENCE")
    chla_fluo_qc_arr = find_array("CHLA_FLUORESCENCE_QC")

    bbp700_arr = first_found("BBP700", "BBP_700", "BBP700_ADJUSTED")
    bbp700_adj_arr = find_array("BBP700_ADJUSTED")
    bbp700_qc_arr = find_array("BBP700_QC")
    bbp700_adj_qc_arr = find_array("BBP700_ADJUSTED_QC")
    bbp700_dpres_arr = first_found("BBP700_dPRES", "BBP700_DPRES")

    # CDOM candidates
    cdom_arr = first_found("CDOM", "A_CDOM", "ACDOM")
    cdom_qc_arr = first_found("CDOM_QC", "A_CDOM_QC")

    # Nitrate candidates
    nitrate_arr = first_found("NITRATE", "NO3", "NO3_WATER", "NITRATE_ADJUSTED")
    nitrate_qc_arr = find_array("NITRATE_QC")
    nitrate_adj_arr = find_array("NITRATE_ADJUSTED")
    nitrate_adj_qc_arr = find_array("NITRATE_ADJUSTED_QC")
    nitrate_adj_err_arr = find_array("NITRATE_ADJUSTED_ERROR")

    # pH candidates
    ph_arr = first_found("PH_IN_SITU_TOTAL", "PH", "PH_IN_SITU")
    ph_qc_arr = find_array("PH_QC")

    # NEW: DOXY error, sensor temperature (TEMP_DOXY), B-phase (BPHASE_DOXY)
    doxy_adj_err_arr = find_array("DOXY_ADJUSTED_ERROR")
    temp_doxy_arr = find_array("TEMP_DOXY")
    temp_doxy_qc_arr = find_array("TEMP_DOXY_QC")
    bphase_doxy_arr = first_found("BPHASE_DOXY", "BPHASE_DOXY2")
    bphase_doxy_qc_arr = first_found("BPHASE_DOXY_QC", "BPHASE_DOXY2_QC")

    # Pre-cache BBP470/532 arrays (avoid repeated find_array inside loop)
    bbp470_arr = find_array("BBP470")
    bbp532_arr = find_array("BBP532")
    bbp470_qc_arr = find_array("BBP470_QC")
    bbp532_qc_arr = find_array("BBP532_QC")

    # ── Pre-compute BBP spectral derivation ONCE (constant across levels) ──
    import re as _re
    eta = None
    try:
        for k, attrs in bgc_attrs.items():
            s = _get_attr_case_insensitive(attrs, ["eta", "spectral_slope", "spectral_slope_eta"])
            if s is not None:
                try:
                    eta = float(s)
                    break
                except Exception:
                    continue
    except Exception:
        eta = None
    if eta is None:
        eta = DEFAULT_BBP_SPECTRAL_SLOPE

    ref_lambda = None
    ref_arr = None
    try:
        for k in bgc_arrays:
            if "bbp" in k.lower():
                m = _re.search(r'(\d{3})', k)
                if m:
                    ref_lambda = float(m.group(1))
                    ref_arr = bgc_arrays[k]
                    break
        if ref_lambda is None and bbp700_arr is not None:
            ref_lambda = 700.0
            ref_arr = bbp700_arr
    except Exception:
        ref_lambda = None
        ref_arr = None

    # Pre-compute full spectral arrays (only once, not per-level)
    derived_bbp470_arr = None
    derived_bbp532_arr = None
    if ref_arr is not None and ref_lambda is not None:
        if bbp470_arr is None:
            try:
                derived_bbp470_arr = compute_bbp_spectral_conversion(ref_arr, ref_lambda, 470.0, eta)
            except Exception:
                derived_bbp470_arr = None
        if bbp532_arr is None:
            try:
                derived_bbp532_arr = compute_bbp_spectral_conversion(ref_arr, ref_lambda, 532.0, eta)
            except Exception:
                derived_bbp532_arr = None

    # Pre-flatten PRES/DEPTH once instead of re-creating np arrays each level
    _pres_flat = np.array(PRES).reshape(-1) if PRES is not None else None
    _depth_flat = np.array(DEPTH).reshape(-1) if DEPTH is not None else None

    for lvl in range(n_levels):
        pres_v = None
        try:
            if _pres_flat is not None and lvl < _pres_flat.size:
                pv = _pres_flat[lvl]
                if np.isfinite(pv):
                    pres_v = float(pv)
        except Exception:
            pres_v = None

        depth_v = None
        try:
            if _depth_flat is not None and lvl < _depth_flat.size:
                dv = _depth_flat[lvl]
                if np.isfinite(dv):
                    depth_v = float(dv)
            if depth_v is None and pres_v is not None:
                if gsw is not None and lat_val is not None:
                    try:
                        darr = pressure_to_depth(np.array([pres_v]), latitude=lat_val)
                        if darr is not None and darr.size > 0 and np.isfinite(darr[0]):
                            depth_v = float(darr[0])
                    except Exception:
                        depth_v = None
        except Exception:
            depth_v = None

        # BGC numeric extraction (existing vars)
        doxy_v = numeric_at(doxy_arr, lvl) if doxy_arr is not None else None
        doxy_adj_v = numeric_at(doxy_adj_arr, lvl) if doxy_adj_arr is not None else None
        if doxy_v is None and doxy_adj_v is not None:
            doxy_v = doxy_adj_v
        doxy_qc_v = qc_at(doxy_qc_arr, lvl) if doxy_qc_arr is not None else None
        doxy_adj_qc_v = qc_at(doxy_adj_qc_arr, lvl) if doxy_adj_qc_arr is not None else None
        doxy_dpres_v = numeric_at(doxy_dpres_arr, lvl) if doxy_dpres_arr is not None else None

        chla_v = numeric_at(chla_arr, lvl) if chla_arr is not None else None
        chla_adj_v = numeric_at(chla_adj_arr, lvl) if chla_adj_arr is not None else None
        if chla_v is None and chla_adj_v is not None:
            chla_v = chla_adj_v
        chla_qc_v = qc_at(chla_qc_arr, lvl) if chla_qc_arr is not None else None
        chla_adj_qc_v = qc_at(chla_adj_qc_arr, lvl) if chla_adj_qc_arr is not None else None
        chla_dpres_v = numeric_at(chla_dpres_arr, lvl) if chla_dpres_arr is not None else None
        chla_flu_v = numeric_at(chla_fluo_arr, lvl) if chla_fluo_arr is not None else None
        chla_flu_qc_v = qc_at(chla_fluo_qc_arr, lvl) if chla_fluo_qc_arr is not None else None

        bbp700_v = numeric_at(bbp700_arr, lvl) if bbp700_arr is not None else None
        bbp700_adj_v = numeric_at(bbp700_adj_arr, lvl) if bbp700_adj_arr is not None else None
        if bbp700_v is None and bbp700_adj_v is not None:
            bbp700_v = bbp700_adj_v
        bbp700_qc_v = qc_at(bbp700_qc_arr, lvl) if bbp700_qc_arr is not None else None
        bbp700_adj_qc_v = qc_at(bbp700_adj_qc_arr, lvl) if bbp700_adj_qc_arr is not None else None
        bbp700_dpres_v = numeric_at(bbp700_dpres_arr, lvl) if bbp700_dpres_arr is not None else None

        # BBP 470/532: use explicit data first, then fall back to derived spectral
        bbp470_v = numeric_at(bbp470_arr, lvl) if bbp470_arr is not None else None
        bbp532_v = numeric_at(bbp532_arr, lvl) if bbp532_arr is not None else None

        if bbp470_v is None and derived_bbp470_arr is not None:
            bbp470_v = numeric_at(derived_bbp470_arr, lvl)
        if bbp532_v is None and derived_bbp532_arr is not None:
            bbp532_v = numeric_at(derived_bbp532_arr, lvl)

        # cdom, nitrate, pH - prefer explicit
        cdom_v = numeric_at(cdom_arr, lvl) if cdom_arr is not None else None
        nitrate_v = numeric_at(nitrate_arr, lvl) if nitrate_arr is not None else None
        ph_v = numeric_at(ph_arr, lvl) if ph_arr is not None else None

        cdom_qc_v = qc_at(cdom_qc_arr, lvl) if cdom_qc_arr is not None else None
        nitrate_qc_v = qc_at(nitrate_qc_arr, lvl) if nitrate_qc_arr is not None else None
        ph_qc_v = qc_at(ph_qc_arr, lvl) if ph_qc_arr is not None else None

        # NEW: nitrate adjusted + error
        nitrate_adj_v = numeric_at(nitrate_adj_arr, lvl) if nitrate_adj_arr is not None else None
        nitrate_adj_qc_v = qc_at(nitrate_adj_qc_arr, lvl) if nitrate_adj_qc_arr is not None else None
        nitrate_adj_err_v = numeric_at(nitrate_adj_err_arr, lvl) if nitrate_adj_err_arr is not None else None

        # NEW: DOXY adjusted error, TEMP_DOXY, BPHASE_DOXY
        doxy_adj_err_v = numeric_at(doxy_adj_err_arr, lvl) if doxy_adj_err_arr is not None else None
        temp_doxy_v = numeric_at(temp_doxy_arr, lvl) if temp_doxy_arr is not None else None
        temp_doxy_qc_v = qc_at(temp_doxy_qc_arr, lvl) if temp_doxy_qc_arr is not None else None
        bphase_doxy_v = numeric_at(bphase_doxy_arr, lvl) if bphase_doxy_arr is not None else None
        bphase_doxy_qc_v = qc_at(bphase_doxy_qc_arr, lvl) if bphase_doxy_qc_arr is not None else None

        bbp_470_qc_v = qc_at(bbp470_qc_arr, lvl) if bbp470_qc_arr is not None else None
        bbp_532_qc_v = qc_at(bbp532_qc_arr, lvl) if bbp532_qc_arr is not None else None

        raw_meta_json = psycopg2.extras.Json(make_json_serializable({})) if psycopg2 is not None else make_json_serializable({})

        rows.append((
            str(pk), int(lvl), pres_v, depth_v, lat_val, lon_val, str(pres_variable) if pres_variable is not None else None,
            doxy_v, doxy_qc_v, doxy_adj_v, doxy_adj_qc_v, doxy_dpres_v,
            doxy_adj_err_v, temp_doxy_v, temp_doxy_qc_v, bphase_doxy_v, bphase_doxy_qc_v,
            chla_v, chla_qc_v, chla_adj_v, chla_adj_qc_v, chla_dpres_v, chla_flu_v, chla_flu_qc_v,
            bbp700_v, bbp700_qc_v, bbp700_adj_v, bbp700_adj_qc_v, bbp700_dpres_v,
            bbp470_v, bbp_470_qc_v, bbp532_v, bbp_532_qc_v,
            cdom_v, cdom_qc_v,
            nitrate_v, nitrate_qc_v, nitrate_adj_v, nitrate_adj_qc_v, nitrate_adj_err_v,
            ph_v, ph_qc_v,
            str(profile.get("nc_filename")) if profile.get("nc_filename") is not None else None,
            str(profile.get("nc_path")) if profile.get("nc_path") is not None else None,
            raw_meta_json
        ))
        if len(rows) >= batch_size:
            psycopg2.extras.execute_values(cur, insert_sql, rows, template=None, page_size=batch_size)
            written += len(rows)
            rows = []
    if rows:
        psycopg2.extras.execute_values(cur, insert_sql, rows, template=None, page_size=batch_size)
        written += len(rows)
    return written

# ----------------------
# Profile upsert and batch control (unchanged)
# ----------------------
def upsert_profile(conn, profile: Dict[str, Any], dry_run: bool=False, batch_size:int=DEFAULT_INSERT_BATCH, reprocess: bool=False):
    if conn is None and not dry_run:
        raise RuntimeError("DB connection required for upsert unless dry-run or no-db.")
    pk = profile["profile_key"]
    meta = profile.get("meta", {})
    file_hash = profile.get("_file_hash", None)
    target_is_bgc = profile.get("bgc_present", False)
    if dry_run:
        PRES = profile.get("PRES")
        if PRES is not None:
            return int(np.array(PRES).size)
        lengths = []
        for arr in (profile.get("TEMP_RAW"), profile.get("TEMP_ADJ"), profile.get("PSAL_RAW"), profile.get("PSAL_ADJ")):
            if arr is not None:
                try:
                    lengths.append(int(np.array(arr).size))
                except Exception:
                    pass
        for arr in profile.get("bgc_arrays", {}).values():
            if arr is not None:
                try:
                    lengths.append(int(np.array(arr).size))
                except Exception:
                    pass
        return int(max(lengths)) if lengths else 0
    cur = conn.cursor()
    try:
        if not reprocess:
            if profile_already_processed(conn, pk, file_hash):
                cur.close()
                return 0
        insert_or_update_file_metadata(cur, pk, file_hash, profile.get("nc_filename"), profile.get("nc_path"), meta)
        rows_written = 0
        if target_is_bgc:
            rows_written = upsert_bgc_levels(cur, profile, batch_size=batch_size)
        else:
            rows_written = upsert_core_levels(cur, profile, batch_size=batch_size)
        conn.commit()
        cur.close()
        return rows_written
    except Exception:
        conn.rollback()
        cur.close()
        raise

def list_nc_files(path: Optional[str], process_all: bool) -> List[str]:
    if path:
        if os.path.isdir(path):
            files = [os.path.join(path, f) for f in os.listdir(path) if f.lower().endswith(".nc")]
            files.sort()
            return files
        elif os.path.isfile(path) and path.lower().endswith(".nc"):
            return [path]
        else:
            raise FileNotFoundError(f"Path not found or not a .nc file: {path}")
    else:
        source_dir = os.path.join(os.getcwd(), "source_files")
        if os.path.isdir(source_dir):
            files = [os.path.join(source_dir, f) for f in os.listdir(source_dir) if f.lower().endswith(".nc")]
            files.sort()
            if files:
                return files
        files = [os.path.join(os.getcwd(), f) for f in os.listdir(".") if f.lower().endswith(".nc")]
        files.sort()
        return files

def _build_parquet_rows(profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Build a list of row-dicts suitable for Parquet export from a parsed profile."""
    PRES = profile.get("PRES")
    DEPTH = profile.get("DEPTH")
    TEMP_RAW = profile.get("TEMP_RAW")
    TEMP_ADJ = profile.get("TEMP_ADJ")
    PSAL_RAW = profile.get("PSAL_RAW")
    PSAL_ADJ = profile.get("PSAL_ADJ")
    # NEW adjusted error/QC arrays
    PRES_ADJ = profile.get("PRES_ADJ")
    PRES_ADJ_ERR = profile.get("PRES_ADJ_ERR")
    PRES_ADJ_QC = profile.get("PRES_ADJ_QC")
    TEMP_ADJ_ERR = profile.get("TEMP_ADJ_ERR")
    TEMP_ADJ_QC = profile.get("TEMP_ADJ_QC")
    PSAL_ADJ_ERR = profile.get("PSAL_ADJ_ERR")
    PSAL_ADJ_QC = profile.get("PSAL_ADJ_QC")
    PRES_QC = profile.get("PRES_QC")
    TEMP_QC = profile.get("TEMP_QC")
    PSAL_QC = profile.get("PSAL_QC")

    meta = profile.get("meta", {})
    pk = profile.get("profile_key", "")
    lat_val = meta.get("LATITUDE")
    lon_val = meta.get("LONGITUDE")
    try:
        if isinstance(lat_val, (np.ndarray, list, tuple)):
            lat_val = float(np.array(lat_val).reshape(-1)[0])
        if isinstance(lon_val, (np.ndarray, list, tuple)):
            lon_val = float(np.array(lon_val).reshape(-1)[0])
    except Exception:
        lat_val = lon_val = None

    n_levels = 0
    if PRES is not None:
        n_levels = int(np.array(PRES).size)
    else:
        lens = []
        for arr in (TEMP_RAW, TEMP_ADJ, PSAL_RAW, PSAL_ADJ, DEPTH):
            if arr is not None:
                try:
                    lens.append(int(np.array(arr).size))
                except Exception:
                    pass
        n_levels = int(max(lens)) if lens else 0

    rows = []
    for i in range(n_levels):
        row = {
            "profile_key": pk,
            "level_index": i,
            "platform_number": str(meta.get("PLATFORM_NUMBER", "")) if meta.get("PLATFORM_NUMBER") else None,
            "cycle_number": _meta_int(meta, "CYCLE_NUMBER"),
            "juld": _meta_timestamp(meta, "JULD"),
            "latitude": float(lat_val) if lat_val is not None else None,
            "longitude": float(lon_val) if lon_val is not None else None,
            "data_mode": _meta_str(meta, "DATA_MODE"),
            "direction": _meta_str(meta, "DIRECTION"),
            "pressure": numeric_at(PRES, i),
            "depth": numeric_at(DEPTH, i),
            "temperature": numeric_at(TEMP_RAW, i),
            "temperature_adjusted": numeric_at(TEMP_ADJ, i),
            "salinity": numeric_at(PSAL_RAW, i),
            "salinity_adjusted": numeric_at(PSAL_ADJ, i),
            # NEW: adjusted values + errors + QC
            "pressure_adjusted": numeric_at(PRES_ADJ, i),
            "pressure_adjusted_error": numeric_at(PRES_ADJ_ERR, i),
            "pres_qc": qc_at(PRES_QC, i),
            "pres_adjusted_qc": qc_at(PRES_ADJ_QC, i),
            "temperature_adjusted_error": numeric_at(TEMP_ADJ_ERR, i),
            "temp_qc": qc_at(TEMP_QC, i),
            "temp_adjusted_qc": qc_at(TEMP_ADJ_QC, i),
            "salinity_adjusted_error": numeric_at(PSAL_ADJ_ERR, i),
            "sal_qc": qc_at(PSAL_QC, i),
            "sal_adjusted_qc": qc_at(PSAL_ADJ_QC, i),
        }
        # Add BGC columns if present
        bgc_arrays = profile.get("bgc_arrays", {})
        for bgc_name, bgc_arr in bgc_arrays.items():
            col_name = bgc_name.lower()
            try:
                if bgc_arr is not None and i < np.array(bgc_arr).size:
                    v = np.array(bgc_arr).reshape(-1)[i]
                    row[col_name] = float(v) if np.isfinite(v) else None
                else:
                    row[col_name] = None
            except Exception:
                row[col_name] = None
        rows.append(row)
    return rows


def process_files(file_list: List[str], dsn: Optional[str], args, parse_only=False, write_parsed_csvs_for_inspection: bool=False):
    summary = {"processed_profiles": 0, "rows_written": 0, "errors": []}
    conn = None
    processed_dir = os.path.join(BASE_DIR, "processed")
    os.makedirs(processed_dir, exist_ok=True)
    if write_parsed_csvs_for_inspection or args.verify:
        parsed_csv_dir = os.path.join(BASE_DIR, "parsed_csvs")
        os.makedirs(parsed_csv_dir, exist_ok=True)
    force = getattr(args, "force", False)
    reprocess = getattr(args, "reprocess", False)
    if not parse_only:
        if not dsn:
            print("No DSN provided; switching to no-db mode.")
            parse_only = True
        else:
            try:
                conn = connect_db(dsn)
                if AUTO_CREATE_TABLES or args.create_tables:
                    ensure_tables(conn)
            except Exception as e:
                print("Warning: could not connect to DB; switching to no-db. Error:", e)
                conn = None
                parse_only = True
    for nc in file_list:
        start_t = time.time()
        try:
            fname = os.path.basename(nc)
            dest_path = os.path.join(processed_dir, fname)
            if os.path.exists(dest_path) and not force:
                print(f"Skipping {nc} (already in processed/).")
                continue
            profile = extract_profile(nc)
            try:
                profile_hash = file_sha256(nc)
                profile["_file_hash"] = profile_hash
            except Exception:
                profile["_file_hash"] = None
            pk = profile["profile_key"]
            print(f"\n--- Processing {fname} -> profile_key={pk} ---")
            if conn and not force and not reprocess:
                try:
                    if profile_already_processed(conn, pk, profile.get("_file_hash")):
                        print(f"Skipping DB ingest for {pk} (already processed). Moving file to processed/.")
                        try:
                            os.replace(nc, dest_path)
                        except Exception as e:
                            print("Warning: unable to move file to processed/:", e)
                        continue
                except Exception as e:
                    print("Warning: could not check processed state, will attempt ingest. Error:", e)
            if parse_only or conn is None:
                if write_parsed_csvs_for_inspection or args.verify:
                    PRES = profile.get("PRES")
                    TEMP_RAW = profile.get("TEMP_RAW")
                    TEMP_ADJ = profile.get("TEMP_ADJ")
                    PSAL_RAW = profile.get("PSAL_RAW")
                    PSAL_ADJ = profile.get("PSAL_ADJ")
                    DEPTH = profile.get("DEPTH")
                    lat_val = None
                    lon_val = None
                    try:
                        lat_val = profile.get("meta", {}).get("LATITUDE")
                        lon_val = profile.get("meta", {}).get("LONGITUDE")
                        if isinstance(lat_val, (np.ndarray, list, tuple)):
                            lat_val = float(np.array(lat_val).reshape(-1)[0])
                        if isinstance(lon_val, (np.ndarray, list, tuple)):
                            lon_val = float(np.array(lon_val).reshape(-1)[0])
                    except Exception:
                        lat_val = lon_val = None
                    pres_var = profile.get("pres_name")
                    n_levels = 0
                    try:
                        if PRES is not None:
                            n_levels = int(np.array(PRES).size)
                        else:
                            n_levels = max([arr.size for arr in (TEMP_RAW, TEMP_ADJ, PSAL_RAW, PSAL_ADJ, DEPTH) if arr is not None] or [0])
                    except Exception:
                        n_levels = 0
                    rows = []
                    for i in range(n_levels):
                        rows.append({
                            "level": i,
                            "nc_pres": float(PRES[i]) if (PRES is not None and i < np.array(PRES).size and np.isfinite(PRES[i])) else None,
                            "nc_depth": float(DEPTH[i]) if (DEPTH is not None and i < np.array(DEPTH).size and np.isfinite(DEPTH[i])) else None,
                            "latitude": float(lat_val) if lat_val is not None else None,
                            "longitude": float(lon_val) if lon_val is not None else None,
                            "pres_variable": pres_var,
                            "nc_temp_raw": float(TEMP_RAW[i]) if (TEMP_RAW is not None and i < np.array(TEMP_RAW).size and np.isfinite(TEMP_RAW[i])) else (float(TEMP_ADJ[i]) if (TEMP_ADJ is not None and i < np.array(TEMP_ADJ).size and np.isfinite(TEMP_ADJ[i])) else None),
                            "nc_temp_adj": float(TEMP_ADJ[i]) if (TEMP_ADJ is not None and i < np.array(TEMP_ADJ).size and np.isfinite(TEMP_ADJ[i])) else (float(TEMP_RAW[i]) if (TEMP_RAW is not None and i < np.array(TEMP_RAW).size and np.isfinite(TEMP_RAW[i])) else None),
                            "nc_psal_raw": float(PSAL_RAW[i]) if (PSAL_RAW is not None and i < np.array(PSAL_RAW).size and np.isfinite(PSAL_RAW[i])) else (float(PSAL_ADJ[i]) if (PSAL_ADJ is not None and i < np.array(PSAL_ADJ).size and np.isfinite(PSAL_ADJ[i])) else None),
                            "nc_psal_adj": float(PSAL_ADJ[i]) if (PSAL_ADJ is not None and i < np.array(PSAL_ADJ).size and np.isfinite(PSAL_ADJ[i])) else (float(PSAL_RAW[i]) if (PSAL_RAW is not None and i < np.array(PSAL_RAW).size and np.isfinite(PSAL_RAW[i])) else None)
                        })
                    df = pd.DataFrame(rows)
                    out_csv = args.diff_out or os.path.join(parsed_csv_dir, f"{os.path.splitext(fname)[0]}_parsed.csv")
                    df.to_csv(out_csv, index=False)
                    print(f"Parse-only CSV written: {out_csv}")
                    # Parquet export (structured format as required by PS 25040)
                    parquet_dir = os.path.join(BASE_DIR, "parquet")
                    os.makedirs(parquet_dir, exist_ok=True)
                    out_parquet = os.path.join(parquet_dir, f"{os.path.splitext(fname)[0]}.parquet")
                    try:
                        df.to_parquet(out_parquet, index=False, engine="pyarrow")
                        print(f"Parquet written: {out_parquet}")
                    except ImportError:
                        try:
                            df.to_parquet(out_parquet, index=False, engine="fastparquet")
                            print(f"Parquet written (fastparquet): {out_parquet}")
                        except ImportError:
                            print("Warning: No parquet engine (pyarrow/fastparquet). Skipping parquet export.")
                try:
                    os.replace(nc, dest_path)
                    print(f"Moved file to processed/ (parse-only): {dest_path}")
                except Exception as e:
                    print("Warning: could not move parsed-only file:", e)
                summary["processed_profiles"] += 1
                continue
            try:
                rows = upsert_profile(conn, profile, dry_run=args.dry_run, batch_size=DEFAULT_INSERT_BATCH, reprocess=reprocess)
                summary["rows_written"] += rows
                summary["processed_profiles"] += 1
                # Export Parquet alongside DB ingestion
                try:
                    parquet_dir = os.path.join(BASE_DIR, "parquet")
                    os.makedirs(parquet_dir, exist_ok=True)
                    out_parquet = os.path.join(parquet_dir, f"{os.path.splitext(fname)[0]}.parquet")
                    parquet_rows = _build_parquet_rows(profile)
                    if parquet_rows:
                        pq_df = pd.DataFrame(parquet_rows)
                        try:
                            pq_df.to_parquet(out_parquet, index=False, engine="pyarrow")
                        except ImportError:
                            try:
                                pq_df.to_parquet(out_parquet, index=False, engine="fastparquet")
                            except ImportError:
                                pass  # silently skip if no parquet engine
                        print(f"Parquet exported: {out_parquet}")
                except Exception as pq_e:
                    print(f"Warning: Parquet export failed: {pq_e}")
                try:
                    os.replace(nc, dest_path)
                    print(f"Moved file to processed/: {dest_path}")
                except Exception as e:
                    print("Warning: could not move processed file:", e)
                if AUTO_INSERT_SUMMARY and not args.dry_run:
                    try:
                        stats = compute_profile_stats(profile)
                        text = build_summary_text(pk, profile.get("meta", {}), stats)
                        insert_profile_summary(conn, pk, text, model_name=AUTO_SUMMARY_MODEL_NAME, summary_json=stats)
                        print("Inserted auto summary.")
                    except Exception as e:
                        print("Warning: auto summary insertion failed:", e)
                if args.verify:
                    try:
                        parsed_csv_dir = os.path.join(BASE_DIR, "parsed_csvs")
                        os.makedirs(parsed_csv_dir, exist_ok=True)
                        out_csv = args.diff_out or os.path.join(parsed_csv_dir, f"{os.path.splitext(fname)[0]}_diff.csv")
                        summary_res, _df = verify_against_db(conn, profile, out_csv=out_csv)
                        print("Verification:", summary_res)
                    except Exception as e:
                        print("Warning: verification failed:", e)
            except Exception as e:
                tb = traceback.format_exc()
                print(f"ERROR ingesting {nc} -> {e}\n{tb}")
                summary["errors"].append({"file": nc, "error": str(e)})
                continue
            elapsed = time.time() - start_t
            print(f"Finished {fname} in {elapsed:.1f}s")
        except Exception as e:
            tb = traceback.format_exc()
            print(f"ERROR processing {nc}: {e}\n{tb}")
            summary["errors"].append({"file": nc, "error": str(e)})
            continue
    if conn:
        conn.close()
    return summary

# ----------------------
# Verification & small stats (include depth & lat/lon in stats)
# ----------------------
def verify_against_db(conn, profile, out_csv: Optional[str] = None, tolerances: Tuple[float,float,float]=(0.05,0.0005,0.001)):
    pk = profile["profile_key"]
    PRES = profile.get("PRES")
    TEMP_RAW = profile.get("TEMP_RAW")
    TEMP_ADJ = profile.get("TEMP_ADJ")
    PSAL_RAW = profile.get("PSAL_RAW")
    PSAL_ADJ = profile.get("PSAL_ADJ")
    cur = conn.cursor()
    cur.execute("SELECT level_index, pressure, depth, temperature, temperature_adjusted, salinity, salinity_adjusted FROM core_levels WHERE profile_key = %s ORDER BY level_index", (str(pk),))
    db_rows = cur.fetchall()
    cur.close()
    if not db_rows:
        return None
    db_df = pd.DataFrame(db_rows, columns=['level_index', 'db_pressure', 'db_depth', 'db_temperature', 'db_temperature_adj', 'db_salinity', 'db_salinity_adj'])
    nc_len = int(np.array(PRES).size) if PRES is not None else max([arr.size for arr in (TEMP_RAW, TEMP_ADJ, PSAL_RAW, PSAL_ADJ) if arr is not None] or [0])
    db_len = len(db_df)
    n_check = min(nc_len, db_len)
    results = []
    pres_tol, temp_tol, psal_tol = tolerances
    pres_matches = temp_matches = psal_matches = 0
    for i in range(n_check):
        nc_pres = float(PRES[i]) if (PRES is not None and i < PRES.size and np.isfinite(PRES[i])) else None
        nc_temp = None
        if TEMP_RAW is not None and i < TEMP_RAW.size and np.isfinite(TEMP_RAW[i]):
            nc_temp = float(TEMP_RAW[i])
        elif TEMP_ADJ is not None and i < TEMP_ADJ.size and np.isfinite(TEMP_ADJ[i]):
            nc_temp = float(TEMP_ADJ[i])
        nc_psal = None
        if PSAL_RAW is not None and i < PSAL_RAW.size and np.isfinite(PSAL_RAW[i]):
            nc_psal = float(PSAL_RAW[i])
        elif PSAL_ADJ is not None and i < PSAL_ADJ.size and np.isfinite(PSAL_ADJ[i]):
            nc_psal = float(PSAL_ADJ[i])
        db_row = db_df.iloc[i]
        db_pres = float(db_row['db_pressure']) if db_row['db_pressure'] is not None else None
        db_temp = float(db_row['db_temperature']) if db_row['db_temperature'] is not None else None
        db_psal = float(db_row['db_salinity']) if db_row['db_salinity'] is not None else None
        pres_ok = (nc_pres is not None and db_pres is not None and abs(nc_pres - db_pres) <= pres_tol)
        temp_ok = (nc_temp is not None and db_temp is not None and abs(nc_temp - db_temp) <= temp_tol)
        psal_ok = (nc_psal is not None and db_psal is not None and abs(nc_psal - db_psal) <= psal_tol)
        pres_matches += 1 if pres_ok else 0
        temp_matches += 1 if temp_ok else 0
        psal_matches += 1 if psal_ok else 0
        results.append({
            "level": i,
            "nc_pres": nc_pres, "db_pres": db_pres,
            "nc_temp": nc_temp, "db_temp": db_temp,
            "nc_psal": nc_psal, "db_psal": db_psal,
            "pres_ok": pres_ok, "temp_ok": temp_ok, "psal_ok": psal_ok
        })
    total_checks = n_check * 3
    total_matched = pres_matches + temp_matches + psal_matches
    measurement_pct = (total_matched / total_checks * 100) if total_checks > 0 else None
    summary = {
        "n_levels_checked": n_check,
        "pres_matched": pres_matches,
        "temp_matched": temp_matches,
        "psal_matched": psal_matches,
        "measurement_pct": measurement_pct
    }
    df = pd.DataFrame(results)
    if out_csv:
        os.makedirs(os.path.dirname(out_csv) or ".", exist_ok=True)
        df.to_csv(out_csv, index=False)
    return summary, df

def insert_profile_summary(conn, profile_key: str, summary_text: str, model_name: str = AUTO_SUMMARY_MODEL_NAME, summary_json: Optional[Dict]=None):
    if conn is None:
        raise RuntimeError("DB connection required.")
    cur = conn.cursor()
    sj = psycopg2.extras.Json(make_json_serializable(summary_json)) if (psycopg2 is not None and summary_json is not None) else make_json_serializable(summary_json)
    cur.execute("DELETE FROM profile_summaries WHERE profile_key = %s AND model_name = %s", (str(profile_key), model_name))
    cur.execute("INSERT INTO profile_summaries (profile_key, model_name, summary_text, summary_json) VALUES (%s,%s,%s,%s)", (str(profile_key), model_name, summary_text, sj))
    conn.commit()
    cur.close()

def compute_profile_stats(profile):
    def arr_stats(arr):
        if arr is None:
            return {"count": 0, "min": None, "max": None, "mean": None}
        a = np.array(arr).astype(float).reshape(-1)
        a = a[np.isfinite(a)]
        if a.size == 0:
            return {"count": 0, "min": None, "max": None, "mean": None}
        return {"count": int(a.size), "min": float(np.min(a)), "max": float(np.max(a)), "mean": float(np.mean(a))}
    return {
        "pressure": arr_stats(profile.get("PRES")),
        "depth": arr_stats(profile.get("DEPTH")),
        "temp_raw": arr_stats(profile.get("TEMP_RAW")),
        "temp_adj": arr_stats(profile.get("TEMP_ADJ")),
        "psal_raw": arr_stats(profile.get("PSAL_RAW")),
        "psal_adj": arr_stats(profile.get("PSAL_ADJ"))
    }

def build_summary_text(profile_key, meta, stats):
    lines = [f"Profile: {profile_key}"]
    if meta.get("PLATFORM_NUMBER"):
        lines.append(f"Platform: {meta.get('PLATFORM_NUMBER')}")
    if meta.get("CYCLE_NUMBER") is not None:
        lines.append(f"Cycle: {meta.get('CYCLE_NUMBER')}")
    if meta.get("JULD") is not None:
        try:
            jdt = pd.to_datetime(meta.get("JULD"))
            lines.append(f"JULD: {jdt.isoformat()}")
        except Exception:
            lines.append(f"JULD: {meta.get('JULD')}")
    def s2(name, s):
        if s["count"] == 0:
            return f"{name}: no data"
        return f"{name}: count={s['count']}, min={s['min']}, max={s['max']}, mean={round(s['mean'],6)}"
    lines.append(s2("Pressure", stats["pressure"]))
    lines.append(s2("Depth", stats["depth"]))
    lines.append(s2("Temperature (raw)", stats["temp_raw"]))
    lines.append(s2("Temperature (adjusted)", stats["temp_adj"]))
    lines.append(s2("Salinity (raw)", stats["psal_raw"]))
    lines.append(s2("Salinity (adjusted)", stats["psal_adj"]))
    return "\n".join(lines)

# ----------------------
# CLI
# ----------------------
def parse_args():
    p = argparse.ArgumentParser(description="Robust batch NetCDF -> Postgres ingestion")
    p.add_argument("--nc", default=None, help="Single .nc file")
    p.add_argument("--dir", default=None, help="Directory of .nc files")
    p.add_argument("--dsn", default=None, help="Postgres DSN")
    p.add_argument("--process-all", action="store_true", help="Process all .nc files found")
    p.add_argument("--dry-run", action="store_true", help="Parse but do not write to DB")
    p.add_argument("--create-tables", action="store_true", help="Ensure DB tables exist")
    p.add_argument("--verify", action="store_true", help="Write diff CSV verification")
    p.add_argument("--diff-out", default=None, help="Path for verification CSV")
    p.add_argument("--no-db", action="store_true", help="Parse-only: don't connect to DB")
    p.add_argument("--force", action="store_true", help="Force reprocess even if processed/")
    p.add_argument("--reprocess", action="store_true", help="Reprocess even if file previously ingested (bypass hash check)")
    return p.parse_args()

def main():
    args = parse_args()
    no_cli_flags = (not args.nc and not args.dir and not args.process_all and not args.no_db and not args.create_tables and not args.verify)
    run_all = args.process_all or no_cli_flags
    if args.nc:
        file_list = list_nc_files(args.nc, process_all=False)
    else:
        target_dir = args.dir if args.dir else None
        file_list = list_nc_files(target_dir, process_all=run_all)
    if not file_list:
        print("No .nc files found. Exiting.")
        sys.exit(1)
    dsn = None
    if args.no_db:
        dsn = None
    else:
        if args.dsn:
            dsn = args.dsn
            print("Using DSN from --dsn flag.")
        elif DEFAULT_DSN:
            dsn = DEFAULT_DSN
            print("Using DSN from DATABASE_URL environment variable.")
        else:
            print("WARNING: No DATABASE_URL env var set. Set it in .env or pass --dsn.")
            print("Switching to no-db (parse-only) mode.")
            dsn = None
    if run_all:
        if dsn:
            try:
                conn = connect_db(dsn)
                ensure_tables(conn)
                conn.close()
                print("Tables ensured/created.")
            except Exception as e:
                print("Warning: could not create/ensure tables:", e)
        print("\nSTEP 2: Ingesting to DB (if DSN available)...")
        summary_db = process_files(file_list, dsn, args, parse_only=args.no_db or dsn is None, write_parsed_csvs_for_inspection=args.verify)
        print("\n=== RUN-ALL SUMMARY ===")
        print(f"Profiles ingested to DB: {summary_db.get('processed_profiles',0)}")
        print(f"Rows written to DB (approx): {summary_db.get('rows_written',0)}")
        print(f"Errors: {len(summary_db.get('errors',[]))}")
        return
    print(f"Files to process: {len(file_list)}")
    summary = process_files(file_list, dsn if not args.no_db else None, args, parse_only=args.no_db or (dsn is None), write_parsed_csvs_for_inspection=args.verify)
    print("\n=== INGEST SUMMARY ===")
    print(f"Profiles processed: {summary.get('processed_profiles',0)}")
    print(f"Approx rows written: {summary.get('rows_written',0)}")
    if summary.get('errors'):
        print(f"Errors for {len(summary['errors'])} files. See below:")
        for e in summary['errors']:
            print("-", e['file'], "->", e['error'])
    else:
        print("No processing errors.")
    print("======================")

if __name__ == "__main__":
    main()
