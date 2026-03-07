// routes/dashboard.routes.js
const express = require("express");
const router = express.Router();
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

/**
 * GET /api/dashboard/stats
 * Returns KPI stats for the dashboard overview
 */
router.get("/stats", async (req, res) => {
  try {
    const [floatCount, profileCount, profiles6m, bgcCount, recentUpdate] = await Promise.all([
      query(`SELECT COUNT(DISTINCT platform_number) AS total FROM file_metadata`),
      query(`SELECT COUNT(*) AS total FROM file_metadata`),
      query(`SELECT COUNT(*) AS total FROM file_metadata WHERE juld >= NOW() - INTERVAL '6 months'`),
      query(`SELECT COUNT(DISTINCT fm.platform_number) AS total
             FROM file_metadata fm
             WHERE EXISTS (
               SELECT 1 FROM bgc_levels bl WHERE bl.profile_key = fm.profile_key
               AND (bl.doxy_adjusted IS NOT NULL OR bl.chla_adjusted IS NOT NULL)
             )`),
      query(`SELECT MAX(juld) AS latest FROM file_metadata`)
    ]);

    const total  = Number(floatCount.rows[0]?.total  || 0);
    const bgc    = Number(bgcCount.rows[0]?.total    || 0);
    res.json({
      total_floats:     total,
      total_profiles:   Number(profileCount.rows[0]?.total || 0),
      profiles_6months: Number(profiles6m.rows[0]?.total   || 0),
      bgc_floats:       bgc,
      core_floats:      Math.max(0, total - bgc),
      latest_update:    recentUpdate.rows[0]?.latest || null
    });
  } catch (err) {
    logger.error("GET /api/dashboard/stats error:", err);
    res.status(500).json({ error: "Failed to fetch stats", detail: err.message });
  }
});

/**
 * GET /api/dashboard/activity
 * Returns monthly profile activity trend for the chart
 */
router.get("/activity", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        TO_CHAR(DATE_TRUNC('month', juld), 'Mon') AS month,
        DATE_TRUNC('month', juld) AS month_date,
        COUNT(*) AS count
      FROM file_metadata
      WHERE juld >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', juld)
      ORDER BY month_date ASC
    `);

    res.json({
      months: result.rows.map(r => r.month),
      counts: result.rows.map(r => Number(r.count))
    });
  } catch (err) {
    logger.error("GET /api/dashboard/activity error:", err);
    res.status(500).json({ error: "Failed to fetch activity", detail: err.message });
  }
});

/**
 * GET /api/dashboard/user-stats
 * Returns real user + query analytics from users and chat_history tables
 */
router.get("/user-stats", async (req, res) => {
  try {
    const [
      totalUsers,
      totalQueries,
      todayQueries,
      yesterdayQueries,
      queryTypes,
      recentUsers,
      avgDuration,
      queriesPerDay
    ] = await Promise.all([
      query(`SELECT COUNT(*) AS total FROM users`),
      query(`SELECT COUNT(*) AS total FROM chat_history`),
      query(`SELECT COUNT(*) AS total FROM chat_history WHERE created_at >= CURRENT_DATE`),
      query(`SELECT COUNT(*) AS total FROM chat_history WHERE created_at >= CURRENT_DATE - INTERVAL '1 day' AND created_at < CURRENT_DATE`),
      query(`SELECT type, COUNT(*) AS count FROM chat_history WHERE type IS NOT NULL GROUP BY type ORDER BY count DESC`),
      query(`SELECT username, email, created_at FROM users ORDER BY created_at DESC LIMIT 5`),
      query(`SELECT ROUND(AVG(duration_ms)) AS avg_ms FROM chat_history WHERE duration_ms IS NOT NULL`),
      query(`
        SELECT
          TO_CHAR(DATE_TRUNC('day', created_at), 'Mon DD') AS day,
          DATE_TRUNC('day', created_at) AS day_date,
          COUNT(*) AS count
        FROM chat_history
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY day_date ASC
      `)
    ]);

    const todayCount     = Number(todayQueries.rows[0]?.total || 0);
    const yesterdayCount = Number(yesterdayQueries.rows[0]?.total || 0);
    const queryDelta     = yesterdayCount > 0
      ? Math.round(((todayCount - yesterdayCount) / yesterdayCount) * 100)
      : null;

    res.json({
      total_users:    Number(totalUsers.rows[0]?.total || 0),
      total_queries:  Number(totalQueries.rows[0]?.total || 0),
      today_queries:  todayCount,
      query_delta_pct: queryDelta,
      avg_response_ms: Number(avgDuration.rows[0]?.avg_ms || 0),
      query_types:    queryTypes.rows.map(r => ({ type: r.type, count: Number(r.count) })),
      recent_users:   recentUsers.rows,
      queries_per_day: {
        days:   queriesPerDay.rows.map(r => r.day),
        counts: queriesPerDay.rows.map(r => Number(r.count))
      }
    });
  } catch (err) {
    logger.error("GET /api/dashboard/user-stats error:", err);
    res.status(500).json({ error: "Failed to fetch user stats", detail: err.message });
  }
});

/**
 * GET /api/dashboard/depth-distribution
 * Returns histogram-style depth distribution of core_levels data
 */
router.get("/depth-distribution", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        CASE
          WHEN depth < 100   THEN '0-100'
          WHEN depth < 500   THEN '100-500'
          WHEN depth < 1000  THEN '500-1000'
          WHEN depth < 1500  THEN '1000-1500'
          WHEN depth < 2000  THEN '1500-2000'
          ELSE '2000+'
        END AS depth_bin,
        COUNT(*) AS count
      FROM core_levels
      WHERE depth IS NOT NULL
      GROUP BY depth_bin
      ORDER BY MIN(depth) ASC
    `);

    res.json({
      bins: result.rows.map(r => r.depth_bin),
      counts: result.rows.map(r => Number(r.count))
    });
  } catch (err) {
    logger.error("GET /api/dashboard/depth-distribution error:", err);
    res.status(500).json({ error: "Failed to fetch depth distribution", detail: err.message });
  }
});

/**
 * GET /api/dashboard/ts-sample
 * Returns a sample of temperature vs salinity data for a T-S diagram
 */
router.get("/ts-sample", async (req, res) => {
  try {
    const result = await query(`
      SELECT
        cl.temperature_adjusted AS temperature,
        cl.salinity_adjusted    AS salinity,
        cl.depth,
        fm.platform_number      AS float_id
      FROM core_levels cl
      JOIN file_metadata fm ON fm.profile_key = cl.profile_key
      WHERE cl.temperature_adjusted IS NOT NULL
        AND cl.salinity_adjusted    IS NOT NULL
        AND cl.depth IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 2000
    `);

    res.json({
      temperatures: result.rows.map(r => Number(r.temperature)),
      salinities:   result.rows.map(r => Number(r.salinity)),
      depths:       result.rows.map(r => Number(r.depth)),
      float_ids:    result.rows.map(r => r.float_id)
    });
  } catch (err) {
    logger.error("GET /api/dashboard/ts-sample error:", err);
    res.status(500).json({ error: "Failed to fetch T-S sample", detail: err.message });
  }
});

module.exports = router;
