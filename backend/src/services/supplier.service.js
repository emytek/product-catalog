"use strict";

const supplierRepo = require("../repositories/supplier.repository");
const cache        = require("../config/cache");

const CACHE_KEY_SUPPLIERS = "suppliers";

class SupplierService {
    async getAllSuppliers() {
        const cached = await cache.get(CACHE_KEY_SUPPLIERS);
        if (cached) return cached;

        const suppliers = await supplierRepo.findAll();
        await cache.set(CACHE_KEY_SUPPLIERS, suppliers, 3600);
        return suppliers;
    }
}

module.exports = new SupplierService();
