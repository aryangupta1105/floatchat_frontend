// services/llmService.js
const axios = require("axios");
const llmConfig = require("../config/llm");
const { logger } = require("../utils/logger");
const { AppError } = require("../utils/error");
const {
  buildSqlPrompt,
  buildFinalAnswerPrompt
} = require("../utils/promptBuilder");

/**
 * Generic LLM call with configurable system prompt
 * Supports both OpenAI-compatible APIs (Groq, etc.) and Google Gemini API
 */
const callLlm = async ({ prompt, systemPrompt = "You are a helpful, precise assistant." }) => {
  if (!llmConfig.baseUrl) {
    throw new AppError("LLM_BASE_URL not configured", 500, "LLM_CONFIG_ERROR");
  }

  try {
    let response;
    
    // Check if using Gemini API (Google)
    if (llmConfig.baseUrl.includes("generativelanguage.googleapis.com") || llmConfig.provider === "gemini") {
      // Gemini API format - use the correct endpoint
      response = await axios.post(
        `${llmConfig.baseUrl}:generateContent?key=${llmConfig.apiKey}`,
        {
          contents: [
            {
              parts: [
                { text: systemPrompt + "\n\n" + prompt }
              ]
            }
          ],
          generationConfig: {
            temperature: llmConfig.temperature,
            maxOutputTokens: llmConfig.maxTokens
          }
        },
        {
          headers: {
            "Content-Type": "application/json"
          }
        }
      );

      const answer = response.data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!answer) {
        throw new Error("Empty response from Gemini API");
      }
      return answer.trim();
    } else {
      // OpenAI-compatible API format (Groq, etc.)
      response = await axios.post(
        `${llmConfig.baseUrl}/chat/completions`,
        {
          model: llmConfig.model,
          temperature: llmConfig.temperature,
          max_tokens: llmConfig.maxTokens,
          messages: [
            {
              role: "system",
              content: systemPrompt
            },
            {
              role: "user",
              content: prompt
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${llmConfig.apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      const answer = response.data.choices?.[0]?.message?.content;
      if (!answer) {
        throw new Error("Empty response from LLM");
      }
      return answer.trim();
    }
  } catch (err) {
    logger.error("LLM error:", err?.response?.data || err);
    throw new AppError("LLM request failed", 500, "LLM_ERROR");
  }
};

/**
 * 1) Generate SQL from question + RAG context
 */
const generateSql = async ({ question, ragContext }) => {
  const prompt = buildSqlPrompt({ question, ragContext });
  let raw = await callLlm({ prompt });

  // Strip markdown code fences
  raw = raw.replace(/```sql\s*/gi, "").replace(/```\s*/gi, "").trim();

  // If LLM returned multiple statements (user sent multiple questions at once),
  // extract only the FIRST SELECT statement to avoid SqlValidationError
  if (raw.includes(";")) {
    // Split on semicolons, find the first non-empty SELECT statement
    const statements = raw.split(";").map(s => s.trim()).filter(s => s.length > 0);
    const firstSelect = statements.find(s => s.toUpperCase().startsWith("SELECT"));
    if (firstSelect) {
      raw = firstSelect;
    } else {
      // No SELECT found — take the first statement anyway
      raw = statements[0];
    }
  }

  return raw.trim();
};

/**
 * 2) Final natural-language answer
 */
const finalizeAnswer = async ({
  question,
  sql,
  rows,
  context,
  anomalies,
  visualization
}) => {
  const prompt = buildFinalAnswerPrompt({
    question,
    sql,
    rows,
    context,
    anomalies,
    visualization
  });

  const answer = await callLlm({ prompt });
  return answer;
};

module.exports = {
  callLlm,
  generateSql,
  finalizeAnswer
};
