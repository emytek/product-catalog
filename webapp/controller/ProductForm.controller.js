sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Token",
    "sap/ui/core/routing/History",
    "com/demo/productcatalog/model/formatter",
    "com/demo/productcatalog/utils/ApiService"
], function (Controller, JSONModel, MessageBox, MessageToast, Token, History, formatter, ApiService) {
    "use strict";

    return Controller.extend("com.demo.productcatalog.controller.ProductForm", {

        formatter: formatter,

        // Tracks whether this is create (false) or edit (true) mode
        _bIsEdit: false,
        // The product ID being edited (null in create mode)
        _sEditProductId: null,
        // Tracks whether the user has made changes (for dirty-check on cancel)
        _bIsDirty: false,
        // Original form data snapshot for dirty detection
        _oOriginalData: null,

        // ================================================================
        // LIFECYCLE HOOKS
        // ================================================================

        onInit: function () {
            // Create the view model for form state and data
            var oViewModel = new JSONModel({
                isEdit: false,
                title: "Create New Product",
                saveButtonText: "Create Product",
                formData: this._getEmptyProduct()
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Attach to both the create and edit route patterns
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("productForm").attachPatternMatched(this._onRouteMatched, this);
            oRouter.getRoute("productEdit").attachPatternMatched(this._onRouteMatched, this);
        },

        // ================================================================
        // ROUTING
        // ================================================================

        /**
         * Called when either the "productForm" (create) or "productEdit" (edit) route matches.
         * Determines mode from the route name:
         *   - "productForm" → create mode: empty form, title "Create New Product"
         *   - "productEdit" → edit mode: pre-filled form, title "Edit Product: <name>"
         * @param {sap.ui.base.Event} oEvent - Router pattern matched event
         * @private
         */
        _onRouteMatched: function (oEvent) {
            var sRouteName = oEvent.getParameter("name");
            var oArgs = oEvent.getParameter("arguments");

            this._bIsDirty = false;
            this._clearValidationStates();

            // Reset the MultiInput tokens
            var oTagsInput = this.byId("tagsInput");
            if (oTagsInput) {
                oTagsInput.removeAllTokens();
            }

            if (sRouteName === "productEdit" && oArgs.productId) {
                this._bIsEdit = true;
                this._sEditProductId = oArgs.productId;
                this._loadProductData(oArgs.productId);
            } else {
                this._bIsEdit = false;
                this._sEditProductId = null;
                this._initFormModel();
            }
        },

        /**
         * Initializes the form with an empty product for create mode.
         * @private
         */
        _initFormModel: function () {
            var oEmptyProduct = this._getEmptyProduct();
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isEdit", false);
            oViewModel.setProperty("/title", "Create New Product");
            oViewModel.setProperty("/saveButtonText", "Create Product");
            oViewModel.setProperty("/formData", oEmptyProduct);
            this._oOriginalData = JSON.stringify(oEmptyProduct);
        },

        /**
         * Loads an existing product into the form for edit mode.
         * Makes a deep copy so edits don't immediately affect the source model.
         * @param {string} sProductId - Product ID to load
         * @private
         */
        _loadProductData: function (sProductId) {
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var aProducts = oProductsModel.getData().products || [];
            var oProduct = aProducts.find(function (p) { return p.ProductID === sProductId; });

            if (!oProduct) {
                MessageBox.error("Product not found: " + sProductId);
                return;
            }

            // Deep copy the product so we don't mutate the source array
            var oFormData = JSON.parse(JSON.stringify(oProduct));
            this._oOriginalData = JSON.stringify(oFormData);

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/isEdit", true);
            oViewModel.setProperty("/title", "Edit Product: " + oProduct.ProductName);
            oViewModel.setProperty("/saveButtonText", "Save Changes");
            oViewModel.setProperty("/formData", oFormData);

            // Populate MultiInput tokens for tags
            var oTagsInput = this.byId("tagsInput");
            if (oTagsInput && oFormData.Tags) {
                oTagsInput.removeAllTokens();
                oFormData.Tags.forEach(function (sTag) {
                    oTagsInput.addToken(new Token({ text: sTag, key: sTag }));
                });
            }
        },

        /**
         * Returns an empty product object with sensible defaults for create mode.
         * @returns {Object} Empty product
         * @private
         */
        _getEmptyProduct: function () {
            var sToday = new Date().toISOString().split("T")[0];
            return {
                ProductID: "",
                ProductName: "",
                Category: "",
                SubCategory: "",
                Description: "",
                Price: "",
                Currency: "USD",
                Stock: "",
                Unit: "EA",
                Rating: 0,
                RatingCount: 0,
                Status: "Active",
                Supplier: "",
                Tags: [],
                CreatedAt: sToday,
                ModifiedAt: sToday,
                Featured: false,
                Discount: 0,
                Weight: "",
                Dimensions: ""
            };
        },

        // ================================================================
        // FORM HANDLERS
        // ================================================================

        /**
         * Generates the next available ProductID in the sequence P001, P002, ...
         * Looks at existing product IDs to find the highest number and increments it.
         * @returns {string} New product ID e.g. "P026"
         * @private
         */
        _generateProductId: function () {
            var oProductsModel = this.getOwnerComponent().getModel("products");
            var aProducts = oProductsModel.getData().products || [];
            var iMax = 0;

            aProducts.forEach(function (p) {
                // Extract the numeric part after "P"
                var iNum = parseInt((p.ProductID || "").replace(/\D/g, ""), 10);
                if (!isNaN(iNum) && iNum > iMax) {
                    iMax = iNum;
                }
            });

            // Pad to 3 digits: P001, P026, P100
            var sNum = (iMax + 1).toString().padStart(3, "0");
            return "P" + sNum;
        },

        /**
         * Validates all required form fields.
         * Sets ValueState on invalid inputs to provide visual feedback.
         * Returns true if the form is valid, false otherwise.
         * @returns {boolean} Validation result
         * @private
         */
        _validateForm: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var oFormData = oViewModel.getProperty("/formData");
            var bValid = true;

            // Validate Product Name
            var oNameInput = this.byId("productNameInput");
            if (!oFormData.ProductName || !oFormData.ProductName.trim()) {
                if (oNameInput) {
                    oNameInput.setValueState("Error");
                    oNameInput.setValueStateText("Product Name is required.");
                }
                bValid = false;
            } else {
                if (oNameInput) { oNameInput.setValueState("None"); }
            }

            // Validate Category
            var oCategorySelect = this.byId("formCategorySelect");
            if (!oFormData.Category) {
                if (oCategorySelect) {
                    oCategorySelect.setValueState("Error");
                    oCategorySelect.setValueStateText("Please select a Category.");
                }
                bValid = false;
            } else {
                if (oCategorySelect) { oCategorySelect.setValueState("None"); }
            }

            // Validate Price
            var oPriceInput = this.byId("priceInput");
            var fPrice = parseFloat(oFormData.Price);
            if (!oFormData.Price || isNaN(fPrice) || fPrice < 0) {
                if (oPriceInput) {
                    oPriceInput.setValueState("Error");
                    oPriceInput.setValueStateText("Price is required and must be a valid positive number.");
                }
                bValid = false;
            } else {
                if (oPriceInput) { oPriceInput.setValueState("None"); }
            }

            // Validate Stock
            var oStockInput = this.byId("stockInput");
            var iStock = parseInt(oFormData.Stock, 10);
            if (oFormData.Stock === "" || oFormData.Stock === null || isNaN(iStock) || iStock < 0) {
                if (oStockInput) {
                    oStockInput.setValueState("Error");
                    oStockInput.setValueStateText("Stock is required and must be a non-negative number.");
                }
                bValid = false;
            } else {
                if (oStockInput) { oStockInput.setValueState("None"); }
            }

            return bValid;
        },

        /**
         * Clears all ValueState indicators on form inputs.
         * Called when the form is reset or the route is re-matched.
         * @private
         */
        _clearValidationStates: function () {
            var aInputIds = ["productNameInput", "formCategorySelect", "priceInput", "stockInput"];
            aInputIds.forEach(function (sId) {
                var oControl = this.byId(sId);
                if (oControl && oControl.setValueState) {
                    oControl.setValueState("None");
                    oControl.setValueStateText("");
                }
            }, this);
        },

        /**
         * Collects the current token values from the MultiInput tags field
         * and updates formData.Tags array in the view model.
         * @private
         */
        _collectTags: function () {
            var oTagsInput = this.byId("tagsInput");
            if (!oTagsInput) { return []; }
            return oTagsInput.getTokens().map(function (oToken) {
                return oToken.getText();
            });
        },

        // ================================================================
        // SAVE HANDLER
        // ================================================================

        /**
         * Main save handler for both create and edit modes.
         *
         * Flow:
         * 1. Collect tags from MultiInput into formData
         * 2. Validate required fields
         * 3a. CREATE: Generate a new ProductID, set timestamps, push to array
         * 3b. EDIT: Find existing product in array, merge updated fields
         * 4. Write updated array back to the products model
         * 5. Show success toast, navigate to detail or list
         */
        onSave: function () {
            // Step 1: Collect tags
            var oViewModel = this.getView().getModel("viewModel");
            var oFormData = oViewModel.getProperty("/formData");
            oFormData.Tags = this._collectTags();
            oViewModel.setProperty("/formData/Tags", oFormData.Tags);

            // Step 2: Validate
            if (!this._validateForm()) {
                MessageBox.error(
                    "Please fill in all required fields (marked with *) before saving.",
                    { title: "Validation Error" }
                );
                return;
            }

            var oProductsModel = this.getOwnerComponent().getModel("products");
            var aProducts = oProductsModel.getData().products || [];
            var sToday = new Date().toISOString().split("T")[0];

            var that = this;
            var oRouter = this.getOwnerComponent().getRouter();

            if (this._bIsEdit) {
                // ── EDIT MODE: PUT to API, then refresh the products model ──
                ApiService.updateProduct(oFormData.ProductID, oFormData)
                    .then(function (oUpdated) {
                        // Sync the in-memory products model so other views stay current
                        var iIndex = aProducts.findIndex(function (p) {
                            return p.ProductID === oUpdated.ProductID;
                        });
                        if (iIndex !== -1) {
                            Object.assign(aProducts[iIndex], oUpdated);
                            oProductsModel.setProperty("/products", aProducts);
                        }
                        MessageToast.show("Product \"" + oUpdated.ProductName + "\" updated successfully.");
                        that._bIsDirty = false;
                        oRouter.navTo("productDetail", { productId: oUpdated.ProductID });
                    })
                    .catch(function (err) {
                        MessageBox.error("Could not update product: " + err.message);
                    });

            } else {
                // ── CREATE MODE: POST to API, then add to the products model ──
                var oPayload = Object.assign({}, oFormData, {
                    Price:    parseFloat(oFormData.Price)    || 0,
                    Stock:    parseInt(oFormData.Stock, 10)  || 0,
                    Discount: parseInt(oFormData.Discount, 10) || 0,
                    Rating:    0,
                    RatingCount: 0
                });

                ApiService.createProduct(oPayload)
                    .then(function (oCreated) {
                        aProducts.push(oCreated);
                        oProductsModel.setProperty("/products", aProducts);
                        MessageToast.show("Product \"" + oCreated.ProductName + "\" created with ID " + oCreated.ProductID + ".");
                        that._bIsDirty = false;
                        oRouter.navTo("productDetail", { productId: oCreated.ProductID });
                    })
                    .catch(function (err) {
                        MessageBox.error("Could not create product: " + err.message);
                    });
            }
        },

        // ================================================================
        // CANCEL HANDLER
        // ================================================================

        /**
         * Cancel button handler.
         * If the form has unsaved changes (dirty), asks for confirmation.
         * Otherwise navigates back immediately.
         */
        onCancel: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var sCurrentData = JSON.stringify(oViewModel.getProperty("/formData"));
            var bHasChanges = (sCurrentData !== this._oOriginalData);

            if (bHasChanges) {
                var that = this;
                MessageBox.confirm(
                    "You have unsaved changes. Are you sure you want to leave? All changes will be lost.",
                    {
                        title: "Unsaved Changes",
                        actions: ["Leave", MessageBox.Action.CANCEL],
                        emphasizedAction: MessageBox.Action.CANCEL,
                        onClose: function (sAction) {
                            if (sAction === "Leave") {
                                that._navigateBack();
                            }
                        }
                    }
                );
            } else {
                this._navigateBack();
            }
        },

        /**
         * Navigate back: use browser history if available, else go to productList.
         * @private
         */
        _navigateBack: function () {
            var oHistory = History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("productList", {}, true);
            }
        },

        // ================================================================
        // FIELD EVENT HANDLERS
        // ================================================================

        /**
         * Called when a tag is submitted via the MultiInput's submit event.
         * Adds a new Token for the entered text.
         * @param {sap.ui.base.Event} oEvent - Submit event with value parameter
         */
        onAddTag: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue && sValue.trim()) {
                var oTagsInput = this.byId("tagsInput");
                oTagsInput.addToken(new Token({
                    text: sValue.trim(),
                    key: sValue.trim()
                }));
                oTagsInput.setValue(""); // Clear the input field after adding
            }
        },

        /**
         * Called when tokens are updated (added or removed via the X button).
         * @param {sap.ui.base.Event} oEvent - TokenUpdate event
         */
        onTokenUpdate: function (oEvent) {
            var sType = oEvent.getParameter("type");
            if (sType === "removed") {
                var aRemovedTokens = oEvent.getParameter("removedTokens");
                var oTagsInput = this.byId("tagsInput");
                aRemovedTokens.forEach(function (oToken) {
                    oTagsInput.removeToken(oToken);
                });
            }
            // Mark form as dirty when tags change
            this._bIsDirty = true;
        },

        /**
         * Called when the discount slider value changes.
         * Updates the viewModel so the "Current Discount" label refreshes.
         * @param {sap.ui.base.Event} oEvent - Slider change/liveChange event
         */
        onDiscountChange: function (oEvent) {
            var iValue = oEvent.getParameter("value");
            this.getView().getModel("viewModel").setProperty("/formData/Discount", iValue);
        },

        /**
         * Called when the category select changes — just marks the form dirty.
         */
        onCategoryChange: function () {
            this._bIsDirty = true;
        }

    });
});
