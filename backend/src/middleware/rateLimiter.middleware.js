"use strict";

/**
 * rateLimiter.middleware.js
 * ─────────────────────────
 * Rate-limiting configurations using express-rate-limit.
 *
 * Why rate limit?
 *   Protects against DoS, brute-force, and runaway clients.
 *   In SAP BTP Cloud Foundry, each application instance gets its own counter
 *   because rate-limit state is in-process.  For a shared counter across
 *   instances, a Redis store (rate-limit-redis) can be swapped in.
 *
 * Three tiers:
 *   general    — 200 requests / 15 min  (default for all routes)
 *   write      — 60  requests / 15 min  (POST / PUT / DELETE)
 *   strict     — 20  requests / 15 min  (future: auth / admin routes)
 */

const rateLimit = require("express-rate-limit");
const config    = require("../config/environment");
const ApiResponse = require("../utils/ApiResponse");

const handler = (req, res) => ApiResponse.tooManyRequests(res);

/** General-purpose rate limit applied globally. */
const generalLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max:      config.rateLimit.maxRequests,
    standardHeaders: true,   // Return RateLimit-* headers
    legacyHeaders:   false,
    handler,
    skip: (req) => req.path === "/health",   // never rate-limit the health check
});

/** Stricter limit for mutating (write) operations. */
const writeLimiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max:      Math.floor(config.rateLimit.maxRequests / 3),
    standardHeaders: true,
    legacyHeaders:   false,
    handler,
});

module.exports = { generalLimiter, writeLimiter };
