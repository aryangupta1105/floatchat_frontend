// config/index.js
require("dotenv").config();

const env = process.env.NODE_ENV || "development";

const config = {
  env,
  isProd: env === "production",
  server: {
    port: process.env.PORT || 5000
  },
  db: {
    url: process.env.DATABASE_URL_PUBLIC || process.env.DATABASE_URL || process.env.POSTGRES_DSN,
    maxConnections: Number(process.env.DB_MAX_CONNECTIONS || 10)
  },
  gtwyRag: {
    apiUrl:       process.env.GTWY_RAG_API_URL   || "https://db.gtwy.ai",
    queryUrl:     process.env.GTWY_RAG_QUERY_URL || "https://api.gtwy.ai",
    authKey:      process.env.GTWY_AUTH_KEY       || "",
    collectionId: process.env.GTWY_RAG_COLLECTION_ID || "697df92c1f5b4176d9fcf7ce",
    mode:         process.env.GTWY_RAG_COLLECTION_MODE || "high_accuracy"
  },
  llm: {
    provider:    process.env.LLM_PROVIDER || "openai",
    apiKey:      process.env.LLM_API_KEY,
    model:       process.env.LLM_MODEL || "gpt-4o-mini",
    temperature: Number(process.env.LLM_TEMPERATURE || 0.2),
    maxTokens:   Number(process.env.LLM_MAX_TOKENS || 800)
  },
  jwt: {
    secret:    process.env.JWT_SECRET || "change-me-in-production",
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  },
  alerts: {
    defaultFrequencyMinutes: Number(process.env.ALERT_DEFAULT_FREQ_MIN || 30)
  }
};

module.exports = config;
