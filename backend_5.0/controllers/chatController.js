/**
 * controllers/chatController.js
 *
 * Final version:
 *  - Conceptual → LLM only
 *  - Data query → RAG → SQL → execute SQL EXACTLY as given → LLM final answer
 */

const { ValidationError } = require("../utils/error");
const { success } = require("./baseController");
const ChatHistory = require("../models/ChatHistory");
const { logger } = require("../utils/logger");
const queryOrchestrator = require("../services/queryOrchestrator");

const processQuery = async (req, res, next) => {
  const startedAt = Date.now();

  try {
    const { question, mode = "auto" } = req.body;
    const userId = req.user?.id || null;

    if (!question || typeof question !== "string") {
      throw new ValidationError("Question is required and must be a string");
    }

    logger.info(`📩 Received question: "${question}"`);

    // =====================================================
    //  STEP 1 — Let orchestrator fully handle classification + data flow
    // =====================================================
    const result = await queryOrchestrator.processQuery(question, mode);

    // result:
    // {
    //   type: "conceptual" | "data_query",
    //   answer: string,
    //   sql: string | null,
    //   raw_rows: array,
    //   error: null | string
    // }

    const durationMs = Date.now() - startedAt;

    // =====================================================
    //  STEP 2 — Save history (non-blocking)
    // =====================================================
    try {
      await ChatHistory.create({
        userId,
        question,
        type: result.type,
        sql: result.sql || null,          // ← SQL saved exactly as RAG gave it
        answer: result.answer,
        rows: result.raw_rows?.length || 0,
        status: result.error ? "error" : "completed",
        durationMs
      });
    } catch (err) {
      logger.warn("⚠ Failed to save chat history:", err.message);
    }

    // =====================================================
    //  STEP 3 — Return response to frontend
    // =====================================================
    return success(res, {
      ok: true,
      question,
      type: result.type,
      answer: result.answer,
      sql: result.sql || null,            // ← NO MODIFICATION
      rows: result.raw_rows || [],
      rowCount: result.raw_rows?.length || 0,
      meta: {
        durationMs,
        error: result.error || null
      }
    });

  } catch (err) {
    logger.error("❌ Error in processQuery:", err);
    return next(err);
  }
};


const getHistory = async (req, res, next) => {
  try {
    const userId = req.user?.id || null;
    const history = await ChatHistory.listRecentByUser(userId, 20);
    return success(res, { history });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  processQuery,
  getHistory
};
