// models/ChatHistory.js
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

const TABLE = "chat_history";

const create = async ({ userId, question, status }) => {
  try {
    const res = await query(
      `
        INSERT INTO ${TABLE} (user_id, question, status)
        VALUES ($1, $2, $3)
        RETURNING *
      `,
      [userId, question, status]
    );
    return res.rows[0];
  } catch (err) {
    logger.warn("ChatHistory.create error - database may be unavailable:", err.message);
    // Return null instead of throwing to allow graceful degradation
    return null;
  }
};

const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return null;

  const setClauses = keys.map((k, idx) => `${k} = $${idx + 2}`);
  const values = [id, ...keys.map((k) => fields[k])];

  const res = await query(
    `
      UPDATE ${TABLE}
      SET ${setClauses.join(", ")}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `,
    values
  );

  return res.rows[0];
};

const listRecentByUser = async (userId, limit = 20) => {
  const res = await query(
    `
      SELECT id, question, final_answer, status, created_at
      FROM ${TABLE}
      WHERE ($1::uuid IS NULL OR user_id = $1)
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [userId, limit]
  );
  return res.rows;
};

module.exports = {
  create,
  update,
  listRecentByUser
};
