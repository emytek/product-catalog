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
 *     → Log the full stack trace; return a generic 500 to the client
 *       (never expose internal details in production)
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DATABASE ERROR MAPPING — SAP HANA Cloud (active)
 * ─────────────────────────────────────────────────────────────────────────────
 * HANA driver errors carry a numeric .code property (not .number like mssql).
 * Common HANA error codes mapped here:
 *   301  — Unique constraint violation  → 409 Conflict
 *   461  — Foreign key constraint       → 400 Bad Request
 *   307  — NOT NULL constraint          → 400 Bad Request
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL SERVER REFERENCE (mssql error numbers — retained for rollback)
 * ─────────────────────────────────────────────────────────────────────────────
 * mssql errors used err.number (not err.code).  SQL Server error numbers:
 *   2627 — Unique key violation  → 409 Conflict
 *   547  — FK constraint         → 400 Bad Request
 *   515  — NOT NULL violation    → 400 Bad Request
 *
 * To restore SQL Server error handling:
 *   1. Replace the HANA error block below with the SQL Server block (commented).
 *   2. Change the condition from (!err.isOperational && err.code) to
 *      (!err.isOperational && err.number).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const logger      = require("../utils/logger");
const ApiResponse = require("../utils/ApiResponse");
const { AppError } = require("../utils/errors");

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {

    // ── 1. Log ────────────────────────────────────────────────────────────────
    if (err.isOperational) {
        logger.warn(`[ERR] ${err.statusCode} ${err.code} — ${err.message}`);
    } else {
        logger.error(`[ERR] Unhandled error on ${req.method} ${req.path}`, {
            error:  err.message,
            stack:  err.stack,
            body:   req.body,
            params: req.params,
            query:  req.query,
        });
    }

    // ── 2. SAP HANA Cloud driver errors (wrap common constraint violations) ───
    // HANA errors carry err.code (number) — check for this to distinguish from
    // AppError.code (string like "NOT_FOUND") using typeof check.
    if (!err.isOperational && err.code && typeof err.code === "number") {
        const HANA_UNIQUE_VIOLATION = 301;   // Unique constraint violated
        const HANA_FK_VIOLATION     = 461;   // Foreign key constraint violated
        const HANA_NULL_VIOLATION   = 307;   // NOT NULL constraint violated

        if (err.code === HANA_UNIQUE_VIOLATION) {
            return ApiResponse.conflict(res, "A record with this identifier already exists.");
        }
        if (err.code === HANA_FK_VIOLATION) {
            return ApiResponse.badRequest(res, "Referenced record does not exist.");
        }
        if (err.code === HANA_NULL_VIOLATION) {
            return ApiResponse.badRequest(res, "A required field is missing.");
        }
    }

    // ── SQL SERVER REFERENCE ──────────────────────────────────────────────────
    // Original mssql error block — restore when rolling back to Azure SQL Server.
    // if (!err.isOperational && err.number) {
    //     const SQL_UNIQUE_VIOLATION = 2627;
    //     const SQL_FK_VIOLATION     = 547;
    //     const SQL_NULL_VIOLATION   = 515;
    //     if (err.number === SQL_UNIQUE_VIOLATION) {
    //         return ApiResponse.conflict(res, "A record with this identifier already exists.");
    //     }
    //     if (err.number === SQL_FK_VIOLATION) {
    //         return ApiResponse.badRequest(res, "Referenced record does not exist.");
    //     }
    //     if (err.number === SQL_NULL_VIOLATION) {
    //         return ApiResponse.badRequest(res, "A required field is missing.");
    //     }
    // }
    // ─────────────────────────────────────────────────────────────────────────

    // ── 3. Joi validation errors ──────────────────────────────────────────────
    if (err.isJoi || err.name === "ValidationError") {
        return ApiResponse.unprocessable(
            res,
            "Validation failed.",
            err.details
                ? err.details.map((d) => ({ field: d.path.join("."), message: d.message }))
                : null
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
