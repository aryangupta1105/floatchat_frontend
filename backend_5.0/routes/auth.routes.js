// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

router.post("/signup", authController.signup);
router.post("/login", authController.login);
router.get("/me", requireAuth, authController.me);
router.post("/send-otp", requireAuth, authController.sendOtp);
router.post("/verify-otp", requireAuth, authController.verifyOtp);

module.exports = router;
