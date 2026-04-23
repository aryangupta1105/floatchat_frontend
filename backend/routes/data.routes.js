// routes/data.routes.js
const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

/**
 * GET /api/data/download/csv?float_id=&start_date=&end_date=&parameter=
 * Returns CSV of core_levels for a float
 */
router.get("/download/csv", async (req, res) => {
  try {
    const { float_id, start_date, end_date, parameter = "temperature" } = req.query;
    if (!float_id) return res.status(400).json({ error: "float_id is required" });

    const params = [float_id];
    let dateFilter = "";
    let idx = 2;
    if (start_date) { dateFilter += ` AND fm.juld >= $${idx++}`; params.push(start_date); }
    if (end_date)   { dateFilter += ` AND fm.juld <= $${idx++}`; params.push(end_date); }

    const result = await query(`
      SELECT
        fm.platform_number  AS float_id,
        fm.profile_key,
        fm.juld             AS profile_date,
        fm.latitude,
        fm.longitude,
        cl.level_index,
        cl.pressure,
        cl.depth,
        cl.temperature_adjusted AS temperature,
        cl.salinity_adjusted    AS salinity,
        cl.pressure_adjusted
      FROM file_metadata fm
      JOIN core_levels cl ON cl.profile_key = fm.profile_key
      WHERE fm.platform_number = $1
        ${dateFilter}
      ORDER BY fm.juld ASC, cl.level_index ASC
      LIMIT 50000
    `, params);

    const rows = result.rows;
    if (!rows.length) return res.status(404).json({ error: "No data found" });

    const headers = Object.keys(rows[0]).join(",");
    const lines = rows.map(r =>
      Object.values(r).map(v => (v === null || v === undefined ? "" : String(v))).join(",")
    );
    const csv = [headers, ...lines].join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="float_${float_id}.csv"`);
    res.send(csv);
  } catch (err) {
    logger.error("GET /api/data/download/csv error:", err);
    res.status(500).json({ error: "Failed to generate CSV", detail: err.message });
  }
});

/**
 * GET /api/data/download/netcdf?float_id=
 * Returns JSON representation of NetCDF-like data structure
 * (actual NetCDF binary generation requires netcdf4 — returning structured JSON for now)
 */
router.get("/download/netcdf", async (req, res) => {
  try {
    const { float_id, start_date, end_date } = req.query;
    if (!float_id) return res.status(400).json({ error: "float_id is required" });

    const params = [float_id];
    let dateFilter = "";
    let idx = 2;
    if (start_date) { dateFilter += ` AND fm.juld >= $${idx++}`; params.push(start_date); }
    if (end_date)   { dateFilter += ` AND fm.juld <= $${idx++}`; params.push(end_date); }

    const result = await query(`
      SELECT
        fm.platform_number  AS float_id,
        fm.profile_key,
        fm.juld             AS profile_date,
        fm.latitude,
        fm.longitude,
        cl.level_index, cl.pressure, cl.depth,
        cl.temperature_adjusted AS temperature,
        cl.salinity_adjusted    AS salinity
      FROM file_metadata fm
      JOIN core_levels cl ON cl.profile_key = fm.profile_key
      WHERE fm.platform_number = $1
        ${dateFilter}
      ORDER BY fm.juld ASC, cl.level_index ASC
      LIMIT 50000
    `, params);

    const rows = result.rows;
    if (!rows.length) return res.status(404).json({ error: "No data found" });

    // Group into NetCDF-like structure
    const profileMap = new Map();
    for (const r of rows) {
      if (!profileMap.has(r.profile_key)) {
        profileMap.set(r.profile_key, {
          profile_key: r.profile_key,
          date: r.profile_date,
          latitude: Number(r.latitude),
          longitude: Number(r.longitude),
          PRES: [], DEPTH: [], TEMP: [], PSAL: []
        });
      }
      const p = profileMap.get(r.profile_key);
      p.PRES.push(r.pressure != null ? Number(r.pressure) : null);
      p.DEPTH.push(r.depth != null ? Number(r.depth) : null);
      p.TEMP.push(r.temperature != null ? Number(r.temperature) : null);
      p.PSAL.push(r.salinity != null ? Number(r.salinity) : null);
    }

    const nc = {
      float_id,
      global_attributes: {
        title: `Argo float ${float_id} profiles`,
        institution: "FloatChat",
        source: "Argo float"
      },
      dimensions: { N_PROF: profileMap.size },
      profiles: Array.from(profileMap.values())
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="float_${float_id}.nc.json"`);
    res.json(nc);
  } catch (err) {
    logger.error("GET /api/data/download/netcdf error:", err);
    res.status(500).json({ error: "Failed to generate NetCDF data", detail: err.message });
  }
});

module.exports = router;
