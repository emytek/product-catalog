"use strict";

/**
 * cache.js
 * ────────
 * Two-level cache strategy:
 *
 * Level 1 — In-process NodeCache (always available, zero latency)
 *   Stores serialised JSON strings.  Eviction is TTL-based.
 *   Works on a single process; entries are NOT shared across CF instances.
 *
 * Level 2 — Redis (optional, requires REDIS_HOST to be set)
 *   Shared across all CF instances (horizontal scaling).
 *   Automatically used when available; app falls back to L1 if Redis is down.
 *
 * Cache key conventions:
 *   "catalog"                — full product list
 *   "product:<id>"           — single product
 *   "categories"             — category list
 *   "suppliers"              — supplier list
 *   "stats"                  — KPI aggregates
 *
 * SOLID — Dependency Inversion: callers depend on the get/set/del interface
 * defined here, not on a concrete Redis or NodeCache implementation.
 */

const NodeCache = require("node-cache");
const config    = require("./environment");
const logger    = require("../utils/logger");

// ── Level 1: In-process cache ─────────────────────────────────────────────────
const l1 = new NodeCache({
    stdTTL:         config.cache.ttlSeconds,
    checkperiod:    60,     // scan for expired keys every 60 s
    useClones:      false,  // store references; callers must not mutate cached values
    deleteOnExpire: true,
});

// ── Level 2: Redis (optional) ─────────────────────────────────────────────────
let redis = null;

async function initRedis() {
    if (!config.redis.enabled) {
        logger.info("[CACHE] Redis not configured — using in-process L1 cache only.");
        return;
    }

    const Redis = require("ioredis");
    const opts = {
        host:           config.redis.host,
        port:           config.redis.port,
        lazyConnect:    true,
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => (times > 5 ? null : Math.min(times * 100, 2000)),
    };
    if (config.redis.password) opts.password = config.redis.password;
    if (config.redis.tls)      opts.tls = {};

    redis = new Redis(opts);

    redis.on("error",  (err) => logger.warn("[CACHE] Redis error:", err.message));
    redis.on("connect",      () => logger.info("[CACHE] Redis connected."));
    redis.on("reconnecting", () => logger.info("[CACHE] Redis reconnecting..."));

    try {
        await redis.connect();
    } catch (err) {
        logger.warn("[CACHE] Redis unavailable — falling back to L1:", err.message);
        redis = null;
    }
}

// ── Public cache interface ────────────────────────────────────────────────────

/**
 * Retrieve a cached value.
 * Checks L2 (Redis) first, then L1 (NodeCache).
 * Promotes L2 hits to L1 for subsequent requests.
 * @param {string} key
 * @returns {Promise<any|null>}
 */
async function get(key) {
    // Try L1 first (zero-cost)
    const l1val = l1.get(key);
    if (l1val !== undefined) return JSON.parse(l1val);

    // Try L2
    if (redis) {
        try {
            const l2val = await redis.get(key);
            if (l2val !== null) {
                // Promote to L1
                l1.set(key, l2val);
                return JSON.parse(l2val);
            }
        } catch (err) {
            logger.warn("[CACHE] Redis get failed:", err.message);
        }
    }
    return null;
}

/**
 * Store a value in both cache levels.
 * @param {string} key
 * @param {any}    value
 * @param {number} [ttl]  TTL in seconds.  Defaults to config.cache.ttlSeconds.
 */
async function set(key, value, ttl = config.cache.ttlSeconds) {
    const serialised = JSON.stringify(value);
    l1.set(key, serialised, ttl);

    if (redis) {
        try {
            await redis.set(key, serialised, "EX", ttl);
        } catch (err) {
            logger.warn("[CACHE] Redis set failed:", err.message);
        }
    }
}

/**
 * Invalidate a specific key from all levels.
 * @param {string} key
 */
async function del(key) {
    l1.del(key);
    if (redis) {
        try { await redis.del(key); } catch {}
    }
}

/**
 * Invalidate all keys that start with a given prefix.
 * Used after a write operation to flush stale read-caches.
 * @param {string} prefix
 */
async function delByPrefix(prefix) {
    // L1: iterate known keys
    const keys = l1.keys().filter((k) => k.startsWith(prefix));
    keys.forEach((k) => l1.del(k));

    // L2: use SCAN to find matching keys (KEYS is blocking — not safe in production)
    if (redis) {
        try {
            let cursor = "0";
            do {
                const [nextCursor, found] = await redis.scan(
                    cursor, "MATCH", prefix + "*", "COUNT", 100
                );
                cursor = nextCursor;
                if (found.length) await redis.del(...found);
            } while (cursor !== "0");
        } catch (err) {
            logger.warn("[CACHE] Redis delByPrefix failed:", err.message);
        }
    }
}

/** Flush every key from all cache levels (use sparingly — admin only). */
async function flush() {
    l1.flushAll();
    if (redis) {
        try { await redis.flushdb(); } catch {}
    }
}

module.exports = { initRedis, get, set, del, delByPrefix, flush };
