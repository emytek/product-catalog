/* global sap */
sap.ui.define([], function () {
    "use strict";

    /**
     * ApiService
     * ──────────
     * Centralised HTTP client for all backend API calls.
     *
     * Why a dedicated service?
     *   DRY — the base URL, error handling, and JSON parsing logic live in one
     *   place.  Every controller that needs data just calls ApiService.doX()
     *   without knowing about fetch(), headers, or URL construction.
     *
     * Base URL resolution:
     *   Development (BAS):  Backend runs on port 3000; frontend on port 8080.
     *                       Set window.API_BASE_URL = "http://localhost:3000"
     *                       in index.html (see below) or use a BAS dev proxy.
     *   Production (BTP):   The approuter routes /api/* to the backend CF app,
     *                       so the base URL is "" (same origin).
     */

    var BASE_URL = (window.API_BASE_URL || "") + "/api/v1";

    /**
     * Internal fetch wrapper.  Throws a plain-JS Error with a human-readable
     * message if the HTTP status is not 2xx or if the response body signals
     * success: false.
     *
     * @param {string} path     - Relative path, e.g. "/products/P001"
     * @param {object} [opts]   - Standard fetch options (method, body, etc.)
     * @returns {Promise<any>}  - Resolved value of response.data
     * @private
     */
    function _request(path, opts) {
        var url = BASE_URL + path;
        var options = Object.assign({
            headers: { "Content-Type": "application/json" },
        }, opts || {});

        return fetch(url, options)
            .then(function (response) {
                return response.json().then(function (body) {
                    if (!response.ok || body.success === false) {
                        var msg = (body.error && body.error.message)
                            ? body.error.message
                            : "API request failed (" + response.status + ")";
                        throw new Error(msg);
                    }
                    return body.data;
                });
            });
    }

    // ── Public API ──────────────────────────────────────────────────────────────

    var ApiService = {

        /**
         * Load the full product catalogue.
         * Returns { products: [...] } — the same shape as products.json
         * so the existing SAPUI5 JSONModel works without changes.
         * @returns {Promise<{products: object[]}>}
         */
        getCatalog: function () {
            return _request("/products/catalog");
        },

        /**
         * Paginated / filtered product list.
         * @param {object} [params] - Query params: page, limit, search, category, status, etc.
         * @returns {Promise<object[]>}
         */
        getProducts: function (params) {
            var qs = params
                ? "?" + Object.keys(params)
                    .filter(function (k) { return params[k] !== "" && params[k] !== undefined; })
                    .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
                    .join("&")
                : "";
            return _request("/products" + qs);
        },

        /**
         * KPI stats for the home page.
         * @returns {Promise<object>}
         */
        getStats: function () {
            return _request("/products/stats");
        },

        /**
         * Single product by ID.
         * @param {string} productId
         * @returns {Promise<object>}
         */
        getProductById: function (productId) {
            return _request("/products/" + encodeURIComponent(productId));
        },

        /**
         * Create a new product.
         * @param {object} product - Product data DTO
         * @returns {Promise<object>} Created product
         */
        createProduct: function (product) {
            return _request("/products", {
                method: "POST",
                body:   JSON.stringify(product),
            });
        },

        /**
         * Update an existing product.
         * @param {string} productId
         * @param {object} product  - Updated product data DTO
         * @returns {Promise<object>} Updated product
         */
        updateProduct: function (productId, product) {
            return _request("/products/" + encodeURIComponent(productId), {
                method: "PUT",
                body:   JSON.stringify(product),
            });
        },

        /**
         * Delete a single product by ID.
         * @param {string} productId
         * @returns {Promise<object>}
         */
        deleteProduct: function (productId) {
            return _request("/products/" + encodeURIComponent(productId), {
                method: "DELETE",
            });
        },

        /**
         * Bulk-delete products.
         * @param {string[]} ids
         * @returns {Promise<object>}
         */
        deleteManyProducts: function (ids) {
            return _request("/products", {
                method: "DELETE",
                body:   JSON.stringify({ ids: ids }),
            });
        },

        /**
         * Load all categories.
         * @returns {Promise<object[]>}
         */
        getCategories: function () {
            return _request("/categories");
        },
    };

    return ApiService;
});
