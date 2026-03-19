"use strict";

/**
 * product.repository.js
 * ─────────────────────
 * All SQL operations for Products.  Uses the vw_ProductFull view for reads
 * (avoiding repetitive JOIN code) and the Products table directly for writes.
 *
 * The repository layer only speaks SQL — no business logic lives here.
 * Tag management (insert/upsert Tags, update ProductTags) is handled here
 * because it is a pure persistence concern.
 *
 * Data contract — every read method returns a "flat product DTO" that matches
 * the exact shape the SAPUI5 frontend expects:
 *   { ProductID, ProductName, Category, SubCategory, Description,
 *     Price, Currency, Stock, Unit, Rating, RatingCount, Status,
 *     Supplier, Tags: string[], Featured, Discount, Weight, Dimensions,
 *     CreatedAt, ModifiedAt }
 */

const BaseRepository      = require("./BaseRepository");
const { sql }             = require("../config/database");
const { NotFoundError }   = require("../utils/errors");
const { calcOffset }      = require("../utils/pagination");

// Safe-listed columns for ORDER BY (prevents SQL injection via sortBy param)
const SORT_COLUMN_MAP = {
    ProductName: "v.[ProductName]",
    Price:       "v.[Price]",
    Stock:       "v.[Stock]",
    Rating:      "v.[Rating]",
    Category:    "v.[Category]",
    CreatedAt:   "v.[CreatedAt]",
    ModifiedAt:  "v.[ModifiedAt]",
};

/**
 * Converts a raw DB row (from vw_ProductFull) into the DTO the frontend uses.
 * TagsCSV  → string[]
 * Featured → boolean  (SQL BIT comes back as 0/1)
 * Price    → number
 * @param {object} row
 * @returns {object}
 */
function rowToDto(row) {
    return {
        ProductID:   row.ProductID,
        ProductName: row.ProductName,
        Category:    row.Category,
        SubCategory: row.SubCategory  || "",
        Description: row.Description  || "",
        Price:       parseFloat(row.Price),
        Currency:    row.Currency.trim(),
        Stock:       row.Stock,
        Unit:        row.Unit.trim(),
        Rating:      parseFloat(row.Rating),
        RatingCount: row.RatingCount,
        Status:      row.Status,
        Supplier:    row.Supplier || "",
        Tags:        row.TagsCSV ? row.TagsCSV.split(",").filter(Boolean) : [],
        Featured:    row.Featured === true || row.Featured === 1,
        Discount:    row.Discount,
        Weight:      row.Weight      || "",
        Dimensions:  row.Dimensions  || "",
        CreatedAt:   row.CreatedAt,
        ModifiedAt:  row.ModifiedAt,
    };
}

class ProductRepository extends BaseRepository {
    constructor() {
        super("Products");
    }

    // ── READ ────────────────────────────────────────────────────────────────

    /**
     * Paginated product list with filtering and sorting.
     * Returns { products: DTO[], totalCount: number }.
     *
     * @param {object} opts
     * @param {string}  [opts.search]
     * @param {string}  [opts.category]
     * @param {string}  [opts.status]
     * @param {boolean} [opts.featured]
     * @param {number}  [opts.minPrice]
     * @param {number}  [opts.maxPrice]
     * @param {string}  [opts.sortBy]    - key from SORT_COLUMN_MAP
     * @param {string}  [opts.sortOrder] - 'ASC' | 'DESC'
     * @param {number}  [opts.page]      - 1-based
     * @param {number}  [opts.limit]
     */
    async findAll(opts = {}) {
        const {
            search, category, status, featured,
            minPrice, maxPrice,
            sortBy = "ProductName", sortOrder = "ASC",
            page = 1, limit = 20,
        } = opts;

        const orderCol = SORT_COLUMN_MAP[sortBy] || SORT_COLUMN_MAP.ProductName;
        const dir      = sortOrder === "DESC" ? "DESC" : "ASC";
        const offset   = calcOffset(page, limit);

        // Build WHERE clauses dynamically
        const whereClauses = [];
        const paramBuilder = (req) => {
            if (search) {
                whereClauses.push(
                    `(v.[ProductName] LIKE N'%' + @search + N'%'
                      OR v.[Supplier]     LIKE N'%' + @search + N'%'
                      OR v.[Category]     LIKE N'%' + @search + N'%'
                      OR v.[SubCategory]  LIKE N'%' + @search + N'%')`
                );
                req.input("search", sql.NVarChar(200), search);
            }
            if (category) {
                whereClauses.push("v.[Category] = @category");
                req.input("category", sql.NVarChar(100), category);
            }
            if (status) {
                whereClauses.push("v.[Status] = @status");
                req.input("status", sql.NVarChar(20), status);
            }
            if (featured !== undefined) {
                whereClauses.push("v.[Featured] = @featured");
                req.input("featured", sql.Bit, featured ? 1 : 0);
            }
            if (minPrice !== undefined) {
                whereClauses.push("v.[Price] >= @minPrice");
                req.input("minPrice", sql.Decimal(10, 2), minPrice);
            }
            if (maxPrice !== undefined) {
                whereClauses.push("v.[Price] <= @maxPrice");
                req.input("maxPrice", sql.Decimal(10, 2), maxPrice);
            }
            req.input("offset", sql.Int, offset);
            req.input("limit",  sql.Int, limit);
        };

        const whereStr = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

        const queryText = `
            -- Total count (no pagination)
            SELECT COUNT(*) AS [TotalCount]
            FROM   [dbo].[vw_ProductFull] v
            ${whereStr};

            -- Paged results
            SELECT * FROM [dbo].[vw_ProductFull] v
            ${whereStr}
            ORDER BY ${orderCol} ${dir}
            OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
        `;

        const result = await this.query(queryText, paramBuilder);

        const totalCount = result.recordsets[0][0].TotalCount;
        const products   = result.recordsets[1].map(rowToDto);

        return { products, totalCount };
    }

    /**
     * Full product list with no pagination — used by the catalog endpoint
     * so the frontend can load all products into its JSONModel in one call.
     * @returns {Promise<object[]>}
     */
    async findAllForCatalog() {
        const result = await this.query(
            `SELECT * FROM [dbo].[vw_ProductFull]
             ORDER BY [ProductName] ASC`
        );
        return result.recordset.map(rowToDto);
    }

    /**
     * Find a single product by ProductID.
     * @param {string} productId
     * @returns {Promise<object>}
     */
    async findById(productId) {
        const result = await this.query(
            `SELECT * FROM [dbo].[vw_ProductFull] WHERE [ProductID] = @id`,
            (req) => req.input("id", sql.NVarChar(10), productId)
        );
        if (!result.recordset[0]) {
            throw new NotFoundError(`Product with ID "${productId}" was not found.`);
        }
        return rowToDto(result.recordset[0]);
    }

    /**
     * Aggregate KPI stats using the stored procedure.
     * @returns {Promise<object>}
     */
    async getStats() {
        const result = await this.exec("sp_GetProductStats");
        return result.recordset[0];
    }

    // ── WRITE ───────────────────────────────────────────────────────────────

    /**
     * Atomically generate the next ProductID (e.g. "P026").
     * Uses the sequence stored procedure with UPDLOCK to prevent races.
     * @param {import("mssql").Transaction} [transaction]
     * @returns {Promise<string>}
     */
    async generateNextId(transaction) {
        const pool    = await require("../config/database").getPool();
        const request = transaction
            ? new sql.Request(transaction)
            : pool.request();

        request.output("NewProductID", sql.NVarChar(10));
        const result = await request.execute("sp_GetNextProductID");
        return result.output.NewProductID;
    }

    /**
     * Insert a new product.
     * Caller is responsible for providing a valid CategoryID and SupplierID.
     * Tags are handled separately by syncTags().
     *
     * @param {object} dto - Flat product DTO (without tags)
     * @param {import("mssql").Transaction} transaction
     * @returns {Promise<void>}
     */
    async insert(dto, transaction) {
        const request = new sql.Request(transaction);
        request.input("ProductID",   sql.NVarChar(10),    dto.ProductID);
        request.input("ProductName", sql.NVarChar(100),   dto.ProductName);
        request.input("CategoryID",  sql.Int,             dto.CategoryID);
        request.input("SubCategory", sql.NVarChar(60),    dto.SubCategory || null);
        request.input("Description", sql.NVarChar(sql.MAX), dto.Description || null);
        request.input("Price",       sql.Decimal(10, 2),  dto.Price);
        request.input("Currency",    sql.NChar(3),        dto.Currency);
        request.input("Stock",       sql.Int,             dto.Stock);
        request.input("Unit",        sql.NVarChar(10),    dto.Unit);
        request.input("Status",      sql.NVarChar(20),    dto.Status);
        request.input("SupplierID",  sql.Int,             dto.SupplierID || null);
        request.input("Featured",    sql.Bit,             dto.Featured ? 1 : 0);
        request.input("Discount",    sql.TinyInt,         dto.Discount || 0);
        request.input("Weight",      sql.NVarChar(30),    dto.Weight || null);
        request.input("Dimensions",  sql.NVarChar(60),    dto.Dimensions || null);
        request.input("CreatedAt",   sql.DateTime2,       new Date(dto.CreatedAt));
        request.input("ModifiedAt",  sql.DateTime2,       new Date(dto.ModifiedAt));

        await request.query(`
            INSERT INTO [dbo].[Products] (
                [ProductID],[ProductName],[CategoryID],[SubCategory],[Description],
                [Price],[Currency],[Stock],[Unit],[Status],[SupplierID],
                [Featured],[Discount],[Weight],[Dimensions],[CreatedAt],[ModifiedAt]
            ) VALUES (
                @ProductID,@ProductName,@CategoryID,@SubCategory,@Description,
                @Price,@Currency,@Stock,@Unit,@Status,@SupplierID,
                @Featured,@Discount,@Weight,@Dimensions,@CreatedAt,@ModifiedAt
            )
        `);
    }

    /**
     * Update an existing product (all provided fields).
     * @param {string} productId
     * @param {object} dto        - Fields to update (+ CategoryID, SupplierID)
     * @param {import("mssql").Transaction} transaction
     */
    async update(productId, dto, transaction) {
        const request = new sql.Request(transaction);
        request.input("ProductID",   sql.NVarChar(10),      productId);
        request.input("ProductName", sql.NVarChar(100),     dto.ProductName);
        request.input("CategoryID",  sql.Int,               dto.CategoryID);
        request.input("SubCategory", sql.NVarChar(60),      dto.SubCategory || null);
        request.input("Description", sql.NVarChar(sql.MAX), dto.Description || null);
        request.input("Price",       sql.Decimal(10, 2),    dto.Price);
        request.input("Currency",    sql.NChar(3),          dto.Currency);
        request.input("Stock",       sql.Int,               dto.Stock);
        request.input("Unit",        sql.NVarChar(10),      dto.Unit);
        request.input("Status",      sql.NVarChar(20),      dto.Status);
        request.input("SupplierID",  sql.Int,               dto.SupplierID || null);
        request.input("Featured",    sql.Bit,               dto.Featured ? 1 : 0);
        request.input("Discount",    sql.TinyInt,           dto.Discount || 0);
        request.input("Weight",      sql.NVarChar(30),      dto.Weight || null);
        request.input("Dimensions",  sql.NVarChar(60),      dto.Dimensions || null);
        request.input("ModifiedAt",  sql.DateTime2,         new Date());

        const result = await request.query(`
            UPDATE [dbo].[Products] SET
                [ProductName] = @ProductName,
                [CategoryID]  = @CategoryID,
                [SubCategory] = @SubCategory,
                [Description] = @Description,
                [Price]       = @Price,
                [Currency]    = @Currency,
                [Stock]       = @Stock,
                [Unit]        = @Unit,
                [Status]      = @Status,
                [SupplierID]  = @SupplierID,
                [Featured]    = @Featured,
                [Discount]    = @Discount,
                [Weight]      = @Weight,
                [Dimensions]  = @Dimensions,
                [ModifiedAt]  = @ModifiedAt
            WHERE [ProductID] = @ProductID
        `);

        if (result.rowsAffected[0] === 0) {
            throw new NotFoundError(`Product "${productId}" not found for update.`);
        }
    }

    /**
     * Delete a product by ID.
     * ProductTags are deleted automatically via ON DELETE CASCADE.
     * @param {string} productId
     */
    async delete(productId) {
        const result = await this.query(
            `DELETE FROM [dbo].[Products] WHERE [ProductID] = @id`,
            (req) => req.input("id", sql.NVarChar(10), productId)
        );
        if (result.rowsAffected[0] === 0) {
            throw new NotFoundError(`Product "${productId}" not found for deletion.`);
        }
    }

    /**
     * Delete multiple products by ID array.
     * @param {string[]} ids
     */
    async deleteMany(ids) {
        if (!ids || ids.length === 0) return 0;

        // Build a safe IN-list using individual numbered parameters
        const result = await this.withTransaction(async (tx) => {
            const req = new sql.Request(tx);
            const placeholders = ids.map((id, i) => {
                req.input(`id${i}`, sql.NVarChar(10), id);
                return `@id${i}`;
            });
            return req.query(
                `DELETE FROM [dbo].[Products] WHERE [ProductID] IN (${placeholders.join(",")})`
            );
        });
        return result.rowsAffected[0];
    }

    // ── TAG MANAGEMENT ───────────────────────────────────────────────────────

    /**
     * Synchronise tags for a product inside a transaction:
     *   1. Ensure all tag names exist in [Tags] (MERGE)
     *   2. Delete stale ProductTags entries
     *   3. Insert new ProductTags entries
     *
     * @param {string}   productId
     * @param {string[]} tags
     * @param {import("mssql").Transaction} transaction
     */
    async syncTags(productId, tags, transaction) {
        const request = new sql.Request(transaction);

        // Remove all existing tags for this product first
        request.input("pid", sql.NVarChar(10), productId);
        await request.query(
            "DELETE FROM [dbo].[ProductTags] WHERE [ProductID] = @pid"
        );

        if (!tags || tags.length === 0) return;

        for (const tagName of tags) {
            const trimmed = tagName.trim();
            if (!trimmed) continue;

            const tagReq = new sql.Request(transaction);
            tagReq.input("tagName", sql.NVarChar(50), trimmed);
            tagReq.input("pid2",    sql.NVarChar(10), productId);

            await tagReq.query(`
                -- Upsert tag
                MERGE [dbo].[Tags] AS target
                USING (VALUES (@tagName)) AS source ([TagName])
                ON target.[TagName] = source.[TagName]
                WHEN NOT MATCHED THEN INSERT ([TagName]) VALUES (source.[TagName]);

                -- Insert ProductTag if not already present
                IF NOT EXISTS (
                    SELECT 1 FROM [dbo].[ProductTags] pt
                    INNER JOIN [dbo].[Tags] t ON pt.[TagID] = t.[TagID]
                    WHERE pt.[ProductID] = @pid2 AND t.[TagName] = @tagName
                )
                BEGIN
                    INSERT INTO [dbo].[ProductTags] ([ProductID],[TagID])
                    SELECT @pid2, [TagID] FROM [dbo].[Tags] WHERE [TagName] = @tagName;
                END
            `);
        }
    }
}

module.exports = new ProductRepository();
