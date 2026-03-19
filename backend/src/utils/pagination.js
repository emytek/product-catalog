"use strict";

/**
 * pagination.js
 * ─────────────
 * Pure utility functions for pagination calculations.
 *
 * DRY: these formulas exist in exactly one place so that every repository
 * that needs pagination delegates here rather than reimplementing the maths.
 */

const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 20;

/**
 * Normalise and validate page / limit query params.
 * Returns safe integer values, clamped within acceptable ranges.
 *
 * @param {string|number} rawPage   - The "page" query param (1-based)
 * @param {string|number} rawLimit  - The "limit" query param
 * @returns {{ page: number, limit: number }}
 */
function parsePagination(rawPage, rawLimit) {
    let page  = parseInt(rawPage,  10);
    let limit = parseInt(rawLimit, 10);

    if (isNaN(page)  || page  < 1) page  = 1;
    if (isNaN(limit) || limit < 1) limit = DEFAULT_PAGE_SIZE;
    if (limit > MAX_PAGE_SIZE)     limit = MAX_PAGE_SIZE;

    return { page, limit };
}

/**
 * Calculate the SQL OFFSET value for a given page and limit.
 * @param {number} page   - 1-based page number
 * @param {number} limit  - items per page
 * @returns {number}
 */
function calcOffset(page, limit) {
    return (page - 1) * limit;
}

/**
 * Build the pagination meta object included in API responses.
 * @param {number} page        - Current page
 * @param {number} limit       - Items per page
 * @param {number} totalCount  - Total matching items (before pagination)
 * @returns {{page, limit, totalCount, totalPages, hasNext, hasPrev}}
 */
function buildMeta(page, limit, totalCount) {
    const totalPages = Math.max(1, Math.ceil(totalCount / limit));
    return {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
    };
}

module.exports = { parsePagination, calcOffset, buildMeta, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
