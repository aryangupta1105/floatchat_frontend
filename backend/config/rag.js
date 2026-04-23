// config/rag.js
const config = require("./index");

module.exports = {
  baseUrl: config.rag.baseUrl,
  apiKey: config.rag.apiKey,
  timeoutMs: config.rag.timeoutMs,
  maxRetries: config.rag.maxRetries
};
