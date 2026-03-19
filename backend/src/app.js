"use strict";

/**
 * app.js
 * ──────
 * Assembles the Express application.
 *
 * Middleware stack (top to bottom = first to last applied):
 *   1. helmet        — security headers (XSS, HSTS, clickjacking, etc.)
 *   2. cors          — Cross-Origin Resource Sharing
 *   3. compression   — gzip all responses (bandwidth optimisation for BTP)
 *   4. morgan        — HTTP access logging
 *   5. json parser   — parse application/json bodies
 *   6. rate limiter  — protect against DoS / runaway clients
 *   7. API routes    — all /api/v1/* handlers
 *   8. health check  — /health endpoint (excluded from rate limiting)
 *   9. 404 handler   — catch unmatched routes
 *  10. error handler — global error middleware (must be last)
 */

require("express-async-errors");   // Patches async route handlers to forward errors

const express    = require("express");
const helmet     = require("helmet");
const cors       = require("cors");
const compression = require("compression");
const morgan     = require("morgan");
const path       = require("path");

const config          = require("./config/environment");
const v1Router        = require("./api/v1");
const errorMiddleware = require("./middleware/error.middleware");
const { generalLimiter } = require("./middleware/rateLimiter.middleware");
const { isHealthy }   = require("./config/database");
const ApiResponse     = require("./utils/ApiResponse");
const logger          = require("./utils/logger");

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },   // allow SAPUI5 CDN resources
}));

// ── CORS ──────────────────────────────────────────────────────────────────────
// In development: allow the ui5 serve origin (typically localhost:8080)
// In production:  allow only the BTP approuter origin
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (curl, Postman, same-origin)
        if (!origin) return callback(null, true);
        if (config.cors.origins.includes(origin) || config.app.nodeEnv === "development") {
            return callback(null, true);
        }
        callback(new Error(`CORS policy does not allow origin: ${origin}`));
    },
    methods:          ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders:   ["Content-Type", "Authorization", "X-Request-ID"],
    exposedHeaders:   ["X-Cache", "RateLimit-Remaining"],
    credentials:      true,
    optionsSuccessStatus: 204,
}));

// ── Compression (gzip) ────────────────────────────────────────────────────────
// Reduces payload size significantly for large product catalogue responses.
app.use(compression({ level: 6, threshold: 512 }));

// ── HTTP logging ──────────────────────────────────────────────────────────────
const morganFormat = config.app.isProduction ? "combined" : "dev";
app.use(morgan(morganFormat, {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip:   (req) => req.path === "/health",
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false, limit: "1mb" }));

// ── Trust proxy (required for rate-limit source IP in CF / behind nginx) ──────
if (config.app.isProduction) {
    app.set("trust proxy", 1);
}

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use(generalLimiter);

// ── Health check (no rate limit, no auth) ─────────────────────────────────────
app.get("/health", async (req, res) => {
    const dbOk = await isHealthy();
    const status = dbOk ? 200 : 503;
    res.status(status).json({
        status:    dbOk ? "UP" : "DEGRADED",
        database:  dbOk ? "connected" : "unreachable",
        uptime:    Math.floor(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});

// ── API routes ────────────────────────────────────────────────────────────────
app.use(`/api/${config.app.apiVersion}`, v1Router);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((req, res) => {
    ApiResponse.notFound(res, `Route ${req.method} ${req.path} not found.`);
});

// ── Global error handler (MUST be last middleware) ────────────────────────────
app.use(errorMiddleware);

module.exports = app;
