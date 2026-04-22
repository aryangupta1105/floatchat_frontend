// utils/promptBuilder.js

// You can optionally move this string to an env var.
const DB_SCHEMA_SUMMARY = process.env.DB_SCHEMA_SUMMARY || `
You are querying a PostgreSQL database with Argo float oceanographic data.

Tables:

1) file_metadata  — one row per profile (dive cycle), primary source of float identity & location
   - profile_key      TEXT PRIMARY KEY  (e.g. '2902266_1_1')
   - platform_number  TEXT              (float/platform ID, e.g. '2902266')
   - data_centre      TEXT              (DAC, e.g. 'incois', 'coriolis')
   - juld             TIMESTAMPTZ       (date/time of the dive — use this for date filters)
   - latitude         DOUBLE PRECISION  (degrees North)
   - longitude        DOUBLE PRECISION  (degrees East)
   - cycle_number     INTEGER
   - data_type        TEXT
   - data_mode        TEXT
   - project_name     TEXT
   - pi_name          TEXT
   - source_filename  TEXT

2) core_levels  — one row per depth level per profile
   - profile_key             TEXT  (FK → file_metadata)
   - level_index             INTEGER
   - pressure                DOUBLE PRECISION  (dbar)
   - depth                   DOUBLE PRECISION  (metres)
   - latitude                DOUBLE PRECISION
   - longitude               DOUBLE PRECISION
   - temperature             DOUBLE PRECISION  (°C, raw)
   - temperature_adjusted    DOUBLE PRECISION  (°C, calibrated — prefer this)
   - salinity                DOUBLE PRECISION  (PSU, raw)
   - salinity_adjusted       DOUBLE PRECISION  (PSU, calibrated — prefer this)
   - pressure_adjusted       DOUBLE PRECISION  (dbar, calibrated)

3) bgc_levels  — one row per depth level per profile (BGC floats only)
   - profile_key             TEXT  (FK → profile_summaries)
   - level_index             INTEGER
   - pressure, depth, latitude, longitude  (same as core_levels)
   - doxy                    DOUBLE PRECISION  (dissolved oxygen, µmol/kg, raw)
   - doxy_adjusted           DOUBLE PRECISION  (calibrated — prefer this)
   - chla                    DOUBLE PRECISION  (chlorophyll-a, mg/m³, raw)
   - chla_adjusted           DOUBLE PRECISION  (calibrated)
   - nitrate                 DOUBLE PRECISION  (µmol/kg)
   - nitrate_adjusted        DOUBLE PRECISION
   - bbp700                  DOUBLE PRECISION  (particulate backscatter 700nm)
   - ph_in_situ_total        DOUBLE PRECISION  (pH)

4) file_metadata  — raw ingestion metadata (one row per source file)
   - profile_key  TEXT PRIMARY KEY
   - platform_number TEXT
   - source_filename TEXT
   - data_type TEXT
   - project_name TEXT
   - pi_name TEXT

SQL Rules:
- JOIN profile_summaries with core_levels or bgc_levels ON profile_key
- Use profile_summaries for float_id, latitude, longitude, profile_date, depth range
- Use core_levels for temperature and salinity queries
- Use bgc_levels for oxygen, chlorophyll, nitrate, pH queries
- Prefer _adjusted columns (temperature_adjusted, salinity_adjusted, doxy_adjusted)
- Always generate a single read-only SELECT query
- Never use INSERT, UPDATE, DELETE, DROP, TRUNCATE, ALTER, or multiple statements
- Limit results to 500 rows unless the question asks for aggregates
`;


/**
 * Prompt for Llama to generate SQL from:
 * - user question
 * - RAG context
 * - DB schema
 */
const FEW_SHOT_EXAMPLES = `
EXAMPLE QUERIES AND CORRECT SQL:

Q: show temperature profile for float 1900064
SQL:
SELECT fm.profile_key, fm.juld AS profile_date, fm.latitude, fm.longitude,
       cl.depth, cl.pressure, cl.temperature_adjusted, cl.salinity_adjusted
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.platform_number = '1900064'
ORDER BY fm.juld ASC, cl.depth ASC
LIMIT 500;

Q: show all floats in the Indian Ocean
SQL:
SELECT platform_number, AVG(latitude) AS latitude, AVG(longitude) AS longitude,
       COUNT(*) AS profile_count, MAX(juld) AS last_seen
FROM file_metadata
WHERE latitude BETWEEN -60 AND 30 AND longitude BETWEEN 20 AND 120
GROUP BY platform_number
ORDER BY last_seen DESC NULLS LAST
LIMIT 500;

Q: what is the salinity at different depths for float 1900065
SQL:
SELECT fm.juld AS profile_date, cl.depth, cl.salinity_adjusted, cl.temperature_adjusted
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.platform_number = '1900065'
ORDER BY fm.juld DESC, cl.depth ASC
LIMIT 500;

Q: plot a vertical temperature profile for float 1900066
SQL:
SELECT fm.profile_key, fm.juld AS profile_date, cl.depth,
       cl.temperature_adjusted, cl.salinity_adjusted
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.platform_number = '1900066'
  AND cl.depth IS NOT NULL
  AND cl.temperature_adjusted IS NOT NULL
ORDER BY fm.juld DESC, cl.depth ASC
LIMIT 500;

Q: show a temperature salinity diagram for float 1900066
SQL:
SELECT fm.profile_key, fm.juld AS profile_date, cl.depth,
       cl.temperature_adjusted, cl.salinity_adjusted
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.platform_number = '1900066'
  AND cl.temperature_adjusted IS NOT NULL
  AND cl.salinity_adjusted IS NOT NULL
ORDER BY fm.juld DESC, cl.depth ASC
LIMIT 500;

Q: how many profiles does each float have
SQL:
SELECT platform_number, COUNT(*) AS profile_count,
       MIN(juld) AS first_seen, MAX(juld) AS last_seen
FROM file_metadata
GROUP BY platform_number
ORDER BY profile_count DESC
LIMIT 100;

Q: show temperature over time for float 1900066
SQL:
SELECT fm.juld AS profile_date, fm.latitude, fm.longitude,
       AVG(cl.temperature_adjusted) AS avg_temperature
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.platform_number = '1900066'
GROUP BY fm.juld, fm.latitude, fm.longitude
ORDER BY fm.juld ASC
LIMIT 200;

Q: list all Argo floats with their locations
SQL:
SELECT platform_number,
       AVG(latitude) AS latitude,
       AVG(longitude) AS longitude,
       COUNT(*) AS profile_count,
       MAX(juld) AS last_seen
FROM file_metadata
GROUP BY platform_number
ORDER BY last_seen DESC NULLS LAST
LIMIT 500;

Q: find the highest salinity of 2002
SQL:
SELECT MAX(cl.salinity_adjusted) AS max_salinity,
       fm.platform_number,
       fm.juld AS profile_date,
       fm.latitude,
       fm.longitude
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE EXTRACT(YEAR FROM fm.juld) = 2002
GROUP BY fm.platform_number, fm.juld, fm.latitude, fm.longitude
ORDER BY max_salinity DESC NULLS LAST
LIMIT 100;

Q: show me floats deployed after 2002
SQL:
SELECT DISTINCT platform_number,
       MIN(juld) AS first_seen,
       MAX(juld) AS last_seen,
       AVG(latitude) AS latitude,
       AVG(longitude) AS longitude
FROM file_metadata
WHERE EXTRACT(YEAR FROM juld) > 2002
GROUP BY platform_number
ORDER BY first_seen ASC
LIMIT 500;

Q: find all floats near India
SQL:
SELECT platform_number, AVG(latitude) AS latitude, AVG(longitude) AS longitude,
       COUNT(*) AS profile_count, MAX(juld) AS last_seen
FROM file_metadata
WHERE latitude BETWEEN 5 AND 35 AND longitude BETWEEN 65 AND 100
GROUP BY platform_number
ORDER BY last_seen DESC NULLS LAST
LIMIT 500;

Q: find the highest salinity of floats near India
SQL:
SELECT MAX(cl.salinity_adjusted) AS max_salinity,
       fm.platform_number, fm.juld AS profile_date, fm.latitude, fm.longitude
FROM file_metadata fm
JOIN core_levels cl ON cl.profile_key = fm.profile_key
WHERE fm.latitude BETWEEN 5 AND 35 AND fm.longitude BETWEEN 65 AND 100
GROUP BY fm.platform_number, fm.juld, fm.latitude, fm.longitude
ORDER BY max_salinity DESC NULLS LAST
LIMIT 100;

Q: show floats in the Arabian Sea
SQL:
SELECT platform_number, AVG(latitude) AS latitude, AVG(longitude) AS longitude,
       COUNT(*) AS profile_count, MAX(juld) AS last_seen
FROM file_metadata
WHERE latitude BETWEEN 0 AND 30 AND longitude BETWEEN 40 AND 80
GROUP BY platform_number
ORDER BY last_seen DESC NULLS LAST
LIMIT 500;
`;

const buildSqlPrompt = ({ question, ragContext }) => {
  return [
    "You are an expert SQL generator for an ARGO float Postgres database.",
    "Your job is to convert the user's question into a single, safe, read-only SQL SELECT query.",
    "",
    "=== DATABASE SCHEMA SUMMARY ===",
    DB_SCHEMA_SUMMARY,
    "",
    "=== FEW-SHOT EXAMPLES ===",
    FEW_SHOT_EXAMPLES,
    "",
    "=== RAG CONTEXT (SEMANTIC HINTS) ===",
    ragContext || "(no additional context)",
    "",
    "=== USER QUESTION ===",
    question,
    "",
    "=== CRITICAL RULES ===",
    "- Return ONLY the raw SQL query — no markdown, no code fences, no explanations.",
    "- IF visualization_requested = true THEN enforce depth-resolved schema.",
    "- If user intent is: 'profile', 'depth', 'vertical', 'T-S', 'salinity vs temperature' -> ALWAYS include: depth, temperature (or temperature_adjusted), salinity (or salinity_adjusted).",
    "- NEVER use aggregation (MAX, AVG, etc.) when visualization is expected or when the user intent involves profiles or T-S diagrams.",
    "- For ANY question about depth/temperature/salinity profiles: JOIN core_levels on profile_key.",
    "- Profile intent MUST return depth-level rows (non-aggregated) with depth (or pressure) and temperature_adjusted (or salinity_adjusted).",
    "- T-S intent MUST return paired temperature_adjusted and salinity_adjusted values per row; include depth when available.",
    "- For profile or T-S intents, DO NOT use aggregate-only outputs (no MAX/MIN/AVG-only result sets, no GROUP BY-only summaries).",
    "- For profile or T-S intents, add filters to exclude NULL depth/temperature/salinity as needed for chartability.",
    "- For ANY question about oxygen/chlorophyll/nitrate: JOIN bgc_levels on profile_key.",
    "- For float location/map queries: SELECT from file_metadata only (no JOIN needed).",
    "- Always use platform_number (TEXT) to filter by float ID.",
    "- Always use juld (TIMESTAMPTZ) for date filters, not profile_date.",
    "- LIMIT to 500 rows unless the question asks for aggregates.",
    "- GROUP BY rule: every non-aggregate column in SELECT must appear in GROUP BY.",
    "- If a question mentions a GEOGRAPHIC REGION or COUNTRY (e.g. 'near India', 'Arabian Sea', 'Bay of Bengal'), you MUST add a WHERE clause with approximate lat/lon bounds.",
    "- Geographic reference: India (lat 5-35, lon 65-100), Arabian Sea (lat 0-30, lon 40-80), Bay of Bengal (lat 5-25, lon 80-100), Indian Ocean (lat -60-30, lon 20-120), Pacific (lon 120-180 or -180 to -70), Atlantic (lon -70 to 20), Southern Ocean (lat < -40).",
    "- If a question says 'all floats' or 'list floats' WITHOUT a region, do NOT add any coordinate WHERE filter.",
    "- IMPORTANT: Generate exactly ONE SQL query even if the user asked multiple questions. Pick the most important/first question only.",
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
