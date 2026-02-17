// routes/alerts.routes.js
const express = require("express");
const alertsController = require("../controllers/alertsController");

const router = express.Router();

// In a real app, add auth middleware before these routes
router.post("/", alertsController.createAlert);
router.get("/", alertsController.listAlerts);
router.patch("/:id", alertsController.updateAlert);
router.delete("/:id", alertsController.deleteAlert);

module.exports = router;
