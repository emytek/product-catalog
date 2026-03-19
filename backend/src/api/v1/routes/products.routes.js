"use strict";

/**
 * products.routes.js
 * ──────────────────
 * All routes under /api/v1/products.
 *
 * Route order matters:
 *   /catalog and /stats are literal paths — they must appear BEFORE /:id
 *   so Express does not interpret "catalog" or "stats" as a productId param.
 */

const router     = require("express").Router();
const ctrl       = require("../../../controllers/product.controller");
const cache      = require("../../../middleware/cache.middleware");
const { writeLimiter } = require("../../../middleware/rateLimiter.middleware");
const {
    validateBody,
    validateQuery,
    validateParams,
    productCreateSchema,
    productUpdateSchema,
    productListQuerySchema,
    productIdParamSchema,
} = require("../../../middleware/validation.middleware");
const config = require("../../../config/environment");

// ── Read routes (cached) ───────────────────────────────────────────────────────

// Full catalogue for frontend (replaces products.json)
router.get("/catalog",
    cache(config.cache.ttlCatalogSeconds),
    ctrl.catalog
);

// KPI aggregates for home-page tiles
router.get("/stats",
    cache(config.cache.ttlSeconds),
    ctrl.stats
);

// Paginated / filtered list
router.get("/",
    validateQuery(productListQuerySchema),
    cache(config.cache.ttlSeconds),
    ctrl.list
);

// Single product by ID
router.get("/:id",
    validateParams(productIdParamSchema),
    cache(config.cache.ttlSeconds),
    ctrl.getById
);

// ── Write routes (rate-limited) ────────────────────────────────────────────────

router.post("/",
    writeLimiter,
    validateBody(productCreateSchema),
    ctrl.create
);

router.put("/:id",
    writeLimiter,
    validateParams(productIdParamSchema),
    validateBody(productUpdateSchema),
    ctrl.update
);

router.delete("/",
    writeLimiter,
    ctrl.removeMany
);

router.delete("/:id",
    writeLimiter,
    validateParams(productIdParamSchema),
    ctrl.remove
);

module.exports = router;
