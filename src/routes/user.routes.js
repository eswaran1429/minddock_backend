const express = require("express");
const router = express.Router();

const { getAllUsers, getUserProfile, deleteUser, deleteAllUsers } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");


router.get("/get-all-users", getAllUsers);
router.delete("/delete/:id", deleteUser);
router.delete("/deleteAll", deleteAllUsers)
router.get("/profile", authMiddleware, getUserProfile);


module.exports = router;