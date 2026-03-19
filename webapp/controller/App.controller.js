sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    /**
     * App Controller
     * This is the root controller for the App.view.xml shell.
     * It contains no special logic because all navigation is handled
     * by the SAPUI5 Router defined in manifest.json.
     * The Router reads the URL hash and renders the appropriate
     * target view into the NavContainer defined in App.view.xml.
     */
    return Controller.extend("com.demo.productcatalog.controller.App", {

        onInit: function () {
            // The App controller intentionally has no init logic.
            // The router is initialized in Component.js via this.getRouter().initialize().
            // Apply content density class to the root view for responsive layout.
            this.getView().addStyleClass(
                this.getOwnerComponent().getContentDensityClass()
            );
        }

    });
});
