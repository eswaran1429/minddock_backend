const prisma = require("../config/prisma");

const createMemory = async (req, res) => {
    try {
        const { title, content, imagePath, date, tags } = req.body;

        const memory = await prisma.memory.create({
            data: {
                title: title,
                content: content,
                imagePath: imagePath,
                date: date,
                tags: tags,
                userId: req.user.id
            }
        });

        return res.status(201).json({
            success: true,
            message: "Memory created successfully",
            data: memory,
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        })
    }
};

const getAllMemories = async (req, res) => {
    try {

        const sort = req.query.sort;

        const orderBy =
            sort === "oldest"
                ? "asc"
                : "desc";

        const memory = await prisma.memory.findMany({
            where: {
                userId: req.user.id
            },

            orderBy: {
                id: orderBy
            },
            take: parseInt(req.query.limit)
        });
        return res.status(200).json({
            success: true,
            message: "Memory fetched successfully",
            count: memory.length,
            data: memory,
        });

    } catch (error) {

        res.status(500).json({
            message: "Internal server error",
            error: error.message
        });

    }
}

const getMemory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const memory = await prisma.memory.findFirst({
            where: {
                userId: req.user.id,
                id: id
            }
        });
        if (memory == null) {
            return res.status(404).json({
                success: false,
                message: "Memory not found",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Memory fetched successfully",
            data: memory,
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        })
    }
}

const searchMemories = async (req, res) => {
    try {
        const userId = req.user.id;
        const searchText = req.query.q;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 5;
        const skip = (page - 1) * limit;


        if (!searchText) {
            return res.status(400).json({
                message: "Search query is required",
            });
        }

        const memories = await prisma.memory.findMany({
            where: {
                userId: userId,
                content: {
                    contains: searchText,
                    mode: "insensitive",
                },
            },
            orderBy: {
                date: "desc",
            },
            // skip: skip,
            take: limit
        });

        res.status(200).json({
            count: memories.length,
            memories,
        });
    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
};

const timelineMemories = async (req, res) => {
    try {
        const memories = await prisma.memory.findMany({
            where: {
                userId: req.user.id,
            },
            orderBy: {
                memoryDate: "desc",
            },
        });

        const timelineMemories = memories.reduce((acc, memory) => {
            const date = memory.memoryDate.toISOString().split('T')[0];

            if (!acc[date]) {
                acc[date] = [];
            }

            acc[date].push({
                id: memory.id,
                title: memory.title,
                content: memory.content,
                imagePath: memory.imagePath,
                memoryDate: memory.memoryDate,
                updatedAt: memory.updatedAt,
                tags: memory.tags,
                userId: memory.userId,
            });

            return acc;
        }, {});

        return res.status(200).json({
            success: true,
            message: "Memory fetched successfully",
            data: timelineMemories,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

const filterMemories = async (req, res) => {
    try {
        const { tags } = req.body;
        if (!Array.isArray(tags)) {
            return res.status(400).json({
                success: false,
                message: "Tags must be an array",
            });
        }

        if (tags.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Tags cannot be empty",
            });
        }

        const memories = await prisma.memory.findMany({
            where: {
                userId: req.user.id,
                tags: {
                    hasSome: tags,
                }
            }
        })

        return res.status(200).json({
            success: true,
            message: "Memories fetched successfully",
            data: memories,
        });

    } catch (error) {
        res.status(500).json({
            message: error.message,
        });
    }
}

const updateMemory = async (req, res) => {
    try {
        const { title, content, tags } = req.body;

        const mem = await prisma.memory.findFirst({
            where: {
                userId: req.user.id,
                id: parseInt(req.params.id)
            }
        });

        if (!mem) {
            return res.status(404).json({
                message: "Memory not found",
            });
        }

        const memory = await prisma.memory.update({
            where: {
                userId: req.user.id,
                id: parseInt(req.params.id)
            },
            data: {
                title: title,
                content: content,
                tags: tags
            },
        });

        return res.status(200).json({
            success: true,
            message: "Memory updated successfully",
            data: memory,
        });
    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        })
    }
}

const deleteMemory = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const findMemory = await prisma.memory.findFirst({
            where: {
                userId: req.user.id,
                id: id
            }
        });
        if (!findMemory) {
            return res.status(404).json({
                success: false,
                message: "Memory not found",
            });
        }

        await prisma.memory.delete({
            where: {
                userId: req.user.id,
                id: id
            }
        });

        return res.status(200).json({
            success: true,
            message: "Memory deleted successfully",
        });

    } catch (error) {
        res.status(500).json({
            message: "Internal server error",
            error: error.message
        })
    }
}

module.exports = {
    createMemory,
    getAllMemories,
    getMemory,
    updateMemory,
    deleteMemory,
    searchMemories,
    filterMemories,
    timelineMemories
}