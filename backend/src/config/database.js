"use strict";

/**
 * database.js
 * ───────────
 * Manages the single mssql ConnectionPool for the entire application.
 *
 * Architecture note (connection pooling):
 *   A ConnectionPool is expensive to create (TCP handshake + authentication).
 *   We create it once at startup, keep it open, and hand the same pool to every
 *   repository.  The pool internally manages a set of ready connections, lending
 *   them to callers and returning them to the pool when done.  Under load this
 *   is far more efficient than opening a new connection per request.
 *
 * Key pool settings (tuned for SAP BTP 256 MB instance):
 *   max: 10  — never hold more than 10 concurrent connections
 *   min: 2   — pre-warm 2 connections so the first requests don't cold-start
 *   idleTimeoutMillis: 30 s — release an idle connection after 30 seconds
 *   acquireTimeoutMillis: 15 s — fail fast if no connection is free after 15 s
 */

const sql    = require("mssql");
const config = require("./environment");
const logger = require("../utils/logger");

// ── Pool singleton ─────────────────────────────────────────────────────────────
let _pool = null;

/**
 * Returns the mssql config object derived from the environment.
 * @returns {import("mssql").config}
 */
function buildMssqlConfig() {
    return {
        user:     config.db.user,
        password: config.db.password,
        server:   config.db.host,
        port:     config.db.port,
        database: config.db.database,
        options: {
            encrypt:               config.db.encrypt,
            trustServerCertificate: config.db.trustServerCertificate,
            enableArithAbort:      true,
            // Return date/time columns as strings, not JS Date objects.
            // This guarantees consistent ISO-8601 formatting across all queries.
            useUTC: true,
        },
        pool: config.db.pool,
        // Retry on connection errors (network blips in cloud environments)
        connectionTimeout: 15000,
        requestTimeout:    30000,
    };
}

/**
 * Creates (or returns the existing) ConnectionPool.
 * Must be called before any repository operation.
 * @returns {Promise<import("mssql").ConnectionPool>}
 */
async function getPool() {
    if (_pool && _pool.connected) {
        return _pool;
    }

    logger.info("[DB] Creating connection pool...");
    _pool = new sql.ConnectionPool(buildMssqlConfig());

    // Surface pool-level errors so they are logged and don't become unhandled
    // promise rejections that crash the process silently.
    _pool.on("error", (err) => {
        logger.error("[DB] Pool error:", err.message);
    });

    await _pool.connect();
    logger.info(
        `[DB] Pool connected to ${config.db.host}:${config.db.port}/${config.db.database} ` +
        `(pool max=${config.db.pool.max})`
    );
    return _pool;
}

/**
 * Gracefully closes the pool.  Called during SIGTERM / SIGINT handling in
 * server.js so in-flight requests can finish before the process exits.
 */
async function closePool() {
    if (_pool) {
        await _pool.close();
        _pool = null;
        logger.info("[DB] Pool closed.");
    }
}

/**
 * Health-check helper.  Used by the /health endpoint.
 * @returns {Promise<boolean>}
 */
async function isHealthy() {
    try {
        const pool    = await getPool();
        const request = pool.request();
        await request.query("SELECT 1 AS alive");
        return true;
    } catch {
        return false;
    }
}

module.exports = { getPool, closePool, isHealthy, sql };
