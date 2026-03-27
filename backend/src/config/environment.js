"use strict";

/**
 * environment.js
 * ─────────────
 * Centralises all environment variable access and validation.
 *
 * SOLID — Single Responsibility: this module owns all env-var concerns so
 * no other module ever calls process.env directly.  If a required variable
 * is missing the process fails fast with a clear message at startup rather
 * than with a cryptic runtime error deep inside a request handler.
 *
 * Cloud Foundry / SAP BTP:
 *   CF injects PORT automatically and injects VCAP_SERVICES when services
 *   are bound.  We parse VCAP_SERVICES here so the rest of the app never
 *   needs to know about CF conventions.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DATABASE — SAP HANA Cloud (active)
 *   The HANA Cloud service binding in VCAP_SERVICES has label "hana".
 *   Credentials shape: { host, port, user, password, schema,
 *                        encrypt, validate_certificate, certificate }
 *
 * DATABASE — Azure SQL Server (retained for reference / rollback)
 *   The SQL Server binding used a user-provided service named
 *   "product-catalog-mssql" with credentials: { host, port, database,
 *   user, password }.
 *   To restore SQL Server: search for the MSSQL REFERENCE block below.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const path = require("path");

// Load .env only in non-production environments.
// In CF/BTP the env vars are injected by the platform.
if (process.env.NODE_ENV !== "production") {
    require("dotenv").config({ path: path.join(__dirname, "../../.env") });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function required(key) {
    const value = process.env[key];
    if (value === undefined || value === "") {
        throw new Error(`[ENV] Required environment variable "${key}" is not set.`);
    }
    return value;
}

function optional(key, defaultValue = "") {
    return process.env[key] || defaultValue;
}

// ── Cloud Foundry VCAP_SERVICES parser — SAP HANA Cloud ──────────────────────
// When the app is bound to a HANA Cloud service on BTP, CF injects credentials
// under VCAP_SERVICES["hana"][0].credentials.
// Field names from the HANA service binding:
//   host, port, user, password, schema, encrypt, validate_certificate
function parseCFServices() {
    const vcap = process.env.VCAP_SERVICES;
    if (!vcap) return {};

    try {
        const services = JSON.parse(vcap);

        // ── SAP HANA Cloud service (label: "hana") ────────────────────────────
        const hanaService = (services["hana"] || []).find(
            (s) => s.name === "product-catalog-hana"
        );
        if (hanaService && hanaService.credentials) {
            const c = hanaService.credentials;
            return {
                DB_HOST:                 c.host,
                DB_PORT:                 String(c.port || 443),
                DB_USER:                 c.user,
                DB_PASSWORD:             c.password,
                DB_SCHEMA:               c.schema || "",
                DB_SSL_VALIDATE_CERT:    String(c.validate_certificate === true ? "true" : "false"),
            };
        }

        // ── SQL SERVER REFERENCE ──────────────────────────────────────────────
        // Original parser for the user-provided "product-catalog-mssql" service.
        // Restore this block (and remove the HANA block above) when rolling back
        // to Azure SQL Server.
        //
        // const mssqlService = (services["user-provided"] || []).find(
        //     (s) => s.name === "product-catalog-mssql"
        // );
        // if (mssqlService && mssqlService.credentials) {
        //     const creds = mssqlService.credentials;
        //     return {
        //         DB_HOST:     creds.host     || creds.hostname,
        //         DB_PORT:     String(creds.port     || 1433),
        //         DB_NAME:     creds.database || creds.dbname,
        //         DB_USER:     creds.user     || creds.username,
        //         DB_PASSWORD: creds.password,
        //         DB_ENCRYPT:  "true",
        //     };
        // }
        // ─────────────────────────────────────────────────────────────────────

    } catch {
        console.warn("[ENV] Could not parse VCAP_SERVICES — using explicit env vars.");
    }
    return {};
}

// Overlay CF credentials on top of process.env (CF values win)
const cfEnv = parseCFServices();
Object.assign(process.env, cfEnv);

// ── Config object ─────────────────────────────────────────────────────────────
const config = {
    app: {
        nodeEnv:    optional("NODE_ENV", "development"),
        port:       parseInt(optional("PORT", "3000"), 10),
        apiVersion: optional("API_VERSION", "v1"),
        isProduction: optional("NODE_ENV", "development") === "production",
    },

    cors: {
        origins: optional("CORS_ORIGIN", "http://localhost:8080")
            .split(",")
            .map((o) => o.trim()),
    },

    // ── SAP HANA Cloud database config (active) ───────────────────────────────
    // Host:   <guid>.hanacloud.ondemand.com
    // Port:   443  (HANA Cloud always uses HTTPS/SSL)
    // Schema: auto-set by the service binding; can be overridden via DB_SCHEMA
    db: {
        host:                   required("DB_HOST"),
        port:                   parseInt(optional("DB_PORT", "443"), 10),
        user:                   required("DB_USER"),
        password:               required("DB_PASSWORD"),
        schema:                 optional("DB_SCHEMA", ""),
        // SAP HANA Cloud is always encrypted; cert validation is managed by SAP
        sslValidateCertificate: optional("DB_SSL_VALIDATE_CERT", "false") === "true",
        pool: {
            max:                    parseInt(optional("DB_POOL_MAX",  "10"), 10),
            min:                    parseInt(optional("DB_POOL_MIN",  "2"),  10),
            idleTimeoutMillis:      parseInt(optional("DB_POOL_IDLE_TIMEOUT_MS", "30000"), 10),
            acquireTimeoutMillis:   parseInt(optional("DB_POOL_ACQUIRE_TIMEOUT_MS", "15000"), 10),
        },
    },

    // ── SQL SERVER REFERENCE  (original db config — keep for rollback) ────────
    // db: {
    //     host:               required("DB_HOST"),
    //     port:               parseInt(optional("DB_PORT", "1433"), 10),
    //     database:           required("DB_NAME"),
    //     user:               required("DB_USER"),
    //     password:           required("DB_PASSWORD"),
    //     encrypt:            optional("DB_ENCRYPT", "false") === "true",
    //     trustServerCertificate: optional("DB_TRUST_CERT", "true") === "true",
    //     pool: {
    //         max:                    parseInt(optional("DB_POOL_MAX",  "10"), 10),
    //         min:                    parseInt(optional("DB_POOL_MIN",  "2"),  10),
    //         idleTimeoutMillis:      parseInt(optional("DB_POOL_IDLE_TIMEOUT_MS", "30000"), 10),
    //         acquireTimeoutMillis:   parseInt(optional("DB_POOL_ACQUIRE_TIMEOUT_MS", "15000"), 10),
    //     },
    // },
    // ─────────────────────────────────────────────────────────────────────────

    redis: {
        host:     optional("REDIS_HOST", "localhost"),
        port:     parseInt(optional("REDIS_PORT", "6379"), 10),
        password: optional("REDIS_PASSWORD", ""),
        tls:      optional("REDIS_TLS", "false") === "true",
        enabled:  Boolean(process.env.REDIS_HOST),
    },

    cache: {
        ttlSeconds:        parseInt(optional("CACHE_TTL_SECONDS", "300"), 10),
        ttlCatalogSeconds: parseInt(optional("CACHE_TTL_CATALOG_SECONDS", "600"), 10),
    },

    rateLimit: {
        windowMs:    parseInt(optional("RATE_LIMIT_WINDOW_MS", "900000"), 10),
        maxRequests: parseInt(optional("RATE_LIMIT_MAX_REQUESTS", "200"), 10),
    },

    logging: {
        level:  optional("LOG_LEVEL", "info"),
        dir:    optional("LOG_DIR", "logs"),
    },
};

module.exports = config;
