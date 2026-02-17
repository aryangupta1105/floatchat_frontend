// routes/chat.routes.js
const express = require("express");
const chatController = require("../controllers/chatController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post("/query", requireAuth, chatController.processQuery);
router.get("/history", requireAuth, chatController.getHistory);

module.exports = router;
