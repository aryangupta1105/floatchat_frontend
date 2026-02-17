// config/index.js
require("dotenv").config();

const env = process.env.NODE_ENV || "development";

const config = {
  env,
  isProd: env === "production",
  server: {
    port: process.env.PORT || 4000
  },
  db: {
    url: process.env.POSTGRES_DSN_PUBLIC || process.env.POSTGRES_DSN || process.env.DATABASE_URL,
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS || 10)
  },
  rag: {
    baseUrl: process.env.RAG_BASE_URL,
    apiKey: process.env.RAG_API_KEY,
    timeoutMs: Number(process.env.RAG_TIMEOUT_MS || 15000),
    maxRetries: Number(process.env.RAG_MAX_RETRIES || 2)
  },
  llm: {
    provider: process.env.LLM_PROVIDER || "openai",
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL || "gpt-4.1-mini",
    temperature: Number(process.env.LLM_TEMPERATURE || 0.2),
    maxTokens: Number(process.env.LLM_MAX_TOKENS || 800)
  },
  alerts: {
    defaultFrequencyMinutes: Number(process.env.ALERT_DEFAULT_FREQ_MIN || 30)
  }
};

module.exports = config;
