sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "com/demo/productcatalog/model/formatter"
], function (Controller, JSONModel, MessageBox, formatter) {
    "use strict";

    return Controller.extend("com.demo.productcatalog.controller.Home", {

        // Expose formatter so XML view bindings can use it via '.formatter.xxx'
        formatter: formatter,

        // ================================================================
        // LIFECYCLE HOOKS
        // ================================================================

        onInit: function () {
            // Create the view model that drives the home page
            var oViewModel = new JSONModel({
                featuredProducts: [],
                recentProducts: [],
                stats: {
                    totalProducts: 0,
                    activeProducts: 0,
                    totalCategories: 5,
                    featuredCount: 0,
                    discontinuedProducts: 0,
                    inactiveProducts: 0,
                    lowStockProducts: 0
                }
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Use routePatternMatched so _onDataLoaded runs every time
            // the home route is visited — this avoids the race condition where
            // requestCompleted fires during component init before this view exists
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("home").attachPatternMatched(this._onDataLoaded, this);
        },

        // ================================================================
        // DATA LOADING
        // ================================================================

        /**
         * Called when the products.json data is loaded into the products model.
         * Computes all derived data for the home page.
         * @private
         */
        _onDataLoaded: function () {
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var oData = oProductsModel.getData();

            // If JSON hasn't loaded yet, wait for requestCompleted then retry
            if (!oData || !oData.products) {
                oProductsModel.attachEventOnce("requestCompleted", this._onDataLoaded, this);
                return;
            }

            var aProducts = oData.products || [];

            var oStats = this._computeStats(aProducts);
            var aFeatured = this._prepareFeaturedProducts(aProducts);
            var aRecent = this._prepareRecentProducts(aProducts);

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/stats", oStats);
            oViewModel.setProperty("/featuredProducts", aFeatured);
            oViewModel.setProperty("/recentProducts", aRecent);
        },

        /**
         * Computes aggregate statistics from the products array.
         * @param {Array} aProducts - Full products array
         * @returns {Object} Stats object
         * @private
         */
        _computeStats: function (aProducts) {
            var iTotal = aProducts.length;
            var iActive = aProducts.filter(function (p) { return p.Status === "Active"; }).length;
            var iDiscontinued = aProducts.filter(function (p) { return p.Status === "Discontinued"; }).length;
            var iInactive = aProducts.filter(function (p) { return p.Status === "Inactive"; }).length;
            var iFeatured = aProducts.filter(function (p) { return p.Featured === true; }).length;
            var iLowStock = aProducts.filter(function (p) { return parseInt(p.Stock, 10) < 10; }).length;

            // Calculate unique categories
            var aCategories = [];
            aProducts.forEach(function (p) {
                if (p.Category && aCategories.indexOf(p.Category) === -1) {
                    aCategories.push(p.Category);
                }
            });

            return {
                totalProducts: iTotal,
                activeProducts: iActive,
                discontinuedProducts: iDiscontinued,
                inactiveProducts: iInactive,
                featuredCount: iFeatured,
                lowStockProducts: iLowStock,
                totalCategories: aCategories.length
            };
        },

        /**
         * Filters for featured products (Featured === true), up to a maximum of 6.
         * @param {Array} aProducts - Full products array
         * @returns {Array} Featured products
         * @private
         */
        _prepareFeaturedProducts: function (aProducts) {
            return aProducts
                .filter(function (p) { return p.Featured === true; })
                .slice(0, 6);
        },

        /**
         * Returns the 5 most recently created products, sorted by CreatedAt descending.
         * @param {Array} aProducts - Full products array
         * @returns {Array} 5 most recent products
         * @private
         */
        _prepareRecentProducts: function (aProducts) {
            var aSorted = aProducts.slice().sort(function (a, b) {
                return new Date(b.CreatedAt) - new Date(a.CreatedAt);
            });
            return aSorted.slice(0, 5);
        },

        // ================================================================
        // NAVIGATION HANDLERS
        // ================================================================

        /**
         * Navigate to the Product List view.
         */
        onNavToProductList: function () {
            this.getOwnerComponent().getRouter().navTo("productList");
        },

        /**
         * Navigate to the Create Product form.
         */
        onNavToCreateProduct: function () {
            this.getOwnerComponent().getRouter().navTo("productForm");
        },

        /**
         * Handle press on a carousel item — navigate to that product's detail page.
         * The carousel items are bound to viewModel>/featuredProducts so we read
         * the ProductID from the binding context.
         * @param {sap.ui.base.Event} oEvent - Press event
         */
        onCarouselItemPress: function (oEvent) {
            var oSource = oEvent.getSource();
            // Walk up the control tree to find the bound context
            var oContext = oSource.getBindingContext("viewModel");
            if (oContext) {
                var sProductId = oContext.getProperty("ProductID");
                if (sProductId) {
                    this.getOwnerComponent().getRouter().navTo("productDetail", {
                        productId: sProductId
                    });
                }
            }
        },

        /**
         * Handle press on a recent products list item — navigate to product detail.
         * @param {sap.ui.base.Event} oEvent - Press/navigation event from ObjectListItem
         */
        onRecentProductPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("viewModel");
            if (oContext) {
                var sProductId = oContext.getProperty("ProductID");
                if (sProductId) {
                    this.getOwnerComponent().getRouter().navTo("productDetail", {
                        productId: sProductId
                    });
                }
            }
        },

        /**
         * Show a statistics summary dialog.
         */
        onShowStats: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oStats = oViewModel.getProperty("/stats");
            var sMessage = "Product Catalog Statistics\n\n" +
                "Total Products: " + oStats.totalProducts + "\n" +
                "Active: " + oStats.activeProducts + "\n" +
                "Inactive: " + oStats.inactiveProducts + "\n" +
                "Discontinued: " + oStats.discontinuedProducts + "\n" +
                "Featured: " + oStats.featuredCount + "\n" +
                "Low Stock (< 10): " + oStats.lowStockProducts + "\n" +
                "Categories: " + oStats.totalCategories;
            MessageBox.information(sMessage, {
                title: "Catalog Statistics"
            });
        },

        /**
         * Show the About dialog with app information.
         */
        onShowAbout: function () {
            MessageBox.information(
                this.getView().getModel("i18n").getResourceBundle().getText("homeAboutText"),
                {
                    title: this.getView().getModel("i18n").getResourceBundle().getText("homeAboutTitle")
                }
            );
        }

    });
});
