"use strict";

/**
 * run-migrations.js
 * ─────────────────
 * Runs the HANA DDL and seed scripts directly from Node.js.
 * Use this when SAP HANA Database Explorer is not available.
 *
 * Usage (from the backend/ directory):
 *   node db/hana/run-migrations.js              — schema + seed data
 *   node db/hana/run-migrations.js --skip-seed  — schema only (no data)
 *   node db/hana/run-migrations.js --seed-only  — seed data only (schema already exists)
 *
 * Prerequisites:
 *   1. backend/.env must contain DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_SCHEMA
 *   2. npm install must have been run in the backend/ directory (@sap/hana-client required)
 *
 * Safe to re-run:
 *   If tables, indexes, or sequences already exist the script logs "SKIP" and
 *   continues — it does NOT drop existing data.
 *   If seed products already exist (duplicate ProductID) the insert is skipped.
 */

const path   = require("path");
const fs     = require("fs");
const hana   = require("@sap/hana-client");

// ── Load .env from backend/ ───────────────────────────────────────────────────
// This file lives at backend/db/hana/run-migrations.js
// so __dirname is backend/db/hana/, and the .env is at backend/.env (two levels up)
require("dotenv").config({ path: path.join(__dirname, "../../.env") });

// ── Script paths ─────────────────────────────────────────────────────────────
const SCHEMA_SCRIPT = path.join(__dirname, "001_schema.sql");
const SEED_SCRIPT   = path.join(__dirname, "002_seed_data.sql");

// ── Parse CLI flags ───────────────────────────────────────────────────────────
const SKIP_SEED  = process.argv.includes("--skip-seed");
const SEED_ONLY  = process.argv.includes("--seed-only");

// =============================================================================
// SQL STATEMENT SPLITTER
// =============================================================================
/**
 * Splits a SQL file into individual executable statements.
 *
 * Rules:
 *   - Lines that begin with -- are stripped (single-line comments)
 *   - Inline -- comments (after code on the same line) are stripped
 *   - The file is then split on semicolons
 *   - Empty / whitespace-only fragments are discarded
 *
 * This is sufficient for the well-structured DDL in 001_schema.sql and
 * the INSERT-heavy 002_seed_data.sql.  It does NOT handle block comments
 * (/* ... *\/) or semicolons inside string literals — neither of which
 * appear in our scripts.
 */
function splitStatements(sqlText) {
    const lines = sqlText.split("\n");
    const cleaned = lines
        .map((line) => {
            // Strip full-line comments
            if (line.trimStart().startsWith("--")) return "";
            // Strip trailing inline comments (e.g. "... WHERE x = 1 -- reason")
            const idx = line.indexOf("--");
            return idx !== -1 ? line.substring(0, idx) : line;
        })
        .join("\n");

    return cleaned
        .split(";")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
}

// =============================================================================
// ERROR CLASSIFIER
// =============================================================================
/**
 * Returns true if the HANA error means an object already exists
 * (table, index, sequence, view, unique-constraint duplicate).
 * These are safe to skip on a re-run.
 *
 * Common HANA "already exists" error codes:
 *   288  — table already exists
 *   289  — sequence already exists
 *   321  — index already exists
 *   301  — unique constraint violated (seed data re-insert)
 *   2621 — view already exists (some HANA versions)
 *
 * As a fallback we also check the message text for "already exists" or
 * "duplicate" so that version-specific code variations are handled.
 */
function isAlreadyExistsError(err) {
    const ALREADY_EXISTS_CODES = [288, 289, 321, 301, 2621];
    if (ALREADY_EXISTS_CODES.includes(err.code)) return true;
    const msg = (err.message || "").toLowerCase();
    return msg.includes("already exists") || msg.includes("duplicate");
}

// =============================================================================
// SCRIPT RUNNER
// =============================================================================
/**
 * Executes every statement in a SQL file against the given connection.
 *
 * @param {object}  conn          - open @sap/hana-client connection
 * @param {string}  filePath      - absolute path to the .sql file
 * @param {boolean} stopOnError   - if true, throws on non-ignorable errors
 *                                  (use true for schema, false for seed)
 */
async function runScript(conn, filePath, stopOnError = false) {
    const fileName   = path.basename(filePath);
    const sqlText    = fs.readFileSync(filePath, "utf8");
    const statements = splitStatements(sqlText);

    console.log("");
    console.log("─".repeat(60));
    console.log(`  Running: ${fileName}  (${statements.length} statements)`);
    console.log("─".repeat(60));

    let ok = 0, skipped = 0, failed = 0;

    for (let i = 0; i < statements.length; i++) {
        const stmt    = statements[i];
        const preview = stmt.replace(/\s+/g, " ").substring(0, 72);

        try {
            await conn.exec(stmt);
            console.log(`  [OK]   ${preview}${stmt.length > 72 ? "..." : ""}`);
            ok++;
        } catch (err) {
            if (isAlreadyExistsError(err)) {
                console.log(`  [SKIP] already exists — ${preview.substring(0, 55)}...`);
                skipped++;
            } else {
                console.error(`  [FAIL] Error ${err.code}: ${err.message}`);
                console.error(`         Statement: ${preview}...`);
                failed++;
                if (stopOnError) {
                    throw new Error(
                        `\n[FATAL] Schema script failed at statement ${i + 1}.\n` +
                        `Error ${err.code}: ${err.message}\n` +
                        `Fix the SQL or check your HANA credentials and re-run.`
                    );
                }
            }
        }
    }

    console.log("");
    console.log(
        `  Result: ${ok} executed  |  ${skipped} skipped  |  ${failed} failed`
    );
}

// =============================================================================
// MAIN
// =============================================================================
async function main() {
    console.log("");
    console.log("=".repeat(60));
    console.log("  Product Catalog Manager — HANA Schema Migration");
    console.log("=".repeat(60));

    // ── Validate environment ──────────────────────────────────────────────────
    const host     = process.env.DB_HOST;
    const port     = process.env.DB_PORT     || "443";
    const user     = process.env.DB_USER;
    const password = process.env.DB_PASSWORD;
    const schema   = process.env.DB_SCHEMA   || "";

    if (!host || !user || !password) {
        console.error("");
        console.error("[ERROR] Missing required environment variables.");
        console.error("        Ensure backend/.env contains:");
        console.error("          DB_HOST, DB_USER, DB_PASSWORD");
        console.error("        and that you are running this from backend/:");
        console.error("          cd backend && node db/hana/run-migrations.js");
        process.exit(1);
    }

    console.log("");
    console.log(`  Host   : ${host}`);
    console.log(`  Port   : ${port}`);
    console.log(`  User   : ${user}`);
    console.log(`  Schema : ${schema || "(not set — using user default)"}`);
    console.log("");

    // ── Connect ───────────────────────────────────────────────────────────────
    const conn = hana.createConnection();

    const connParams = {
        serverNode:             `${host}:${port}`,
        uid:                    user,
        pwd:                    password,
        encrypt:                "TRUE",
        sslValidateCertificate: "FALSE",
    };

    // Setting currentSchema ensures all unqualified table names resolve to
    // your schema — the same setting used by the app at runtime.
    if (schema) {
        connParams.currentSchema = schema;
    }

    try {
        console.log("  Connecting to SAP HANA Cloud...");
        await conn.connect(connParams);
        console.log("  [OK] Connected.");

        // ── Verify schema context ─────────────────────────────────────────────
        const rows = await conn.exec(
            "SELECT CURRENT_USER AS \"User\", CURRENT_SCHEMA AS \"Schema\" FROM DUMMY"
        );
        if (rows && rows[0]) {
            console.log(`  [OK] Logged in as : ${rows[0]["User"]}`);
            console.log(`  [OK] Active schema: ${rows[0]["Schema"]}`);
        }

        // ── Run schema script (DDL) ───────────────────────────────────────────
        if (!SEED_ONLY) {
            await runScript(conn, SCHEMA_SCRIPT, true /* stopOnError */);
        } else {
            console.log("\n  [SKIP] Schema script (--seed-only flag set)");
        }

        // ── Run seed script (data) ────────────────────────────────────────────
        if (!SKIP_SEED) {
            await runScript(conn, SEED_SCRIPT, false /* don't stop on dup key */);
        } else {
            console.log("\n  [SKIP] Seed script (--skip-seed flag set)");
        }

        // ── Final verification query ──────────────────────────────────────────
        console.log("");
        console.log("─".repeat(60));
        console.log("  Verification");
        console.log("─".repeat(60));

        try {
            const count = await conn.exec('SELECT COUNT(*) AS "N" FROM "Products"');
            console.log(`  Products in database : ${count[0]["N"]}`);

            const cats = await conn.exec('SELECT COUNT(*) AS "N" FROM "Categories"');
            console.log(`  Categories           : ${cats[0]["N"]}`);

            const sup = await conn.exec('SELECT COUNT(*) AS "N" FROM "Suppliers"');
            console.log(`  Suppliers            : ${sup[0]["N"]}`);

            const tags = await conn.exec('SELECT COUNT(*) AS "N" FROM "Tags"');
            console.log(`  Tags                 : ${tags[0]["N"]}`);
        } catch (verifyErr) {
            console.warn(`  [WARN] Could not run verification queries: ${verifyErr.message}`);
            console.warn(`         This is normal if only --skip-seed was used.`);
        }

        console.log("");
        console.log("=".repeat(60));
        console.log("  Migration complete!");
        console.log("");
        console.log("  Next steps:");
        console.log("  1. Start the backend:  npm run dev");
        console.log("  2. Test health:        GET http://localhost:3000/health");
        console.log("  3. Test products:      GET http://localhost:3000/api/v1/products/catalog");
        console.log("=".repeat(60));
        console.log("");

    } catch (err) {
        console.error("");
        console.error("=".repeat(60));
        console.error(err.message || err);
        console.error("=".repeat(60));
        console.error("");
        process.exit(1);
    } finally {
        try {
            await conn.disconnect();
        } catch {
            // ignore disconnect errors
        }
    }
}

main();
