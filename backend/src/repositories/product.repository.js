"use strict";

/**
 * product.repository.js  —  SAP HANA Cloud edition
 * ──────────────────────────────────────────────────
 * All SQL operations for Products.  Uses the "vw_ProductFull" view for reads
 * and the "Products" table directly for writes.
 *
 * The repository layer only speaks SQL — no business logic lives here.
 *
 * Data contract — every read method returns a "flat product DTO" that matches
 * the exact shape the SAPUI5 frontend expects:
 *   { ProductID, ProductName, Category, SubCategory, Description,
 *     Price, Currency, Stock, Unit, Rating, RatingCount, Status,
 *     Supplier, Tags: string[], Featured, Discount, Weight, Dimensions,
 *     CreatedAt, ModifiedAt }
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * KEY CHANGES FROM SQL SERVER VERSION
 * ─────────────────────────────────────────────────────────────────────────────
 * 1. Table references  : [dbo].[TableName]   →  "TableName"
 * 2. Column references : [ColumnName]        →  "ColumnName"
 * 3. Parameters        : @paramName + type   →  @paramName (type ignored; HanaRequest
 *                        converts to positional ? at query time)
 * 4. String concat     : N'%' + @p + N'%'    →  pass '%value%' in the param itself
 * 5. Pagination        : OFFSET x FETCH NEXT y ROWS ONLY  →  LIMIT y OFFSET x
 * 6. Multi-result sets : single query with two SELECTs → two separate query() calls
 *    (HANA does not support multiple result sets from one exec() call)
 * 7. BOOLEAN           : sql.Bit / 0|1       →  true|false (JavaScript boolean)
 * 8. getStats()        : stored proc call    →  inline aggregate SELECT
 * 9. generateNextId()  : stored proc output  →  HANA SEQUENCE + JS formatting
 * 10. syncTags()       : T-SQL IF/BEGIN/END  →  HANA MERGE INTO + MERGE INTO
 * 11. Transaction reqs : new sql.Request(tx) →  tx.request()
 * ─────────────────────────────────────────────────────────────────────────────
 */

const BaseRepository      = require("./BaseRepository");
const { sql }             = require("../config/database");
const { NotFoundError }   = require("../utils/errors");
const { calcOffset }      = require("../utils/pagination");

// Safe-listed columns for ORDER BY (prevents SQL injection via sortBy param)
// SQL SERVER REFERENCE: was  v.[ProductName],  v.[Price],  etc.
const SORT_COLUMN_MAP = {
    ProductName: `v."ProductName"`,
    Price:       `v."Price"`,
    Stock:       `v."Stock"`,
    Rating:      `v."Rating"`,
    Category:    `v."Category"`,
    CreatedAt:   `v."CreatedAt"`,
    ModifiedAt:  `v."ModifiedAt"`,
};

/**
 * Converts a raw DB row (from vw_ProductFull) into the DTO the frontend uses.
 * TagsCSV   → string[]   (STRING_AGG in the view returns a comma-separated string)
 * Featured  → boolean    (HANA BOOLEAN returns JS true/false; also handles 0/1 for safety)
 * Price     → number
 *
 * SQL SERVER REFERENCE: same function, no structural changes needed.
 */
function rowToDto(row) {
    return {
        ProductID:   row["ProductID"],
        ProductName: row["ProductName"],
        Category:    row["Category"],
        SubCategory: row["SubCategory"]  || "",
        Description: row["Description"]  || "",
        Price:       parseFloat(row["Price"]),
        Currency:    (row["Currency"] || "USD").trim(),
        Stock:       row["Stock"],
        Unit:        (row["Unit"] || "EA").trim(),
        Rating:      parseFloat(row["Rating"]),
        RatingCount: row["RatingCount"],
        Status:      row["Status"],
        Supplier:    row["Supplier"] || "",
        Tags:        row["TagsCSV"] ? row["TagsCSV"].split(",").filter(Boolean) : [],
        Featured:    row["Featured"] === true || row["Featured"] === 1,
        Discount:    row["Discount"],
        Weight:      row["Weight"]      || "",
        Dimensions:  row["Dimensions"]  || "",
        CreatedAt:   row["CreatedAt"],
        ModifiedAt:  row["ModifiedAt"],
    };
}

class ProductRepository extends BaseRepository {
    constructor() {
        super("Products");
    }

    // ── READ ──────────────────────────────────────────────────────────────────

    /**
     * Paginated product list with filtering and sorting.
     * Returns { products: DTO[], totalCount: number }.
     *
     * HANA CHANGE: HANA does not support multiple result sets from a single
     * exec() call.  The original SQL Server version ran a COUNT(*) SELECT and
     * a paged SELECT in one query.  Here they are split into two calls with
     * the same WHERE clause.  A helper function (buildFilterParams) sets
     * the same named parameters on both requests.
     *
     * @param {object} opts
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
        const filterParams  = {};   // name → value

        if (search) {
            // SQL SERVER REFERENCE: used N'%' + @search + N'%' in the SQL.
            // HANA version: embed wildcards directly in the param value — cleaner
            // and avoids string-concatenation SQL.
            const likeVal = `%${search}%`;
            whereClauses.push(
                `(v."ProductName" LIKE @search OR v."Supplier"    LIKE @search ` +
                ` OR v."Category"  LIKE @search OR v."SubCategory" LIKE @search)`
            );
            filterParams.search = likeVal;
        }
        if (category) {
            whereClauses.push(`v."Category" = @category`);
            filterParams.category = category;
        }
        if (status) {
            whereClauses.push(`v."Status" = @status`);
            filterParams.status = status;
        }
        if (featured !== undefined) {
            // SQL SERVER REFERENCE: sql.Bit type, value 0 or 1.
            // HANA: pass JavaScript boolean directly.
            whereClauses.push(`v."Featured" = @featured`);
            filterParams.featured = Boolean(featured);
        }
        if (minPrice !== undefined) {
            whereClauses.push(`v."Price" >= @minPrice`);
            filterParams.minPrice = minPrice;
        }
        if (maxPrice !== undefined) {
            whereClauses.push(`v."Price" <= @maxPrice`);
            filterParams.maxPrice = maxPrice;
        }

        const whereStr = whereClauses.length ? "WHERE " + whereClauses.join(" AND ") : "";

        // Helper: register all filter params on a given request
        function applyFilterParams(req) {
            for (const [name, value] of Object.entries(filterParams)) {
                req.input(name, value);
            }
        }

        // ── Query 1: Total count ──────────────────────────────────────────────
        // SQL SERVER REFERENCE: was part of a single multi-result-set query.
        const countReq    = await this.getRequest();
        applyFilterParams(countReq);
        const countResult = await countReq.query(
            `SELECT COUNT(*) AS "TotalCount" FROM "vw_ProductFull" v ${whereStr}`
        );
        const totalCount = countResult.recordset[0]["TotalCount"];

        // ── Query 2: Paged data ───────────────────────────────────────────────
        // SQL SERVER REFERENCE: OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY
        // HANA:                 LIMIT @limit OFFSET @offset
        const dataReq = await this.getRequest();
        applyFilterParams(dataReq);
        dataReq.input("limit",  limit);
        dataReq.input("offset", offset);
        const dataResult = await dataReq.query(`
            SELECT * FROM "vw_ProductFull" v
            ${whereStr}
            ORDER BY ${orderCol} ${dir}
            LIMIT @limit OFFSET @offset
        `);
        const products = dataResult.recordset.map(rowToDto);

        return { products, totalCount };
    }

    /**
     * Full product list with no pagination — used by the catalog endpoint
     * so the frontend can load all products into its JSONModel in one call.
     * SQL SERVER REFERENCE: FROM [dbo].[vw_ProductFull] ORDER BY [ProductName]
     * @returns {Promise<object[]>}
     */
    async findAllForCatalog() {
        const result = await this.query(
            `SELECT * FROM "vw_ProductFull" ORDER BY "ProductName" ASC`
        );
        return result.recordset.map(rowToDto);
    }

    /**
     * Find a single product by ProductID.
     * SQL SERVER REFERENCE: FROM [dbo].[vw_ProductFull] WHERE [ProductID] = @id
     * @param {string} productId
     */
    async findById(productId) {
        const result = await this.query(
            `SELECT * FROM "vw_ProductFull" WHERE "ProductID" = @id`,
            (req) => req.input("id", sql.NVarChar(10), productId)
        );
        if (!result.recordset[0]) {
            throw new NotFoundError(`Product with ID "${productId}" was not found.`);
        }
        return rowToDto(result.recordset[0]);
    }

    /**
     * Aggregate KPI stats.
     *
     * SQL SERVER REFERENCE: called stored procedure sp_GetProductStats.
     *   const result = await this.exec("sp_GetProductStats");
     *   return result.recordset[0];
     *
     * HANA: inline aggregate SELECT — no stored procedure required.
     * Returns one row with the same field names the service layer expects:
     *   TotalProducts, ActiveProducts, InactiveProducts, DiscontinuedProducts,
     *   FeaturedProducts, LowStockProducts, TotalCategories, AveragePrice
     */
    async getStats() {
        const result = await this.query(`
            SELECT
                COUNT(*)                                                          AS "TotalProducts",
                SUM(CASE WHEN "Status" = 'Active'       THEN 1 ELSE 0 END)       AS "ActiveProducts",
                SUM(CASE WHEN "Status" = 'Inactive'     THEN 1 ELSE 0 END)       AS "InactiveProducts",
                SUM(CASE WHEN "Status" = 'Discontinued' THEN 1 ELSE 0 END)       AS "DiscontinuedProducts",
                SUM(CASE WHEN "Featured" = TRUE         THEN 1 ELSE 0 END)       AS "FeaturedProducts",
                SUM(CASE WHEN "Stock" < 10              THEN 1 ELSE 0 END)        AS "LowStockProducts",
                COUNT(DISTINCT "CategoryID")                                      AS "TotalCategories",
                AVG(TO_DOUBLE("Price"))                                           AS "AveragePrice"
            FROM "Products"
        `);
        return result.recordset[0];
    }

    // ── WRITE ─────────────────────────────────────────────────────────────────

    /**
     * Atomically generate the next ProductID (e.g. "P026").
     *
     * SQL SERVER REFERENCE: called stored procedure sp_GetNextProductID with
     *   an OUTPUT parameter and used UPDLOCK to prevent races.
     *   request.output("NewProductID", sql.NVarChar(10));
     *   const result = await request.execute("sp_GetNextProductID");
     *   return result.output.NewProductID;
     *
     * HANA: uses the "ProductIDSeq" SEQUENCE defined in 001_schema.sql.
     *   SELECT "ProductIDSeq".NEXTVAL FROM DUMMY
     *   → returns the next integer; JS formats it as P001, P026, etc.
     *
     * @param {HanaTransactionContext} [transaction]
     * @returns {Promise<string>}
     */
    async generateNextId(transaction) {
        const seqSQL = `SELECT "ProductIDSeq".NEXTVAL AS "NextVal" FROM DUMMY`;
        let rows;

        if (transaction) {
            const req = transaction.request();
            const result = await req.query(seqSQL);
            rows = result.recordset;
        } else {
            const result = await this.query(seqSQL);
            rows = result.recordset;
        }

        const num = rows[0]["NextVal"];
        return `P${String(num).padStart(3, "0")}`;
    }

    /**
     * Insert a new product.
     * Caller is responsible for providing valid CategoryID and SupplierID.
     * Tags are handled separately by syncTags().
     *
     * SQL SERVER REFERENCE: used new sql.Request(transaction) and [dbo].[Products]
     *   with sql.* typed inputs.  HANA version uses tx.request() and
     *   double-quoted table/column names.  Type arguments in req.input() are
     *   ignored by HanaRequest but retained in the call signature for clarity.
     *
     * @param {object} dto
     * @param {HanaTransactionContext} transaction
     */
    async insert(dto, transaction) {
        const req = transaction.request();
        req.input("ProductID",   sql.NVarChar(10),      dto.ProductID);
        req.input("ProductName", sql.NVarChar(100),     dto.ProductName);
        req.input("CategoryID",  sql.Int,               dto.CategoryID);
        req.input("SubCategory", sql.NVarChar(60),      dto.SubCategory || null);
        req.input("Description", sql.NVarChar(sql.MAX), dto.Description || null);
        req.input("Price",       sql.Decimal(10, 2),    dto.Price);
        req.input("Currency",    sql.NChar(3),          dto.Currency);
        req.input("Stock",       sql.Int,               dto.Stock);
        req.input("Unit",        sql.NVarChar(10),      dto.Unit);
        req.input("Status",      sql.NVarChar(20),      dto.Status);
        req.input("SupplierID",  sql.Int,               dto.SupplierID || null);
        req.input("Featured",    sql.Bit,               Boolean(dto.Featured));
        req.input("Discount",    sql.TinyInt,           dto.Discount || 0);
        req.input("Weight",      sql.NVarChar(30),      dto.Weight || null);
        req.input("Dimensions",  sql.NVarChar(60),      dto.Dimensions || null);
        req.input("CreatedAt",   sql.DateTime2,         new Date(dto.CreatedAt));
        req.input("ModifiedAt",  sql.DateTime2,         new Date(dto.ModifiedAt));

        await req.query(`
            INSERT INTO "Products" (
                "ProductID","ProductName","CategoryID","SubCategory","Description",
                "Price","Currency","Stock","Unit","Status","SupplierID",
                "Featured","Discount","Weight","Dimensions","CreatedAt","ModifiedAt"
            ) VALUES (
                @ProductID,@ProductName,@CategoryID,@SubCategory,@Description,
                @Price,@Currency,@Stock,@Unit,@Status,@SupplierID,
                @Featured,@Discount,@Weight,@Dimensions,@CreatedAt,@ModifiedAt
            )
        `);
    }

    /**
     * Update an existing product (all provided fields).
     * SQL SERVER REFERENCE: same structure, table/column names updated,
     *   new sql.Request(transaction) → tx.request().
     *
     * @param {string} productId
     * @param {object} dto
     * @param {HanaTransactionContext} transaction
     */
    async update(productId, dto, transaction) {
        const req = transaction.request();
        req.input("ProductID",   sql.NVarChar(10),      productId);
        req.input("ProductName", sql.NVarChar(100),     dto.ProductName);
        req.input("CategoryID",  sql.Int,               dto.CategoryID);
        req.input("SubCategory", sql.NVarChar(60),      dto.SubCategory || null);
        req.input("Description", sql.NVarChar(sql.MAX), dto.Description || null);
        req.input("Price",       sql.Decimal(10, 2),    dto.Price);
        req.input("Currency",    sql.NChar(3),          dto.Currency);
        req.input("Stock",       sql.Int,               dto.Stock);
        req.input("Unit",        sql.NVarChar(10),      dto.Unit);
        req.input("Status",      sql.NVarChar(20),      dto.Status);
        req.input("SupplierID",  sql.Int,               dto.SupplierID || null);
        req.input("Featured",    sql.Bit,               Boolean(dto.Featured));
        req.input("Discount",    sql.TinyInt,           dto.Discount || 0);
        req.input("Weight",      sql.NVarChar(30),      dto.Weight || null);
        req.input("Dimensions",  sql.NVarChar(60),      dto.Dimensions || null);
        req.input("ModifiedAt",  sql.DateTime2,         new Date());

        const result = await req.query(`
            UPDATE "Products" SET
                "ProductName" = @ProductName,
                "CategoryID"  = @CategoryID,
                "SubCategory" = @SubCategory,
                "Description" = @Description,
                "Price"       = @Price,
                "Currency"    = @Currency,
                "Stock"       = @Stock,
                "Unit"        = @Unit,
                "Status"      = @Status,
                "SupplierID"  = @SupplierID,
                "Featured"    = @Featured,
                "Discount"    = @Discount,
                "Weight"      = @Weight,
                "Dimensions"  = @Dimensions,
                "ModifiedAt"  = @ModifiedAt
            WHERE "ProductID" = @ProductID
        `);

        if (result.rowsAffected[0] === 0) {
            throw new NotFoundError(`Product "${productId}" not found for update.`);
        }
    }

    /**
     * Delete a product by ID.
     * ProductTags are deleted automatically via ON DELETE CASCADE (defined
     * in 001_schema.sql — same behaviour as SQL Server version).
     * @param {string} productId
     */
    async delete(productId) {
        const result = await this.query(
            `DELETE FROM "Products" WHERE "ProductID" = @id`,
            (req) => req.input("id", sql.NVarChar(10), productId)
        );
        if (result.rowsAffected[0] === 0) {
            throw new NotFoundError(`Product "${productId}" not found for deletion.`);
        }
    }

    /**
     * Delete multiple products by ID array.
     * SQL SERVER REFERENCE: same logic — builds numbered params @id0, @id1...
     * HanaRequest converts each @idN to positional ? correctly.
     * @param {string[]} ids
     */
    async deleteMany(ids) {
        if (!ids || ids.length === 0) return 0;

        const result = await this.withTransaction(async (tx) => {
            const req          = tx.request();
            const placeholders = ids.map((id, i) => {
                req.input(`id${i}`, sql.NVarChar(10), id);
                return `@id${i}`;
            });
            return req.query(
                `DELETE FROM "Products" WHERE "ProductID" IN (${placeholders.join(",")})`
            );
        });
        return result.rowsAffected[0];
    }

    // ── TAG MANAGEMENT ────────────────────────────────────────────────────────

    /**
     * Synchronise tags for a product inside a transaction:
     *   1. Delete all existing ProductTags for this product
     *   2. For each tag: upsert the tag into Tags (MERGE INTO)
     *   3. For each tag: link tag to product (MERGE INTO ProductTags)
     *
     * SQL SERVER REFERENCE:
     *   - Used MERGE with VALUES(@tagName) and T-SQL IF NOT EXISTS BEGIN/END blocks.
     *   - T-SQL IF/BEGIN/END is not supported in HANA plain SQL.
     *
     * HANA version uses:
     *   - MERGE INTO "Tags" USING (SELECT ? AS "TagName" FROM DUMMY) for upsert
     *   - MERGE INTO "ProductTags" USING (SELECT ... FROM "Tags" WHERE ...) for link
     *   Both MERGE statements are idempotent and safe to run multiple times.
     *
     * @param {string}   productId
     * @param {string[]} tags
     * @param {HanaTransactionContext} transaction
     */
    async syncTags(productId, tags, transaction) {
        // Step 1 — Remove all existing tag links for this product
        const delReq = transaction.request();
        delReq.input("pid", sql.NVarChar(10), productId);
        await delReq.query(`DELETE FROM "ProductTags" WHERE "ProductID" = @pid`);

        if (!tags || tags.length === 0) return;

        for (const tagName of tags) {
            const trimmed = tagName.trim();
            if (!trimmed) continue;

            // Step 2 — Upsert the tag name into the Tags table
            // SQL SERVER REFERENCE:
            //   MERGE [dbo].[Tags] AS target
            //   USING (VALUES (@tagName)) AS source ([TagName])
            //   ON target.[TagName] = source.[TagName]
            //   WHEN NOT MATCHED THEN INSERT ([TagName]) VALUES (source.[TagName]);
            const mergeTagReq = transaction.request();
            mergeTagReq.input("tagName", sql.NVarChar(50), trimmed);
            await mergeTagReq.query(`
                MERGE INTO "Tags" AS T
                USING (SELECT @tagName AS "TagName" FROM DUMMY) AS S
                ON (T."TagName" = S."TagName")
                WHEN NOT MATCHED THEN
                    INSERT ("TagName") VALUES (S."TagName")
            `);

            // Step 3 — Link the tag to the product (idempotent)
            // SQL SERVER REFERENCE:
            //   IF NOT EXISTS (SELECT 1 FROM [dbo].[ProductTags] ...)
            //   BEGIN
            //       INSERT INTO [dbo].[ProductTags] ...
            //   END
            // HANA: T-SQL IF/BEGIN/END not available in plain SQL.
            // Use MERGE INTO instead — same idempotent semantics.
            const mergeLinkReq = transaction.request();
            mergeLinkReq.input("pid2",     sql.NVarChar(10), productId);
            mergeLinkReq.input("tagName2", sql.NVarChar(50), trimmed);
            await mergeLinkReq.query(`
                MERGE INTO "ProductTags" AS T
                USING (
                    SELECT @pid2 AS "ProductID", "TagID"
                    FROM   "Tags"
                    WHERE  "TagName" = @tagName2
                ) AS S
                ON (T."ProductID" = S."ProductID" AND T."TagID" = S."TagID")
                WHEN NOT MATCHED THEN
                    INSERT ("ProductID", "TagID") VALUES (S."ProductID", S."TagID")
            `);
        }
    }
}

module.exports = new ProductRepository();
