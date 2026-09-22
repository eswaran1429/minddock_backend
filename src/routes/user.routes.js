const express = require("express");
const router = express.Router();

const { signupUser, loginUser, getAllUsers, getUserProfile } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.get("/get-all-users", getAllUsers);
router.get("/profile/:id", authMiddleware, getUserProfile);

module.exports = router;