// models/Otp.js — OTP codes table
const { query } = require("../config/db");

const TABLE = "otp_codes";

const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id         SERIAL PRIMARY KEY,
      email      TEXT NOT NULL,
      code       TEXT NOT NULL,
      expires_at TIMESTAMPTZ NOT NULL,
      used       BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);
};

const create = async (email, code, expiresInMinutes = 10) => {
  // Invalidate any previous unused codes for this email
  await query(`UPDATE ${TABLE} SET used = TRUE WHERE email = $1 AND used = FALSE`, [email]);

  const res = await query(
    `INSERT INTO ${TABLE} (email, code, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${expiresInMinutes} minutes')
     RETURNING id, email, code, expires_at`,
    [email, code]
  );
  return res.rows[0];
};

const findLatestValid = async (email, code) => {
  const res = await query(
    `SELECT * FROM ${TABLE}
     WHERE email = $1 AND code = $2 AND used = FALSE AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [email, code]
  );
  return res.rows[0] || null;
};

const markUsed = async (id) => {
  await query(`UPDATE ${TABLE} SET used = TRUE WHERE id = $1`, [id]);
};

module.exports = { ensureTable, create, findLatestValid, markUsed };
