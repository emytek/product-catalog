"use strict";

/**
 * product.service.js
 * ──────────────────
 * Business logic layer for product operations.
 *
 * Responsibilities:
 *   • Orchestrates repository calls (product, category, supplier)
 *   • Manages cache invalidation after writes
 *   • Dispatches async jobs to the queue (audit log, stat refresh)
 *   • Maps between the flat frontend DTO and the normalised DB records
 *
 * SOLID — Single Responsibility: the service owns business rules, not SQL.
 * SOLID — DIP: depends on repository and cache interfaces, not their implementations.
 */

const productRepo  = require("../repositories/product.repository");
const categoryRepo = require("../repositories/category.repository");
const supplierRepo = require("../repositories/supplier.repository");
const cache        = require("../config/cache");
const { getProductQueue } = require("../config/queue");
const { NotFoundError }   = require("../utils/errors");
const { buildMeta, parsePagination } = require("../utils/pagination");
const logger  = require("../utils/logger");
const config  = require("../config/environment");

// Cache key constants — single place to change them
const CACHE_KEY_CATALOG = "catalog";
const CACHE_KEY_STATS   = "stats";
const CACHE_PREFIX_PROD = "product:";

class ProductService {

    // ── READ ────────────────────────────────────────────────────────────────

    /**
     * Paginated product list with filtering, searching, and sorting.
     * Results are cached per unique query signature.
     *
     * @param {object} query - Validated query params from the controller
     * @returns {Promise<{ products: object[], meta: object }>}
     */
    async listProducts(query) {
        const { page, limit } = parsePagination(query.page, query.limit);
        const cacheKey = `products:list:${JSON.stringify({ ...query, page, limit })}`;

        const cached = await cache.get(cacheKey);
        if (cached) return cached;

        const { products, totalCount } = await productRepo.findAll({
            ...query,
            page,
            limit,
        });

        const result = { products, meta: buildMeta(page, limit, totalCount) };
        await cache.set(cacheKey, result, config.cache.ttlSeconds);
        return result;
    }

    /**
     * Returns the full product catalogue as a flat array matching products.json.
     * This endpoint powers the initial load of the SAPUI5 frontend.
     * @returns {Promise<{ products: object[] }>}
     */
    async getCatalog() {
        const cached = await cache.get(CACHE_KEY_CATALOG);
        if (cached) return cached;

        const products = await productRepo.findAllForCatalog();
        const result = { products };
        await cache.set(CACHE_KEY_CATALOG, result, config.cache.ttlCatalogSeconds);
        return result;
    }

    /**
     * Single product by ID.
     * @param {string} productId
     */
    async getProductById(productId) {
        const cacheKey = CACHE_PREFIX_PROD + productId;
        const cached   = await cache.get(cacheKey);
        if (cached) return cached;

        const product = await productRepo.findById(productId);
        await cache.set(cacheKey, product, config.cache.ttlSeconds);
        return product;
    }

    /**
     * KPI aggregates for the home page tiles.
     */
    async getStats() {
        const cached = await cache.get(CACHE_KEY_STATS);
        if (cached) return cached;

        const raw   = await productRepo.getStats();
        const stats = {
            totalProducts:        raw.TotalProducts,
            activeProducts:       raw.ActiveProducts,
            inactiveProducts:     raw.InactiveProducts,
            discontinuedProducts: raw.DiscontinuedProducts,
            featuredCount:        raw.FeaturedProducts,
            lowStockProducts:     raw.LowStockProducts,
            totalCategories:      raw.TotalCategories,
            averagePrice:         parseFloat(raw.AveragePrice || 0),
        };
        await cache.set(CACHE_KEY_STATS, stats, config.cache.ttlSeconds);
        return stats;
    }

    // ── WRITE ────────────────────────────────────────────────────────────────

    /**
     * Create a new product.
     * Flow:
     *   1. Resolve CategoryID from name
     *   2. Resolve/create SupplierID from name
     *   3. Open transaction
     *   4. Generate next ProductID atomically
     *   5. Insert product
     *   6. Sync tags
     *   7. Commit
     *   8. Invalidate cache
     *   9. Enqueue async jobs
     *
     * @param {object} dto - Validated body from controller
     * @returns {Promise<object>} Created product DTO
     */
    async createProduct(dto) {
        // Resolve foreign keys
        const category = await categoryRepo.findByName(dto.Category);
        if (!category) throw new NotFoundError(`Category "${dto.Category}" does not exist.`);

        const supplierID = await supplierRepo.findOrCreate(dto.Supplier);

        const today = new Date().toISOString().split("T")[0];

        const created = await productRepo.withTransaction(async (tx) => {
            const productId = await productRepo.generateNextId(tx);

            const record = {
                ProductID:   productId,
                ProductName: dto.ProductName,
                CategoryID:  category.CategoryID,
                SubCategory: dto.SubCategory || null,
                Description: dto.Description || null,
                Price:       parseFloat(dto.Price),
                Currency:    dto.Currency || "USD",
                Stock:       parseInt(dto.Stock, 10),
                Unit:        dto.Unit || "EA",
                Status:      dto.Status || "Active",
                SupplierID:  supplierID,
                Featured:    Boolean(dto.Featured),
                Discount:    parseInt(dto.Discount, 10) || 0,
                Weight:      dto.Weight || null,
                Dimensions:  dto.Dimensions || null,
                CreatedAt:   today,
                ModifiedAt:  today,
            };

            await productRepo.insert(record, tx);
            await productRepo.syncTags(productId, dto.Tags || [], tx);
            return productId;
        });

        // Invalidate caches
        await this._invalidateWriteCaches(created);

        // Async jobs (fire-and-forget)
        this._enqueuePostCreateJobs(created);

        // Return the freshly created product
        return this.getProductById(created);
    }

    /**
     * Update an existing product.
     * @param {string} productId
     * @param {object} dto - Validated body (full or partial update)
     * @returns {Promise<object>} Updated product DTO
     */
    async updateProduct(productId, dto) {
        // Verify product exists
        await productRepo.findById(productId);

        const category   = await categoryRepo.findByName(dto.Category);
        if (!category) throw new NotFoundError(`Category "${dto.Category}" does not exist.`);

        const supplierID = await supplierRepo.findOrCreate(dto.Supplier);

        await productRepo.withTransaction(async (tx) => {
            const record = {
                ProductName: dto.ProductName,
                CategoryID:  category.CategoryID,
                SubCategory: dto.SubCategory || null,
                Description: dto.Description || null,
                Price:       parseFloat(dto.Price),
                Currency:    dto.Currency || "USD",
                Stock:       parseInt(dto.Stock, 10),
                Unit:        dto.Unit || "EA",
                Status:      dto.Status || "Active",
                SupplierID:  supplierID,
                Featured:    Boolean(dto.Featured),
                Discount:    parseInt(dto.Discount, 10) || 0,
                Weight:      dto.Weight || null,
                Dimensions:  dto.Dimensions || null,
            };

            await productRepo.update(productId, record, tx);
            await productRepo.syncTags(productId, dto.Tags || [], tx);
        });

        await this._invalidateWriteCaches(productId);
        this._enqueuePostUpdateJobs(productId);

        return this.getProductById(productId);
    }

    /**
     * Delete a product by ID.
     * @param {string} productId
     */
    async deleteProduct(productId) {
        // Confirm existence before deletion (gives meaningful 404)
        await productRepo.findById(productId);
        await productRepo.delete(productId);
        await this._invalidateWriteCaches(productId);
        this._enqueuePostDeleteJobs(productId);
    }

    /**
     * Bulk delete products.
     * @param {string[]} ids
     * @returns {Promise<number>} Count of deleted records
     */
    async deleteManyProducts(ids) {
        const count = await productRepo.deleteMany(ids);
        // Flush catalog + stats caches; individual product keys will expire naturally
        await cache.del(CACHE_KEY_CATALOG);
        await cache.del(CACHE_KEY_STATS);
        await cache.delByPrefix("products:list:");
        return count;
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /**
     * Invalidate all caches that may be stale after a write.
     * @param {string} productId
     */
    async _invalidateWriteCaches(productId) {
        await Promise.all([
            cache.del(CACHE_KEY_CATALOG),
            cache.del(CACHE_KEY_STATS),
            cache.del(CACHE_PREFIX_PROD + productId),
            cache.delByPrefix("products:list:"),
        ]);
        logger.debug(`[CACHE] Invalidated caches for product ${productId}`);
    }

    /** Dispatch async post-create jobs (fire-and-forget — never throws). */
    _enqueuePostCreateJobs(productId) {
        try {
            const q = getProductQueue();
            q.add("refresh-stats",   { trigger: "create",  productId });
            q.add("audit-log",       { action:  "CREATED", productId });
        } catch (err) {
            logger.warn("[SERVICE] Failed to enqueue post-create jobs:", err.message);
        }
    }

    _enqueuePostUpdateJobs(productId) {
        try {
            const q = getProductQueue();
            q.add("audit-log", { action: "UPDATED", productId });
        } catch (err) {
            logger.warn("[SERVICE] Failed to enqueue post-update jobs:", err.message);
        }
    }

    _enqueuePostDeleteJobs(productId) {
        try {
            const q = getProductQueue();
            q.add("refresh-stats", { trigger: "delete",  productId });
            q.add("audit-log",     { action:  "DELETED", productId });
        } catch (err) {
            logger.warn("[SERVICE] Failed to enqueue post-delete jobs:", err.message);
        }
    }
}

module.exports = new ProductService();
