// services/emailService.js
const { Resend } = require("resend");
const { logger } = require("../utils/logger");

let resendClient = null;

const init = () => {
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY missing in environment");
    return null;
  }
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

const sendAlertEmail = async ({ to, subject, text }) => {
  if (!resendClient) init();

  if (!resendClient) {
    logger.warn("Resend not configured — skipping email");
    return false;
  }

  try {
    const response = await resendClient.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "FloatChat Alerts <alerts@example.com>",
      to,
      subject,
      text,
    });

    logger.info("Resend email sent:", response?.id || response);
    return true;
  } catch (err) {
    logger.error("Resend email send failed:", err);
    return false;
  }
};

module.exports = {
  sendAlertEmail
};
