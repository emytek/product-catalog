"use strict";

/**
 * product.worker.js
 * ─────────────────
 * Background job processors for the product-operations queue.
 *
 * Jobs processed:
 *   refresh-stats   — invalidates and re-warms the stats cache after writes
 *   audit-log       — writes an audit record (logged to console in this impl;
 *                     extend to write to a DB table or external service)
 *
 * This module is imported once at app startup in app.js.
 * It attaches processor functions to the queue — execution happens asynchronously
 * in the same Node.js process (or in separate worker processes when Bull is used
 * with a dedicated worker binary for true horizontal scaling).
 */

const { getProductQueue } = require("../config/queue");
const logger              = require("../utils/logger");

function registerWorkers() {
    const queue = getProductQueue();

    // ── refresh-stats ──────────────────────────────────────────────────────
    queue.process("refresh-stats", async (job) => {
        const { trigger, productId } = job.data;
        logger.info(`[WORKER] refresh-stats: triggered by ${trigger} on ${productId}`);

        // Re-warm the stats cache
        try {
            const productService = require("../services/product.service");
            const cache          = require("../config/cache");
            // Clear the stats key so the next request fetches fresh data from DB
            await cache.del("stats");
            // Proactively warm it
            await productService.getStats();
            logger.debug("[WORKER] Stats cache refreshed.");
        } catch (err) {
            logger.warn("[WORKER] refresh-stats failed:", err.message);
        }
    });

    // ── audit-log ──────────────────────────────────────────────────────────
    queue.process("audit-log", async (job) => {
        const { action, productId } = job.data;
        // In production: write to an AuditLog table or external audit service
        logger.info(`[AUDIT] action=${action} productId=${productId} ts=${new Date().toISOString()}`);
    });

    logger.info("[WORKER] Product workers registered.");
}

module.exports = { registerWorkers };
