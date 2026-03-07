// services/otpService.js — Generate, send, and verify OTP codes
const crypto = require("crypto");
const Otp = require("../models/Otp");
const { sendOtpEmail } = require("./emailService");

const generateCode = () => {
  return crypto.randomInt(100000, 999999).toString();
};

const sendOtp = async (email) => {
  const code = generateCode();
  await Otp.create(email, code, 10); // 10 min expiry
  const sent = await sendOtpEmail(email, code);
  if (!sent) throw new Error("Failed to send OTP email");
  return true;
};

const verifyOtp = async (email, code) => {
  const record = await Otp.findLatestValid(email, code);
  if (!record) throw new Error("Invalid or expired OTP");
  await Otp.markUsed(record.id);
  return true;
};

module.exports = { sendOtp, verifyOtp };
