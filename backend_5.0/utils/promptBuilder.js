// utils/promptBuilder.js

// You can optionally move this string to an env var.
const DB_SCHEMA_SUMMARY = process.env.DB_SCHEMA_SUMMARY || `
You are querying a Postgres database with ARGO float oceanographic data.

Main tables:

1) file_metadata (profile summary data)
   - profile_key (TEXT primary key, unique identifier like '2902266_1_1')
   - platform_number (TEXT, float/platform ID like '2902266')
   - latitude, longitude (DOUBLE PRECISION, float coordinates)
   - juld (datetime, profile sampling date)
   - project_name, data_type, source_filename (TEXT metadata)
   - station_parameters (JSONB, station info)

2) core_levels (temperature & salinity data)
   - profile_key (TEXT, foreign key to file_metadata)
   - level_index (INTEGER, depth level number)
   - pressure (DOUBLE PRECISION, in dbar)
   - depth (DOUBLE PRECISION, in meters)
   - latitude, longitude (location at this depth level)
   - temperature (DOUBLE PRECISION, degC)
   - temperature_adjusted (DOUBLE PRECISION, degC)
   - salinity (DOUBLE PRECISION, psu)
   - salinity_adjusted (DOUBLE PRECISION, psu)

3) bgc_levels (biogeochemical data - oxygen, chlorophyll, nitrate, etc.)
   - profile_key (TEXT, foreign key to file_metadata)
   - level_index (INTEGER, depth level number)
   - pressure, depth, latitude, longitude (same as core_levels)
   - doxy (DOUBLE PRECISION, dissolved oxygen in micromol/kg)
   - doxy_adjusted (DOUBLE PRECISION)
   - chla (DOUBLE PRECISION, chlorophyll-a in mg/m³)
   - chla_adjusted (DOUBLE PRECISION)
   - bbp700 (DOUBLE PRECISION, backscatter at 700nm)
   - ph (DOUBLE PRECISION, pH)
   - nitrate (DOUBLE PRECISION, nitrate in micromol/kg)

Rules:
- Always join file_metadata with core_levels or bgc_levels on profile_key
- Use core_levels for temperature and salinity queries
- Use bgc_levels for oxygen, chlorophyll, nitrate, backscatter, pH queries
- Use file_metadata for platform_number, latitude, longitude, juld (date) lookups
- Always generate a single, read-only SELECT query
- Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, or multiple statements
`;


/**
 * Prompt for Llama to generate SQL from:
 * - user question
 * - RAG context
 * - DB schema
 */
const buildSqlPrompt = ({ question, ragContext }) => {
  return [
    "You are an expert SQL generator for an ARGO float Postgres database.",
    "Your job is to convert the user's question into a single, safe, read-only SQL SELECT query.",
    "",
    "=== DATABASE SCHEMA SUMMARY ===",
    DB_SCHEMA_SUMMARY,
    "",
    "=== RAG CONTEXT (SEMANTIC HINTS) ===",
    ragContext || "(no additional context)",
    "",
    "=== USER QUESTION ===",
    question,
    "",
    "=== INSTRUCTIONS ===",
    "- Return ONLY the SQL query.",
    "- Do NOT include explanations, markdown, comments, or code fences.",
    "- Use explicit column names and table names.",
    "- Prefer joins on profile_key when combining summaries, meta, and levels.",
    "- If unsure, make a reasonable assumption but still produce syntactically valid SQL.",
    "",
    "Now output the SQL query:"
  ].join("\n");
};

/**
 * Prompt for final natural-language answer from:
 * - question
 * - executed SQL
 * - data rows
 * - anomalies
 * - visualization choice
 */
const buildFinalAnswerPrompt = ({
  question,
  sql,
  rows,
  context,
  anomalies,
  visualization
}) => {
  return [
    "You are an ocean data analyst assistant.",
    "Explain clearly what the data means for the user.",
    "",
    "=== USER QUESTION ===",
    question,
    "",
    "=== RAG CONTEXT (if any) ===",
    JSON.stringify(context || {}, null, 2),
    "",
    "=== SQL USED ===",
    sql,
    "",
    "=== DATA (FIRST FEW ROWS) ===",
    JSON.stringify(rows?.slice(0, 10) || [], null, 2),
    "",
    "=== ANOMALY DETECTION RESULT ===",
    JSON.stringify(anomalies || {}, null, 2),
    "",
    "=== VISUALIZATION METADATA ===",
    JSON.stringify(visualization || {}, null, 2),
    "",
    "=== INSTRUCTIONS ===",
    "- First, briefly summarize what the data is showing.",
    "- Then, describe any vertical or temporal structure (e.g. how temperature changes with depth or time).",
    "- If anomalies.hasAnomaly is true, explain what is unusual and why it matters.",
    "- Keep the answer concise but informative, suitable for a scientific user.",
    "- Do NOT restate the raw SQL; focus on interpretation."
  ].join("\n");
};

module.exports = {
  buildSqlPrompt,
  buildFinalAnswerPrompt
};
