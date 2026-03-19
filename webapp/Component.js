sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel",
    "com/demo/productcatalog/model/models",
    "com/demo/productcatalog/utils/ApiService"
], function (UIComponent, Device, JSONModel, models, ApiService) {
    "use strict";

    return UIComponent.extend("com.demo.productcatalog.Component", {

        metadata: {
            manifest: "json"
        },

        init: function () {
            // Call the base component's init function
            UIComponent.prototype.init.apply(this, arguments);

            // Set the device model
            this.setModel(models.createDeviceModel(), "device");

            // ── Products model: load from backend API ──────────────────────
            // We create an empty JSONModel first so the router can initialise
            // immediately, then populate it asynchronously from the backend.
            // A fallback to the local mock file is used if the API is unreachable
            // (e.g. during pure-frontend development without the backend running).
            var oProductsModel = new JSONModel({ products: [] });
            this.setModel(oProductsModel, "products");

            ApiService.getCatalog()
                .then(function (oData) {
                    // oData = { products: [...] } — exact same shape as products.json
                    oProductsModel.setData(oData);
                    oProductsModel.fireRequestCompleted();
                })
                .catch(function () {
                    // Backend unavailable — fall back to local mock data
                    oProductsModel.loadData(
                        sap.ui.require.toUrl(
                            "com/demo/productcatalog/localService/mockdata/products.json"
                        )
                    );
                });

            // Initialize the router — this causes SAPUI5 to parse the URL
            // and navigate to the matched route target view
            this.getRouter().initialize();
        },

        /**
         * Returns the content density CSS class to apply to the root view.
         * On desktop browsers, compact mode is used (smaller paddings/fonts).
         * On touch devices (tablet/phone), cozy mode is used (larger tap targets).
         * @returns {string} CSS class name
         */
        getContentDensityClass: function () {
            if (!this._sContentDensityClass) {
                if (!Device.support.touch) {
                    this._sContentDensityClass = "sapUiSizeCompact";
                } else {
                    this._sContentDensityClass = "sapUiSizeCozy";
                }
            }
            return this._sContentDensityClass;
        }
    });
});
