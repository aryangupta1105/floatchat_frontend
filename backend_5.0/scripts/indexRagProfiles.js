/**
 * scripts/indexRagProfiles.js
 *
 * One-time script to index all existing profiles from PostgreSQL into GTWY RAG.
 * Run with: node scripts/indexRagProfiles.js
 *
 * This reads file_metadata + core_levels stats and pushes a summary per
 * platform (float) into the GTWY RAG collection so queries get semantic context.
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const { query } = require("../config/db");
const { createResource, buildProfileContent } = require("../services/ragService");
const { logger } = require("../utils/logger");

const BATCH_SIZE = 5; // concurrent GTWY requests per batch
const DELAY_MS   = 500; // ms between batches to avoid rate limiting

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function indexAllProfiles() {
  logger.info("=== RAG Indexing Script Started ===");

  // Fetch one summary row per platform_number (float)
  const { rows: floats } = await query(`
    SELECT
      fm.platform_number,
      fm.data_centre,
      fm.project_name,
      fm.pi_name,
      COUNT(DISTINCT fm.profile_key)                    AS profile_count,
      MIN(fm.juld)                                      AS first_seen,
      MAX(fm.juld)                                      AS last_seen,
      AVG(fm.latitude)                                  AS avg_lat,
      AVG(fm.longitude)                                 AS avg_lon,
      MIN(cl.depth)                                     AS min_depth,
      MAX(cl.depth)                                     AS max_depth,
      ROUND(AVG(cl.temperature_adjusted)::numeric, 2)  AS avg_temp,
      ROUND(MIN(cl.temperature_adjusted)::numeric, 2)  AS min_temp,
      ROUND(MAX(cl.temperature_adjusted)::numeric, 2)  AS max_temp,
      ROUND(AVG(cl.salinity_adjusted)::numeric, 2)     AS avg_sal,
      ROUND(MIN(cl.salinity_adjusted)::numeric, 2)     AS min_sal,
      ROUND(MAX(cl.salinity_adjusted)::numeric, 2)     AS max_sal
    FROM file_metadata fm
    LEFT JOIN core_levels cl ON cl.profile_key = fm.profile_key
    GROUP BY fm.platform_number, fm.data_centre, fm.project_name, fm.pi_name
    ORDER BY fm.platform_number
  `);

  logger.info(`Found ${floats.length} floats to index`);

  let indexed = 0;
  let failed  = 0;

  // Process in batches
  for (let i = 0; i < floats.length; i += BATCH_SIZE) {
    const batch = floats.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (f) => {
      const content = buildProfileContent({
        platform_number: f.platform_number,
        profile_key:     f.platform_number,
        data_centre:     f.data_centre,
        project_name:    f.project_name,
        pi_name:         f.pi_name,
        profile_count:   f.profile_count,
        first_seen:      f.first_seen,
        last_seen:       f.last_seen,
        latitude:        f.avg_lat ? Number(f.avg_lat).toFixed(3) : "",
        longitude:       f.avg_lon ? Number(f.avg_lon).toFixed(3) : "",
        min_depth:       f.min_depth,
        max_depth:       f.max_depth,
        temp_min:        f.min_temp,
        temp_max:        f.max_temp,
        psal_min:        f.min_sal,
        psal_max:        f.max_sal,
        ocean:           inferOcean(Number(f.avg_lat), Number(f.avg_lon))
      });

      const docId = await createResource({
        title:       `ARGO Float ${f.platform_number}`,
        description: `Float ${f.platform_number} — ${f.profile_count} profiles, ${f.data_centre || "unknown DAC"}`,
        content,
        ownerId:     "public"
      });

      if (docId) {
        indexed++;
        logger.info(`[${indexed}/${floats.length}] Indexed float ${f.platform_number} → doc ${docId}`);
      } else {
        failed++;
        logger.warn(`Failed to index float ${f.platform_number}`);
      }
    }));

    if (i + BATCH_SIZE < floats.length) {
      await sleep(DELAY_MS);
    }
  }

  logger.info(`=== RAG Indexing Complete: ${indexed} indexed, ${failed} failed ===`);
  process.exit(0);
}

/**
 * Rough ocean region inference from lat/lon
 */
function inferOcean(lat, lon) {
  if (isNaN(lat) || isNaN(lon)) return "Unknown";
  if (lon >= 20 && lon <= 120 && lat >= -60 && lat <= 30)  return "Indian Ocean";
  if (lon >= 20 && lon <= 90  && lat >= 0   && lat <= 30)  return "Arabian Sea";
  if (lon >= 80 && lon <= 100 && lat >= 5   && lat <= 25)  return "Bay of Bengal";
  if (lon >= -180 && lon <= -70)                            return "Pacific Ocean (East)";
  if (lon >= 120  && lon <= 180)                            return "Pacific Ocean (West)";
  if (lon >= -70  && lon <= 20)                             return "Atlantic Ocean";
  return "Global Ocean";
}

indexAllProfiles().catch(err => {
  logger.error("Indexing script failed:", err);
  process.exit(1);
});
