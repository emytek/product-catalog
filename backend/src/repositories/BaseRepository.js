"use strict";

/**
 * BaseRepository.js
 * ─────────────────
 * Abstract base class for all repository implementations.
 *
 * Responsibilities:
 *   • Provides access to the shared connection pool
 *   • Exposes a convenience method to create a new Request
 *   • Houses a thin transaction helper
 *   • Enforces the Repository interface (subclasses may override)
 *
 * SOLID — Open/Closed: subclasses extend without modifying this class.
 * SOLID — DIP: repositories depend on the pool abstraction, not mssql directly.
 */

const { getPool, sql } = require("../config/database");
const { DatabaseError } = require("../utils/errors");
const logger = require("../utils/logger");

class BaseRepository {
    constructor(tableName) {
        /** Logical table name — used in generic log messages. */
        this.tableName = tableName;
    }

    /**
     * Returns a new mssql Request bound to the shared pool.
     * @returns {Promise<import("mssql").Request>}
     */
    async getRequest() {
        const pool = await getPool();
        return pool.request();
    }

    /**
     * Executes a callback inside a SQL Server transaction.
     * If the callback throws, the transaction is rolled back.
     *
     * Usage:
     *   await this.withTransaction(async (transaction) => {
     *       const req = new sql.Request(transaction);
     *       await req.query("INSERT ...");
     *       await req.query("UPDATE ...");
     *   });
     *
     * @param {function(import("mssql").Transaction): Promise<any>} callback
     * @returns {Promise<any>}
     */
    async withTransaction(callback) {
        const pool        = await getPool();
        const transaction = new sql.Transaction(pool);

        try {
            await transaction.begin();
            const result = await callback(transaction);
            await transaction.commit();
            return result;
        } catch (err) {
            try {
                await transaction.rollback();
            } catch (rollbackErr) {
                logger.error("[DB] Transaction rollback failed:", rollbackErr.message);
            }
            // Re-wrap mssql errors so the caller only sees domain errors
            if (err.number) {
                throw new DatabaseError(`Database operation failed: ${err.message}`);
            }
            throw err;
        }
    }

    /**
     * Convenience: execute a parameterised query via the pool.
     * @param {string}   queryText
     * @param {function(import("mssql").Request): void} paramBuilder - adds .input() calls
     * @returns {Promise<import("mssql").IResult<any>>}
     */
    async query(queryText, paramBuilder = () => {}) {
        try {
            const request = await this.getRequest();
            paramBuilder(request);
            return await request.query(queryText);
        } catch (err) {
            if (err.number) {
                throw new DatabaseError(`Query failed on ${this.tableName}: ${err.message}`);
            }
            throw err;
        }
    }

    /**
     * Convenience: execute a stored procedure via the pool.
     * @param {string}   procName
     * @param {function(import("mssql").Request): void} paramBuilder
     * @returns {Promise<import("mssql").IResult<any>>}
     */
    async exec(procName, paramBuilder = () => {}) {
        try {
            const request = await this.getRequest();
            paramBuilder(request);
            return await request.execute(procName);
        } catch (err) {
            if (err.number) {
                throw new DatabaseError(`Stored procedure ${procName} failed: ${err.message}`);
            }
            throw err;
        }
    }
}

module.exports = BaseRepository;
