"use strict";

/**
 * ApiResponse.js
 * ──────────────
 * Enforces a consistent JSON envelope for every API response.
 *
 * Success:
 *   { "success": true,  "data": <payload>,   "meta": <optional> }
 *
 * Error:
 *   { "success": false, "error": { "code": "...", "message": "...", "details": [...] } }
 *
 * Having a single response shape means:
 *   • Frontend always knows where to find its data
 *   • API monitoring / testing can rely on the "success" flag
 *   • No ad-hoc {status, result, payload, ...} inconsistencies
 */

class ApiResponse {
    /**
     * Send a successful response.
     * @param {import("express").Response} res
     * @param {any}    data       - Primary payload
     * @param {number} [status]   - HTTP status code (default 200)
     * @param {object} [meta]     - Pagination, cache info, etc.
     */
    static success(res, data, status = 200, meta = null) {
        const body = { success: true, data };
        if (meta) body.meta = meta;
        return res.status(status).json(body);
    }

    /**
     * Send a 201 Created response (used after POST).
     * @param {import("express").Response} res
     * @param {any} data
     */
    static created(res, data) {
        return ApiResponse.success(res, data, 201);
    }

    /**
     * Send a 204 No Content response (used after DELETE with no body).
     * @param {import("express").Response} res
     */
    static noContent(res) {
        return res.status(204).end();
    }

    /**
     * Send an error response.
     * @param {import("express").Response} res
     * @param {number} status      - HTTP status code
     * @param {string} code        - Machine-readable error code (e.g. "NOT_FOUND")
     * @param {string} message     - Human-readable message
     * @param {any[]}  [details]   - Validation error details, etc.
     */
    static error(res, status, code, message, details = null) {
        const body = {
            success: false,
            error: { code, message },
        };
        if (details) body.error.details = details;
        return res.status(status).json(body);
    }

    // ── Convenience error factories ───────────────────────────────────────────

    static badRequest(res, message, details = null) {
        return ApiResponse.error(res, 400, "BAD_REQUEST", message, details);
    }

    static notFound(res, message = "Resource not found.") {
        return ApiResponse.error(res, 404, "NOT_FOUND", message);
    }

    static conflict(res, message) {
        return ApiResponse.error(res, 409, "CONFLICT", message);
    }

    static unprocessable(res, message, details = null) {
        return ApiResponse.error(res, 422, "VALIDATION_ERROR", message, details);
    }

    static tooManyRequests(res) {
        return ApiResponse.error(
            res, 429, "RATE_LIMIT_EXCEEDED",
            "Too many requests. Please slow down and try again later."
        );
    }

    static internalError(res, message = "An unexpected error occurred.") {
        return ApiResponse.error(res, 500, "INTERNAL_ERROR", message);
    }
}

module.exports = ApiResponse;
