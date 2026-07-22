const express = require("express");
const router = express.Router();


const { createMemory, getAllMemories, getMemory, updateMemory, deleteMemory, searchMemories, filterMemories, timelineMemories } = require("../controllers/memories.controller");
const authMiddleware = require("../middleware/auth.middleware");
const upload = require("../middleware/upload");
const uploadImage = require("../controllers/upload_controller");

router.post("/create-memory", authMiddleware, createMemory);
router.get("/get-all-memories", authMiddleware, getAllMemories);
router.get("/get-memory/:id", authMiddleware, getMemory);
router.put("/update-memory/:id", authMiddleware, updateMemory);
router.delete("/delete-memory/:id", authMiddleware, deleteMemory);
router.get("/search", authMiddleware, searchMemories);
router.post("/filter", authMiddleware, filterMemories);
router.get("/timeline", authMiddleware, timelineMemories);


router.post("/upload", upload.single("image"), uploadImage);



module.exports = router;