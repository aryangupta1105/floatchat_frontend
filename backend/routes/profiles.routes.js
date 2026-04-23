// routes/profiles.routes.js
const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

/**
 * GET /api/profiles
 * Returns depth-value profile data for a specific float.
 * Joins file_metadata → core_levels (and optionally bgc_levels).
 * Query params: float_id, parameter, start_date, end_date, min_depth, max_depth
 */
router.get("/", async (req, res) => {
  try {
    const {
      float_id,
      parameter = "temperature",
      start_date,
      end_date,
      min_depth = 0,
      max_depth = 2000
    } = req.query;

    if (!float_id) {
      return res.status(400).json({ error: "float_id is required" });
    }

    // Map frontend parameter name → DB column (table-qualified)
    const PARAM_COLUMN = {
      temperature: "cl.temperature_adjusted",
      salinity:    "cl.salinity_adjusted",
      oxygen:      "bl.doxy_adjusted",
      chlorophyll: "bl.chla_adjusted",
      nitrate:     "bl.nitrate_adjusted"
    };

    const col = PARAM_COLUMN[parameter] || "cl.temperature_adjusted";
    const isBgc = ["oxygen", "chlorophyll", "nitrate"].includes(parameter);

    const params = [float_id, Number(min_depth), Number(max_depth)];
    let paramIdx = 4;
    let dateFilter = "";

    if (start_date) {
      dateFilter += ` AND fm.juld >= $${paramIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ` AND fm.juld <= $${paramIdx++}`;
      params.push(end_date);
    }

    let sql;
    if (isBgc) {
      sql = `
        SELECT
          fm.profile_key,
          fm.juld            AS profile_date,
          fm.latitude,
          fm.longitude,
          cl.depth,
          cl.pressure,
          ${col}             AS value,
          cl.temperature_adjusted AS temperature,
          cl.salinity_adjusted    AS salinity
        FROM file_metadata fm
        JOIN core_levels cl ON cl.profile_key = fm.profile_key
        LEFT JOIN bgc_levels bl
               ON bl.profile_key = cl.profile_key
              AND bl.level_index  = cl.level_index
        WHERE fm.platform_number = $1
          AND cl.depth BETWEEN $2 AND $3
          ${dateFilter}
          AND ${col} IS NOT NULL
        ORDER BY fm.juld ASC, cl.depth ASC
        LIMIT 5000
      `;
    } else {
      sql = `
        SELECT
          fm.profile_key,
          fm.juld            AS profile_date,
          fm.latitude,
          fm.longitude,
          cl.depth,
          cl.pressure,
          ${col}             AS value,
          cl.temperature_adjusted AS temperature,
          cl.salinity_adjusted    AS salinity
        FROM file_metadata fm
        JOIN core_levels cl ON cl.profile_key = fm.profile_key
        WHERE fm.platform_number = $1
          AND cl.depth BETWEEN $2 AND $3
          ${dateFilter}
          AND ${col} IS NOT NULL
        ORDER BY fm.juld ASC, cl.depth ASC
        LIMIT 5000
      `;
    }

    const result = await query(sql, params);
    const rows = result.rows;

    // Group rows by profile_key into separate Plotly traces
    const profileMap = new Map();
    for (const row of rows) {
      const pk = row.profile_key;
      if (!profileMap.has(pk)) {
        const dateStr = row.profile_date
          ? new Date(row.profile_date).toISOString().slice(0, 10)
          : "";
        profileMap.set(pk, {
          profile_key: pk,
          label: `${float_id} — ${dateStr}`,
          date: row.profile_date,
          latitude:  row.latitude  != null ? Number(row.latitude)  : null,
          longitude: row.longitude != null ? Number(row.longitude) : null,
          depths:       [],
          values:       [],
          temperatures: [],
          salinities:   []
        });
      }
      const p = profileMap.get(pk);
      p.depths.push(row.depth != null ? Number(row.depth) : null);
      p.values.push(row.value != null ? Number(row.value) : null);
      p.temperatures.push(row.temperature != null ? Number(row.temperature) : null);
      p.salinities.push(row.salinity    != null ? Number(row.salinity)    : null);
    }

    const profiles = Array.from(profileMap.values());

    res.json({
      float_id,
      parameter,
      profile_count: profiles.length,
      profiles
    });
  } catch (err) {
    logger.error("GET /api/profiles error:", err);
    res.status(500).json({ error: "Failed to fetch profiles", detail: err.message });
  }
});

module.exports = router;
