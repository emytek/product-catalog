sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "sap/ui/model/json/JSONModel",
    "com/ardova/tradecard/model/models"
], function (UIComponent, Device, JSONModel, models) {
    "use strict";

    return UIComponent.extend("com.ardova.tradecard.Component", {

        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);

            // Device model for responsive layout
            this.setModel(models.createDeviceModel(), "device");

            // Trade Card data model — initialised with empty structure
            // Populated by TradeCard.controller.js on route match
            var oTradeCardModel = new JSONModel(models.createTradeCardModel());
            this.setModel(oTradeCardModel, "tradeCard");

            this.getRouter().initialize();
        },

        getContentDensityClass: function () {
            if (!this._sContentDensityClass) {
                this._sContentDensityClass = Device.support.touch
                    ? "sapUiSizeCozy"
                    : "sapUiSizeCompact";
            }
            return this._sContentDensityClass;
        }
    });
});
