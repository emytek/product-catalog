sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Token",
    "sap/ui/core/routing/History",
    "com/demo/productcatalog/model/formatter",
    "com/demo/productcatalog/utils/ApiService"
], function (Controller, MessageBox, MessageToast, Token, History, formatter, ApiService) {
    "use strict";

    return Controller.extend("com.demo.productcatalog.controller.ProductDetail", {

        // Expose formatter for XML view bindings
        formatter: formatter,

        // Holds the current product ID while this view is active
        _sCurrentProductId: null,

        // ================================================================
        // LIFECYCLE HOOKS
        // ================================================================

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();

            // Attach to both "productDetail" and "productEdit" pattern matches.
            // The productEdit route also shows this detail view initially before
            // redirecting to the form, but in this architecture we only need
            // the productDetail route here.
            oRouter.getRoute("productDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        // ================================================================
        // ROUTING
        // ================================================================

        /**
         * Called every time the URL matches the productDetail pattern.
         * Extracts the productId from the URL, finds the product in the model array,
         * and binds the view to that product using element binding.
         *
         * Element binding (bindElement) is a SAPUI5 pattern that sets the binding
         * context of the entire view to a specific path in a model, so all relative
         * bindings in the view (e.g. {products>ProductName}) automatically resolve
         * against that product object.
         *
         * @param {sap.ui.base.Event} oEvent - Router pattern matched event
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var sProductId = oEvent.getParameter("arguments").productId;
            this._sCurrentProductId = sProductId;

            var iIndex = this._findProductIndex(sProductId);
            if (iIndex === -1) {
                MessageBox.error("Product with ID \"" + sProductId + "\" could not be found.", {
                    title: "Product Not Found",
                    onClose: function () {
                        this.onNavBack();
                    }.bind(this)
                });
                return;
            }

            // Bind the view to the specific product in the array
            // Path format: /products/INDEX — this is the JSON model array path
            this.getView().bindElement({
                path: "/products/" + iIndex,
                model: "products"
            });

            // After binding, render the tags
            this._renderTags(iIndex);
        },

        /**
         * Searches the products array for the product with the given ID.
         * Returns the array index or -1 if not found.
         * @param {string} sProductId - Product ID to search for
         * @returns {number} Array index or -1
         * @private
         */
        _findProductIndex: function (sProductId) {
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var aProducts = oProductsModel.getData().products || [];
            for (var i = 0; i < aProducts.length; i++) {
                if (aProducts[i].ProductID === sProductId) {
                    return i;
                }
            }
            return -1;
        },

        /**
         * Renders Tag tokens into the tagsContainer FlexBox.
         * Tags are stored as a JSON array in the product, so they can't be
         * directly bound via aggregation binding without a factory — instead
         * we create Token controls programmatically.
         * @param {number} iIndex - Product index in the array
         * @private
         */
        _renderTags: function (iIndex) {
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var aProducts = oProductsModel.getData().products || [];
            var oProduct = aProducts[iIndex];
            var oTagsContainer = this.byId("tagsContainer");

            if (!oTagsContainer || !oProduct) { return; }

            // Clear previous tokens
            oTagsContainer.removeAllItems();

            var aTags = oProduct.Tags || [];
            aTags.forEach(function (sTag) {
                var oToken = new Token({
                    text: sTag,
                    editable: false
                });
                oTagsContainer.addItem(oToken);
            });
        },

        // ================================================================
        // ACTION HANDLERS
        // ================================================================

        /**
         * Navigate to the product edit form with the current product ID.
         */
        onEditProduct: function () {
            if (this._sCurrentProductId) {
                this.getOwnerComponent().getRouter().navTo("productEdit", {
                    productId: this._sCurrentProductId
                });
            }
        },

        /**
         * Show delete confirmation dialog. On confirm, remove the product from
         * the model and navigate back to the product list.
         */
        onDeleteProduct: function () {
            var sProductId = this._sCurrentProductId;
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var iIndex = this._findProductIndex(sProductId);
            if (iIndex === -1) { return; }

            var sProductName = oProductsModel.getData().products[iIndex].ProductName;
            var that = this;

            MessageBox.confirm(
                "Are you sure you want to delete \"" + sProductName + "\"? This action cannot be undone.",
                {
                    title: "Confirm Delete",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            ApiService.deleteProduct(sProductId)
                                .then(function () {
                                    // Remove from in-memory model so other views reflect the change
                                    var aProducts = oProductsModel.getData().products;
                                    aProducts.splice(iIndex, 1);
                                    oProductsModel.setProperty("/products", aProducts);
                                    MessageToast.show("Product \"" + sProductName + "\" deleted successfully.");
                                    that.getOwnerComponent().getRouter().navTo("productList");
                                })
                                .catch(function (err) {
                                    MessageBox.error("Could not delete product: " + err.message);
                                });
                        }
                    }
                }
            );
        },

        /**
         * Navigate back using the browser history if available, otherwise go to productList.
         * Uses sap.ui.core.routing.History to check if a back navigation is possible.
         */
        onNavBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();

            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("productList", {}, true);
            }
        },

        /**
         * Expands all accordion panels in the detail view.
         */
        onExpandAll: function () {
            ["generalInfoPanel", "pricingPanel", "descriptionPanel", "physicalPanel"].forEach(function (sId) {
                var oPanel = this.byId(sId);
                if (oPanel) { oPanel.setExpanded(true); }
            }, this);
        },

        /**
         * Collapses all accordion panels in the detail view.
         */
        onCollapseAll: function () {
            ["generalInfoPanel", "pricingPanel", "descriptionPanel", "physicalPanel"].forEach(function (sId) {
                var oPanel = this.byId(sId);
                if (oPanel) { oPanel.setExpanded(false); }
            }, this);
        }

    });
});
