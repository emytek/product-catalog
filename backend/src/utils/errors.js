"use strict";

/**
 * errors.js
 * ─────────
 * Custom error class hierarchy.
 *
 * Why custom errors?
 *   Throwing a generic Error() loses context (status code, machine-readable code,
 *   details).  The global error middleware in error.middleware.js distinguishes
 *   between "operational" errors (expected, user-facing: 400/404/422/409) and
 *   "programmer" errors (unexpected: 500) by checking `isOperational`.
 *
 * Usage in a service:
 *   throw new NotFoundError("Product P999 not found.");
 *   throw new ValidationError("Price must be positive.", [{ field: "Price" }]);
 */

class AppError extends Error {
    /**
     * @param {string} message      - Human-readable message
     * @param {number} statusCode   - HTTP status code
     * @param {string} code         - Machine-readable error code
     * @param {any[]}  [details]    - Optional structured details (validation errors, etc.)
     */
    constructor(message, statusCode, code, details = null) {
        super(message);
        this.name        = this.constructor.name;
        this.statusCode  = statusCode;
        this.code        = code;
        this.details     = details;
        this.isOperational = true;           // Expected — safe to expose to client
        Error.captureStackTrace(this, this.constructor);
    }
}

class BadRequestError extends AppError {
    constructor(message, details = null) {
        super(message, 400, "BAD_REQUEST", details);
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, "NOT_FOUND");
    }
}

class ConflictError extends AppError {
    constructor(message) {
        super(message, 409, "CONFLICT");
    }
}

class ValidationError extends AppError {
    constructor(message, details = null) {
        super(message, 422, "VALIDATION_ERROR", details);
    }
}

class DatabaseError extends AppError {
    constructor(message) {
        // 500 but still operational — we log it but don't expose DB internals
        super(message, 500, "DATABASE_ERROR");
    }
}

module.exports = {
    AppError,
    BadRequestError,
    NotFoundError,
    ConflictError,
    ValidationError,
    DatabaseError,
};
