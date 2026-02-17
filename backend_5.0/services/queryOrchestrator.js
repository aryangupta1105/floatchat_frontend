/**
 * services/queryOrchestrator.js
 * 
 * Simplified query orchestrator:
 * 1. Call RAG service to get SQL
 * 2. Execute SQL against database
 * 3. Use LLM to finalize/explain the answer
 */

const axios = require("axios");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/error");
const llmService = require("./llmService");
const sqlService = require("./sqlService");

const RAG_SERVICE_URL = process.env.RAG_SERVICE_URL || "http://localhost:8000";
const RAG_TIMEOUT_MS = parseInt(process.env.RAG_TIMEOUT_MS || "10000", 10);

/**
 * Call RAG service to get SQL from question
 */
async function callRagService(question) {
  try {
    const response = await axios.post(
      `${RAG_SERVICE_URL}/rag`,
      { query: question },
      { timeout: RAG_TIMEOUT_MS }
    );

    if (response.data.status !== "success") {
      throw new Error(response.data.message || "RAG service returned error");
    }

    const sql = response.data.sql;
    logger.info(`RAG response - SQL type: ${typeof sql}, Content: ${sql ? sql.substring(0, 100) : "null"}`);
    
    return sql || null;
  } catch (err) {
    logger.error("RAG service error:", err?.response?.data || err?.message);
    throw new AppError("Failed to get SQL from RAG service", 502, "RAG_ERROR");
  }
}

/**
 * Main query processing:
 * 1. Get SQL from RAG
 * 2. Execute SQL
 * 3. Finalize answer with LLM
 */
async function processQuery(question, mode = "auto") {
  if (!question || question.trim() === "") {
    throw new AppError("Question is required", 400, "INVALID_INPUT");
  }

  let sql = null;
  let rows = [];
  let error = null;
  let answer = null;

  try {
    logger.info(`Processing query: ${question}`);

    // Step 1: Get SQL from RAG service
    sql = await callRagService(question);
    
    if (!sql) {
      error = "RAG service returned no SQL";
      logger.warn("RAG returned null SQL");
      // Use LLM to answer directly
      try {
        const systemPrompt = `You are an expert in oceanography and Argo float data systems. 
Answer questions about Argo floats based on your knowledge.`;
        answer = await llmService.callLlm({
          prompt: question,
          systemPrompt
        });
      } catch (llmErr) {
        logger.warn("LLM direct answer failed:", llmErr);
        answer = "Unable to process your question. Please try rephrasing it.";
      }
      
      return {
        ok: true,
        type: "query_result",
        question,
        sql: null,
        raw_rows: [],
        answer: answer,
        meta: {
          rowCount: 0,
          error: error
        }
      };
    }

    // Check if RAG returned actual SQL or text response
    const isSqlQuery = sql.trim().toUpperCase().startsWith('SELECT');
    
    if (!isSqlQuery) {
      // RAG returned text instead of SQL - treat as conceptual question
      logger.info("RAG returned non-SQL response, treating as conceptual question");
      try {
        const systemPrompt = `You are an expert in oceanography and Argo float data systems. 
Answer conceptual questions about Argo floats, oceanography, and data collection based on your knowledge.
Provide clear, informative, and accurate answers.`;
        answer = await llmService.callLlm({
          prompt: question,
          systemPrompt
        });
      } catch (llmErr) {
        logger.warn("LLM answer generation failed:", llmErr);
        answer = "Unable to process your question. Please try rephrasing it.";
      }
      
      return {
        ok: true,
        type: "query_result",
        question,
        sql: null,
        raw_rows: [],
        answer,
        meta: {
          rowCount: 0,
          error: null
        }
      };
    }

    logger.info(`RAG generated SQL: ${sql.substring(0, 150)}...`);

    // Step 2: Execute SQL against database
    try {
      const result = await sqlService.execute(sql);
      rows = result.rows || [];
      logger.info(`Query returned ${rows.length} rows`);
    } catch (sqlErr) {
      logger.error("SQL execution error:", sqlErr);
      error = sqlErr.message;
      // If SQL execution fails, try to provide answer anyway
      answer = `Query execution failed: ${sqlErr.message}`;
      
      return {
        ok: false,
        type: "query_result",
        question,
        sql,
        raw_rows: [],
        answer,
        error: error
      };
    }

    // Step 3: Use LLM to finalize/explain the answer
    if (rows && Array.isArray(rows) && rows.length > 0) {
      try {
        answer = await llmService.finalizeAnswer({
          question,
          sql,
          rows: rows.slice(0, 20), // Limit to 20 rows for prompt
          context: "Argo float oceanographic data"
        });
      } catch (llmErr) {
        logger.warn("LLM explanation failed, using basic answer:", llmErr);
        answer = `Found ${rows.length} matching records from the database.`;
      }
    } else if (rows && Array.isArray(rows) && rows.length === 0) {
      answer = "Query executed successfully but returned no matching records.";
    } else {
      answer = "Query completed.";
    }

    return {
      ok: true,
      type: "query_result",
      question,
      sql,
      raw_rows: rows,
      answer,
      meta: {
        rowCount: rows.length,
        error: null
      }
    };

  } catch (err) {
    logger.error("Query processing error:", err);
    return {
      ok: false,
      type: "query_result",
      question,
      sql,
      raw_rows: [],
      answer: err.message || "Failed to process query",
      error: {
        message: err.message || "Failed to process query",
        code: "QUERY_ERROR"
      }
    };
  }
}

module.exports = {
  processQuery,
  callRagService
};
