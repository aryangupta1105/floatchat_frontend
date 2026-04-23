const toFinite = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const hasAnyRows = (rows) => Array.isArray(rows) && rows.length > 0;

const isProfileShape = (rows) => {
  if (!hasAnyRows(rows)) return false;

  return rows.some((r) => {
    const depth = toFinite(r?.depth ?? r?.pressure);
    const temp = toFinite(r?.temperature_adjusted ?? r?.temperature);
    const sal = toFinite(r?.salinity_adjusted ?? r?.salinity);
    return depth != null && (temp != null || sal != null);
  });
};

const isTsShape = (rows) => {
  if (!hasAnyRows(rows)) return false;

  return rows.some((r) => {
    const temp = toFinite(r?.temperature_adjusted ?? r?.temperature);
    const sal = toFinite(r?.salinity_adjusted ?? r?.salinity);
    return temp != null && sal != null;
  });
};

const shapeSummary = (rows) => {
  if (!hasAnyRows(rows)) {
    return {
      rowCount: 0,
      validProfileRows: 0,
      validTsRows: 0,
      hasLatLonRows: 0,
      columns: []
    };
  }

  let validProfileRows = 0;
  let validTsRows = 0;
  let hasLatLonRows = 0;

  for (const r of rows) {
    const depth = toFinite(r?.depth ?? r?.pressure);
    const temp = toFinite(r?.temperature_adjusted ?? r?.temperature);
    const sal = toFinite(r?.salinity_adjusted ?? r?.salinity);
    const lat = toFinite(r?.latitude);
    const lon = toFinite(r?.longitude);

    if (depth != null && (temp != null || sal != null)) validProfileRows += 1;
    if (temp != null && sal != null) validTsRows += 1;
    if (lat != null && lon != null) hasLatLonRows += 1;
  }

  return {
    rowCount: rows.length,
    validProfileRows,
    validTsRows,
    hasLatLonRows,
    columns: Object.keys(rows[0] || {})
  };
};

const detectType = ({ rows, fields, question, ragMeta }) => {
  const colNames = fields?.map((f) => f.name.toLowerCase()) || [];
  const has = (key) => colNames.includes(key.toLowerCase());

  if (isProfileShape(rows)) return "profile_plot";
  if (isTsShape(rows)) return "ts_plot";

  if ((has("time") || has("timestamp") || has("date") || has("juld") || has("profile_date")) &&
      (has("temperature") || has("salinity") || has("oxygen") || has("avg_temperature"))) {
    return "time_series";
  }

  if (hasAnyRows(rows) && rows.some((r) => toFinite(r?.latitude) != null && toFinite(r?.longitude) != null)) {
    return "spatial_map";
  }

  if ((has("depth") || has("pressure")) &&
      (has("time") || has("date") || has("juld") || has("profile_date")) &&
      (has("temperature") || has("salinity"))) {
    return "heatmap";
  }

  if (ragMeta?.intent === "comparison") {
    return "comparison_plot";
  }

  const qLower = (question || "").toLowerCase();
  if (qLower.includes("nearest") || has("distance_km")) {
    return "nearest_floats";
  }

  return "ascii_table";
};

module.exports = {
  detectType,
  isProfileShape,
  isTsShape,
  shapeSummary
};
