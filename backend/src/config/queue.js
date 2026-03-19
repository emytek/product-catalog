"use strict";

/**
 * queue.js
 * ────────
 * Async job queues using Bull.
 *
 * Why queues?
 *   Certain operations should not block the HTTP response:
 *     • Sending notification emails after a product is created
 *     • Regenerating aggregate stats after a batch delete
 *     • Audit log writes
 *   By pushing jobs onto a queue, the API responds instantly and a background
 *   worker processes the job asynchronously — improving p99 latency.
 *
 * Bull requires Redis.  If Redis is not configured, we fall back to a simple
 * in-process EventEmitter queue so the app still works (jobs run synchronously
 * in the same process).  This makes Redis optional for development.
 */

const config = require("./environment");
const logger = require("../utils/logger");
const EventEmitter = require("events");

// ── In-process fallback queue (no Redis) ─────────────────────────────────────
class InProcessQueue extends EventEmitter {
    constructor(name) {
        super();
        this.name = name;
        this._processors = {};
    }

    process(name, handler) {
        this._processors[name] = handler;
    }

    async add(jobName, data, opts = {}) {
        const job = { id: Date.now(), name: jobName, data, opts };
        logger.debug(`[QUEUE:${this.name}] In-process job "${jobName}" queued.`);
        // Run asynchronously (next tick) so it does not block the caller
        setImmediate(async () => {
            const handler = this._processors[jobName];
            if (handler) {
                try {
                    await handler(job);
                } catch (err) {
                    logger.error(`[QUEUE:${this.name}] Job "${jobName}" failed:`, err.message);
                }
            }
        });
        return job;
    }

    async close() {}
}

// ── Queue factory ─────────────────────────────────────────────────────────────
let _productQueue = null;

/**
 * Returns (or creates) the product operations queue.
 * Uses Bull + Redis when Redis is configured; InProcessQueue otherwise.
 * @returns {import("bull").Queue | InProcessQueue}
 */
function getProductQueue() {
    if (_productQueue) return _productQueue;

    if (config.redis.enabled) {
        const Bull = require("bull");
        const redisOpts = {
            host:     config.redis.host,
            port:     config.redis.port,
        };
        if (config.redis.password) redisOpts.password = config.redis.password;
        if (config.redis.tls)      redisOpts.tls = {};

        _productQueue = new Bull("product-operations", { redis: redisOpts });

        _productQueue.on("failed", (job, err) => {
            logger.error(`[QUEUE] Job ${job.id} ("${job.name}") failed: ${err.message}`);
        });
        _productQueue.on("completed", (job) => {
            logger.debug(`[QUEUE] Job ${job.id} ("${job.name}") completed.`);
        });

        logger.info("[QUEUE] Bull queue initialised with Redis backend.");
    } else {
        _productQueue = new InProcessQueue("product-operations");
        logger.info("[QUEUE] Using in-process fallback queue (no Redis).");
    }

    return _productQueue;
}

/**
 * Gracefully drains and closes all queues.  Called on SIGTERM.
 */
async function closeQueues() {
    if (_productQueue) {
        await _productQueue.close();
        _productQueue = null;
        logger.info("[QUEUE] Queue closed.");
    }
}

module.exports = { getProductQueue, closeQueues };
