// services/anomalyService.js
const KEYWORDS = ["anomaly", "abnormal", "outlier", "unusual", "normal?"];

const shouldRun = (question, ragMeta) => {
  const q = (question || "").toLowerCase();
  if (KEYWORDS.some((kw) => q.includes(kw))) return true;
  if (ragMeta && ragMeta.intent === "anomaly_check") return true;
  return false;
};

// simple z-score based anomaly detection for a numeric column (temperature)
const detect = async ({ rows, question, context, ragMeta }) => {
  if (!rows || rows.length === 0) {
    return { hasAnomaly: false, points: [], summary: "No data." };
  }

  // choose a numeric key: prefer temperature, else first numeric column
  const sample = rows[0];
  const numericKeys = Object.keys(sample).filter(
    (k) => typeof sample[k] === "number"
  );

  if (numericKeys.length === 0) {
    return { hasAnomaly: false, points: [], summary: "No numeric data to analyze." };
  }

  const key = numericKeys.includes("temperature") ? "temperature" : numericKeys[0];

  const values = rows.map((r) => r[key]);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length;
  const std = Math.sqrt(variance) || 1;

  const points = rows
    .map((row, idx) => {
      const z = (row[key] - mean) / std;
      return { rowIndex: idx, value: row[key], zScore: z, raw: row };
    })
    .filter((p) => Math.abs(p.zScore) >= 3);

  const hasAnomaly = points.length > 0;

  const summary = hasAnomaly
    ? `Detected ${points.length} potential anomalies in "${key}" (|z-score| >= 3).`
    : `No strong anomalies detected in "${key}".`;

  return {
    hasAnomaly,
    type: "z-score",
    key,
    points,
    summary,
    meta: {
      mean,
      std,
      totalCount: values.length
    }
  };
};

module.exports = {
  shouldRun,
  detect
};

