// services/emailService.js
const nodemailer = require("nodemailer");
const { Resend } = require("resend");
const { logger } = require("../utils/logger");

// ── Nodemailer transport (for OTP emails) ─────────────────────────
let transporter = null;

const getTransporter = () => {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: 587,
    secure: false,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });
  return transporter;
};

const sendOtpEmail = async (to, code) => {
  const t = getTransporter();
  const from = process.env.MAIL_FROM || process.env.MAIL_USER;

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
    const info = await t.sendMail({
      from: `"FloatChat" <${from}>`,
      to,
      subject: "FloatChat — Email Verification Code",
      html,
    });
    logger.info("OTP email sent:", info.messageId);
    return true;
  } catch (err) {
    logger.error("OTP email send failed:", err.message);
    return false;
  }
};

// ── Resend transport (for alert emails) ───────────────────────────
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
  sendAlertEmail,
  sendOtpEmail
};
