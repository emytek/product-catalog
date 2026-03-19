"use strict";

/**
 * server.js
 * ─────────
 * Application entry point.
 *
 * Horizontal scaling via Node.js cluster:
 *   In production the master process forks one worker per CPU core.
 *   Each worker is an independent HTTP server sharing nothing in memory —
 *   the OS load-balancer distributes incoming connections between them.
 *   This gives near-linear throughput scaling at zero infrastructure cost.
 *
 *   In development a single worker is used for simplicity.
 *
 * Graceful shutdown:
 *   On SIGTERM (CF app stop / scaling event) we:
 *     1. Close the HTTP server (stop accepting new connections)
 *     2. Close the DB connection pool (release DB connections)
 *     3. Close the queue (drain in-flight jobs)
 *   This gives in-flight requests up to 10 s to finish before the process exits.
 */

const cluster = require("cluster");
const os      = require("os");

const config  = require("./src/config/environment");
const logger  = require("./src/utils/logger");

const NUM_WORKERS = config.app.isProduction ? os.cpus().length : 1;

// ── Master process ─────────────────────────────────────────────────────────────
if (cluster.isMaster && NUM_WORKERS > 1) {
    logger.info(`[CLUSTER] Master ${process.pid} started — forking ${NUM_WORKERS} workers.`);

    for (let i = 0; i < NUM_WORKERS; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        logger.warn(`[CLUSTER] Worker ${worker.process.pid} exited (code=${code}, signal=${signal}). Restarting...`);
        cluster.fork();    // Auto-restart crashed workers
    });

    return;  // Master does nothing else
}

// ── Worker process (or single process in development) ──────────────────────────
async function startWorker() {
    const app        = require("./src/app");
    const { getPool, closePool } = require("./src/config/database");
    const { closeQueues }        = require("./src/config/queue");
    const { initRedis }          = require("./src/config/cache");
    const { registerWorkers }    = require("./src/workers/product.worker");

    // ── 1. Warm up external connections ──────────────────────────────────────
    logger.info(`[WORKER ${process.pid}] Connecting to database...`);
    await getPool();            // Pre-warms the connection pool

    logger.info(`[WORKER ${process.pid}] Initialising cache...`);
    await initRedis();          // Optional Redis connection

    // ── 2. Register background job processors ─────────────────────────────────
    registerWorkers();

    // ── 3. Start HTTP server ───────────────────────────────────────────────────
    const PORT   = config.app.port;
    const server = app.listen(PORT, () => {
        logger.info(
            `[WORKER ${process.pid}] HTTP server listening on port ${PORT} ` +
            `(${config.app.nodeEnv})`
        );
    });

    // ── 4. Graceful shutdown ───────────────────────────────────────────────────
    async function shutdown(signal) {
        logger.info(`[WORKER ${process.pid}] ${signal} received — shutting down gracefully...`);

        // Stop accepting new connections
        server.close(async () => {
            logger.info(`[WORKER ${process.pid}] HTTP server closed.`);
            try {
                await closeQueues();
                await closePool();
            } catch (err) {
                logger.error(`[WORKER ${process.pid}] Error during shutdown:`, err.message);
            }
            process.exit(0);
        });

        // Force exit if graceful shutdown takes too long
        setTimeout(() => {
            logger.error(`[WORKER ${process.pid}] Forced exit after timeout.`);
            process.exit(1);
        }, 10000).unref();
    }

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT",  () => shutdown("SIGINT"));

    // Catch unhandled rejections — log and keep running (don't crash on a single bad query)
    process.on("unhandledRejection", (reason) => {
        logger.error(`[WORKER ${process.pid}] Unhandled rejection:`, reason);
    });

    process.on("uncaughtException", (err) => {
        logger.error(`[WORKER ${process.pid}] Uncaught exception:`, err);
        shutdown("uncaughtException");
    });
}

startWorker().catch((err) => {
    console.error("Fatal startup error:", err);
    process.exit(1);
});
