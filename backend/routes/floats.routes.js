// routes/floats.routes.js
const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

// Region bounding boxes [lat_min, lat_max, lon_min, lon_max]
const REGION_BOUNDS = {
  indian_ocean:   [-60,  30,  20, 120],
  arabian_sea:    [  5,  30,  50,  80],
  bay_of_bengal:  [  5,  25,  80, 100],
  global:         [-90,  90, -180, 180]
};

/**
 * GET /api/floats
 * Returns distinct floats from file_metadata with region/date/depth filters.
 * Query params: region, parameter, start_date, end_date, min_depth, max_depth
 */
router.get("/", async (req, res) => {
  try {
    const {
      region = "indian_ocean",
      parameter = "temperature",
      start_date,
      end_date,
      min_depth = 0,
      max_depth = 2000
    } = req.query;

    const bounds = REGION_BOUNDS[region] || REGION_BOUNDS.global;
    const [latMin, latMax, lonMin, lonMax] = bounds;

    const params = [latMin, latMax, lonMin, lonMax];
    let paramIdx = 5;
    let dateFilter = "";
    let depthFilter = "";

    if (start_date) {
      dateFilter += ` AND fm.juld >= $${paramIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      dateFilter += ` AND fm.juld <= $${paramIdx++}`;
      params.push(end_date);
    }

    // For depth filter: join core_levels and check depth range
    if (Number(min_depth) > 0 || Number(max_depth) < 2000) {
      depthFilter = `
        AND fm.profile_key IN (
          SELECT DISTINCT profile_key FROM core_levels
          WHERE depth BETWEEN $${paramIdx++} AND $${paramIdx++}
        )
      `;
      params.push(Number(min_depth), Number(max_depth));
    }

    // For BGC parameter filter
    let bgcFilter = "";
    if (parameter === "oxygen") {
      bgcFilter = `AND fm.profile_key IN (SELECT DISTINCT profile_key FROM bgc_levels WHERE doxy_adjusted IS NOT NULL)`;
    } else if (parameter === "chlorophyll") {
      bgcFilter = `AND fm.profile_key IN (SELECT DISTINCT profile_key FROM bgc_levels WHERE chla_adjusted IS NOT NULL)`;
    } else if (parameter === "nitrate") {
      bgcFilter = `AND fm.profile_key IN (SELECT DISTINCT profile_key FROM bgc_levels WHERE nitrate IS NOT NULL)`;
    }

    const sql = `
      SELECT
        fm.platform_number                  AS float_id,
        fm.platform_number,
        fm.data_centre                      AS dac,
        COUNT(*)                            AS profile_count,
        AVG(fm.latitude)                    AS latitude,
        AVG(fm.longitude)                   AS longitude,
        MAX(fm.juld)                        AS last_seen,
        MIN(fm.juld)                        AS first_seen
      FROM file_metadata fm
      WHERE fm.latitude  BETWEEN $1 AND $2
        AND fm.longitude BETWEEN $3 AND $4
        AND fm.latitude  IS NOT NULL
        AND fm.longitude IS NOT NULL
        ${dateFilter}
        ${depthFilter}
        ${bgcFilter}
      GROUP BY fm.platform_number, fm.data_centre
      ORDER BY MAX(fm.juld) DESC NULLS LAST
      LIMIT 500
    `;

    const result = await query(sql, params);

    const floats = result.rows.map(r => ({
      float_id: r.float_id,
      platform_number: r.platform_number,
      dac: r.dac,
      profile_count: Number(r.profile_count),
      latitude: r.latitude != null ? Number(r.latitude) : null,
      longitude: r.longitude != null ? Number(r.longitude) : null,
      last_seen: r.last_seen,
      first_seen: r.first_seen
    }));

    res.json({ floats, count: floats.length, region, parameter });
  } catch (err) {
    logger.error("GET /api/floats error:", err);
    res.status(500).json({ error: "Failed to fetch floats", detail: err.message });
  }
});

/**
 * GET /api/floats/:floatId/trajectory
 * Returns per-cycle positions for a float (for trajectory map visualization)
 */
router.get("/:floatId/trajectory", async (req, res) => {
  try {
    const { floatId } = req.params;
    const result = await query(`
      SELECT
        fm.profile_key,
        fm.cycle_number,
        fm.juld          AS date,
        fm.latitude,
        fm.longitude
      FROM file_metadata fm
      WHERE fm.platform_number = $1
        AND fm.latitude  IS NOT NULL
        AND fm.longitude IS NOT NULL
      ORDER BY fm.juld ASC
    `, [floatId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "No trajectory data found for this float" });
    }

    const points = result.rows.map(r => ({
      profile_key:  r.profile_key,
      cycle_number: r.cycle_number != null ? Number(r.cycle_number) : null,
      date:         r.date,
      latitude:     Number(r.latitude),
      longitude:    Number(r.longitude)
    }));

    res.json({ float_id: floatId, point_count: points.length, points });
  } catch (err) {
    logger.error("GET /api/floats/:id/trajectory error:", err);
    res.status(500).json({ error: "Failed to fetch trajectory", detail: err.message });
  }
});

/**
 * GET /api/floats/:floatId
 * Returns metadata summary for a single float
 */
router.get("/:floatId", async (req, res) => {
  try {
    const { floatId } = req.params;
    const result = await query(`
      SELECT
        fm.platform_number                AS float_id,
        fm.platform_number,
        fm.data_centre                    AS dac,
        fm.project_name,
        fm.pi_name,
        COUNT(*)                          AS profile_count,
        MIN(fm.juld)                      AS first_seen,
        MAX(fm.juld)                      AS last_seen,
        AVG(fm.latitude)                  AS latitude,
        AVG(fm.longitude)                 AS longitude,
        EXISTS(
          SELECT 1 FROM bgc_levels bl
          JOIN file_metadata fm2 ON fm2.profile_key = bl.profile_key
          WHERE fm2.platform_number = $1 AND bl.doxy_adjusted IS NOT NULL
          LIMIT 1
        ) AS has_doxy,
        EXISTS(
          SELECT 1 FROM bgc_levels bl
          JOIN file_metadata fm2 ON fm2.profile_key = bl.profile_key
          WHERE fm2.platform_number = $1 AND bl.chla_adjusted IS NOT NULL
          LIMIT 1
        ) AS has_chla
      FROM file_metadata fm
      WHERE fm.platform_number = $1
      GROUP BY fm.platform_number, fm.data_centre, fm.project_name, fm.pi_name
    `, [floatId]);

    if (!result.rows.length) {
      return res.status(404).json({ error: "Float not found" });
    }
    res.json({ float: result.rows[0] });
  } catch (err) {
    logger.error("GET /api/floats/:id error:", err);
    res.status(500).json({ error: "Failed to fetch float", detail: err.message });
  }
});

module.exports = router;
