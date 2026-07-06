const express = require("express");
const router = express.Router();

const { signupUser, loginUser, getAllUsers } = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.post("/signup", signupUser);
router.post("/login", loginUser);
router.get("/get-all-users", getAllUsers);

router.get(
    "/profile",
    authMiddleware,
    (req, res) => {
        res.json({
            message: "User profile",
            user: req.myuser,
        });
    }
);

module.exports = router;