"use strict";

const categoryService = require("../services/category.service");
const ApiResponse     = require("../utils/ApiResponse");

const CategoryController = {
    async list(req, res) {
        const categories = await categoryService.getAllCategories();
        return ApiResponse.success(res, categories);
    },

    async summary(req, res) {
        const summary = await categoryService.getCategorySummary();
        return ApiResponse.success(res, summary);
    },
};

module.exports = CategoryController;
