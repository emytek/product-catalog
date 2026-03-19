"use strict";

const categoryRepo = require("../repositories/category.repository");
const cache        = require("../config/cache");

const CACHE_KEY_CATEGORIES = "categories";

class CategoryService {
    async getAllCategories() {
        const cached = await cache.get(CACHE_KEY_CATEGORIES);
        if (cached) return cached;

        const categories = await categoryRepo.findAll();
        await cache.set(CACHE_KEY_CATEGORIES, categories, 3600); // 1 hour — rarely changes
        return categories;
    }

    async getCategorySummary() {
        const key    = "category-summary";
        const cached = await cache.get(key);
        if (cached) return cached;

        const summary = await categoryRepo.getCategorySummary();
        await cache.set(key, summary, 300);
        return summary;
    }
}

module.exports = new CategoryService();
