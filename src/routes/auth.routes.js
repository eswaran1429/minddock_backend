const express = require("express");
const router = express.Router();

const { signupUser, loginUser, logoutUser, refreshToken } = require("../controllers/auth.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.get("/logout", authMiddleware, logoutUser);
router.get("/refresh", refreshToken);

module.exports = router;