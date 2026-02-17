// config/llm.js
const config = require("./index");

module.exports = {
  provider: process.env.LLM_PROVIDER || "llama",
  apiKey: process.env.LLM_API_KEY,
  baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
  model: process.env.LLM_MODEL || "llama-3.1-8b-instant",
  temperature: config.llm.temperature,
  maxTokens: config.llm.maxTokens
};
