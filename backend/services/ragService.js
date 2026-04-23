// services/ragService.js  — GTWY RAG integration
const axios = require("axios");
const { logger } = require("../utils/logger");

const GTWY_DB_URL   = process.env.GTWY_RAG_API_URL   || "https://db.gtwy.ai";
const GTWY_QUERY_URL = process.env.GTWY_RAG_QUERY_URL || "https://api.gtwy.ai";
const GTWY_AUTH_KEY  = process.env.GTWY_AUTH_KEY       || "";
const COLLECTION_ID  = process.env.GTWY_RAG_COLLECTION_ID || "697df92c1f5b4176d9fcf7ce";
const COLLECTION_MODE = process.env.GTWY_RAG_COLLECTION_MODE || "high_accuracy";
const TIMEOUT_MS = 15000;

const gtwyHeaders = () => ({
  "Content-Type": "application/json",
  "pauthkey": GTWY_AUTH_KEY
});

/**
 * Create a RAG resource for a newly ingested profile.
 * Call this after a profile is successfully written to DB.
 * Returns the GTWY doc_id to store alongside the profile.
 *
 * When to call:
 *  - After ingest completes for a profile (via webhook or post-ingest hook)
 *  - Content = human-readable summary of the profile (float_id, date, lat/lon, temp/sal stats)
 *  - ownerId = profile_key (e.g. "1900042:50") so queries can filter by float
 */
const createResource = async ({ title, description, content, ownerId }) => {
  if (!GTWY_AUTH_KEY) {
    logger.warn("[GTWY RAG] AUTH_KEY not set — skipping createResource");
    return null;
  }
  try {
    const res = await axios.post(
      `${GTWY_DB_URL}/api/rag/resource`,
      {
        title,
        description,
        content,
        settings: { strategy: "recursive", chunkSize: 4000 },
        collection_details: COLLECTION_MODE,
        owner_id: ownerId
      },
      { headers: gtwyHeaders(), timeout: TIMEOUT_MS }
    );

    if (!res.data?.success || !res.data?.data?._id) {
      throw new Error("Invalid response from GTWY RAG API");
    }

    logger.info(`[GTWY RAG] Created resource: ${res.data.data._id} for owner: ${ownerId}`);
    return res.data.data._id;
  } catch (err) {
    logger.error("[GTWY RAG] createResource failed:", err?.response?.data || err.message);
    return null;
  }
};

/**
 * Update an existing RAG resource (e.g. when a profile is reingested).
 */
const updateResource = async (docId, { title, description, content }) => {
  if (!GTWY_AUTH_KEY || !docId) return;
  try {
    await axios.put(
      `${GTWY_DB_URL}/api/rag/resource/${docId}`,
      { title, description, content },
      { headers: gtwyHeaders(), timeout: TIMEOUT_MS }
    );
    logger.info(`[GTWY RAG] Updated resource: ${docId}`);
  } catch (err) {
    logger.error(`[GTWY RAG] updateResource failed for ${docId}:`, err?.response?.data || err.message);
  }
};

/**
 * Delete a RAG resource (e.g. when a profile is removed).
 */
const deleteResource = async (docId) => {
  if (!GTWY_AUTH_KEY || !docId) return;
  try {
    await axios.delete(
      `${GTWY_DB_URL}/api/rag/resource/${docId}`,
      { headers: gtwyHeaders(), timeout: TIMEOUT_MS }
    );
    logger.info(`[GTWY RAG] Deleted resource: ${docId}`);
  } catch (err) {
    logger.error(`[GTWY RAG] deleteResource failed for ${docId}:`, err?.response?.data || err.message);
  }
};

/**
 * Query GTWY RAG for relevant context given a user question.
 * Returns array of { docId, score, content } results.
 *
 * When to call:
 *  - On every POST /api/chat/process before calling LLM
 *  - ownerId = null to search across all profiles (global search)
 *  - Use returned content as context for LLM SQL generation
 */
const queryRag = async ({ query, ownerId = null, limit = 5 }) => {
  if (!GTWY_AUTH_KEY || !COLLECTION_ID) {
    logger.warn("[GTWY RAG] Not configured — skipping RAG query");
    return [];
  }
  try {
    const body = {
      collection_id: COLLECTION_ID,
      owner_id: ownerId || "public",
      query,
      score: 0.5
    };

    const res = await axios.post(
      `${GTWY_QUERY_URL}/rag/query`,
      body,
      { headers: gtwyHeaders(), timeout: TIMEOUT_MS }
    );

    const results = [];
    if (Array.isArray(res.data?.results)) {
      for (const r of res.data.results) {
        if (r.id) {
          results.push({
            docId: r.payload?.resourceId,
            score: r.score,
            content: r.payload?.content || ""
          });
        }
      }
    }

    logger.info(`[GTWY RAG] Query returned ${results.length} results`);
    return results.slice(0, limit);
  } catch (err) {
    logger.error("[GTWY RAG] queryRag failed:", err?.response?.data || err.message);
    return [];
  }
};

/**
 * Build a human-readable profile summary for RAG indexing.
 * Called after a profile is ingested into the DB.
 */
const buildProfileContent = (profile) => {
  const m = profile.meta || profile;
  return [
    `Float ID: ${m.float_id || m.platform_number || "unknown"}`,
    `Profile key: ${m.profile_key || ""}`,
    `Date: ${m.profile_date || m.date || ""}`,
    `Latitude: ${m.latitude || m.lat || ""}`,
    `Longitude: ${m.longitude || m.lon || ""}`,
    `DAC: ${m.dac || ""}`,
    `Data type: ${m.data_type || "core"}`,
    `Depth range: ${m.min_depth || 0}m – ${m.max_depth || ""}m`,
    `Temperature range: ${m.temp_min || ""}°C – ${m.temp_max || ""}°C`,
    `Salinity range: ${m.psal_min || ""} – ${m.psal_max || ""} PSU`,
    `BGC variables: ${m.bgc_vars || "none"}`,
    `Levels: ${m.n_levels || ""}`,
    `Ocean region: ${m.ocean || ""}`,
    `Project: ${m.project_name || ""}`,
    `PI: ${m.pi_name || ""}`
  ].filter(l => !l.endsWith(": ") && !l.endsWith(": undefined")).join("\n");
};

module.exports = {
  createResource,
  updateResource,
  deleteResource,
  queryRag,
  buildProfileContent
};
