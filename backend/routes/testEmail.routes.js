const express = require("express");
const router = express.Router();
const { sendAlertEmail } = require("../services/emailService");

router.get("/test-email", async (req, res) => {
  try {
    const to = req.query.to;  

    if (!to) {
      return res.status(400).json({
        ok: false,
        message: "Missing ?to=prajvalpanchal707@gmail.com"
      });
    }

    const success = await sendAlertEmail({
      to,
      subject: "FloatChat Email Test",
      text: "This is a test email from your FloatChat backend. ✔️"
    });

    return res.json({
      ok: success,
      message: success
        ? "Test email sent successfully!"
        : "Email sending failed. Check logs."
    });
  } catch (err) {
    return res.status(500).json({
      ok: false,
      message: err.message
    });
  }
});

module.exports = router;
