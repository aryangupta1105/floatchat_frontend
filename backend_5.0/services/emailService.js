// services/emailService.js
const { Resend } = require("resend");
const { logger } = require("../utils/logger");

// ── Resend client (shared by OTP + alert emails) ─────────────────
let resendClient = null;

const getResendClient = () => {
  if (resendClient) return resendClient;
  if (!process.env.RESEND_API_KEY) {
    logger.warn("RESEND_API_KEY missing in environment");
    return null;
  }
  resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
};

// ── OTP emails (via Resend HTTP API) ──────────────────────────────
const sendOtpEmail = async (to, code) => {
  const client = getResendClient();
  const from = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

  logger.info(`[OTP] Sending to: ${to}, from: ${from}, RESEND_API_KEY: ${process.env.RESEND_API_KEY ? 'SET' : 'MISSING'}`);

  if (!client) {
    logger.error('[OTP] Resend client not initialized — RESEND_API_KEY missing');
    return false;
  }

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;background:#1e293b;border-radius:12px;color:#f1f5f9;">
      <h2 style="text-align:center;color:#38bdf8;margin-bottom:8px;">FloatChat</h2>
      <p style="text-align:center;color:#94a3b8;font-size:14px;">AI-Powered Ocean Data Interface</p>
      <div style="background:#0f172a;border-radius:8px;padding:24px;margin:20px 0;text-align:center;">
        <p style="color:#cbd5e1;margin:0 0 12px;">Your verification code is:</p>
        <div style="font-size:32px;font-weight:bold;letter-spacing:8px;color:#38bdf8;">${code}</div>
      </div>
      <p style="color:#94a3b8;font-size:12px;text-align:center;">This code expires in 10 minutes. Do not share it with anyone.</p>
    </div>
  `;

  try {
    const response = await client.emails.send({
      from: `"FloatChat" <${from}>`,
      to,
      subject: "FloatChat — Email Verification Code",
      html,
    });
    logger.info("OTP email sent:", response?.id || response);
    return true;
  } catch (err) {
    logger.error("OTP email send failed:", err.message || err);
    return false;
  }
};

// ── Alert emails (via Resend HTTP API) ────────────────────────────
const sendAlertEmail = async ({ to, subject, text }) => {
  const client = getResendClient();

  if (!client) {
    logger.warn("Resend not configured — skipping alert email");
    return false;
  }

  try {
    const response = await client.emails.send({
      from: process.env.RESEND_FROM_EMAIL || "FloatChat Alerts <alerts@example.com>",
      to,
      subject,
      text,
    });

    logger.info("Alert email sent:", response?.id || response);
    return true;
  } catch (err) {
    logger.error("Alert email send failed:", err);
    return false;
  }
};

module.exports = {
  sendAlertEmail,
  sendOtpEmail
};
