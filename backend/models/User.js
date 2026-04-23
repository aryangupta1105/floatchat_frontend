// models/User.js  — PostgreSQL-backed (replaces Mongoose model)
const { query } = require("../config/db");

const TABLE = "users";

const ensureTable = async () => {
  await query(`
    CREATE TABLE IF NOT EXISTS ${TABLE} (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      username    TEXT NOT NULL,
      email       TEXT NOT NULL UNIQUE,
      password    TEXT NOT NULL,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at  TIMESTAMPTZ DEFAULT NOW(),
      updated_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);
  // Add column if table already exists without it
  await query(`ALTER TABLE ${TABLE} ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE`).catch(() => {});
};

const findOne = async ({ email }) => {
  const res = await query(`SELECT * FROM ${TABLE} WHERE email = $1 LIMIT 1`, [email]);
  return res.rows[0] || null;
};

const findById = async (id) => {
  const res = await query(`SELECT id, username, email, is_verified, created_at FROM ${TABLE} WHERE id = $1 LIMIT 1`, [id]);
  return res.rows[0] || null;
};

const markVerified = async (id) => {
  const res = await query(
    `UPDATE ${TABLE} SET is_verified = TRUE, updated_at = NOW() WHERE id = $1 RETURNING id, username, email, is_verified`,
    [id]
  );
  return res.rows[0] || null;
};

const updatePassword = async (id, hashedPassword) => {
  await query(
    `UPDATE ${TABLE} SET password = $1, updated_at = NOW() WHERE id = $2`,
    [hashedPassword, id]
  );
};

const create = async ({ username, email, password }) => {
  const res = await query(
    `INSERT INTO ${TABLE} (username, email, password) VALUES ($1, $2, $3) RETURNING id, username, email, created_at`,
    [username, email, password]
  );
  return res.rows[0];
};

module.exports = { ensureTable, findOne, findById, create, markVerified, updatePassword };
