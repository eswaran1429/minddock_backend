const prisma = require("../config/prisma");
const ai = require("../services/embedding");
const llm = require("../services/llm");

// Fields safe to return. `embedding` is excluded everywhere: 1536 floats per
// row would dominate the payload and is useless to clients.
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

const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;

// Rows scanned per request. The embedding column is Float[], not pgvector, so
// Postgres cannot rank by distance -- similarity is computed here in Node and
// every candidate row must be loaded. This cap keeps one request bounded.
const MAX_CANDIDATES = 500;

// Chars of each memory injected into an LLM prompt, to bound token spend.
const CONTEXT_CHARS_PER_MEMORY = 1200;

const parseTopK = (value, fallback = DEFAULT_TOP_K) => {
    const parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.min(parsed, MAX_TOP_K);
};

const parseId = (value) => {
    const parsed = parseInt(value);
    return isNaN(parsed) ? null : parsed;
};

const cosineSimilarity = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || a.length === 0) {
        return 0;
    }

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }

    if (magA === 0 || magB === 0) {
        return 0;
    }

    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
};

// The detail names the real cause -- missing key, bad key, retired model,
// quota -- instead of a generic message. Resolved per request, since a key can
// be revoked or a model retired between requests.
const aiUnavailable = (res, detail) =>
    res.status(503).json({
        success: false,
        message: "AI features unavailable",
        detail: detail,
    });

// Loads this user's memories that actually carry a vector, then ranks them
// against `queryVector`. Rows saved before an API key existed have
// embedding = [] and are skipped by the query.
const rankByVector = async (userId, queryVector, topK, excludeId = null) => {
    const candidates = await prisma.memory.findMany({
        where: {
            userId: userId,
            ...(excludeId ? { id: { not: excludeId } } : {}),
            NOT: { embedding: { isEmpty: true } },
        },
        orderBy: {
            memoryDate: "desc",
        },
        take: MAX_CANDIDATES,
        select: {
            ...MEMORY_FIELDS,
            embedding: true,
        },
    });

    return candidates
        .map(({ embedding, ...memory }) => ({
            ...memory,
            score: Number(cosineSimilarity(queryVector, embedding).toFixed(4)),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};

const buildContext = (memories) =>
    memories
        .map((memory, index) => {
            const date = memory.memoryDate.toISOString().split("T")[0];
            const body = memory.content.slice(0, CONTEXT_CHARS_PER_MEMORY);
            return `[${index + 1}] (id: ${memory.id}, date: ${date}) ${memory.title}\n${body}`;
        })
        .join("\n\n");

// POST /ai/search  body: { q, limit? }
const semanticSearch = async (req, res) => {
    try {
        const { q, limit } = req.body;

        if (!q || typeof q !== "string" || !q.trim()) {
            return res.status(400).json({
                success: false,
                message: "q is required",
            });
        }

        // "search_query: " prefix, not the document one used when storing.
        const queryVector = await ai.generateEmbedding(q, { type: "query" });
        if (!queryVector) {
            const health = await ai.checkEmbeddingHealth();
            return aiUnavailable(res, health.ok ? "Could not embed the query" : health.reason);
        }

        const results = await rankByVector(req.user.id, queryVector, parseTopK(limit));

        return res.status(200).json({
            success: true,
            message: "Semantic search completed",
            query: q,
            count: results.length,
            data: results,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

const askAi = async (req, res) => {
    try {
        const { question, limit } = req.body;

        if (!question || typeof question !== "string" || !question.trim()) {
            return res.status(400).json({
                success: false,
                message: "question is required",
            });
        }

        const queryVector = await ai.generateEmbedding(question, { type: "query" });
        if (!queryVector) {
            const health = await ai.checkEmbeddingHealth();
            return aiUnavailable(res, health.ok ? "Could not embed the question" : health.reason);
        }

        // const sources = await rankByVector(req.user.id, queryVector, parseTopK(limit));

        if (sources.length === 0) {
            return res.status(200).json({
                success: true,
                message: "No memories with embeddings to answer from",
                question: question,
                answer: null,
                // sources: [],
            });
        }

        const answer = await llm.chatComplete(
            "You answer questions about the user's personal memories. " +
            "Use only the numbered memories provided. If they do not contain the answer, " +
            "say so plainly. Cite the memories you used as [1], [2] and so on.",
            `Memories:\n\n${buildContext(sources)}\n\nQuestion: ${question}`
        );

        if (!answer) {
            const health = await llm.checkLlmHealth();
            return aiUnavailable(res, health.ok ? "The model returned no answer" : health.reason);
        }

        return res.status(200).json({
            success: true,
            message: "Answer generated",
            question: question,
            answer: answer,
            sources: sources,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// POST /ai/summarize  body: { memoryId } | { memoryIds: [] } | { from, to } | {}
// With no selector, summarizes the most recent memories.
const summarizeMemories = async (req, res) => {
    try {
        const { memoryId, memoryIds, from, to, limit } = req.body;

        const where = { userId: req.user.id };
        let scope;

        if (memoryId !== undefined) {
            const id = parseId(memoryId);
            if (id === null) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid memoryId",
                });
            }
            where.id = id;
            scope = "single";
        } else if (memoryIds !== undefined) {
            if (!Array.isArray(memoryIds) || memoryIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "memoryIds must be a non-empty array",
                });
            }
            const ids = memoryIds.map(parseId);
            if (ids.some((id) => id === null)) {
                return res.status(400).json({
                    success: false,
                    message: "memoryIds must all be integers",
                });
            }
            where.id = { in: ids };
            scope = "selection";
        } else if (from !== undefined || to !== undefined) {
            const fromDate = from ? new Date(from) : null;
            const toDate = to ? new Date(to) : null;

            if ((from && isNaN(fromDate.getTime())) || (to && isNaN(toDate.getTime()))) {
                return res.status(400).json({
                    success: false,
                    message: "from/to must be valid dates",
                });
            }

            where.memoryDate = {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {}),
            };
            scope = "dateRange";
        } else {
            scope = "recent";
        }

        const memories = await prisma.memory.findMany({
            where: where,
            orderBy: { memoryDate: "desc" },
            take: parseTopK(limit, 10),
            select: MEMORY_FIELDS,
        });

        if (memories.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No memories found to summarize",
            });
        }

        const summary = await llm.chatComplete(
            "You summarize the user's personal memories. Be concrete and factual: " +
            "name the people, places and events that appear. Do not invent details. " +
            "Write a short paragraph, then bullet the key points.",
            `Summarize these memories:\n\n${buildContext(memories)}`
        );

        if (!summary) {
            const health = await llm.checkLlmHealth();
            return aiUnavailable(res, health.ok ? "The model returned no summary" : health.reason);
        }

        return res.status(200).json({
            success: true,
            message: "Summary generated",
            scope: scope,
            count: memories.length,
            summary: summary,
            memoryIds: memories.map((memory) => memory.id),
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// GET /ai/related/:memoryId?limit=
// Ranks the user's other memories against this one's stored vector. Needs no
// API call, since the source vector is already in the row.
const relatedMemories = async (req, res) => {
    try {
        const id = parseId(req.params.memoryId);
        if (id === null) {
            return res.status(400).json({
                success: false,
                message: "Invalid memory id",
            });
        }

        const memory = await prisma.memory.findFirst({
            where: {
                id: id,
                userId: req.user.id,
            },
            select: {
                id: true,
                title: true,
                embedding: true,
            },
        });

        if (!memory) {
            return res.status(404).json({
                success: false,
                message: "Memory not found",
            });
        }

        if (!Array.isArray(memory.embedding) || memory.embedding.length === 0) {
            return res.status(409).json({
                success: false,
                message: "This memory has no embedding yet, so related memories cannot be ranked",
            });
        }

        const results = await rankByVector(
            req.user.id,
            memory.embedding,
            parseTopK(req.query.limit),
            memory.id
        );

        return res.status(200).json({
            success: true,
            message: "Related memories fetched",
            source: { id: memory.id, title: memory.title },
            count: results.length,
            data: results,
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// GET /ai/health -- is the Gemini key valid and are both models reachable?
const aiHealth = async (req, res) => {
    const [embedding, chat] = await Promise.all([
        ai.checkEmbeddingHealth(),
        llm.checkLlmHealth(),
    ]);

    const ok = embedding.ok && chat.ok;

    return res.status(ok ? 200 : 503).json({
        success: ok,
        provider: "gemini",
        baseUrl: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta",
        embedding: embedding,
        chat: chat,
    });
};

module.exports = {
    semanticSearch,
    askAi,
    summarizeMemories,
    relatedMemories,
    aiHealth,
};
