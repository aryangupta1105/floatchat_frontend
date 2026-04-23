// config/llm.js
const config = require("./index");

// Groq decommissioned: llama3-70b-8192, llama3-8b-8192
// Current valid models: llama-3.3-70b-versatile, llama-3.1-8b-instant, llama3-groq-70b-8192-tool-use-preview
const DECOMMISSIONED = ["llama3-70b-8192", "llama3-8b-8192", "llama2-70b-4096"];
const envModel = process.env.LLM_MODEL || "";
const safeModel = DECOMMISSIONED.includes(envModel)
  ? "llama-3.3-70b-versatile"
  : (envModel || "llama-3.3-70b-versatile");

module.exports = {
  provider: process.env.LLM_PROVIDER || "groq",
  apiKey: process.env.LLM_API_KEY,
  baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1",
  model: safeModel,
  temperature: config.llm.temperature,
  maxTokens: config.llm.maxTokens
};
