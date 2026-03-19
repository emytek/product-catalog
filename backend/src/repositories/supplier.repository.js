"use strict";

const BaseRepository = require("./BaseRepository");
const { sql }        = require("../config/database");

/**
 * SupplierRepository
 * ──────────────────
 * All database operations for the Suppliers table.
 *
 * Key pattern — findOrCreate:
 *   The frontend sends supplier as a plain string (not an ID).
 *   findOrCreate looks up the supplier by name; if it does not exist, it inserts
 *   it and returns the new ID.  This keeps supplier data normalised while
 *   keeping the API surface simple.
 */
class SupplierRepository extends BaseRepository {
    constructor() {
        super("Suppliers");
    }

    /** Return all active suppliers ordered by name. */
    async findAll() {
        const result = await this.query(
            `SELECT [SupplierID], [SupplierName], [ContactEmail], [Country], [IsActive]
             FROM   [dbo].[Suppliers]
             WHERE  [IsActive] = 1
             ORDER  BY [SupplierName]`
        );
        return result.recordset;
    }

    /**
     * Return supplier by name (exact match, case-insensitive via DB collation).
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async findByName(name) {
        const result = await this.query(
            `SELECT [SupplierID], [SupplierName]
             FROM   [dbo].[Suppliers]
             WHERE  [SupplierName] = @name`,
            (req) => req.input("name", sql.NVarChar(100), name)
        );
        return result.recordset[0] || null;
    }

    /**
     * Get a SupplierID for the given name, creating the record if needed.
     * Idempotent — safe to call concurrently (uses MERGE).
     * @param {string} name
     * @returns {Promise<number|null>} SupplierID, or null if name is empty
     */
    async findOrCreate(name) {
        if (!name || !name.trim()) return null;

        const result = await this.query(
            `MERGE [dbo].[Suppliers] AS target
             USING (VALUES (@name)) AS source ([SupplierName])
             ON target.[SupplierName] = source.[SupplierName]
             WHEN NOT MATCHED THEN
                 INSERT ([SupplierName]) VALUES (source.[SupplierName]);

             SELECT [SupplierID] FROM [dbo].[Suppliers] WHERE [SupplierName] = @name;`,
            (req) => req.input("name", sql.NVarChar(100), name.trim())
        );
        return result.recordset[0] ? result.recordset[0].SupplierID : null;
    }
}

module.exports = new SupplierRepository();
