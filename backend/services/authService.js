// services/authService.js  — PostgreSQL-backed
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const signup = async ({ username, name, email, password }) => {
  const uname = username || name || email.split("@")[0];
  const exists = await User.findOne({ email });

  if (exists && exists.is_verified) {
    throw new Error("Email already registered");
  }

  const hashed = await bcrypt.hash(password, 10);

  if (exists && !exists.is_verified) {
    // Unverified account — update password and let them retry OTP
    await User.updatePassword(exists.id, hashed);
    const { password: _pw, ...safeUser } = exists;
    return { user: { ...safeUser, is_verified: false }, token: generateToken(exists.id) };
  }

  const user = await User.create({ username: uname, email, password: hashed });
  return { user: { ...user, is_verified: false }, token: generateToken(user.id) };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email });
  if (!user) throw new Error("Invalid email or password");

  const match = await bcrypt.compare(password, user.password);
  if (!match) throw new Error("Invalid email or password");

  const { password: _pw, ...safeUser } = user;
  return { user: safeUser, token: generateToken(user.id) };
};

const verifyOtp = async (userId) => {
  const user = await User.markVerified(userId);
  if (!user) throw new Error("User not found");
  return user;
};

const me = async (id) => {
  return await User.findById(id);
};

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
};

module.exports = { signup, login, me, verifyOtp };
