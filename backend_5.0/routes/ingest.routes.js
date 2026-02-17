/**
 * routes/ingest.routes.js
 * 
 * Proxy routes to the ingestion service
 * Allows frontend to control ingestion from main backend origin
 */

const express = require("express");
const axios = require("axios");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/error");
const { success } = require("../controllers/baseController");

const router = express.Router();

const INGEST_SERVICE_URL = process.env.INGEST_SERVICE_URL || "http://localhost:8100";
const INGEST_TIMEOUT_MS = parseInt(process.env.INGEST_TIMEOUT_MS || "60000", 10);

/**
 * POST /api/ingest/run
 * Proxy to ingestion service
 */
router.post("/run", async (req, res, next) => {
  try {
    const body = req.body || {};

    const response = await axios.post(
      `${INGEST_SERVICE_URL}/ingest/run`,
      body,
      { timeout: INGEST_TIMEOUT_MS }
    );

    return success(res, response.data);
  } catch (err) {
    logger.error("Ingest run error:", err?.message);

    if (err.response?.status === 409) {
      return next(new AppError("Ingestion already in progress", 409, "INGEST_RUNNING"));
    }

    return next(new AppError(
      err.response?.data?.error || "Ingestion service error",
      err.response?.status || 500,
      "INGEST_ERROR"
    ));
  }
});

/**
 * GET /api/ingest/status
 * Proxy to ingestion service
 */
router.get("/status", async (req, res, next) => {
  try {
    const response = await axios.get(
      `${INGEST_SERVICE_URL}/ingest/status`,
      { timeout: INGEST_TIMEOUT_MS }
    );

    return success(res, response.data);
  } catch (err) {
    logger.error("Ingest status error:", err?.message);

    return next(new AppError(
      err.response?.data?.error || "Failed to fetch ingestion status",
      err.response?.status || 500,
      "INGEST_ERROR"
    ));
  }
});

module.exports = router;
