sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {

        /**
         * Creates a JSONModel pre-loaded with sap.ui.Device data.
         * This model is used throughout the app for responsive behavior:
         * - device>/system/phone — true on phones
         * - device>/system/tablet — true on tablets
         * - device>/system/desktop — true on desktops
         * - device>/support/touch — true if touch is supported
         * Binding to these paths lets views show/hide controls based on device type.
         * @returns {sap.ui.model.json.JSONModel} Device model
         */
        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        }
    };
});
