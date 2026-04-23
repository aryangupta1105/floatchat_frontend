// routes/index.js
const express = require("express");
const authRoutes      = require("./auth.routes");
const chatRoutes      = require("./chat.routes");
const alertsRoutes    = require("./alerts.routes");
const testEmailRoutes = require("./testEmail.routes");
const ingestRoutes    = require("./ingest.routes");
const floatsRoutes    = require("./floats.routes");
const profilesRoutes  = require("./profiles.routes");
const dashboardRoutes = require("./dashboard.routes");
const dataRoutes      = require("./data.routes");

const router = express.Router();

router.use("/auth",      authRoutes);
router.use("/chat",      chatRoutes);
router.use("/floats",    floatsRoutes);
router.use("/profiles",  profilesRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/data",      dataRoutes);
router.use("/alerts",    alertsRoutes);
router.use("/ingest",    ingestRoutes);
router.use("/test",      testEmailRoutes);

module.exports = router;
