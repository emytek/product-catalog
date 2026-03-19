"use strict";

const BaseRepository  = require("./BaseRepository");
const { sql }         = require("../config/database");
const { NotFoundError } = require("../utils/errors");

/**
 * CategoryRepository
 * ──────────────────
 * All database operations for the Categories table.
 */
class CategoryRepository extends BaseRepository {
    constructor() {
        super("Categories");
    }

    /** Return all active categories ordered by name. */
    async findAll() {
        const result = await this.query(
            `SELECT [CategoryID], [CategoryName], [Description], [IsActive]
             FROM   [dbo].[Categories]
             WHERE  [IsActive] = 1
             ORDER  BY [CategoryName]`
        );
        return result.recordset;
    }

    /**
     * Find category by name (case-insensitive).
     * @param {string} name
     * @returns {Promise<object|null>}
     */
    async findByName(name) {
        const result = await this.query(
            `SELECT [CategoryID], [CategoryName]
             FROM   [dbo].[Categories]
             WHERE  [CategoryName] = @name`,
            (req) => req.input("name", sql.NVarChar(100), name)
        );
        return result.recordset[0] || null;
    }

    /**
     * Find category by ID; throws NotFoundError if missing.
     * @param {number} id
     */
    async findById(id) {
        const result = await this.query(
            `SELECT [CategoryID], [CategoryName], [Description]
             FROM   [dbo].[Categories]
             WHERE  [CategoryID] = @id`,
            (req) => req.input("id", sql.Int, id)
        );
        if (!result.recordset[0]) {
            throw new NotFoundError(`Category ID ${id} not found.`);
        }
        return result.recordset[0];
    }

    /**
     * Returns an array of category names with their product counts.
     * Used by the stats endpoint.
     */
    async getCategorySummary() {
        const result = await this.query(
            `SELECT c.[CategoryName],
                    COUNT(p.[ProductID])                                   AS [ProductCount],
                    SUM(CASE WHEN p.[Status] = 'Active' THEN 1 ELSE 0 END) AS [ActiveCount]
             FROM   [dbo].[Categories] c
             LEFT JOIN [dbo].[Products] p ON p.[CategoryID] = c.[CategoryID]
             GROUP BY c.[CategoryName]
             ORDER BY c.[CategoryName]`
        );
        return result.recordset;
    }
}

module.exports = new CategoryRepository();
