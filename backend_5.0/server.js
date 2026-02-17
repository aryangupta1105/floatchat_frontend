// server.js
require("dotenv").config();

const http = require("http");
const app = require("./app");
const { logger } = require("./utils/logger");
const { startSchedulers } = require("./schedulers");
const { pool } = require("./config/db");
const { connectMongoDB } = require("./config/mongodb");

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectMongoDB();

    const server = http.createServer(app);

    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      startSchedulers();
    });

    // Graceful shutdown
    const shutdown = (signal) => {
      return () => {
        logger.info(`${signal} received. Shutting down...`);

        server.close(() => {
          logger.info("HTTP server closed");
          pool
            .end()
            .then(() => {
              logger.info("Postgres pool closed");
              process.exit(0);
            })
            .catch((err) => {
              logger.error("Error closing Postgres pool", err);
              process.exit(1);
            });
        });
      };
    };

    process.on("SIGINT", shutdown("SIGINT"));
    process.on("SIGTERM", shutdown("SIGTERM"));

    process.on("unhandledRejection", (reason) => {
      logger.error("Unhandled Rejection:", reason);
    });

    process.on("uncaughtException", (err) => {
      logger.error("Uncaught Exception:", err);
      process.exit(1);
    });
  } catch (err) {
    logger.error("Failed to start server:", err);
    process.exit(1);
  }
};

startServer();
