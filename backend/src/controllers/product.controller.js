"use strict";

/**
 * product.controller.js
 * ─────────────────────
 * HTTP handler layer for all product endpoints.
 *
 * Responsibilities (and ONLY these):
 *   • Extract and forward request data to the service
 *   • Choose the correct HTTP status code and response shape
 *   • Never contain business logic or SQL
 *
 * Every method is async and relies on express-async-errors to forward
 * thrown errors to the global error middleware.
 */

const productService = require("../services/product.service");
const ApiResponse    = require("../utils/ApiResponse");

const ProductController = {

    /**
     * GET /api/v1/products
     * Paginated, filtered, sorted product list.
     */
    async list(req, res) {
        const result = await productService.listProducts(req.query);
        return ApiResponse.success(res, result.products, 200, result.meta);
    },

    /**
     * GET /api/v1/products/catalog
     * Full product array (no pagination) — consumed by the SAPUI5 frontend
     * as a drop-in replacement for products.json.
     * Returns exactly: { "success": true, "data": { "products": [...] } }
     */
    async catalog(req, res) {
        const result = await productService.getCatalog();
        return ApiResponse.success(res, result);
    },

    /**
     * GET /api/v1/products/stats
     * KPI aggregates for the home-page tiles.
     */
    async stats(req, res) {
        const stats = await productService.getStats();
        return ApiResponse.success(res, stats);
    },

    /**
     * GET /api/v1/products/:id
     * Single product by ID.
     */
    async getById(req, res) {
        const product = await productService.getProductById(req.params.id);
        return ApiResponse.success(res, product);
    },

    /**
     * POST /api/v1/products
     * Create a new product.
     */
    async create(req, res) {
        const product = await productService.createProduct(req.body);
        return ApiResponse.created(res, product);
    },

    /**
     * PUT /api/v1/products/:id
     * Full update of an existing product.
     */
    async update(req, res) {
        const product = await productService.updateProduct(req.params.id, req.body);
        return ApiResponse.success(res, product);
    },

    /**
     * DELETE /api/v1/products/:id
     * Delete a single product.
     */
    async remove(req, res) {
        await productService.deleteProduct(req.params.id);
        return ApiResponse.success(res, {
            message: `Product "${req.params.id}" deleted successfully.`,
        });
    },

    /**
     * DELETE /api/v1/products
     * Bulk delete — accepts body: { ids: ["P001","P002"] }
     */
    async removeMany(req, res) {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return ApiResponse.badRequest(res, "Request body must contain a non-empty 'ids' array.");
        }
        const count = await productService.deleteManyProducts(ids);
        return ApiResponse.success(res, {
            deleted: count,
            message: `${count} product(s) deleted successfully.`,
        });
    },
};

module.exports = ProductController;
