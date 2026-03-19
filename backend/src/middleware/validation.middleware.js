"use strict";

/**
 * validation.middleware.js
 * ────────────────────────
 * Factory that returns an Express middleware which validates req.body (or
 * req.query / req.params) against a Joi schema.
 *
 * Usage:
 *   const { validateBody, validateQuery } = require("../middleware/validation.middleware");
 *   router.post("/", validateBody(productCreateSchema), controller.create);
 *
 * On failure the middleware throws a ValidationError that the global error
 * handler converts into a 422 Unprocessable Entity response.
 */

const Joi = require("joi");
const { ValidationError } = require("../utils/errors");

// ── Middleware factories ───────────────────────────────────────────────────────

function validateBody(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly:  false,  // collect ALL errors, not just the first
            stripUnknown: true,  // remove fields not defined in the schema
            convert:     true,   // coerce types (string "true" → boolean true)
        });
        if (error) {
            const details = error.details.map((d) => ({
                field:   d.path.join("."),
                message: d.message.replace(/['"]/g, ""),
            }));
            return next(new ValidationError("Request body validation failed.", details));
        }
        req.body = value;   // replace body with sanitised/coerced value
        next();
    };
}

function validateQuery(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly:  false,
            stripUnknown: true,
            convert:     true,
        });
        if (error) {
            const details = error.details.map((d) => ({
                field:   d.path.join("."),
                message: d.message.replace(/['"]/g, ""),
            }));
            return next(new ValidationError("Query parameter validation failed.", details));
        }
        req.query = value;
        next();
    };
}

function validateParams(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            convert:    true,
        });
        if (error) {
            const details = error.details.map((d) => ({
                field:   d.path.join("."),
                message: d.message.replace(/['"]/g, ""),
            }));
            return next(new ValidationError("URL parameter validation failed.", details));
        }
        req.params = value;
        next();
    };
}

// ── Reusable Joi schemas ──────────────────────────────────────────────────────

const VALID_CURRENCIES = ["USD", "EUR", "GBP"];
const VALID_UNITS      = ["EA", "KG", "L", "M"];
const VALID_STATUSES   = ["Active", "Inactive", "Discontinued"];
const VALID_SORT_BY    = ["ProductName", "Price", "Stock", "Rating", "CreatedAt", "Category"];
const VALID_SORT_ORDER = ["ASC", "DESC"];

/** Schema for creating a new product (all required fields must be present). */
const productCreateSchema = Joi.object({
    ProductName: Joi.string().min(1).max(100).required(),
    Category:    Joi.string().valid("Electronics","Furniture","Clothing","Food & Beverage","Office Supplies").required(),
    SubCategory: Joi.string().max(60).allow("", null).optional(),
    Description: Joi.string().max(2000).allow("", null).optional(),
    Price:       Joi.number().min(0).precision(2).required(),
    Currency:    Joi.string().valid(...VALID_CURRENCIES).default("USD"),
    Stock:       Joi.number().integer().min(0).required(),
    Unit:        Joi.string().valid(...VALID_UNITS).default("EA"),
    Status:      Joi.string().valid(...VALID_STATUSES).default("Active"),
    Supplier:    Joi.string().max(100).allow("", null).optional(),
    Tags:        Joi.array().items(Joi.string().max(50)).default([]),
    Featured:    Joi.boolean().default(false),
    Discount:    Joi.number().integer().min(0).max(100).default(0),
    Weight:      Joi.string().max(30).allow("", null).optional(),
    Dimensions:  Joi.string().max(60).allow("", null).optional(),
});

/** Schema for updating a product (all fields optional — PATCH semantics). */
const productUpdateSchema = Joi.object({
    ProductName: Joi.string().min(1).max(100).optional(),
    Category:    Joi.string().valid("Electronics","Furniture","Clothing","Food & Beverage","Office Supplies").optional(),
    SubCategory: Joi.string().max(60).allow("", null).optional(),
    Description: Joi.string().max(2000).allow("", null).optional(),
    Price:       Joi.number().min(0).precision(2).optional(),
    Currency:    Joi.string().valid(...VALID_CURRENCIES).optional(),
    Stock:       Joi.number().integer().min(0).optional(),
    Unit:        Joi.string().valid(...VALID_UNITS).optional(),
    Status:      Joi.string().valid(...VALID_STATUSES).optional(),
    Supplier:    Joi.string().max(100).allow("", null).optional(),
    Tags:        Joi.array().items(Joi.string().max(50)).optional(),
    Featured:    Joi.boolean().optional(),
    Discount:    Joi.number().integer().min(0).max(100).optional(),
    Weight:      Joi.string().max(30).allow("", null).optional(),
    Dimensions:  Joi.string().max(60).allow("", null).optional(),
});

/** Schema for list query parameters. */
const productListQuerySchema = Joi.object({
    search:   Joi.string().max(200).allow("").optional(),
    category: Joi.string().valid("Electronics","Furniture","Clothing","Food & Beverage","Office Supplies","").optional(),
    status:   Joi.string().valid(...VALID_STATUSES, "").optional(),
    featured: Joi.boolean().optional(),
    minPrice: Joi.number().min(0).optional(),
    maxPrice: Joi.number().min(0).optional(),
    sortBy:   Joi.string().valid(...VALID_SORT_BY).default("ProductName"),
    sortOrder:Joi.string().valid(...VALID_SORT_ORDER).default("ASC"),
    page:     Joi.number().integer().min(1).default(1),
    limit:    Joi.number().integer().min(1).max(200).default(20),
});

/** ProductID param schema — must match P + 1-10 digits */
const productIdParamSchema = Joi.object({
    id: Joi.string().pattern(/^P\d{1,10}$/).required()
        .messages({ "string.pattern.base": "Product ID must be in the format P001, P002, …" }),
});

module.exports = {
    validateBody,
    validateQuery,
    validateParams,
    productCreateSchema,
    productUpdateSchema,
    productListQuerySchema,
    productIdParamSchema,
};
