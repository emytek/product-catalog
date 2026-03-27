"use strict";

/**
 * category.repository.js  —  SAP HANA Cloud edition
 * ────────────────────────────────────────────────────
 * All database operations for the Categories table.
 *
 * SQL SERVER REFERENCE changes applied:
 *   [dbo].[Categories]  →  "Categories"
 *   [CategoryID]        →  "CategoryID"   (all column names double-quoted)
 *   sql.Int / sql.NVarChar types retained in .input() calls but ignored
 *     by HanaRequest (HANA infers types from JS values).
 *   CASE WHEN sum pattern — identical in both SQL Server and HANA.
 */

const BaseRepository    = require("./BaseRepository");
const { sql }           = require("../config/database");
const { NotFoundError } = require("../utils/errors");

class CategoryRepository extends BaseRepository {
    constructor() {
        super("Categories");
    }

    /**
     * Return all active categories ordered by name.
     * SQL SERVER REFERENCE:
     *   SELECT [CategoryID],[CategoryName],[Description],[IsActive]
     *   FROM [dbo].[Categories] WHERE [IsActive] = 1 ORDER BY [CategoryName]
     */
    async findAll() {
        const result = await this.query(
            `SELECT "CategoryID", "CategoryName", "Description", "IsActive"
             FROM   "Categories"
             WHERE  "IsActive" = TRUE
             ORDER  BY "CategoryName"`
        );
        return result.recordset;
    }

    /**
     * Find category by name (case-insensitive via HANA collation).
     * SQL SERVER REFERENCE: WHERE [CategoryName] = @name
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async findByName(name) {
        const result = await this.query(
            `SELECT "CategoryID", "CategoryName"
             FROM   "Categories"
             WHERE  "CategoryName" = @name`,
            (req) => req.input("name", sql.NVarChar(100), name)
        );
        return result.recordset[0] || null;
    }

    /**
     * Find category by ID; throws NotFoundError if missing.
     * SQL SERVER REFERENCE: WHERE [CategoryID] = @id  (sql.Int type)
     * @param {number} id
     */
    async findById(id) {
        const result = await this.query(
            `SELECT "CategoryID", "CategoryName", "Description"
             FROM   "Categories"
             WHERE  "CategoryID" = @id`,
            (req) => req.input("id", sql.Int, id)
        );
        if (!result.recordset[0]) {
            throw new NotFoundError(`Category ID ${id} not found.`);
        }
        return result.recordset[0];
    }

    /**
     * Returns category names with their product counts.
     * Used by the stats endpoint.
     * SQL SERVER REFERENCE: same query structure — LEFT JOIN and CASE WHEN
     * aggregation is standard SQL supported identically by both HANA and SQL Server.
     */
    async getCategorySummary() {
        const result = await this.query(
            `SELECT c."CategoryName",
                    COUNT(p."ProductID")                                          AS "ProductCount",
                    SUM(CASE WHEN p."Status" = 'Active' THEN 1 ELSE 0 END)       AS "ActiveCount"
             FROM   "Categories" c
             LEFT   JOIN "Products" p ON p."CategoryID" = c."CategoryID"
             GROUP  BY c."CategoryName"
             ORDER  BY c."CategoryName"`
        );
        return result.recordset;
    }
}

module.exports = new CategoryRepository();
