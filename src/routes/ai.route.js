const express = require("express");
const router = express.Router();

const {
    semanticSearch,
    askAi,
    summarizeMemories,
    relatedMemories,
    aiHealth,
} = require("../controllers/ai.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/health", authMiddleware, aiHealth);
router.post("/search", authMiddleware, semanticSearch);
router.post("/ask", authMiddleware, askAi);
router.post("/summarize", authMiddleware, summarizeMemories);
router.get("/related/:memoryId", authMiddleware, relatedMemories);

module.exports = router;
