"use strict";

/**
 * cache.middleware.js
 * ───────────────────
 * HTTP-level cache middleware for GET endpoints.
 *
 * How it works:
 *   1. On GET request: compute a cache key from the URL + query string.
 *   2. If a cached response exists, return it immediately (no DB hit).
 *   3. If not, let the request proceed; intercept res.json() to cache before sending.
 *
 * This is a read-through cache: the controller / service code is completely
 * unaware of caching — it just calls res.json() as normal.
 *
 * Cache invalidation is handled by the service layer (cache.delByPrefix after writes).
 */

const cacheStore = require("../config/cache");
const config     = require("../config/environment");
const logger     = require("../utils/logger");

/**
 * Returns a cache middleware with a configurable TTL.
 * @param {number} [ttl]  Override TTL in seconds.  Defaults to config.cache.ttlSeconds.
 */
function cacheMiddleware(ttl = config.cache.ttlSeconds) {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== "GET") return next();

        const key = `http:${req.originalUrl}`;

        try {
            const cached = await cacheStore.get(key);
            if (cached !== null) {
                logger.debug(`[CACHE] HIT  ${key}`);
                res.setHeader("X-Cache", "HIT");
                return res.json(cached);
            }
            logger.debug(`[CACHE] MISS ${key}`);
        } catch (err) {
            logger.warn("[CACHE] Cache read error:", err.message);
            // Cache failure should never block a request — fall through
        }

        // Intercept res.json to store the response before sending
        const originalJson = res.json.bind(res);
        res.json = async (body) => {
            // Only cache successful responses
            if (res.statusCode >= 200 && res.statusCode < 300) {
                try {
                    await cacheStore.set(key, body, ttl);
                } catch (err) {
                    logger.warn("[CACHE] Cache write error:", err.message);
                }
            }
            res.setHeader("X-Cache", "MISS");
            return originalJson(body);
        };

        next();
    };
}

module.exports = cacheMiddleware;
