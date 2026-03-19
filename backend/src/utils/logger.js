"use strict";

/**
 * logger.js
 * ─────────
 * Singleton Winston logger.
 *
 * Transports:
 *   Console   — always on; uses colourised format in dev, JSON in production.
 *   File      — only in production; daily-rotating files so logs don't grow unbounded.
 *
 * Structured JSON logging in production makes it trivially parseable by SAP BTP
 * application logging service / Kibana / Splunk.
 */

const winston = require("winston");
const path    = require("path");

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const isProduction = process.env.NODE_ENV === "production";
const logDir       = process.env.LOG_DIR || "logs";
const logLevel     = process.env.LOG_LEVEL || (isProduction ? "info" : "debug");

// ── Custom dev format ─────────────────────────────────────────────────────────
const devFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaStr = Object.keys(meta).length ? " " + JSON.stringify(meta) : "";
    return `${ts} [${level}] ${stack || message}${metaStr}`;
});

// ── Transports ────────────────────────────────────────────────────────────────
const transports = [
    new winston.transports.Console({
        format: isProduction
            ? combine(timestamp(), errors({ stack: true }), json())
            : combine(
                  colorize({ all: true }),
                  timestamp({ format: "HH:mm:ss" }),
                  errors({ stack: true }),
                  devFormat
              ),
    }),
];

if (isProduction) {
    const DailyRotateFile = require("winston-daily-rotate-file");

    transports.push(
        new DailyRotateFile({
            dirname:       path.join(process.cwd(), logDir),
            filename:      "app-%DATE%.log",
            datePattern:   "YYYY-MM-DD",
            maxSize:       "20m",
            maxFiles:      "14d",   // keep 14 days of logs
            zippedArchive: true,
            format:        combine(timestamp(), errors({ stack: true }), json()),
        })
    );
}

// ── Logger instance ───────────────────────────────────────────────────────────
const logger = winston.createLogger({
    level:      logLevel,
    transports,
    // Prevent Winston from exiting on uncaught exceptions — handled in server.js
    exitOnError: false,
});

module.exports = logger;
