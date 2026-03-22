// services/emailService.js
const { logger } = require("../utils/logger");

const MAILEROO_API_URL = "https://smtp.maileroo.com/api/v2/emails";

// ── Shared Maileroo sender ──────────────────────────────────
const sendViaMaileroo = async ({ to, toName, subject, html, plain }) => {
  const apiKey = process.env.MAILEROO_API_KEY;
  const fromAddr = "floatchat@5842dc8d9446e20b.maileroo.org";
  const fromName = process.env.MAILEROO_FROM_NAME || "FloatChat";

  if (!apiKey || !fromAddr) {
    logger.error("[Maileroo] MAILEROO_API_KEY or MAILEROO_FROM_EMAIL env var missing");
    return false;
  }

  const body = {
    from: { address: fromAddr, display_name: fromName },
    to: [{ address: to, display_name: toName || to }],
    subject,
  };
  if (html) body.html = html;
  if (plain) body.plain = plain;

  try {
    const res = await fetch(MAILEROO_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      logger.error(`[Maileroo] ${res.status} — ${JSON.stringify(data)}`);
      return false;
    }

    logger.info(`[Maileroo] Email sent to ${to}:`, JSON.stringify(data));
    return true;
  } catch (err) {
    logger.error("[Maileroo] Request failed:", err.message || err);
    return false;
  }
};

// ── OTP emails ──────────────────────────────────────────────
const sendOtpEmail = async (to, code) => {
  logger.info(`[OTP] Sending to: ${to}`);

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

  return sendViaMaileroo({
    to,
    subject: "FloatChat — Email Verification Code",
    html,
  });
};

// ── Alert emails ────────────────────────────────────────────
const sendAlertEmail = async ({ to, subject, text }) => {
  return sendViaMaileroo({ to, subject, plain: text });
};

module.exports = {
  sendAlertEmail,
  sendOtpEmail
};
