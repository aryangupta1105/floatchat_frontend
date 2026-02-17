// config/mongodb.js
const mongoose = require("mongoose");
const { logger } = require("../utils/logger");

const connectMongoDB = async () => {
  try {
    const mongoURL = process.env.DATABASE_URL;

    if (!mongoURL) {
      logger.warn("DATABASE_URL (MongoDB) not configured - Chat history & user persistence disabled");
      return null;
    }

    await mongoose.connect(mongoURL, {
      retryWrites: true,
      w: "majority",
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5
    });

    logger.info("✅ MongoDB connected successfully");

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("MongoDB disconnected");
    });

    return mongoose.connection;
  } catch (err) {
    logger.error("Failed to connect MongoDB:", err.message);
    if (process.env.NODE_ENV === "production") {
      throw err; // In production, fail hard
    }
    // In development, continue with limited functionality
    logger.warn("Continuing without MongoDB - some features will be unavailable");
    return null;
  }
};

module.exports = { connectMongoDB };
