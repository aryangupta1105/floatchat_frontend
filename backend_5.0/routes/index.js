// routes/index.js
const express = require("express");
const chatRoutes = require("./chat.routes");
const alertsRoutes = require("./alerts.routes");
const testEmailRoutes = require("./testEmail.routes");
const ingestRoutes = require("./ingest.routes");

const router = express.Router();

const authRoutes = require("./auth.routes");

router.use("/auth", authRoutes);
router.use("/chat", chatRoutes);
router.use("/alerts", alertsRoutes);
router.use("/ingest", ingestRoutes);  // NEW: ingestion API proxy
router.use("/test", testEmailRoutes);

module.exports = router;
