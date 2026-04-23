// utils/visualizationFormatter.js

/**
 * Converts SQL rows into frontend-ready visualization structures.
 * Output MUST match PDF expectations.
 */

const formatVisualization = (type, { rows, fields, ragMeta }) => {
  switch (type) {
    case "profile_plot":
      return formatProfilePlot(rows);

    case "time_series":
      return formatTimeSeries(rows);

    case "spatial_map":
      return formatSpatialMap(rows);

    case "heatmap":
      return formatHeatmap(rows);

    case "comparison_plot":
      return formatComparisonPlot(rows, ragMeta);

    case "nearest_floats":
      return formatNearestFloats(rows);

    case "ascii_table":
    default:
      return formatAsciiTable(rows, fields);
  }
};

/* -----------------------------------------------------------
   1) PROFILE PLOT (depth vs temp/sal)
------------------------------------------------------------*/
const formatProfilePlot = (rows) => {
  const depthKey = rows[0].depth !== undefined ? "depth" : "pressure";

  const depth = rows.map(r => Number(r[depthKey]));
  const temp  = rows.map(r => r.temperature ?? null);
  const sal   = rows.map(r => r.salinity ?? null);

  const lines = [];
  if (temp.some(v => v !== null)) {
    lines.push({ label: "temperature", x: temp, y: depth });
  }
  if (sal.some(v => v !== null)) {
    lines.push({ label: "salinity", x: sal, y: depth });
  }

  return {
    xLabel: "Value",
    yLabel: "Depth (dbar)",
    lines,
    metadata: {
      float_id: rows[0].float_id || null,
      cycle: rows[0].cycle || null
    }
  };
};

/* -----------------------------------------------------------
   2) TIME SERIES
------------------------------------------------------------*/
const formatTimeSeries = (rows) => {
  const keys = Object.keys(rows[0]);
  const varKey = keys.find(k =>
    ["temperature","salinity","oxygen","value"].includes(k)
  );

  return {
    variable: varKey || "value",
    timestamps: rows.map(r => r.time || r.timestamp || r.date),
    values: rows.map(r => Number(r[varKey] ?? null))
  };
};

/* -----------------------------------------------------------
   3) SPATIAL MAP
------------------------------------------------------------*/
const formatSpatialMap = (rows) => {
  const points = rows.map(r => ({
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    float_id: r.float_id ?? null,
    cycle: r.cycle ?? null
  }));

  // Auto-center = average position
  const center = {
    lat: points.reduce((a,b) => a + b.lat, 0) / points.length,
    lon: points.reduce((a,b) => a + b.lon, 0) / points.length
  };

  return { points, center };
};

/* -----------------------------------------------------------
   4) HEATMAP (Depth × Time × Value matrix)
------------------------------------------------------------*/
const formatHeatmap = (rows) => {
  const depthKey = rows[0].depth !== undefined ? "depth" : "pressure";

  const uniqueTimes = [...new Set(rows.map(r => r.time || r.date))];
  const uniqueDepth = [...new Set(rows.map(r => Number(r[depthKey])))];

  // Sort depth descending (like ARGO PDFs)
  uniqueDepth.sort((a,b) => b - a);

  // Build matrix
  const matrix = uniqueDepth.map(depth =>
    uniqueTimes.map(time => {
      const match = rows.find(r =>
        Number(r[depthKey]) === depth &&
        (r.time === time || r.date === time)
      );

      return match ? match.temperature ?? match.salinity ?? null : null;
    })
  );

  return {
    x: uniqueTimes,
    y: uniqueDepth,
    matrix,
    variable: "temperature or salinity"
  };
};

/* -----------------------------------------------------------
   5) COMPARISON PLOT
------------------------------------------------------------*/
const formatComparisonPlot = (rows, ragMeta) => {
  // Group by (float_id, cycle)
  const groups = {};

  for (const r of rows) {
    const key = `${r.float_id}_${r.cycle}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(r);
  }

  const lines = Object.keys(groups).map(key => {
    const grp = groups[key];
    const depthKey = grp[0].depth !== undefined ? "depth" : "pressure";

    return {
      label: key,
      x: grp.map(r => r.temperature ?? r.salinity ?? null),
      y: grp.map(r => Number(r[depthKey]))
    };
  });

  return {
    lines,
    metadata: {
      comparison_type: ragMeta?.comparisonType || "multi-profile"
    }
  };
};

/* -----------------------------------------------------------
   6) NEAREST FLOATS
------------------------------------------------------------*/
const formatNearestFloats = (rows) => {
  const reference = {
    lat: Number(rows[0].reference_lat),
    lon: Number(rows[0].reference_lon)
  };

  const neighbors = rows.map(r => ({
    float_id: r.float_id,
    lat: Number(r.latitude),
    lon: Number(r.longitude),
    distance_km: Number(r.distance_km)
  }));

  return { reference, neighbors };
};

/* -----------------------------------------------------------
   7) ASCII TABLE
------------------------------------------------------------*/
const formatAsciiTable = (rows, fields) => ({
  columns: fields.map(f => f.name),
  rows
});

module.exports = { formatVisualization };
