"use strict";

/**
 * database.js  —  SAP HANA Cloud edition
 * ────────────────────────────────────────
 * Manages a lightweight connection pool for @sap/hana-client and exposes a
 * request/query interface that is intentionally compatible with the previous
 * mssql interface so that all repository code requires only minimal changes.
 *
 * Key design decisions:
 *   HanaPool      — holds a bounded set of HANA connections, pre-warms at
 *                   startup, and queues callers when all connections are busy.
 *   HanaRequest   — mimics the mssql Request object (.input() / .query()).
 *                   Named @param placeholders are auto-converted to positional
 *                   ? before the statement is sent to HANA.
 *   HanaTransactionContext — wraps a dedicated connection in autoCommit=false
 *                   mode so repository callbacks can create requests without
 *                   knowing the underlying connection object.
 *   sql (shim)    — a dummy type object so that existing req.input("x", sql.NVarChar(100), v)
 *                   calls continue to compile; the type argument is ignored
 *                   because HANA infers types from the JavaScript values.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ORIGINAL SQL SERVER VERSION (mssql) — retained for rollback reference
 * ─────────────────────────────────────────────────────────────────────────────
 * The mssql implementation used a single sql.ConnectionPool singleton.
 * To restore Azure SQL Server support:
 *   1. npm install mssql@^10.0.4
 *   2. Replace this entire file with the original (see git history or
 *      the rollback section in Doc/HANA_Migration_Guide.txt).
 *   3. Restore original environment.js, repositories, error.middleware.js,
 *      and mta.yaml from the same guide.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const hana   = require("@sap/hana-client");
const config = require("./environment");
const logger = require("../utils/logger");

// =============================================================================
// SQL TYPE SHIM
// =============================================================================
// HANA uses positional '?' parameters — JS values are mapped to HANA types
// automatically by the client driver.  This shim lets every existing
// req.input("name", sql.NVarChar(100), value) call work without modification;
// the type argument is simply ignored at runtime.
const sql = {
    NVarChar:  () => null,
    VarChar:   () => null,
    NChar:     () => null,
    Char:      () => null,
    Int:       null,
    Integer:   null,
    Decimal:   () => null,
    Float:     null,
    Real:      null,
    Bit:       null,
    Boolean:   null,
    TinyInt:   null,
    SmallInt:  null,
    BigInt:    null,
    DateTime2: null,
    DateTime:  null,
    Date:      null,
    MAX:       -1,   // placeholder for sql.NVarChar(sql.MAX) calls
};

// =============================================================================
// HANA REQUEST
// =============================================================================
/**
 * Mimics the mssql Request interface so existing repository code needs only
 * minimal changes.
 *
 * Typical usage (identical to old mssql code):
 *   const req = pool.request();
 *   req.input("id", sql.NVarChar(10), "P001");  // type arg is ignored
 *   const result = await req.query('SELECT * FROM "Products" WHERE "ProductID" = @id');
 *   result.recordset          // → array of row objects
 *   result.rowsAffected[0]    // → affected row count for DML
 */
class HanaRequest {
    /**
     * @param {HanaPool|object} source  — pool (for regular queries) or raw
     *                                    HANA connection (for transaction queries)
     */
    constructor(source) {
        this._source   = source;
        this._isPool   = source instanceof HanaPool;
        this._params   = [];         // [{name, value}] in insertion order
        this._paramMap = {};         // name → index in _params
        this._outputParams = {};     // shim for .output() calls
    }

    /**
     * Register a named parameter.  Accepts both mssql call forms:
     *   .input("name", sql.SomeType, value)   ← type is ignored
     *   .input("name", value)
     */
    input(name, typeOrValue, value) {
        const actualValue = (value !== undefined) ? value : typeOrValue;
        if (!(name in this._paramMap)) {
            this._paramMap[name] = this._params.length;
            this._params.push({ name, value: actualValue });
        } else {
            // Update existing param value (idempotent re-call)
            this._params[this._paramMap[name]].value = actualValue;
        }
        return this;
    }

    /** No-op shim for mssql .output() calls (stored-proc output params). */
    output(name) {
        this._outputParams[name] = null;
        return this;
    }

    /**
     * Convert every @paramName occurrence in sqlText to a positional '?'
     * and collect the corresponding values in appearance order.
     * The same @param can appear multiple times — each occurrence gets its
     * own '?' with its own copy of the value in the positional array.
     * @private
     */
    _convertParams(sqlText) {
        const paramValues = [];
        const hanaSQL = sqlText.replace(/@(\w+)/g, (_, paramName) => {
            if (paramName in this._paramMap) {
                paramValues.push(this._params[this._paramMap[paramName]].value);
                return "?";
            }
            return `@${paramName}`;   // unknown param — leave as-is (safety)
        });
        return { hanaSQL, paramValues };
    }

    /**
     * Execute a SQL statement.  For pool-backed requests, acquires a
     * connection automatically and releases it when done.
     * @param {string} sqlText
     * @returns {Promise<{recordset: object[], recordsets: object[][], rowsAffected: number[]}>}
     */
    async query(sqlText) {
        const { hanaSQL, paramValues } = this._convertParams(sqlText);

        if (this._isPool) {
            const conn = await this._source._acquire();
            try {
                return await _execOnConn(conn, hanaSQL, paramValues);
            } finally {
                this._source._release(conn);
            }
        } else {
            // Transaction-bound: use the connection directly (no acquire/release)
            return _execOnConn(this._source, hanaSQL, paramValues);
        }
    }

    /**
     * Execute a stored procedure via CALL.
     * Note: Most stored-procedure logic has been replaced by inline SQL in
     * the HANA repositories.  This method exists for completeness.
     * @param {string} procName
     */
    async execute(procName) {
        const vals         = this._params.map(p => p.value);
        const placeholders = vals.map(() => "?").join(", ");
        const callSQL      = `CALL "${procName}"(${placeholders})`;

        const conn = this._isPool ? await this._source._acquire() : this._source;
        try {
            const rows = await conn.exec(callSQL, vals);
            return {
                recordset:    Array.isArray(rows) ? rows : [],
                recordsets:   [Array.isArray(rows) ? rows : []],
                output:       this._outputParams,
                rowsAffected: [0],
            };
        } finally {
            if (this._isPool) this._source._release(conn);
        }
    }
}

// =============================================================================
// INTERNAL HELPER — execute on a raw HANA connection
// =============================================================================
async function _execOnConn(conn, hanaSQL, paramValues) {
    const result = await conn.exec(hanaSQL, paramValues);

    if (!Array.isArray(result)) {
        // DML (INSERT / UPDATE / DELETE) → result is the affected-row count
        return {
            recordset:    [],
            recordsets:   [[]],
            rowsAffected: [typeof result === "number" ? result : 0],
        };
    }
    // SELECT → result is an array of row objects
    return {
        recordset:    result,
        recordsets:   [result],
        rowsAffected: [result.length],
    };
}

// =============================================================================
// HANA TRANSACTION CONTEXT
// =============================================================================
/**
 * Wraps a dedicated HANA connection that has been placed in autoCommit=false
 * mode.  Passed as the "transaction" argument to repository callbacks so they
 * can create HanaRequests without needing to know the underlying connection.
 *
 * Repository code that previously did:
 *   const req = new sql.Request(transaction);
 * now does:
 *   const req = transaction.request();
 */
class HanaTransactionContext {
    constructor(conn) {
        this._conn = conn;
    }

    /** Create a HanaRequest bound to this transaction's connection. */
    request() {
        return new HanaRequest(this._conn);
    }
}

// =============================================================================
// HANA POOL
// =============================================================================
class HanaPool {
    constructor(connParams, poolConfig) {
        this._connParams    = connParams;
        this._max           = poolConfig.max  || 10;
        this._min           = poolConfig.min  || 2;
        this._acquireMs     = poolConfig.acquireTimeoutMillis || 15000;
        this._available     = [];   // idle connections
        this._total         = 0;    // total connections created
        this._waitQueue     = [];   // resolve functions waiting for a connection
        this._connected     = false;
    }

    get connected() { return this._connected; }

    // ── Startup ──────────────────────────────────────────────────────────────

    /**
     * Pre-warm the pool by creating min connections at startup.
     * Must be called before the first getPool() returns.
     */
    async connect() {
        for (let i = 0; i < this._min; i++) {
            const conn = await this._createConnection();
            this._available.push(conn);
        }
        this._connected = true;
    }

    // ── Public request API ───────────────────────────────────────────────────

    /** Create a HanaRequest backed by the pool (lazy connection acquire). */
    request() {
        return new HanaRequest(this);
    }

    // ── Transaction support ──────────────────────────────────────────────────

    /**
     * Acquire a dedicated connection and begin a transaction
     * (sets autoCommit=false).  Returns the raw connection; caller must
     * call commitTransaction() or rollbackTransaction() when done.
     * @returns {Promise<object>} raw HANA connection
     */
    async beginTransaction() {
        const conn = await this._acquire();
        await conn.setAutoCommit(false);
        return conn;
    }

    async commitTransaction(conn) {
        await conn.commit();
        await conn.setAutoCommit(true);
        this._release(conn);
    }

    async rollbackTransaction(conn) {
        try { await conn.rollback(); } catch { /* ignore rollback errors */ }
        try { await conn.setAutoCommit(true); } catch {}
        this._release(conn);
    }

    // ── Health check ─────────────────────────────────────────────────────────

    async isHealthy() {
        let conn;
        try {
            conn = await this._acquire();
            await conn.exec("SELECT 1 FROM DUMMY");
            return true;
        } catch {
            return false;
        } finally {
            if (conn) this._release(conn);
        }
    }

    // ── Shutdown ─────────────────────────────────────────────────────────────

    async close() {
        for (const conn of this._available) {
            try { await conn.disconnect(); } catch {}
        }
        this._available = [];
        this._total     = 0;
        this._connected = false;
    }

    // ── Internal pool management ─────────────────────────────────────────────

    /** Acquire a connection — from idle pool, or create one, or wait. */
    async _acquire() {
        if (this._available.length > 0) return this._available.pop();
        if (this._total < this._max)    return this._createConnection();

        // All connections busy — queue the caller with a timeout
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                const idx = this._waitQueue.findIndex(w => w.resolve === resolve);
                if (idx !== -1) this._waitQueue.splice(idx, 1);
                reject(new Error(
                    `[DB] Connection pool timeout after ${this._acquireMs}ms — ` +
                    `all ${this._max} connections are in use.`
                ));
            }, this._acquireMs);

            this._waitQueue.push({
                resolve: (conn) => { clearTimeout(timer); resolve(conn); },
            });
        });
    }

    /** Return a connection to the pool, or hand it to the next waiter. */
    _release(conn) {
        if (this._waitQueue.length > 0) {
            const waiter = this._waitQueue.shift();
            waiter.resolve(conn);
        } else {
            this._available.push(conn);
        }
    }

    /** Open a new HANA connection using the configured params. */
    async _createConnection() {
        const conn = hana.createConnection();
        await conn.connect(this._connParams);
        this._total++;
        return conn;
    }
}

// =============================================================================
// POOL SINGLETON
// =============================================================================
let _pool = null;

/**
 * Build the @sap/hana-client connection parameters from the environment config.
 * Note the HANA-specific field names (serverNode, uid, pwd) which differ from
 * the SQL Server equivalents (server, user, password).
 */
function buildHanaConnParams() {
    return {
        // HANA Cloud uses port 443 (SSL/TLS) by default
        serverNode:             `${config.db.host}:${config.db.port}`,
        uid:                    config.db.user,
        pwd:                    config.db.password,
        // Encrypt is mandatory for HANA Cloud
        encrypt:                "TRUE",
        // Set to "FALSE" for BTP-hosted HANA Cloud (SAP-managed cert)
        // Set to "TRUE"  if you supply your own certificate (enterprise setups)
        sslValidateCertificate: config.db.sslValidateCertificate ? "TRUE" : "FALSE",
        // Set the working schema so table references don't need schema prefix
        ...(config.db.schema ? { currentSchema: config.db.schema } : {}),
    };
}

/**
 * Returns the single shared HanaPool instance.
 * Creates and connects the pool on first call.
 * @returns {Promise<HanaPool>}
 */
async function getPool() {
    if (_pool && _pool.connected) return _pool;

    logger.info("[DB] Creating SAP HANA Cloud connection pool...");
    _pool = new HanaPool(buildHanaConnParams(), config.db.pool);
    await _pool.connect();
    logger.info(
        `[DB] HANA pool connected → ${config.db.host}:${config.db.port} ` +
        `schema="${config.db.schema || "default"}" ` +
        `pool(min=${config.db.pool.min}, max=${config.db.pool.max})`
    );
    return _pool;
}

/** Gracefully disconnect all idle connections.  Called on SIGTERM. */
async function closePool() {
    if (_pool) {
        await _pool.close();
        _pool = null;
        logger.info("[DB] HANA pool closed.");
    }
}

/** Health-check helper used by the /health endpoint. */
async function isHealthy() {
    try {
        const pool = await getPool();
        return await pool.isHealthy();
    } catch {
        return false;
    }
}

module.exports = { getPool, closePool, isHealthy, sql, HanaTransactionContext };

// =============================================================================
// SQL SERVER REFERENCE  (original mssql implementation — DO NOT DELETE)
// =============================================================================
// The original database.js used:
//
//   const sql    = require("mssql");
//   let _pool = null;
//
//   function buildMssqlConfig() {
//       return {
//           user:     config.db.user,
//           password: config.db.password,
//           server:   config.db.host,
//           port:     config.db.port,
//           database: config.db.database,
//           options: {
//               encrypt:               config.db.encrypt,
//               trustServerCertificate: config.db.trustServerCertificate,
//               enableArithAbort:      true,
//               useUTC: true,
//           },
//           pool: config.db.pool,
//           connectionTimeout: 15000,
//           requestTimeout:    30000,
//       };
//   }
//
//   async function getPool() {
//       if (_pool && _pool.connected) return _pool;
//       _pool = new sql.ConnectionPool(buildMssqlConfig());
//       _pool.on("error", (err) => logger.error("[DB] Pool error:", err.message));
//       await _pool.connect();
//       return _pool;
//   }
//
//   async function closePool() { if (_pool) { await _pool.close(); _pool = null; } }
//
//   async function isHealthy() {
//       try {
//           const pool    = await getPool();
//           const request = pool.request();
//           await request.query("SELECT 1 AS alive");
//           return true;
//       } catch { return false; }
//   }
//
//   module.exports = { getPool, closePool, isHealthy, sql };
// =============================================================================
