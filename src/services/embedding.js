const API_BASE = () =>
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const EMBEDDING_MODEL = () => process.env.GEMINI_EMBED_MODEL || "gemini-embedding-001";

// gemini-embedding-001 defaults to 3072 dimensions but supports 768/1536/3072.
// 768 is requested explicitly: it matches what nomic-embed-text produced, so
// vectors already in the DB stay comparable and no backfill is needed.
const EMBEDDING_DIMENSIONS = 768;

// Gemini takes the retrieval role as a taskType parameter rather than a text
// prefix. Stored text and query text must use different ones or ranking suffers.
const TASK_TYPE = {
    document: "RETRIEVAL_DOCUMENT",
    query: "RETRIEVAL_QUERY",
};

// gemini-embedding-001 accepts 2048 tokens; ~4 chars per token leaves headroom
// without pulling in a tokenizer.
const MAX_INPUT_CHARS = 6000;

const REQUEST_TIMEOUT_MS = 30000;

const apiKey = () => (process.env.GEMINI_API_KEY || "").trim();

const isEmbeddingEnabled = () => Boolean(apiKey());

// Returns a 768-float array, or null when the text is empty, the key is
// missing, or the API call failed. Callers treat null as "no embedding".
const generateEmbedding = async (text, options = {}) => {
    const raw = typeof text === "string" ? text.trim() : "";

    if (!raw) {
        return null;
    }

    const key = apiKey();
    if (!key) {
        console.warn("GEMINI_API_KEY not set, skipping embedding generation");
        return null;
    }

    const model = EMBEDDING_MODEL();
    const taskType = TASK_TYPE[options.type] || TASK_TYPE.document;

    try {
        const response = await fetch(`${API_BASE()}/models/${model}:embedContent`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-goog-api-key": key,
            },
            body: JSON.stringify({
                content: { parts: [{ text: raw.slice(0, MAX_INPUT_CHARS) }] },
                taskType: taskType,
                outputDimensionality: EMBEDDING_DIMENSIONS,
            }),
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!response.ok) {
            const body = await response.text();
            console.error(`Gemini embedContent HTTP ${response.status}: ${body.slice(0, 200)}`);
            return null;
        }

        const payload = await response.json();
        const embedding = payload.embedding?.values;

        if (!Array.isArray(embedding) || embedding.length === 0) {
            console.error("Gemini returned no embedding vector");
            return null;
        }

        return embedding;
    } catch (error) {
        console.error(`Embedding generation failed (model ${model}):`, error.message);
        return null;
    }
};

// Verifies the key by fetching the model itself, not a public listing, so a
// bad or unauthorised key fails here instead of silently at call time.
const checkEmbeddingHealth = async () => {
    const key = apiKey();
    if (!key) {
        return { ok: false, reason: "GEMINI_API_KEY is not set" };
    }

    const model = EMBEDDING_MODEL();
    try {
        const response = await fetch(`${API_BASE()}/models/${model}`, {
            headers: { "x-goog-api-key": key },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const body = await response.text();
            let reason = `Gemini HTTP ${response.status}`;
            try {
                const message = JSON.parse(body).error?.message;
                if (message) reason += `: ${message}`;
            } catch {
                // non-JSON error body, status alone is enough
            }
            return { ok: false, reason: reason };
        }

        return { ok: true, model: model, dimensions: EMBEDDING_DIMENSIONS };
    } catch (error) {
        return { ok: false, reason: `Gemini unreachable: ${error.message}` };
    }
};

module.exports = {
    generateEmbedding,
    isEmbeddingEnabled,
    checkEmbeddingHealth,
    EMBEDDING_MODEL,
    EMBEDDING_DIMENSIONS,
};
