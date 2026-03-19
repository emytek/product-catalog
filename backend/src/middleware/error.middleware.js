"use strict";

/**
 * error.middleware.js
 * ───────────────────
 * Global Express error handler — must be the LAST middleware registered.
 *
 * Distinguishes between:
 *   Operational errors  (AppError subclasses, isOperational=true)
 *     → Return the error's own statusCode + message to the client
 *   Programmer errors   (anything else)
 *     → Log the full stack trace, return a generic 500 to the client
 *       (never expose internal details in production)
 */

const logger      = require("../utils/logger");
const ApiResponse = require("../utils/ApiResponse");
const { AppError } = require("../utils/errors");

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
    // ── 1. Log ────────────────────────────────────────────────────────────────
    if (err.isOperational) {
        // Expected error — info level, no stack trace needed
        logger.warn(`[ERR] ${err.statusCode} ${err.code} — ${err.message}`);
    } else {
        // Unexpected — full stack, visible in logs but NOT in response
        logger.error(`[ERR] Unhandled error on ${req.method} ${req.path}`, {
            error:   err.message,
            stack:   err.stack,
            body:    req.body,
            params:  req.params,
            query:   req.query,
        });
    }

    // ── 2. mssql-specific errors (wrap as operational for common cases) ────────
    if (!err.isOperational && err.number) {
        // SQL Server error numbers
        const SQL_UNIQUE_VIOLATION   = 2627;
        const SQL_FK_VIOLATION       = 547;
        const SQL_NULL_VIOLATION     = 515;

        if (err.number === SQL_UNIQUE_VIOLATION) {
            return ApiResponse.conflict(res, "A record with this identifier already exists.");
        }
        if (err.number === SQL_FK_VIOLATION) {
            return ApiResponse.badRequest(res, "Referenced record does not exist.");
        }
        if (err.number === SQL_NULL_VIOLATION) {
            return ApiResponse.badRequest(res, "A required field is missing.");
        }
    }

    // ── 3. Joi validation errors (from express-joi-validation or manual throw) ─
    if (err.isJoi || err.name === "ValidationError") {
        return ApiResponse.unprocessable(
            res,
            "Validation failed.",
            err.details ? err.details.map((d) => ({ field: d.path.join("."), message: d.message })) : null
        );
    }

    // ── 4. Operational (AppError) ─────────────────────────────────────────────
    if (err instanceof AppError) {
        return ApiResponse.error(res, err.statusCode, err.code, err.message, err.details);
    }

    // ── 5. Fallback: generic 500 ──────────────────────────────────────────────
    const message = process.env.NODE_ENV === "production"
        ? "An unexpected error occurred. Please try again later."
        : err.message;

    return ApiResponse.internalError(res, message);
}

module.exports = errorMiddleware;
