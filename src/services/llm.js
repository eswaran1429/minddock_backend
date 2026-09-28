const API_BASE = () =>
    process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";
const CHAT_MODEL = () => process.env.GEMINI_CHAT_MODEL || "gemini-3.8-flash";

const REQUEST_TIMEOUT_MS = 60000;

// Flash models return 503 UNAVAILABLE under load. That is transient, so retry
// once rather than surfacing it as a failure.
const RETRY_STATUSES = new Set([429, 503]);
const RETRY_DELAY_MS = 1500;

const apiKey = () => (process.env.GEMINI_API_KEY || "").trim();

const isLlmEnabled = () => Boolean(apiKey());

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Returns the assistant text, or null when the key is missing, the request
// failed, or the model returned nothing usable.
const chatComplete = async (systemPrompt, userPrompt, options = {}) => {
    const key = apiKey();
    if (!key) {
        console.warn("GEMINI_API_KEY not set, skipping chat completion");
        return null;
    }

    const model = options.model || CHAT_MODEL();
    const body = JSON.stringify({
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
            temperature: options.temperature ?? 0.3,
            maxOutputTokens: options.maxTokens ?? 1200,
        },
    });

    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await fetch(`${API_BASE()}/models/${model}:generateContent`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-goog-api-key": key,
                },
                body: body,
                signal: AbortSignal.timeout(options.timeoutMs ?? REQUEST_TIMEOUT_MS),
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(
                    `Gemini generateContent HTTP ${response.status}: ${errorBody.slice(0, 200)}`
                );
                if (RETRY_STATUSES.has(response.status) && attempt === 0) {
                    await sleep(RETRY_DELAY_MS);
                    continue;
                }
                return null;
            }

            const payload = await response.json();
            const candidate = payload.candidates?.[0];

            // A response can come back with no parts when the model stops on a
            // safety filter or hits the token cap mid-thought.
            const text = (candidate?.content?.parts || [])
                .map((part) => part.text)
                .filter(Boolean)
                .join("")
                .trim();

            if (!text) {
                console.error(
                    `Gemini returned no text (finishReason: ${candidate?.finishReason || "unknown"})`
                );
                return null;
            }

            return text;
        } catch (error) {
            console.error(`Chat completion failed (model ${model}):`, error.message);
            if (attempt === 0) {
                await sleep(RETRY_DELAY_MS);
                continue;
            }
            return null;
        }
    }

    return null;
};

// Verifies the key against the model itself, so a bad key fails here.
const checkLlmHealth = async () => {
    const key = apiKey();
    if (!key) {
        return { ok: false, reason: "GEMINI_API_KEY is not set" };
    }

    const model = CHAT_MODEL();
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

        return { ok: true, model: model };
    } catch (error) {
        return { ok: false, reason: `Gemini unreachable: ${error.message}` };
    }
};

module.exports = {
    chatComplete,
    isLlmEnabled,
    checkLlmHealth,
    CHAT_MODEL,
};
