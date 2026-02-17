/**
 * services/fallbackQueryService.js
 * 
 * Generates fallback SQL queries when RAG service fails
 * Handles common data query patterns like location-based searches
 */

const { logger } = require("../utils/logger");

/**
 * Generate a fallback SQL query for location-based data existence queries
 * e.g., "is there any argo data available in the bay of bengal?"
 */
function generateLocationQuery(question) {
  const questionLower = question.toLowerCase();
  
  // Extract location keywords
  const locations = {
    "bay of bengal": { lat_min: 5, lat_max: 22, lon_min: 80, lon_max: 100 },
    "arabian sea": { lat_min: 0, lat_max: 25, lon_min: 45, lon_max: 75 },
    "indian ocean": { lat_min: -60, lat_max: 30, lon_min: 20, lon_max: 120 },
    "north atlantic": { lat_min: 0, lat_max: 60, lon_min: -100, lon_max: 0 },
    "south atlantic": { lat_min: -60, lat_max: 0, lon_min: -80, lon_max: 20 },
    "pacific ocean": { lat_min: -60, lat_max: 60, lon_min: 100, lon_max: 180 },
    "caribbean": { lat_min: 10, lat_max: 27, lon_min: -85, lon_max: -60 },
    "mediterranean": { lat_min: 30, lat_max: 45, lon_min: -6, lon_max: 42 },
    "north sea": { lat_min: 50, lat_max: 62, lon_min: -3, lon_max: 10 },
    "gulf of mexico": { lat_min: 18, lat_max: 30, lon_min: -97, lon_max: -80 }
  };

  // Find matching location
  let location = null;
  let locationName = null;
  
  for (const [locName, bounds] of Object.entries(locations)) {
    if (questionLower.includes(locName)) {
      location = bounds;
      locationName = locName;
      break;
    }
  }

  if (!location) {
    logger.warn("Could not find location in question:", question);
    return null;
  }

  // Extract year if present
  const yearMatch = question.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : null;

  // Build fallback query
  let query = `
    SELECT 
      pm.profile_key,
      pm.latitude,
      pm.longitude,
      pm.juld as date_time,
      COUNT(*) as level_count
    FROM profile_levels pl
    JOIN profile_meta pm ON pl.profile_key = pm.profile_key
    WHERE pm.latitude >= ${region.lat_min}
      AND pm.latitude <= ${region.lat_max}
      AND pm.longitude >= ${region.lon_min}
      AND pm.longitude <= ${region.lon_max}
  `;

  if (year) {
    query += `\n      AND EXTRACT(YEAR FROM pm.juld) = ${year}`;
  }

  query += `\n    GROUP BY pm.profile_key, pm.latitude, pm.longitude, pm.juld
    ORDER BY pm.juld DESC
    LIMIT 100;`;

  logger.info(`Generated fallback query for location: ${locationName}`, { year });
  return query;
}

/**
 * Generate a fallback SQL query for year-based data queries
 * e.g., "how many profiles in 2023?"
 */
function generateYearQuery(question) {
  const questionLower = question.toLowerCase();
  
  // Extract year
  const yearMatch = question.match(/\b(19|20)\d{2}\b/);
  if (!yearMatch) return null;

  const year = yearMatch[0];

  // Build query based on question intent
  if (questionLower.includes("how many") || questionLower.includes("count")) {
    return `
      SELECT 
        EXTRACT(YEAR FROM juld) as year,
        COUNT(DISTINCT profile_key) as profile_count,
        COUNT(*) as total_levels
      FROM profile_levels pl
      JOIN profile_meta pm ON pl.profile_key = pm.profile_key
      WHERE EXTRACT(YEAR FROM pm.juld) = ${year}
      GROUP BY year;
    `;
  }

  // Default: return profiles from that year
  return `
    SELECT 
      pm.profile_key,
      pm.latitude,
      pm.longitude,
      pm.juld as date_time,
      COUNT(*) as level_count
    FROM profile_levels pl
    JOIN profile_meta pm ON pl.profile_key = pm.profile_key
    WHERE EXTRACT(YEAR FROM pm.juld) = ${year}
    GROUP BY pm.profile_key, pm.latitude, pm.longitude, pm.juld
    ORDER BY pm.juld DESC
    LIMIT 50;
  `;
}

/**
 * Generate a fallback SQL query for measurement/aggregation queries
 * e.g., "find the highest salinity in 2002", "what is the average temperature"
 */
function generateMeasurementQuery(question) {
  const questionLower = question.toLowerCase();

  // Detect measurement type
  let measurement = null;
  let aggregation = "MAX"; // default

  const measurements = {
    "salinity": "salinity_adjusted",
    "temperature": "temperature_adjusted",
    "pressure": "pressure",
    "doxy": "doxy_adjusted",
    "oxygen": "doxy_adjusted",
    "chla": "chla_adjusted",
    "chlorophyll": "chla_adjusted",
    "ph": "ph_adjusted",
    "nitrate": "nitrate_adjusted",
    "bbp": "bbp_adjusted"
  };

  // Find the measurement variable
  for (const [name, column] of Object.entries(measurements)) {
    if (questionLower.includes(name)) {
      measurement = { name, column };
      break;
    }
  }

  if (!measurement) return null;

  // Detect aggregation function
  if (questionLower.includes("highest") || questionLower.includes("maximum") || questionLower.includes("max")) {
    aggregation = "MAX";
  } else if (questionLower.includes("lowest") || questionLower.includes("minimum") || questionLower.includes("min")) {
    aggregation = "MIN";
  } else if (questionLower.includes("average") || questionLower.includes("mean")) {
    aggregation = "AVG";
  } else if (questionLower.includes("count") || questionLower.includes("how many")) {
    aggregation = "COUNT";
  } else if (questionLower.includes("sum") || questionLower.includes("total")) {
    aggregation = "SUM";
  }

  // Extract year if present
  const yearMatch = question.match(/\b(19|20)\d{2}\b/);
  const year = yearMatch ? yearMatch[0] : null;

  // Build query
  let query = `
    SELECT 
      ${aggregation === "COUNT" ? "COUNT(DISTINCT pm.profile_key) as count" : `${aggregation}(${measurement.column}) as ${measurement.name}_${aggregation.toLowerCase()}`},
      EXTRACT(YEAR FROM pm.juld) as year
    FROM profile_levels pl
    JOIN profile_meta pm ON pl.profile_key = pm.profile_key
    WHERE ${measurement.column} IS NOT NULL
  `;

  if (year) {
    query += `\n      AND EXTRACT(YEAR FROM pm.juld) = ${year}`;
  }

  query += `\n    GROUP BY EXTRACT(YEAR FROM pm.juld)
    ORDER BY year DESC
    LIMIT 1;`;

  logger.info(`Generated fallback measurement query for ${measurement.name}`, { aggregation, year });
  return query;
}

/**
 * Try to generate a fallback SQL query based on common patterns
 * Returns null if no fallback can be generated
 */
function generateFallbackQuery(question) {
  // Try measurement/aggregation query first (more specific)
  let query = generateMeasurementQuery(question);
  if (query) return query;

  // Try location-based query
  query = generateLocationQuery(question);
  if (query) return query;

  // Try year-based query
  query = generateYearQuery(question);
  if (query) return query;

  return null;
}

module.exports = {
  generateFallbackQuery,
  generateLocationQuery,
  generateYearQuery,
  generateMeasurementQuery
};
