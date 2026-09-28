const prisma = require("../config/prisma");
const ai = require("../services/embedding")

// Every field except `embedding`: a 1536-float vector per row would dominate
// the JSON payload and is useless to clients.
const MEMORY_FIELDS = {
    id: true,
    title: true,
    content: true,
    imagePath: true,
    type: true,
    memoryDate: true,
    updatedAt: true,
    tags: true,
    userId: true,
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const parseLimit = (value, fallback = DEFAULT_LIMIT) => {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(parsed, MAX_LIMIT);
};

const parseId = (value) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
};

const createMemory = async (req, res) => {
    try {
        const { title, content, imagePath, date, tags } = req.body;

        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: "title and content are required",
            });
        }

        // null when embeddings are unavailable; the memory is still saved.
        const embedding = await ai.generateEmbedding(`${title}\n${content}`);

        const memory = await prisma.memory.create({
            data: {
                title: title,
                content: content,
                imagePath: imagePath,
                // Omitted rather than passed as undefined so the schema
                // default @default(now()) applies.
                ...(date ? { memoryDate: new Date(date) } : {}),
                tags: Array.isArray(tags) ? tags : [],
                userId: req.user.id,
                embedding: embedding ?? []
            },
            select: MEMORY_FIELDS
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

        const limit = parseLimit(req.query.limit);
        const page = parseLimit(req.query.page, 1);

        const [memory, total] = await Promise.all([
            prisma.memory.findMany({
                where: {
                    userId: req.user.id
                },

                orderBy: {
                    id: orderBy
                },
                skip: (page - 1) * limit,
                take: limit,
                select: MEMORY_FIELDS
            }),
            prisma.memory.count({
                where: {
                    userId: req.user.id
                }
            })
        ]);

        return res.status(200).json({
            success: true,
            message: "Memory fetched successfully",
            count: memory.length,
            total: total,
            page: page,
            limit: limit,
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
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid memory id",
            });
        }

        const memory = await prisma.memory.findFirst({
            where: {
                userId: req.user.id,
                id: id
            },
            select: MEMORY_FIELDS
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
        const limit = parseLimit(req.query.limit, 5);
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
                memoryDate: "desc",
            },
            skip: skip,
            take: limit,
            select: MEMORY_FIELDS
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
            select: MEMORY_FIELDS
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
            },
            select: MEMORY_FIELDS
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

        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid memory id",
            });
        }

        const mem = await prisma.memory.findFirst({
            where: {
                userId: req.user.id,
                id: id
            }
        });

        if (!mem) {
            return res.status(404).json({
                message: "Memory not found",
            });
        }

        const data = {};
        if (title !== undefined) data.title = title;
        if (content !== undefined) data.content = content;
        if (tags !== undefined) {
            if (!Array.isArray(tags)) {
                return res.status(400).json({
                    success: false,
                    message: "Tags must be an array",
                });
            }
            data.tags = tags;
        }

        // Text changed, so the stored vector no longer matches the row.
        if (data.title !== undefined || data.content !== undefined) {
            const embedding = await ai.generateEmbedding(
                `${data.title ?? mem.title}\n${data.content ?? mem.content}`
            );
            if (embedding) {
                data.embedding = embedding;
            }
        }

        const memory = await prisma.memory.update({
            // findFirst above already proved ownership. Prisma requires a
            // unique selector here, and userId is not part of one.
            where: {
                id: id
            },
            data: data,
            select: MEMORY_FIELDS
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
        const id = parseId(req.params.id);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid memory id",
            });
        }

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
            // Ownership checked above; Prisma needs a unique selector.
            where: {
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