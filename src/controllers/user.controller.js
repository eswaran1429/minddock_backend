const { join } = require("@prisma/client/runtime/library");
const prisma = require("../config/prisma");

const bcrypt = require("bcrypt");

const jwt = require("jsonwebtoken");

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

        const token = jwt.sign({
            id: user.id
        }, 'superSecretKey', {
            expiresIn: "1h"
        })
        return res.json({
            message: "user created successfully",
            token: token,
            user: {

                id: user.id,
                name: user.name,
                email: user.email,
                createdAt: user.createdAt
            }
        });
    } catch (e) {
        return res.status(500).json({
            message: "user not created because " + e,
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

        const token = jwt.sign(
            {
                id: user.id
            },
            process.env.JWT_SECRET,
            {
                expiresIn: "7d"
            }
        );

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

    } catch (e) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: e.message
        });
    }
};


const profile = async (req, res) => {
    try {
        const token = await jwt.verify(req.headers.authorization, process.env.JWT_SECRET);

        const user = await prisma.user.findUnique({
            where: {
                id: token.id,
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
            message: "User profile fetched successfully",
            data: user,
        });

    } catch (error) {

    }
}

const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany();

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users,
        });

    } catch (error) {

    }
}

module.exports = {
    signupUser,
    loginUser,
    profile,
    getAllUsers
};