// controllers/authController.js
const authService = require("../services/authService");
const otpService = require("../services/otpService");

const signup = async (req, res) => {
  try {
    const { name, username, email, password } = req.body;
    const { user, token } = await authService.signup({ name, username, email, password });
    res.status(201).json({
      message: "Signup successful",
      user: { id: user.id, username: user.username, email: user.email, is_verified: user.is_verified || false },
      token
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const { user, token } = await authService.login({ email, password });
    res.json({
      message: "Login successful",
      user: { id: user.id, username: user.username, email: user.email, is_verified: user.is_verified || false },
      token
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const me = async (req, res) => {
  try {
    const user = await authService.me(req.user.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json({ user: { id: user.id, username: user.username, email: user.email, is_verified: user.is_verified || false } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const sendOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });
    await otpService.sendOtp(email);
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

const verifyOtp = async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ error: "Email and code are required" });
    await otpService.verifyOtp(email, code);
    const user = await authService.verifyOtp(req.user.id);
    res.json({
      message: "Email verified successfully",
      user: { id: user.id, username: user.username, email: user.email, is_verified: true }
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

module.exports = { signup, login, me, sendOtp, verifyOtp };

