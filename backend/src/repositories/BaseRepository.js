"use strict";

/**
 * BaseRepository.js
 * ─────────────────
 * Abstract base class for all repository implementations.
 *
 * Responsibilities:
 *   • Provides access to the shared HANA connection pool
 *   • Exposes a convenience method to create a new HanaRequest
 *   • Houses the transaction helper (begin / callback / commit|rollback)
 *   • Enforces the Repository interface (subclasses may override)
 *
 * SOLID — Open/Closed: subclasses extend without modifying this class.
 * SOLID — DIP: repositories depend on the pool abstraction, not the
 *              @sap/hana-client driver directly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * SQL SERVER REFERENCE (mssql) — original implementation notes
 * ─────────────────────────────────────────────────────────────────────────────
 * The original code used:
 *   const { getPool, sql } = require("../config/database");
 *   async getRequest() { return pool.request(); }   // mssql Request
 *   // withTransaction used sql.Transaction(pool) + sql.Request(transaction)
 *
 * HANA equivalent:
 *   pool.beginTransaction() acquires a dedicated connection + setAutoCommit(false)
 *   HanaTransactionContext.request() creates a HanaRequest on that connection
 *   pool.commitTransaction() / pool.rollbackTransaction() close the tx
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { getPool, sql, HanaTransactionContext } = require("../config/database");
const { DatabaseError } = require("../utils/errors");
const logger = require("../utils/logger");

class BaseRepository {
    constructor(tableName) {
        /** Logical table name — used in log messages. */
        this.tableName = tableName;
    }

    // ── Request factory ───────────────────────────────────────────────────────

    /**
     * Returns a new HanaRequest backed by the shared connection pool.
     * The connection is acquired lazily when request.query() is called.
     * @returns {Promise<import("../config/database").HanaRequest>}
     */
    async getRequest() {
        const pool = await getPool();
        return pool.request();
    }

    // ── Transaction helper ────────────────────────────────────────────────────

    /**
     * Executes a callback inside a HANA transaction.
     * If the callback throws, the transaction is rolled back automatically.
     *
     * The callback receives a HanaTransactionContext which exposes
     * .request() so repositories can create bound HanaRequests without
     * needing access to the raw connection.
     *
     * Usage (identical to the old mssql pattern — only the request()
     * call changes from `new sql.Request(tx)` to `tx.request()`):
     *
     *   await this.withTransaction(async (tx) => {
     *       const req = tx.request();
     *       req.input("id", sql.NVarChar(10), "P001");
     *       await req.query('INSERT INTO "Products" ...');
     *   });
     *
     * @param {function(HanaTransactionContext): Promise<any>} callback
     * @returns {Promise<any>}
     *
     * ── SQL SERVER REFERENCE ──────────────────────────────────────────────────
     * Original mssql version:
     *   const transaction = new sql.Transaction(pool);
     *   await transaction.begin();
     *   const result = await callback(transaction);
     *   await transaction.commit();
     *   // In callback: const req = new sql.Request(transaction);
     * ─────────────────────────────────────────────────────────────────────────
     */
    async withTransaction(callback) {
        const pool = await getPool();
        const conn = await pool.beginTransaction();
        const txCtx = new HanaTransactionContext(conn);

        try {
            const result = await callback(txCtx);
            await pool.commitTransaction(conn);
            return result;
        } catch (err) {
            await pool.rollbackTransaction(conn);

            // Re-wrap HANA driver errors so the caller only sees domain errors
            // HANA errors carry a numeric .code (not .number like mssql)
            if (err.code && typeof err.code === "number") {
                throw new DatabaseError(`Database operation failed: ${err.message}`);
            }
            throw err;
        }
    }

    // ── Query helpers ─────────────────────────────────────────────────────────

    /**
     * Convenience: execute a parameterised query via the pool.
     * @param {string}   queryText
     * @param {function(HanaRequest): void} paramBuilder — calls .input() on the request
     * @returns {Promise<{recordset: object[], rowsAffected: number[]}>}
     */
    async query(queryText, paramBuilder = () => {}) {
        try {
            const request = await this.getRequest();
            paramBuilder(request);
            return await request.query(queryText);
        } catch (err) {
            if (err.code && typeof err.code === "number") {
                throw new DatabaseError(`Query failed on ${this.tableName}: ${err.message}`);
            }
            throw err;
        }
    }

    /**
     * Convenience: execute a stored procedure via the pool.
     * Note: most stored-procedure logic is replaced by inline SQL in the HANA
     * repositories.  This method is retained for compatibility.
     * @param {string}   procName
     * @param {function(HanaRequest): void} paramBuilder
     * @returns {Promise<{recordset: object[], output: object}>}
     */
    async exec(procName, paramBuilder = () => {}) {
        try {
            const request = await this.getRequest();
            paramBuilder(request);
            return await request.execute(procName);
        } catch (err) {
            if (err.code && typeof err.code === "number") {
                throw new DatabaseError(`Stored procedure ${procName} failed: ${err.message}`);
            }
            throw err;
        }
    }
}

module.exports = BaseRepository;
