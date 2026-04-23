// schedulers/index.js
const { logger } = require("../utils/logger");
const { alertService } = require("../services");
const config = require("../config");

const startSchedulers = () => {
  const freqMinutes = config.alerts?.defaultFrequencyMinutes || 30;
  const intervalMs = freqMinutes * 60 * 1000;

  logger.info(`Starting alert scheduler (every ${freqMinutes} minutes)`);

  setInterval(async () => {
    try {
      logger.info("Running alert scheduler tick...");
      const events = await alertService.runDueAlerts();
      logger.info(`Alert scheduler completed. New events: ${events.length}`);
    } catch (err) {
      logger.error("Alert scheduler error:", err);
    }
  }, intervalMs);
};

module.exports = {
  startSchedulers
};
