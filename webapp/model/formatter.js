sap.ui.define([], function () {
    "use strict";

    return {

        /**
         * Formats a numeric price value with currency symbol.
         * Example: formatPrice(1299.99, "USD") => "$ 1,299.99"
         * @param {number|string} fPrice - The price value
         * @param {string} sCurrency - Currency code (USD, EUR, GBP)
         * @returns {string} Formatted price string
         */
        formatPrice: function (fPrice, sCurrency) {
            if (fPrice === undefined || fPrice === null || fPrice === "") {
                return "";
            }
            var fValue = parseFloat(fPrice);
            if (isNaN(fValue)) {
                return "";
            }
            var sCurrencySymbol = "$";
            if (sCurrency === "EUR") {
                sCurrencySymbol = "€";
            } else if (sCurrency === "GBP") {
                sCurrencySymbol = "£";
            } else if (sCurrency === "USD") {
                sCurrencySymbol = "$";
            }
            var sFormatted = fValue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
            return sCurrencySymbol + " " + sFormatted;
        },

        /**
         * Maps a product status string to a sap.ui.core.ValueState.
         * Used to color ObjectStatus and other controls.
         * @param {string} sStatus - Product status ("Active", "Inactive", "Discontinued")
         * @returns {string} sap.ui.core.ValueState value
         */
        formatStatus: function (sStatus) {
            switch (sStatus) {
                case "Active":
                    return "Success";
                case "Discontinued":
                    return "Error";
                case "Inactive":
                    return "Warning";
                default:
                    return "None";
            }
        },

        /**
         * Returns a human-readable display text for a product status.
         * Falls back to the status itself if unrecognized.
         * @param {string} sStatus - Product status
         * @returns {string} Display text
         */
        formatStatusText: function (sStatus) {
            switch (sStatus) {
                case "Active":
                    return "Active";
                case "Inactive":
                    return "Inactive";
                case "Discontinued":
                    return "Discontinued";
                default:
                    return sStatus || "Unknown";
            }
        },

        /**
         * Formats a numeric rating to one decimal place.
         * Example: formatRating(4.666) => "4.7"
         * @param {number|string} fRating - Raw rating value
         * @returns {string} Formatted rating string
         */
        formatRating: function (fRating) {
            if (fRating === undefined || fRating === null) {
                return "0.0";
            }
            return parseFloat(fRating).toFixed(1);
        },

        /**
         * Returns a ValueState based on stock quantity.
         * Red (Error) for critically low stock (< 10)
         * Yellow (Warning) for low stock (< 50)
         * Green (Success) for adequate stock (>= 50)
         * @param {number|string} iStock - Stock quantity
         * @returns {string} sap.ui.core.ValueState value
         */
        formatStockState: function (iStock) {
            var iValue = parseInt(iStock, 10);
            if (isNaN(iValue)) {
                return "None";
            }
            if (iValue < 10) {
                return "Error";
            } else if (iValue < 50) {
                return "Warning";
            }
            return "Success";
        },

        /**
         * Formats an ISO date string to a locale-friendly date string.
         * Example: formatDate("2024-03-15") => "3/15/2024" (en-US locale)
         * @param {string} sDate - ISO date string (YYYY-MM-DD or full ISO)
         * @returns {string} Formatted date string
         */
        formatDate: function (sDate) {
            if (!sDate) {
                return "";
            }
            try {
                var oDate = new Date(sDate);
                if (isNaN(oDate.getTime())) {
                    return sDate;
                }
                return oDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit"
                });
            } catch (e) {
                return sDate;
            }
        },

        /**
         * Formats a discount percentage into a badge-style string.
         * Returns empty string for zero discount so bindings hide the control.
         * @param {number|string} iDiscount - Discount percentage (0-100)
         * @returns {string} Formatted discount string e.g. "20% OFF"
         */
        formatDiscount: function (iDiscount) {
            var iValue = parseInt(iDiscount, 10);
            if (!iValue || iValue === 0) {
                return "";
            }
            return iValue + "% OFF";
        },

        /**
         * Calculates and formats the price after applying a discount.
         * Example: formatDiscountedPrice(100, 20) => "$ 80.00"
         * @param {number|string} fPrice - Original price
         * @param {number|string} iDiscount - Discount percentage
         * @returns {string} Formatted discounted price string
         */
        formatDiscountedPrice: function (fPrice, iDiscount) {
            var fValue = parseFloat(fPrice);
            var iDiscountVal = parseInt(iDiscount, 10);
            if (isNaN(fValue)) {
                return "";
            }
            if (!iDiscountVal || iDiscountVal === 0) {
                return "$ " + fValue.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                });
            }
            var fDiscounted = fValue * (1 - iDiscountVal / 100);
            return "$ " + fDiscounted.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        },

        /**
         * Returns a visibility boolean for discount-related controls.
         * @param {number|string} iDiscount - Discount percentage
         * @returns {boolean} true if discount > 0
         */
        formatDiscountVisible: function (iDiscount) {
            var iValue = parseInt(iDiscount, 10);
            return !!(iValue && iValue > 0);
        },

        /**
         * Formats stock quantity with unit for display.
         * @param {number} iStock - Stock quantity
         * @param {string} sUnit - Unit of measure
         * @returns {string} Combined stock display
         */
        formatStockDisplay: function (iStock, sUnit) {
            if (iStock === undefined || iStock === null) {
                return "";
            }
            return iStock + " " + (sUnit || "EA");
        }
    };
});
