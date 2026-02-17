const detectType = ({ rows, fields, question, ragMeta }) => {
  const colNames = fields?.map(f => f.name.toLowerCase()) || [];

  const has = (key) => colNames.includes(key.toLowerCase());

  // 1) PROFILE PLOT
  // Required: pressure or depth + (temperature OR salinity)
  if ((has("pressure") || has("depth")) &&
      (has("temperature") || has("salinity"))) {
    return "profile_plot";
  }

  // 2) TIME SERIES
  // Required: time + some variable (temp/sal/etc)
  if ((has("time") || has("timestamp") || has("date")) &&
      (has("temperature") || has("salinity") || has("oxygen"))) {
    return "time_series";
  }

  // 3) SPATIAL MAP
  // Required: lat + lon
  if (has("latitude") && has("longitude")) {
    return "spatial_map";
  }

  // 4) HEATMAP
  // Required: depth + time + variable
  if ((has("depth") || has("pressure")) &&
      (has("time") || has("date")) &&
      (has("temperature") || has("salinity"))) {
    return "heatmap";
  }

  // 5) COMPARISON PLOT
  // RAG usually marks this in meta
  if (ragMeta?.intent === "comparison") {
    return "comparison_plot";
  }

  // 6) NEAREST FLOATS
  // If question includes "nearest" or columns include distance
  const qLower = (question || "").toLowerCase();
  if (qLower.includes("nearest") || has("distance_km")) {
    return "nearest_floats";
  }

  // 7) ASCII TABLE
  // Fallback when no plotting columns found
  return "ascii_table";
};

module.exports = {
  detectType
};
