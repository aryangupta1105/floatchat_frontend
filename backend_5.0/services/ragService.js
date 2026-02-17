// services/ragService.js
const axios = require("axios");
const ragConfig = require("../config/rag");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/error");

/**
 * Call RAG /search to get semantic context for the question.
 * FastAPI response shape:
 * {
 *   "topK": [...],
 *   "contextText": "...",
 *   "metadata": [...]
 * }
 */
const fetchContext = async (question, topK = 5) => {
  if (!ragConfig.baseUrl) {
    throw new AppError("RAG_BASE_URL not configured", 500, "RAG_CONFIG_ERROR");
  }

  const url = `${ragConfig.baseUrl}/search`;

  try {
    const response = await axios.post(
      url,
      { question, topK },
      {
        timeout: ragConfig.timeoutMs,
        headers: {
          ...(ragConfig.apiKey ? { "x-api-key": ragConfig.apiKey } : {})
        }
      }
    );

    const { topK: results, contextText, metadata } = response.data || {};

    return {
      results: results || [],
      context: contextText || "",
      metadata: metadata || []
    };
  } catch (err) {
    logger.error("RAG /search error:", err?.response?.data || err);
    throw new AppError("Failed to fetch RAG context", 502, "RAG_SEARCH_ERROR");
  }
};

/**
 * Optional: call RAG /generate (Gemini) if you want RAG-side text generation.
 * Not required for SQL, since we use Llama for SQL + final answer.
 */
const ragGenerate = async (prompt, options = {}) => {
  if (!ragConfig.baseUrl) {
    throw new AppError("RAG_BASE_URL not configured", 500, "RAG_CONFIG_ERROR");
  }

  const url = `${ragConfig.baseUrl}/generate`;

  try {
    const response = await axios.post(
      url,
      { prompt, ...options },
      {
        timeout: ragConfig.timeoutMs,
        headers: {
          ...(ragConfig.apiKey ? { "x-api-key": ragConfig.apiKey } : {})
        }
      }
    );

    return response.data.text;
  } catch (err) {
    logger.error("RAG /generate error:", err?.response?.data || err);
    throw new AppError("RAG generate failed", 502, "RAG_GENERATE_ERROR");
  }
};

module.exports = {
  fetchContext,
  ragGenerate
};
