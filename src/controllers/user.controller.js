const { join } = require("@prisma/client/runtime/library");

const prisma = require("../config/prisma");

const updateProfile = async (req, res) => {
    try {
        const { name, email, profileImage } = req.body;

        const updateData = {};

        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (profileImage !== undefined) updateData.profileImage = profileImage;

        if (Object.keys(updateData).length === 0) {
            return res.status(400).json({
                success: false,
                message: "No data provided to update",
            });
        }

        const user = await prisma.user.update({
            where: {
                id: parseInt(req.user.id),
            },
            data: updateData,
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        return res.status(200).json({
            success: true,
            message: "User updated successfully",
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

const getAllUsers = async (req, res) => {
    try {
        const users = await prisma.user.findMany();

        return res.status(200).json({
            success: true,
            message: "Users fetched successfully",
            data: users,
        });

    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

const getUserProfile = async (req, res) => {
    try {

        const user = await prisma.user.findUnique({
            where: {
                id: req.user.id
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true
            }
        })
        return res.status(200).json({
            success: true,
            message: "User profile fetched successfully",
            data: user,
        });[]
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

const deleteUser = async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: {
                id: parseInt(req.user.id)
            }
        });
        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        await prisma.user.delete({
            where: {
                id: id
            }
        });
        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

const deleteAllUsers = async (req, res) => {
    try {

        await prisma.user.deleteMany({
            where: {
                email: {
                    contains: 'com'
                }
            }
        });
        return res.status(200).json({
            success: true,
            message: "User deleted successfully",
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
}

module.exports = {
    getAllUsers,
    getUserProfile,
    deleteUser,
    deleteAllUsers,
    updateProfile
};