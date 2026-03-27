"use strict";

/**
 * supplier.repository.js  —  SAP HANA Cloud edition
 * ────────────────────────────────────────────────────
 * All database operations for the Suppliers table.
 *
 * Key pattern — findOrCreate:
 *   The frontend sends supplier as a plain string (not an ID).
 *   findOrCreate looks up the supplier by name; if it does not exist, it
 *   upserts it and returns the new ID.
 *
 * SQL SERVER REFERENCE changes applied:
 *   [dbo].[Suppliers]  →  "Suppliers"
 *   [ColumnName]       →  "ColumnName"
 *   MERGE syntax updated for HANA (USING SELECT ... FROM DUMMY instead of
 *     USING VALUES(...)).
 *   Multi-statement query (MERGE + SELECT in one string) split into two
 *   separate query() calls because HANA does not support multiple result
 *   sets from a single exec() call.
 */

const BaseRepository = require("./BaseRepository");
const { sql }        = require("../config/database");

class SupplierRepository extends BaseRepository {
    constructor() {
        super("Suppliers");
    }

    /**
     * Return all active suppliers ordered by name.
     * SQL SERVER REFERENCE:
     *   SELECT [SupplierID],[SupplierName],... FROM [dbo].[Suppliers]
     *   WHERE [IsActive] = 1 ORDER BY [SupplierName]
     */
    async findAll() {
        const result = await this.query(
            `SELECT "SupplierID", "SupplierName", "ContactEmail", "Country", "IsActive"
             FROM   "Suppliers"
             WHERE  "IsActive" = TRUE
             ORDER  BY "SupplierName"`
        );
        return result.recordset;
    }

    /**
     * Return supplier by name (exact match).
     * SQL SERVER REFERENCE: WHERE [SupplierName] = @name
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async findByName(name) {
        const result = await this.query(
            `SELECT "SupplierID", "SupplierName"
             FROM   "Suppliers"
             WHERE  "SupplierName" = @name`,
            (req) => req.input("name", sql.NVarChar(100), name)
        );
        return result.recordset[0] || null;
    }

    /**
     * Get a SupplierID for the given name, creating the record if needed.
     * Idempotent — safe to call concurrently.
     *
     * SQL SERVER REFERENCE:
     *   A single query string contained both a MERGE and a SELECT statement,
     *   relying on SQL Server's multi-result-set support (result.recordset[0]).
     *   HANA does not support multiple result sets, so this is split into
     *   two separate query() calls.
     *
     *   SQL Server MERGE used:
     *     USING (VALUES (@name)) AS source ([SupplierName])
     *   HANA MERGE uses:
     *     USING (SELECT @name AS "SupplierName" FROM DUMMY) AS source
     *
     * @param {string} name
     * @returns {Promise<number|null>} SupplierID, or null if name is empty
     */
    async findOrCreate(name) {
        if (!name || !name.trim()) return null;
        const trimmed = name.trim();

        // Step 1 — Upsert: insert the supplier if it does not already exist
        // SQL SERVER REFERENCE:
        //   MERGE [dbo].[Suppliers] AS target
        //   USING (VALUES (@name)) AS source ([SupplierName])
        //   ON target.[SupplierName] = source.[SupplierName]
        //   WHEN NOT MATCHED THEN
        //       INSERT ([SupplierName]) VALUES (source.[SupplierName]);
        await this.query(
            `MERGE INTO "Suppliers" AS T
             USING (SELECT @name AS "SupplierName" FROM DUMMY) AS S
             ON (T."SupplierName" = S."SupplierName")
             WHEN NOT MATCHED THEN
                 INSERT ("SupplierName") VALUES (S."SupplierName")`,
            (req) => req.input("name", sql.NVarChar(100), trimmed)
        );

        // Step 2 — Fetch the SupplierID (newly created or pre-existing)
        const result = await this.query(
            `SELECT "SupplierID" FROM "Suppliers" WHERE "SupplierName" = @name`,
            (req) => req.input("name", sql.NVarChar(100), trimmed)
        );
        return result.recordset[0] ? result.recordset[0]["SupplierID"] : null;
    }
}

module.exports = new SupplierRepository();
