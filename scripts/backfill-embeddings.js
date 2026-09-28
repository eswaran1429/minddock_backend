// Embeds every memory that has no vector yet.
// Usage: node scripts/backfill-embeddings.js [--dry-run] [--all]
//   --dry-run  report what would change, write nothing
//   --all      re-embed every memory, not just the empty ones
//              (use after switching embedding model or dimensions)
require("dotenv").config({ quiet: true });

const prisma = require("../src/config/prisma");
const ai = require("../src/services/embedding");

const DRY_RUN = process.argv.includes("--dry-run");
const ALL = process.argv.includes("--all");

// Gemini's free tier rate-limits embedContent, so pace the calls.
const DELAY_MS = 250;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

(async () => {
    const health = await ai.checkEmbeddingHealth();
    if (!health.ok) {
        console.error("Embedding service not ready:", health.reason);
        await prisma.$disconnect();
        process.exitCode = 1;
        return;
    }
    console.log(`Model ${health.model}, ${health.dimensions} dimensions`);

    const memories = await prisma.memory.findMany({
        where: ALL ? {} : { embedding: { isEmpty: true } },
        select: { id: true, title: true, content: true, userId: true },
        orderBy: { id: "asc" },
    });

    console.log(
        `${memories.length} memor${memories.length === 1 ? "y" : "ies"} to embed` +
        (DRY_RUN ? " (dry run, nothing written)" : "")
    );

    let done = 0;
    let failed = 0;

    for (const memory of memories) {
        if (DRY_RUN) {
            console.log(`  would embed #${memory.id} "${memory.title}"`);
            continue;
        }

        // Same text shape as createMemory, so backfilled vectors match new ones.
        const embedding = await ai.generateEmbedding(
            `${memory.title}\n${memory.content}`,
            { type: "document" }
        );

        if (!embedding) {
            failed++;
            console.error(`  FAILED #${memory.id} "${memory.title}"`);
            continue;
        }

        await prisma.memory.update({
            where: { id: memory.id },
            data: { embedding: embedding },
        });

        done++;
        console.log(`  embedded #${memory.id} "${memory.title}" (${embedding.length} dims)`);
        await sleep(DELAY_MS);
    }

    if (!DRY_RUN) {
        console.log(`Done: ${done} embedded, ${failed} failed`);
    }

    // process.exit() here races Prisma shutdown on Windows (libuv assertion),
    // so set the code and let the event loop drain.
    await prisma.$disconnect();
    process.exitCode = failed > 0 ? 1 : 0;
})();
