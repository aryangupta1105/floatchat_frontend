// routes/test.routes.js (if not exists) - Test endpoints
const express = require("express");
const router = express.Router();
const { logger } = require("../utils/logger");

// Simple test endpoint that echoes back the request
router.post("/echo", (req, res) => {
  logger.info("Echo endpoint received:", req.body);
  res.json({
    ok: true,
    received: req.body,
    message: "Echo successful"
  });
});

// Test endpoint for query without auth
router.post("/query-test", (req, res) => {
  logger.info("Query test endpoint received:", req.body);
  const { question, mode } = req.body;
  
  if (!question) {
    return res.status(400).json({
      ok: false,
      error: { message: "question is required" }
    });
  }
  
  res.json({
    ok: true,
    received: {
      question,
      mode: mode || "auto"
    },
    message: "Test query received successfully"
  });
});

// Test endpoint for health
router.get("/status", (req, res) => {
  res.json({
    ok: true,
    status: "test endpoints working",
    time: new Date().toISOString()
  });
});

module.exports = router;
