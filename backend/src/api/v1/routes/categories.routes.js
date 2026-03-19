"use strict";

const router = require("express").Router();
const ctrl   = require("../../../controllers/category.controller");
const cache  = require("../../../middleware/cache.middleware");

router.get("/",        cache(3600), ctrl.list);
router.get("/summary", cache(300),  ctrl.summary);

module.exports = router;
