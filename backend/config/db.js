// config/db.js
const { Pool } = require("pg");
const config = require("./index");
const { logger } = require("../utils/logger");

if (!config.db.url) {
  logger.warn("DATABASE_URL not set – Postgres connection may fail");
}

const pool = new Pool({
  connectionString: config.db.url,
  max: config.db.maxConnections,
  ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : false
});

pool.on("error", (err) => {
  logger.error("Unexpected Postgres pool error", err);
});

const query = async (text, params) => {
  const start = Date.now();
  const res = await pool.query(text, params);
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn(`Slow query (${duration}ms): ${text}`);
  }
  return res;
};

module.exports = {
  pool,
  query
};
