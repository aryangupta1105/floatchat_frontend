/**
 * services/queryOrchestrator.js
 * 
 * Simplified query orchestrator:
 * 1. Call RAG service to get SQL
 * 2. Execute SQL against database
 * 3. Use LLM to finalize/explain the answer
 */

const { logger } = require("../utils/logger");
const { AppError } = require("../utils/error");
const llmService = require("./llmService");
const sqlService = require("./sqlService");
const ragService = require("./ragService");

/**
 * Build a concise conversation context string from recent chat history
 */
function buildConversationContext(chatHistory) {
  if (!chatHistory || chatHistory.length === 0) return "";
  const lines = chatHistory.map(h => {
    let entry = `User: ${h.question}`;
    if (h.sql) entry += `\n[SQL used: ${h.sql.substring(0, 150)}]`;
    entry += `\nAssistant: ${h.answer}`;
    return entry;
  });
  return `\n\nRecent conversation history (use this for context on follow-up questions):\n---\n${lines.join("\n\n")}\n---\n`;
}

/**
 * Query GTWY RAG for semantic context, then use LLM to generate SQL
 */
async function callRagService(question, conversationCtx = "") {
  // Step 1: Get semantic context from GTWY RAG
  const ragResults = await ragService.queryRag({ query: question, limit: 5 });
  const ragContext = ragResults.map(r => r.content).filter(Boolean).join("\n\n");

  logger.info(`RAG context retrieved: ${ragContext.length} chars from ${ragResults.length} results`);

  // Step 2: Use LLM to generate SQL from question + RAG context
  try {
    const sql = await llmService.generateSql({ question, ragContext: ragContext + conversationCtx });
    logger.info(`LLM generated SQL: ${sql ? sql.substring(0, 100) : "null"}`);
    return sql || null;
  } catch (err) {
    logger.error("LLM SQL generation error:", err?.message);
    return null;
  }
}

// Action verbs that indicate the user wants actual data retrieval
const DATA_ACTION_WORDS = [
  "show", "list", "find", "fetch", "get", "give", "display", "retrieve",
  "plot", "chart", "graph", "map", "download", "export",
  "how many", "count", "average", "mean", "max", "min", "sum", "total",
  "compare", "between", "from", "in the", "near", "around", "within",
  "highest", "lowest", "deepest", "shallowest", "warmest", "coldest",
  "most", "least", "top", "bottom"
];

// Domain nouns — only trigger "data" when combined with an action word above
const DOMAIN_NOUNS = [
  "float", "profile", "temperature", "salinity", "depth", "pressure",
  "oxygen", "chlorophyll", "nitrate", "argo", "ocean", "sea", "latitude",
  "longitude", "dac", "platform", "cycle", "bgc", "core",
  "indian", "arabian", "bengal", "pacific", "atlantic"
];

/**
 * Classify intent: "data" → run RAG+SQL pipeline, "chat" → direct LLM reply
 */
// Patterns that are definitively conceptual/conversational — never need SQL
const CHAT_PATTERNS = [
  /^what is (a|an|the) /i,
  /^what are /i,
  /^explain /i,
  /^define /i,
  /^describe /i,
  /^tell me (about|more)/i,
  /^how does /i,
  /^how do /i,
  /^how (is|are) /i,
  /^why (is|are|does|do) /i,
  /^what (can|do|does) you/i,
  /^who are you/i,
  /^help( me)?$/i,
  /^i want to (understand|know|learn)/i,
  /^(can|could) you (explain|describe|tell)/i,
  /^(please )?(explain|describe|elaborate)/i,
  /^what('s| is) the (meaning|purpose|role|difference|importance)/i,
  /^(teach|educate) me/i,
  /^give me (an? )?(overview|introduction|summary|explanation)/i,
  /meaning of /i,
  /understand(ing)? (about|of|the) /i,
];

function classifyIntent(question, chatHistory = []) {
  const q = question.toLowerCase().trim();

  // Very short → chat
  if (q.length < 8) return "chat";

  // Greetings → chat
  const greetings = ["hi", "hello", "hey", "hii", "helo", "howdy", "sup", "yo", "thanks", "thank you", "ok", "okay", "bye", "good morning", "good evening"];
  if (greetings.some(g => q === g || q.startsWith(g + " ") || q.startsWith(g + "!"))) return "chat";

  // Check for data keywords FIRST — these override chat patterns
  const hasDomain = DOMAIN_NOUNS.some(kw => q.includes(kw));
  const hasAction = DATA_ACTION_WORDS.some(kw => q.includes(kw));

  // If question has BOTH a domain noun AND an action word → always data
  if (hasDomain && hasAction) return "data";

  // Follow-up detection: pronouns like "their/these/those/its" + domain/action + recent SQL history
  const hasFollowUpPronoun = /\b(their|these|those|its|them|the same|above|previous)\b/.test(q);
  const hasRecentDataQuery = chatHistory.some(h => h.sql);
  if (hasFollowUpPronoun && (hasDomain || hasAction) && hasRecentDataQuery) return "data";

  // Conceptual question patterns → chat (only if no data keywords matched above)
  if (CHAT_PATTERNS.some(p => p.test(q))) return "chat";

  // Explicit data-request verbs even without a domain noun
  if (hasAction && q.split(" ").length > 3) return "data";

  // Questions starting with "where/when/which" + domain noun → data
  if (/^(where|when|which)\b/.test(q) && hasDomain) return "data";

  // Default: treat as conversational
  return "chat";
}

/**
 * Main query processing:
 * 1. Classify intent
 * 2. If data: Get SQL from RAG → Execute → Finalize with LLM
 * 3. If chat: Direct LLM conversational reply
 */
async function processQuery(question, mode = "auto", chatHistory = []) {
  if (!question || question.trim() === "") {
    throw new AppError("Question is required", 400, "INVALID_INPUT");
  }

  let sql = null;
  let rows = [];
  let error = null;
  let answer = null;

  try {
    logger.info(`Processing query: ${question}`);

    // ── Intent classification ──
    const intent = mode === "auto" ? classifyIntent(question, chatHistory) : mode;
    logger.info(`Intent classified as: ${intent}`);

    const conversationCtx = buildConversationContext(chatHistory);

    if (intent === "chat") {
      // Fetch RAG context to ground the answer in real data
      let ragContext = "";
      try {
        const ragResults = await ragService.queryRag({ query: question, limit: 5 });
        ragContext = ragResults.map(r => r.content).filter(Boolean).join("\n\n");
        logger.info(`[Chat] RAG context: ${ragContext.length} chars from ${ragResults.length} results`);
      } catch (ragErr) {
        logger.warn("[Chat] RAG fetch failed, proceeding without context:", ragErr.message);
      }

      const contextBlock = ragContext
        ? `\n\nHere is relevant data from our Argo float database for reference:\n---\n${ragContext}\n---\nUse this data to enrich your answer when relevant, but don't just list raw data — explain it naturally.`
        : "";

      const systemPrompt = `You are FloatChat, an AI assistant specializing in Argo ocean float data and oceanography.
Be helpful, concise, and friendly. Answer conceptual and educational questions thoroughly using your knowledge of oceanography and Argo floats.
If the user asks about specific data retrieval (e.g. "show me floats"), let them know they can ask data-specific questions.${contextBlock}${conversationCtx}`;
      try {
        answer = await llmService.callLlm({ prompt: question, systemPrompt });
      } catch {
        answer = "Hello! I'm FloatChat, your Argo ocean data assistant. Ask me about float profiles, temperature, salinity, or any ocean data!";
      }
      return { ok: true, type: "chat", question, sql: null, raw_rows: [], answer };
    }

    // Step 1: Get SQL from RAG service (with conversation context for follow-ups)
    sql = await callRagService(question, conversationCtx);
    
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

    // Step 2: Execute SQL against database (with one auto-repair attempt)
    try {
      const result = await sqlService.execute(sql);
      rows = result.rows || [];
      logger.info(`Query returned ${rows.length} rows`);
    } catch (sqlErr) {
      logger.error("SQL execution error:", sqlErr);

      // Auto-repair: ask LLM to fix common SQL errors (GROUP BY, syntax, multiple statements, etc.)
      const fixableCode = sqlErr.code === "42803" || sqlErr.code === "42601" || sqlErr.code === "42P01"
        || sqlErr.code === "SQL_VALIDATION_ERROR";
      if (fixableCode) {
        logger.info(`Attempting SQL auto-repair for error code ${sqlErr.code}...`);
        try {
          const fixPrompt = [
            "Fix this PostgreSQL SQL query. Return ONLY the corrected SQL, no explanation.",
            "",
            "Error: " + sqlErr.message,
            "",
            "Original SQL:",
            sql,
            "",
            "Rules:",
            "- If error is about GROUP BY: add all non-aggregate SELECT columns to GROUP BY clause.",
            "- If error is about missing table: check table names (use file_metadata, core_levels, bgc_levels).",
            "- Return ONLY the fixed SQL query, no markdown, no explanation."
          ].join("\n");
          const fixedSql = await llmService.callLlm({ prompt: fixPrompt });
          const cleanFixed = fixedSql.replace(/```sql\n?/gi, "").replace(/```/g, "").trim();
          logger.info(`Auto-repaired SQL: ${cleanFixed.substring(0, 150)}...`);
          const retryResult = await sqlService.execute(cleanFixed);
          rows = retryResult.rows || [];
          sql = cleanFixed;
          logger.info(`Repaired query returned ${rows.length} rows`);
        } catch (retryErr) {
          logger.error("SQL auto-repair also failed:", retryErr.message);
          error = sqlErr.message;
          answer = "I couldn't retrieve that data due to a query error. Try rephrasing your question.";
          return { ok: false, type: "query_result", question, sql, raw_rows: [], answer, error };
        }
      } else {
        error = sqlErr.message;
        answer = "I couldn't retrieve that data due to a query error. Try rephrasing your question.";
        return { ok: false, type: "query_result", question, sql, raw_rows: [], answer, error };
      }
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
