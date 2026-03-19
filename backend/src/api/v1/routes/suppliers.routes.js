"use strict";

const router = require("express").Router();
const ctrl   = require("../../../controllers/supplier.controller");
const cache  = require("../../../middleware/cache.middleware");

router.get("/", cache(3600), ctrl.list);

module.exports = router;
