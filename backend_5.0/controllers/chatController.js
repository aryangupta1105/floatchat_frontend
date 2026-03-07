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

    // Fetch recent conversation context for this user
    const chatHistory = await ChatHistory.getRecentContext(userId, 5);

    // =====================================================
    //  STEP 1 — Let orchestrator fully handle classification + data flow
    // =====================================================
    const result = await queryOrchestrator.processQuery(question, mode, chatHistory);

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
    //  STEP 2a — Chat/conceptual responses: no data, no visualization
    // =====================================================
    if (result.type === "chat") {
      try {
        await ChatHistory.create({
          userId, question, type: "chat", sql: null,
          answer: result.answer, rows: 0, status: "completed",
          durationMs, responseData: null, visualizationType: null
        });
      } catch (err) {
        logger.warn("⚠ Failed to save chat history:", err.message);
      }
      return res.json({
        ok: true,
        content: result.answer || "No answer available.",
        hasVisualization: false,
        hasAR: false,
        visualizationType: null,
        data: null,
        meta: { durationMs, error: null }
      });
    }

    // =====================================================
    //  STEP 2b — Build response data for data queries
    // =====================================================
    const rows = result.raw_rows || [];
    if (rows.length > 0) {
      logger.info(`Row columns: [${Object.keys(rows[0]).join(", ")}] | first row sample: ${JSON.stringify(rows[0]).substring(0, 200)}`);
    }
    const hasVisualization = rows.length > 0;
    let visualizationType = null;
    if (hasVisualization) {
      const r = rows[0];
      if (r?.latitude != null && r?.longitude != null && r?.depth == null) {
        visualizationType = "map";
      } else if (r?.depth != null) {
        visualizationType = "profile";
      } else if (r?.juld != null || r?.profile_date != null) {
        visualizationType = "timeseries";
      } else {
        visualizationType = "table";
      }
    }

    const responseData = hasVisualization ? {
      rows: rows.slice(0, 100),
      sql: result.sql || null,
      rowCount: rows.length
    } : null;

    // =====================================================
    //  STEP 3 — Save history with full response data
    // =====================================================
    try {
      await ChatHistory.create({
        userId,
        question,
        type: result.type,
        sql: result.sql || null,
        answer: result.answer,
        rows: result.raw_rows?.length || 0,
        status: result.error ? "error" : "completed",
        durationMs,
        responseData,
        visualizationType
      });
    } catch (err) {
      logger.warn("⚠ Failed to save chat history:", err.message);
    }

    // =====================================================
    //  STEP 4 — Return response to frontend
    // =====================================================
    return res.json({
      ok: true,
      content: result.answer || "No answer available.",
      hasVisualization,
      hasAR: false,
      visualizationType,
      data: responseData,
      meta: { durationMs, error: result.error || null }
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
