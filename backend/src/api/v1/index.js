"use strict";

/**
 * api/v1/index.js
 * ───────────────
 * Mount all v1 route modules under their respective path prefixes.
 * app.js imports this and mounts it at /api/v1.
 */

const router = require("express").Router();

router.use("/products",   require("./routes/products.routes"));
router.use("/categories", require("./routes/categories.routes"));
router.use("/suppliers",  require("./routes/suppliers.routes"));

module.exports = router;
