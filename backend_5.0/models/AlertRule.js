// models/AlertRule.js
const { query } = require("../config/db");

const TABLE = "alert_rules";

/*
Suggested Postgres table:

CREATE TABLE alert_rules (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL,
  user_email        TEXT NOT NULL,
  type              TEXT NOT NULL,             -- 'threshold' | 'anomaly'
  parameter         TEXT,                      -- temperature, salinity, oxygen, etc. or NULL for "any"
  direction         TEXT,                      -- 'above' | 'below' (threshold only)
  threshold         DOUBLE PRECISION,          -- threshold numeric value (threshold only)
  region            TEXT,
  depth_range       TEXT,
  float_id          TEXT,
  channels_in_app   BOOLEAN DEFAULT TRUE,
  channels_email    BOOLEAN DEFAULT FALSE,
  frequency_minutes INT DEFAULT 60,
  enabled           BOOLEAN DEFAULT TRUE,
  last_run_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);
*/

const mapRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  userEmail: row.user_email,
  type: row.type,
  parameter: row.parameter,
  direction: row.direction,
  threshold: row.threshold,
  region: row.region,
  depthRange: row.depth_range,
  floatId: row.float_id,
  enabled: row.enabled,
  frequencyMinutes: row.frequency_minutes,
  channels: {
    inApp: row.channels_in_app,
    email: row.channels_email
  },
  lastRunAt: row.last_run_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const create = async (data) => {
  const {
    userId,
    userEmail,
    type,
    parameter,
    direction,
    threshold,
    region,
    depthRange,
    floatId,
    channels,
    frequencyMinutes = 60
  } = data;

  const res = await query(
    `
      INSERT INTO ${TABLE} 
      (
        user_id, user_email, type, parameter, direction, threshold,
        region, depth_range, float_id,
        channels_in_app, channels_email,
        frequency_minutes, enabled
      )
      VALUES
      ($1, $2, $3, $4, $5, $6,
       $7, $8, $9,
       $10, $11,
       $12, TRUE)
      RETURNING *
    `,
    [
      userId,
      userEmail,
      type,
      parameter || null,
      direction || null,
      threshold != null ? Number(threshold) : null,
      region || null,
      depthRange || null,
      floatId || null,
      channels?.inApp ?? true,
      channels?.email ?? false,
      frequencyMinutes
    ]
  );

  return mapRow(res.rows[0]);
};

const listByUser = async (userId) => {
  const res = await query(
    `
      SELECT * FROM ${TABLE}
      WHERE user_id = $1
      ORDER BY created_at DESC
    `,
    [userId]
  );

  return res.rows.map(mapRow);
};

const findById = async (id) => {
  const res = await query(
    `SELECT * FROM ${TABLE} WHERE id = $1`,
    [id]
  );
  if (!res.rows[0]) return null;
  return mapRow(res.rows[0]);
};

const update = async (id, fields) => {
  const allowed = [
    "parameter",
    "direction",
    "threshold",
    "region",
    "depthRange",
    "floatId",
    "enabled",
    "frequencyMinutes",
    "channels"
  ];
  const keys = Object.keys(fields).filter((k) => allowed.includes(k));
  if (keys.length === 0) return findById(id);

  const columns = [];
  const values = [id];

  keys.forEach((key, idx) => {
    if (key === "depthRange") {
      columns.push(`depth_range = $${idx + 2}`);
      values.push(fields.depthRange);
    } else if (key === "floatId") {
      columns.push(`float_id = $${idx + 2}`);
      values.push(fields.floatId);
    } else if (key === "channels") {
      if (typeof fields.channels.inApp === "boolean") {
        columns.push(`channels_in_app = $${idx + 2}`);
        values.push(fields.channels.inApp);
      }
      if (typeof fields.channels.email === "boolean") {
        columns.push(`channels_email = $${idx + 3}`);
        values.push(fields.channels.email);
      }
    } else {
      columns.push(`${camelToSnake(key)} = $${idx + 2}`);
      values.push(fields[key]);
    }
  });

  const setClause = columns.join(", ");

  const res = await query(
    `
      UPDATE ${TABLE}
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  return mapRow(res.rows[0]);
};

const remove = async (id) => {
  await query(`DELETE FROM ${TABLE} WHERE id = $1`, [id]);
};

const listDueRules = async () => {
  const res = await query(
    `
      SELECT *
      FROM ${TABLE}
      WHERE enabled = TRUE
      AND (
        last_run_at IS NULL OR
        NOW() - last_run_at > (frequency_minutes || ' minutes')::interval
      )
    `
  );
  return res.rows.map(mapRow);
};

const touchLastRun = async (id) => {
  await query(
    `
      UPDATE ${TABLE}
      SET last_run_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `,
    [id]
  );
};

// helper: convert camelCase to snake_case
function camelToSnake(str) {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

module.exports = {
  create,
  listByUser,
  findById,
  update,
  remove,
  listDueRules,
  touchLastRun
};
