// models/AlertEvent.js
const { query } = require("../config/db");

const TABLE = "alert_events";

/*
Suggested table:

CREATE TABLE alert_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL,
  alert_rule_id UUID NOT NULL REFERENCES alert_rules(id) ON DELETE CASCADE,
  description   TEXT NOT NULL,
  payload       JSONB,
  status        TEXT DEFAULT 'new',   -- 'new' | 'sent' | 'seen' etc.
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
*/

const mapRow = (row) => ({
  id: row.id,
  userId: row.user_id,
  alertRuleId: row.alert_rule_id,
  description: row.description,
  payload: row.payload,
  status: row.status,
  createdAt: row.created_at
});

const createFromRule = async (rule, details = {}) => {
  const description =
    details.description ||
    `Alert triggered for rule "${rule.type === "threshold"
      ? `${rule.parameter} ${rule.direction} ${rule.threshold}`
      : `Anomaly on float ${rule.floatId || "unknown"}`}"`;

  const payload = {
    rule: {
      id: rule.id,
      type: rule.type,
      parameter: rule.parameter,
      direction: rule.direction,
      threshold: rule.threshold,
      region: rule.region,
      depthRange: rule.depthRange,
      floatId: rule.floatId
    },
    dataSample: details.dataSample || null,
    anomalyInfo: details.anomalyInfo || null
  };

  const res = await query(
    `
      INSERT INTO ${TABLE}
      (user_id, alert_rule_id, description, payload, status)
      VALUES ($1, $2, $3, $4::jsonb, $5)
      RETURNING *
    `,
    [rule.userId, rule.id, description, JSON.stringify(payload), "new"]
  );

  return mapRow(res.rows[0]);
};

module.exports = {
  createFromRule
};
