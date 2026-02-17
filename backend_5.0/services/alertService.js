// services/alertService.js
const AlertRule = require("../models/AlertRule");
const AlertEvent = require("../models/AlertEvent");
const sqlService = require("./sqlService");
const anomalyService = require("./anomalyService");
const { sendAlertEmail } = require("./emailService");
const { AppError } = require("../utils/error");
const { logger } = require("../utils/logger");

/**
 * Create new alert rule (from frontend payload).
 */
const createRule = async (payload) => {
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
    frequencyMinutes
  } = payload;

  if (!userId || !userEmail) {
    throw new AppError("userId and userEmail are required for alert rules", 400, "ALERT_USER_MISSING");
  }

  if (type === "threshold") {
    if (!parameter || !direction || threshold == null) {
      throw new AppError("Threshold rule missing parameter/direction/threshold", 400, "ALERT_INVALID");
    }
  }

  if (type === "anomaly") {
    if (!floatId) {
      throw new AppError("Anomaly rule requires a floatId", 400, "ALERT_INVALID");
    }
  }

  const rule = await AlertRule.create({
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
    frequencyMinutes
  });

  return rule;
};

const listRulesByUser = async (userId) => {
  return AlertRule.listByUser(userId);
};

const updateRule = async (userId, id, updates) => {
  const rule = await AlertRule.findById(id);
  if (!rule || rule.userId !== userId) {
    throw new AppError("Alert rule not found", 404, "ALERT_NOT_FOUND");
  }
  return AlertRule.update(id, updates);
};

const deleteRule = async (userId, id) => {
  const rule = await AlertRule.findById(id);
  if (!rule || rule.userId !== userId) {
    throw new AppError("Alert rule not found", 404, "ALERT_NOT_FOUND");
  }
  await AlertRule.remove(id);
};

/**
 * Called periodically by scheduler.
 * Returns list of fired alert events.
 */
const runDueAlerts = async () => {
  const rules = await AlertRule.listDueRules();
  const events = [];

  for (const rule of rules) {
    try {
      const triggered = await evaluateRule(rule);

      if (triggered) {
        const event = await AlertEvent.createFromRule(rule, triggered.details);
        events.push(event);

        // send email if enabled
        if (rule.channels.email && rule.userEmail) {
          const subject = `FloatChat Alert Triggered: ${rule.type === "threshold"
            ? `${rule.parameter} ${rule.direction} ${rule.threshold}`
            : `Anomaly on float ${rule.floatId}`}`;

          const text = [
            `Hello,`,
            "",
            `Your alert rule has been triggered:`,
            "",
            `Rule type: ${rule.type}`,
            rule.type === "threshold"
              ? `Condition: ${rule.parameter} ${rule.direction} ${rule.threshold}`
              : `Anomaly on float: ${rule.floatId}`,
            rule.region ? `Region: ${rule.region}` : "",
            rule.depthRange ? `Depth range: ${rule.depthRange}` : "",
            "",
            `Details:`,
            triggered.details.description || "See dashboard for more information.",
            "",
            `Time: ${new Date().toISOString()}`,
            "",
            `– FloatChat Alerts`
          ].join("\n");

          await sendAlertEmail({
            to: rule.userEmail,
            subject,
            text
          });
        }
      }

      await AlertRule.touchLastRun(rule.id);
    } catch (err) {
      logger.error("Error evaluating alert rule", { ruleId: rule.id, err });
    }
  }

  return events;
};

/**
 * Evaluate a single rule.
 * Returns:
 *   false -> not triggered
 *   { details: { description, dataSample, anomalyInfo } } -> triggered
 *
 * NOTE: The actual SQL queries here are placeholders.
 * You must adapt them to your real ARGO schema/tables.
 */
const evaluateRule = async (rule) => {
  if (rule.type === "threshold") {
    return evaluateThresholdRule(rule);
  }
  if (rule.type === "anomaly") {
    return evaluateAnomalyRule(rule);
  }
  return false;
};

const evaluateThresholdRule = async (rule) => {
  const { parameter, direction, threshold, floatId, region, depthRange } = rule;

  // TODO: Replace this with your real SQL logic.
  // Example idea:
  //
  // 1. Decide column name based on parameter
  // 2. Filter by region / floatId / depthRange
  // 3. Get latest / max / min value
  //
  // For now, we assume there is a view "latest_parameter_values":
  //
  // columns: float_id, parameter, value, region, depth_label

  const PARAM_COL = "value"; // numeric value column
  const PARAM_NAME = parameter; // temperature, salinity, etc.

  let sql = `
    SELECT value
    FROM latest_parameter_values
    WHERE parameter = $1
  `;
  const params = [PARAM_NAME];

  if (floatId) {
    sql += " AND float_id = $2";
    params.push(floatId);
  }

  // We are not implementing region/depthRange filters now – TODO for you
  sql += " ORDER BY observed_at DESC LIMIT 1";

  let latestValue = null;

  try {
    const result = await sqlService.execute(sql, params);
    if (result.rowCount > 0) {
      latestValue = Number(result.rows[0][PARAM_COL]);
    }
  } catch (err) {
    // If your DB doesn't have this view yet, we just log and skip
    logger.error("Threshold rule SQL failed (placeholder)", err);
    return false;
  }

  if (latestValue == null || Number.isNaN(latestValue)) {
    return false;
  }

  const crossed =
    direction === "above"
      ? latestValue > threshold
      : latestValue < threshold;

  if (!crossed) return false;

  const description = `Threshold crossed: ${parameter} is ${latestValue.toFixed(
    2
  )}, condition ${direction} ${threshold}.`;

  return {
    details: {
      description,
      dataSample: { latestValue }
    }
  };
};

const evaluateAnomalyRule = async (rule) => {
  const { floatId, parameter } = rule;

  // TODO: Replace with your real profile fetch + anomaly detection.
  // Rough idea:
  //  1. Fetch latest profile levels for floatId
  //  2. Use anomalyService.detect(...) on those rows
  //
  // Example placeholder SQL:
  const sql = `
    SELECT pressure, temperature, salinity, oxygen
    FROM core_levels
    WHERE profile_key IN (
      SELECT profile_key
      FROM profile_meta
      WHERE platform_number = $1
      ORDER BY juld DESC
      LIMIT 1
    )
    ORDER BY pressure ASC
  `;

  let rows = [];
  try {
    const result = await sqlService.execute(sql, [floatId]);
    rows = result.rows;
  } catch (err) {
    logger.error("Anomaly rule SQL failed (placeholder)", err);
    return false;
  }

  if (!rows.length) return false;

  // Use existing anomalyService on numeric data:
  const anomalies = await anomalyService.detect({
    rows,
    question: `Check anomaly for float ${floatId}`,
    context: { floatId },
    ragMeta: { intent: "anomaly_check" }
  });

  if (!anomalies.hasAnomaly) return false;

  const filteredPoints = parameter
    ? anomalies.points.filter((p) => p.raw[parameter] != null)
    : anomalies.points;

  if (!filteredPoints.length) return false;

  const description = anomalies.summary || `Anomaly detected for float ${floatId}.`;

  return {
    details: {
      description,
      anomalyInfo: anomalies,
      dataSample: rows.slice(0, 10)
    }
  };
};

module.exports = {
  createRule,
  listRulesByUser,
  updateRule,
  deleteRule,
  runDueAlerts
};
