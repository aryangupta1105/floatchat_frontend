// models/ChatHistory.js
const { query } = require("../config/db");
const { logger } = require("../utils/logger");

const TABLE = "chat_history";

const create = async ({ userId, question, type, sql, answer, rows, status, durationMs, responseData, visualizationType }) => {
  try {
    const res = await query(
      `INSERT INTO ${TABLE} (user_id, question, type, sql, answer, final_answer, rows, response_data, visualization_type, status, duration_ms)
       VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [userId || null, question, type || null, sql || null, answer || null, rows || 0, responseData ? JSON.stringify(responseData) : null, visualizationType || null, status || "completed", durationMs || null]
    );
    return res.rows[0];
  } catch (err) {
    logger.warn("ChatHistory.create error:", err.message);
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
  // Subquery picks the N most recent, then outer query orders ASC for chronological display.
  // This avoids the bug where .reverse() on a flat [user,assistant,...] array misorders pairs.
  const res = await query(
    `SELECT * FROM (
       SELECT
         id,
         question,
         answer,
         type,
         sql,
         status,
         rows,
         response_data,
         visualization_type,
         created_at
       FROM ${TABLE}
       WHERE ($1::uuid IS NULL OR user_id = $1)
       ORDER BY created_at DESC
       LIMIT $2
     ) sub
     ORDER BY created_at ASC`,
    [userId, limit]
  );
  // Each DB row becomes a user message + assistant message pair (already chronological)
  const pairs = [];
  for (const r of res.rows) {
    const hasViz = (r.rows || 0) > 0;
    const storedData = r.response_data || null;
    const vizType = r.visualization_type || (hasViz ? (r.type === "data_query" ? "table" : null) : null);
    pairs.push({
      _id: r.id + "_q",
      type: "user",
      content: r.question,
      createdAt: r.created_at
    });
    pairs.push({
      _id: r.id + "_a",
      type: "assistant",
      question: r.question,
      response: {
        content: r.answer || "",
        hasVisualization: hasViz,
        visualizationType: vizType,
        data: storedData || (hasViz ? { sql: r.sql || null, rowCount: r.rows } : null)
      },
      createdAt: r.created_at
    });
  }
  return pairs;
};

const getRecentContext = async (userId, limit = 5) => {
  try {
    const res = await query(
      `SELECT question, answer, sql FROM ${TABLE}
       WHERE ($1::uuid IS NULL OR user_id = $1)
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, limit]
    );
    // Return in chronological order (oldest first)
    return res.rows.reverse().map(r => ({
      question: r.question,
      answer: (r.answer || "").substring(0, 300),
      sql: r.sql || null
    }));
  } catch (err) {
    logger.warn("ChatHistory.getRecentContext error:", err.message);
    return [];
  }
};

module.exports = {
  create,
  update,
  listRecentByUser,
  getRecentContext
};
