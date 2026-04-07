/* global sap */
sap.ui.define([], function () {
    "use strict";

    /**
     * ApiService — Ardova Trade Card
     * ─────────────────────────────
     * Centralised HTTP client for all Trade Card backend API calls.
     *
     * Base URL resolution:
     *   Development (BAS):  window.API_BASE_URL = "http://localhost:3000" (set in index.html)
     *   Production (BTP):   Approuter routes /api/* to backend CF app (same-origin, BASE_URL = "")
     */

    var BASE_URL = (window.API_BASE_URL || "") + "/api/v1";

    function _request(path, opts) {
        var url     = BASE_URL + path;
        var options = Object.assign(
            { headers: { "Content-Type": "application/json" } },
            opts || {}
        );

        return fetch(url, options).then(function (response) {
            return response.json().then(function (body) {
                if (!response.ok || body.success === false) {
                    var msg = (body.error && body.error.message)
                        ? body.error.message
                        : "API request failed (" + response.status + ")";
                    throw new Error(msg);
                }
                return body.data;
            });
        });
    }

    var ApiService = {

        // ── Trade Card ────────────────────────────────────────────────────

        /**
         * Fetch a single Trade Card by its ID (e.g. "LPG/2022/061").
         * @param {string} id
         * @returns {Promise<object>}
         */
        getTradeCard: function (id) {
            return _request("/trade-cards/" + encodeURIComponent(id));
        },

        /**
         * Fetch paginated list of Trade Cards.
         * @param {object} [params] - Query params: page, limit, status, productCode, etc.
         * @returns {Promise<object[]>}
         */
        getTradeCards: function (params) {
            var qs = params
                ? "?" + Object.keys(params)
                    .filter(function (k) { return params[k] !== "" && params[k] !== undefined; })
                    .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(params[k]); })
                    .join("&")
                : "";
            return _request("/trade-cards" + qs);
        },

        /**
         * Create a new Trade Card.
         * @param {object} payload - Full Trade Card data
         * @returns {Promise<object>} Created Trade Card with generated ID
         */
        saveTradeCard: function (payload) {
            var id = payload.id;
            if (id && id !== "LPG/2022/061") {
                // Update existing
                return _request("/trade-cards/" + encodeURIComponent(id), {
                    method: "PUT",
                    body:   JSON.stringify(payload)
                });
            }
            // Create new
            return _request("/trade-cards", {
                method: "POST",
                body:   JSON.stringify(payload)
            });
        },

        /**
         * Submit Trade Card for approval.
         * @param {string} id
         * @returns {Promise<object>}
         */
        submitForApproval: function (id) {
            return _request("/trade-cards/" + encodeURIComponent(id) + "/submit", {
                method: "POST"
            });
        },

        /**
         * Delete a Trade Card by ID.
         * @param {string} id
         * @returns {Promise<object>}
         */
        deleteTradeCard: function (id) {
            return _request("/trade-cards/" + encodeURIComponent(id), {
                method: "DELETE"
            });
        },

        // ── Health ────────────────────────────────────────────────────────

        health: function () {
            return fetch((window.API_BASE_URL || "") + "/health")
                .then(function (r) { return r.json(); });
        }
    };

    return ApiService;
});
