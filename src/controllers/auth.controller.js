const { join } = require("@prisma/client/runtime/library");

const prisma = require("../config/prisma");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const { generateAccessToken, generateRefreshToken } = require("../controllers/token.controller");

const signupUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                message: "invalid email",
            });
        }

        const uniqueUser = await prisma.user.findUnique({
            where: {
                email: email
            }
        });
        if (uniqueUser) {
            return res.status(400).json({
                message: "user already exists",
            });
        }

        const user = await prisma.user.create({
            data: {
                name: name,
                email: email,
                password: hashedPassword,
            }
        });

        const token = generateAccessToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                token: token
            }
        });

        return res.json({
            message: "user created successfully",
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            },
            token: token
        });
    } catch (error) {
        return res.status(500).json({
            message: "user not created because " + error,
        });
    }
};

const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({
            where: {
                email: email,
            }
        });

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        const match = await bcrypt.compare(
            password,
            user.password
        );

        if (!match) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password",
            });
        }

        const token = generateAccessToken(user);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                token: token
            }
        });


        return res.status(200).json({
            success: true,
            message: "User logged in successfully",
            data: {
                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt,

            }, token: token,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};


const logoutUser = async (req, res) => {
    try {

        console.log(req.user.id);
        const user = await prisma.user.update({
            where: {
                id: req.user.id
            },
            data: {
                token: null
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        });



        return res.status(200).json({
            success: true,
            message: "User logged out successfully",
            data: user,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}


const refreshToken = async (req, res) => {
    try {
        const token = req.cookies.refreshToken;

        if (!token) {
            return res.status(401).json({ message: "No refresh token" });
        }

        const decoded = jwt.verify(
            token,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await prisma.user.findUnique({
            where: { id: decoded.id }
        });

        if (!user || user.refreshToken !== token) {
            return res.status(403).json({ message: "Invalid refresh token" });
        }

        const accessToken = generateAccessToken(user);

        return res.json({ accessToken });

    } catch (error) {
        return res.status(403).json({
            message: "Refresh token expired"
        });
    }
};

module.exports = {
    loginUser, signupUser, logoutUser, refreshToken
}