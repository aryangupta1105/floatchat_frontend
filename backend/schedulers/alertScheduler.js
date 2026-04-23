// schedulers/alertScheduler.js
const { runDueAlerts } = require("../services/alertService");
const { logger } = require("../utils/logger");

const runTick = async () => {
  logger.info("Running alert scheduler tick...");
  const events = await runDueAlerts();
  logger.info(`Alert scheduler completed. New events: ${events.length}`);
};

module.exports = {
  runTick
};
