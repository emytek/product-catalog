"use strict";

const supplierService = require("../services/supplier.service");
const ApiResponse     = require("../utils/ApiResponse");

const SupplierController = {
    async list(req, res) {
        const suppliers = await supplierService.getAllSuppliers();
        return ApiResponse.success(res, suppliers);
    },
};

module.exports = SupplierController;
