// app.js
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");

const { logger } = require("./utils/logger");
const routes = require("./routes");
const authRoutes = require("./routes/auth.routes");
const chatRoutes = require("./routes/chat.routes");
const testRoutes = require("./routes/test.routes");
const { AppError } = require("./utils/error");

const app = express();

// Middlewares
app.use(cors());

// Read raw body first
app.use(express.raw({ type: '*/*', limit: '2mb' }));

// Custom JSON parser with recovery
app.use((req, res, next) => {
  if (!req.body || req.body.length === 0) {
    req.body = {};
    return next();
  }

  const rawText = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;

  try {
    // First try normal JSON parse
    req.body = JSON.parse(rawText);
    next();
  } catch (err) {
    logger.warn("JSON Parse Error - attempting recovery", { error: err.message, bodyStart: rawText.substring(0, 100) });
    try {
      // Try removing all whitespace around colons and after commas
      const cleaned = rawText
        .replace(/\s*:\s*/g, ':')          // Remove spaces around colons
        .replace(/\s*,\s*/g, ',')          // Remove spaces around commas
        .replace(/{\s*/g, '{')             // Remove space after {
        .replace(/\s*}/g, '}')             // Remove space before }
        .replace(/\[\s*/g, '[')            // Remove space after [
        .replace(/\s*]/g, ']');            // Remove space before ]
      
      req.body = JSON.parse(cleaned);
      logger.info("JSON recovered successfully");
      next();
    } catch (e) {
      logger.error("Could not recover from JSON parse error:", e.message);
      return res.status(400).json({
        ok: false,
        error: {
          message: "Invalid JSON in request body",
          code: "INVALID_JSON"
        }
      });
    }
  }
});

app.use(morgan("dev"));

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "healthy" });
});

// Root-level auth routes (for backward compatibility)
app.use("/", authRoutes);

// Root-level chat routes (for backward compatibility)
app.use("/", chatRoutes);

// Test routes (for debugging)
app.use("/test", testRoutes);

// API routes
app.use("/api", routes);

// 404 handler
app.use((req, _res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error("Global error handler:", err);

  const status = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production" && status === 500
      ? "Something went wrong"
      : err.message || "Unknown error";

  res.status(status).json({
    ok: false,
    error: {
      message,
      code: err.code || "SERVER_ERROR"
    }
  });
});

module.exports = app;
