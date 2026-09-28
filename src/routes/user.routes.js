const express = require("express");
const router = express.Router();

const { getAllUsers, getUserProfile, deleteUser, deleteAllUsers, updateProfile } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");


router.get("/get-all-users", getAllUsers);
router.delete("/delete", authMiddleware, deleteUser);
router.delete("/deleteAll", deleteAllUsers)
router.get("/profile", authMiddleware, getUserProfile);
router.put("/profile", authMiddleware, updateProfile);


module.exports = router;