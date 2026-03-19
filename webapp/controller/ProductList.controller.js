sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "com/demo/productcatalog/model/formatter",
    "com/demo/productcatalog/utils/ApiService"
], function (Controller, JSONModel, MessageBox, MessageToast, ViewSettingsDialog, ViewSettingsItem, formatter, ApiService) {
    "use strict";

    return Controller.extend("com.demo.productcatalog.controller.ProductList", {

        // Expose formatter for XML view bindings
        formatter: formatter,

        // ================================================================
        // INTERNAL PAGINATION / FILTER STATE
        // ================================================================
        _iPageSize: 10,
        _iCurrentPage: 1,
        _sSearchQuery: "",
        _sFilterCategory: "",
        _sFilterStatus: "",
        _sSortBy: "ProductName",
        _bSortDesc: false,
        _aAllProducts: [],
        _aFilteredProducts: [],
        _oSortDialog: null,

        // ================================================================
        // LIFECYCLE HOOKS
        // ================================================================

        onInit: function () {
            // Create the view model that backs the list
            var oViewModel = new JSONModel({
                displayedProducts: [],
                currentPage: 1,
                totalPages: 1,
                totalCount: 0,
                startItem: 0,
                endItem: 0,
                hasNextPage: false,
                hasPrevPage: false,
                selectedCount: 0
            });
            this.getView().setModel(oViewModel, "viewModel");

            // Register for route matching so the list refreshes each time we navigate to it
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("productList").attachPatternMatched(this._onRouteMatched, this);
        },

        /**
         * Called every time the productList route URL pattern is matched.
         * This ensures the list always shows the latest data (e.g. after create/delete).
         * @private
         */
        _onRouteMatched: function () {
            var oProductsModel = this.getOwnerComponent().getModel("products");

            // If the model already has data, load immediately; otherwise wait
            var fnLoad = function () {
                var oData = oProductsModel.getData();
                if (oData && oData.products) {
                    this._aAllProducts = oData.products.map(function (p) {
                        // Return a shallow copy so we don't mutate the source model
                        return Object.assign({}, p);
                    });
                    // Reset filters and show page 1
                    this._applyFiltersAndSort();
                }
            }.bind(this);

            if (oProductsModel.getData() && oProductsModel.getData().products) {
                fnLoad();
            } else {
                oProductsModel.attachRequestCompleted(fnLoad);
            }
        },

        // ================================================================
        // FILTER, SEARCH, SORT ENGINE
        // ================================================================

        /**
         * Master filter+sort function.
         * Applies the current search query, category filter, and status filter
         * to _aAllProducts, then sorts the result, then calls _updatePage(1)
         * to show the first page of the filtered/sorted data.
         * @private
         */
        _applyFiltersAndSort: function () {
            var sSearch = this._sSearchQuery.toLowerCase().trim();
            var sCategory = this._sFilterCategory;
            var sStatus = this._sFilterStatus;

            // Step 1: Filter
            var aFiltered = this._aAllProducts.filter(function (oProduct) {
                // Multi-field text search: name, category, supplier, ID
                var bMatchSearch = !sSearch ||
                    (oProduct.ProductName && oProduct.ProductName.toLowerCase().indexOf(sSearch) !== -1) ||
                    (oProduct.Category && oProduct.Category.toLowerCase().indexOf(sSearch) !== -1) ||
                    (oProduct.Supplier && oProduct.Supplier.toLowerCase().indexOf(sSearch) !== -1) ||
                    (oProduct.ProductID && oProduct.ProductID.toLowerCase().indexOf(sSearch) !== -1) ||
                    (oProduct.SubCategory && oProduct.SubCategory.toLowerCase().indexOf(sSearch) !== -1);

                // Category filter: exact match
                var bMatchCategory = !sCategory || oProduct.Category === sCategory;

                // Status filter: exact match
                var bMatchStatus = !sStatus || oProduct.Status === sStatus;

                return bMatchSearch && bMatchCategory && bMatchStatus;
            });

            // Step 2: Sort
            var sSortBy = this._sSortBy;
            var bDesc = this._bSortDesc;

            aFiltered.sort(function (a, b) {
                var vA = a[sSortBy];
                var vB = b[sSortBy];

                // Numeric sort for Price, Stock, Rating
                if (sSortBy === "Price" || sSortBy === "Stock" || sSortBy === "Rating") {
                    vA = parseFloat(vA) || 0;
                    vB = parseFloat(vB) || 0;
                    return bDesc ? (vB - vA) : (vA - vB);
                }

                // Date sort for CreatedAt
                if (sSortBy === "CreatedAt") {
                    vA = new Date(vA).getTime() || 0;
                    vB = new Date(vB).getTime() || 0;
                    return bDesc ? (vB - vA) : (vA - vB);
                }

                // Default: string sort
                vA = (vA || "").toString().toLowerCase();
                vB = (vB || "").toString().toLowerCase();
                if (vA < vB) { return bDesc ? 1 : -1; }
                if (vA > vB) { return bDesc ? -1 : 1; }
                return 0;
            });

            this._aFilteredProducts = aFiltered;
            this._updatePage(1);
        },

        /**
         * Slices the filtered products array to produce the current page.
         * Adds a _rowIndex property to each item for display in the # column.
         * Updates all pagination state in the viewModel.
         *
         * Pagination algorithm:
         *   startIndex = (iPage - 1) * _iPageSize
         *   endIndex   = startIndex + _iPageSize
         *   displayed  = _aFilteredProducts.slice(startIndex, endIndex)
         *
         * @param {number} iPage - Target page number (1-based)
         * @private
         */
        _updatePage: function (iPage) {
            var iTotalCount = this._aFilteredProducts.length;
            var iTotalPages = Math.max(1, Math.ceil(iTotalCount / this._iPageSize));

            // Clamp page within valid bounds
            if (iPage < 1) { iPage = 1; }
            if (iPage > iTotalPages) { iPage = iTotalPages; }

            this._iCurrentPage = iPage;

            var iStartIndex = (iPage - 1) * this._iPageSize;
            var iEndIndex = Math.min(iStartIndex + this._iPageSize, iTotalCount);

            // Slice and annotate with 1-based row index
            var aDisplayed = this._aFilteredProducts.slice(iStartIndex, iEndIndex).map(function (oProduct, idx) {
                return Object.assign({}, oProduct, { _rowIndex: iStartIndex + idx + 1 });
            });

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/displayedProducts", aDisplayed);
            oViewModel.setProperty("/currentPage", iPage);
            oViewModel.setProperty("/totalPages", iTotalPages);
            oViewModel.setProperty("/totalCount", iTotalCount);
            oViewModel.setProperty("/startItem", iTotalCount === 0 ? 0 : iStartIndex + 1);
            oViewModel.setProperty("/endItem", iEndIndex);
            oViewModel.setProperty("/hasNextPage", iPage < iTotalPages);
            oViewModel.setProperty("/hasPrevPage", iPage > 1);
        },

        // ================================================================
        // SEARCH & FILTER HANDLERS
        // ================================================================

        /**
         * Handles live search input. Updates internal query and reapplies filters.
         * @param {sap.ui.base.Event} oEvent - SearchField liveChange/search event
         */
        onSearch: function (oEvent) {
            this._sSearchQuery = oEvent.getParameter("newValue") || oEvent.getParameter("query") || "";
            this._applyFiltersAndSort();
        },

        /**
         * Handles Category Select dropdown change.
         * @param {sap.ui.base.Event} oEvent - Select change event
         */
        onCategoryFilterChange: function (oEvent) {
            this._sFilterCategory = oEvent.getParameter("selectedItem").getKey();
            this._applyFiltersAndSort();
        },

        /**
         * Handles Status Select dropdown change.
         * @param {sap.ui.base.Event} oEvent - Select change event
         */
        onStatusFilterChange: function (oEvent) {
            this._sFilterStatus = oEvent.getParameter("selectedItem").getKey();
            this._applyFiltersAndSort();
        },

        /**
         * Opens the sort ViewSettingsDialog.
         * Creates it lazily on first call.
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onSortPress: function (oEvent) {
            if (!this._oSortDialog) {
                this._oSortDialog = new ViewSettingsDialog({
                    title: "Sort Products",
                    confirm: this.onSortConfirm.bind(this),
                    sortItems: [
                        new ViewSettingsItem({ key: "ProductName", text: "Product Name", selected: true }),
                        new ViewSettingsItem({ key: "Price", text: "Price" }),
                        new ViewSettingsItem({ key: "Stock", text: "Stock Quantity" }),
                        new ViewSettingsItem({ key: "Rating", text: "Rating" }),
                        new ViewSettingsItem({ key: "Category", text: "Category" }),
                        new ViewSettingsItem({ key: "CreatedAt", text: "Created Date" })
                    ]
                });
                // Ensure dialog is destroyed when the view is destroyed
                this.getView().addDependent(this._oSortDialog);
            }
            this._oSortDialog.open();
        },

        /**
         * Called when the user confirms the sort dialog selection.
         * Reads the selected sort key and order from the event parameters.
         * @param {sap.ui.base.Event} oEvent - ViewSettingsDialog confirm event
         */
        onSortConfirm: function (oEvent) {
            var mParams = oEvent.getParameters();
            if (mParams.sortItem) {
                this._sSortBy = mParams.sortItem.getKey();
            }
            this._bSortDesc = mParams.sortDescending || false;
            this._applyFiltersAndSort();
        },

        /**
         * Resets all filters, search query, and sort to defaults.
         */
        onResetFilters: function () {
            this._sSearchQuery = "";
            this._sFilterCategory = "";
            this._sFilterStatus = "";
            this._sSortBy = "ProductName";
            this._bSortDesc = false;

            // Reset UI controls
            var oSearchField = this.byId("searchField");
            if (oSearchField) { oSearchField.setValue(""); }

            var oCategorySelect = this.byId("categorySelect");
            if (oCategorySelect) { oCategorySelect.setSelectedKey(""); }

            var oStatusSelect = this.byId("statusSelect");
            if (oStatusSelect) { oStatusSelect.setSelectedKey(""); }

            this._applyFiltersAndSort();
            MessageToast.show("Filters cleared");
        },

        // ================================================================
        // PAGINATION HANDLERS
        // ================================================================

        /** Navigate to the first page. */
        onFirstPage: function () {
            if (this._iCurrentPage > 1) {
                this._updatePage(1);
            }
        },

        /** Navigate to the previous page. */
        onPrevPage: function () {
            if (this._iCurrentPage > 1) {
                this._updatePage(this._iCurrentPage - 1);
            }
        },

        /** Navigate to the next page. */
        onNextPage: function () {
            var iTotalPages = this.getView().getModel("viewModel").getProperty("/totalPages");
            if (this._iCurrentPage < iTotalPages) {
                this._updatePage(this._iCurrentPage + 1);
            }
        },

        /** Navigate to the last page. */
        onLastPage: function () {
            var iTotalPages = this.getView().getModel("viewModel").getProperty("/totalPages");
            if (this._iCurrentPage < iTotalPages) {
                this._updatePage(iTotalPages);
            }
        },

        // ================================================================
        // CRUD HANDLERS
        // ================================================================

        /**
         * Navigate to the product form for creating a new product.
         */
        onAddProduct: function () {
            this.getOwnerComponent().getRouter().navTo("productForm");
        },

        /**
         * Navigate back to the home page.
         */
        onNavHome: function () {
            this.getOwnerComponent().getRouter().navTo("home");
        },

        /**
         * Handle "Edit" button press on a table row.
         * Gets the ProductID from the binding context of the source button's
         * parent ColumnListItem.
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onEditProduct: function (oEvent) {
            var oButton = oEvent.getSource();
            // The button is inside a HBox inside a ColumnListItem — traverse parent chain
            var oListItem = oButton.getParent().getParent();
            var oContext = oListItem.getBindingContext("viewModel");
            if (oContext) {
                var sProductId = oContext.getProperty("ProductID");
                this.getOwnerComponent().getRouter().navTo("productEdit", {
                    productId: sProductId
                });
            }
        },

        /**
         * Handle "Delete" button press on a table row.
         * Shows a MessageBox.confirm, then removes the product from the model array.
         * @param {sap.ui.base.Event} oEvent - Button press event
         */
        onDeleteProduct: function (oEvent) {
            var oButton = oEvent.getSource();
            var oListItem = oButton.getParent().getParent();
            var oContext = oListItem.getBindingContext("viewModel");
            if (!oContext) { return; }

            var sProductId = oContext.getProperty("ProductID");
            var sProductName = oContext.getProperty("ProductName");

            var that = this;
            MessageBox.confirm(
                "Are you sure you want to delete \"" + sProductName + "\"? This action cannot be undone.",
                {
                    title: "Confirm Delete",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            that._deleteProduct(sProductId, sProductName);
                        }
                    }
                }
            );
        },

        /**
         * Removes a product from the underlying products model array and refreshes the list.
         * @param {string} sProductId - Product ID to remove
         * @param {string} sProductName - Product name for the toast message
         * @private
         */
        _deleteProduct: function (sProductId, sProductName) {
            var that = this;
            var oProductsModel = this.getOwnerComponent().getModel("products");

            ApiService.deleteProduct(sProductId)
                .then(function () {
                    var aProducts = oProductsModel.getData().products;
                    var iIndex = aProducts.findIndex(function (p) { return p.ProductID === sProductId; });
                    if (iIndex !== -1) {
                        aProducts.splice(iIndex, 1);
                        oProductsModel.setProperty("/products", aProducts);
                    }
                    that._aAllProducts = that._aAllProducts.filter(function (p) {
                        return p.ProductID !== sProductId;
                    });
                    that._applyFiltersAndSort();
                    MessageToast.show("Product \"" + sProductName + "\" deleted successfully.");
                })
                .catch(function (err) {
                    MessageBox.error("Could not delete product: " + err.message);
                });
        },

        /**
         * Navigate to the product detail view when a table row is pressed.
         * @param {sap.ui.base.Event} oEvent - ColumnListItem press event
         */
        onProductPress: function (oEvent) {
            var oItem = oEvent.getSource();
            var oContext = oItem.getBindingContext("viewModel");
            if (oContext) {
                var sProductId = oContext.getProperty("ProductID");
                this.getOwnerComponent().getRouter().navTo("productDetail", {
                    productId: sProductId
                });
            }
        },

        /**
         * Updates the selected item count in the view model.
         * Used to show/hide the "Delete Selected" button.
         */
        onSelectionChange: function () {
            var oTable = this.byId("productTable");
            var iSelected = oTable.getSelectedItems().length;
            this.getView().getModel("viewModel").setProperty("/selectedCount", iSelected);
        },

        /**
         * Delete all currently selected table rows after confirmation.
         */
        onDeleteSelected: function () {
            var oTable = this.byId("productTable");
            var aSelectedItems = oTable.getSelectedItems();
            if (!aSelectedItems.length) { return; }

            var iCount = aSelectedItems.length;
            var that = this;

            MessageBox.confirm(
                "Are you sure you want to delete " + iCount + " selected product(s)? This action cannot be undone.",
                {
                    title: "Delete Selected Products",
                    actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                    emphasizedAction: MessageBox.Action.NO,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.YES) {
                            var aIdsToDelete = aSelectedItems.map(function (oItem) {
                                return oItem.getBindingContext("viewModel").getProperty("ProductID");
                            });

                            ApiService.deleteManyProducts(aIdsToDelete)
                                .then(function () {
                                    var oProductsModel = that.getOwnerComponent().getModel("products");
                                    var aProducts = oProductsModel.getData().products;
                                    aIdsToDelete.forEach(function (sId) {
                                        var iIndex = aProducts.findIndex(function (p) { return p.ProductID === sId; });
                                        if (iIndex !== -1) { aProducts.splice(iIndex, 1); }
                                    });
                                    oProductsModel.setProperty("/products", aProducts);
                                    that._aAllProducts = that._aAllProducts.filter(function (p) {
                                        return aIdsToDelete.indexOf(p.ProductID) === -1;
                                    });
                                    that._applyFiltersAndSort();
                                    that.getView().getModel("viewModel").setProperty("/selectedCount", 0);
                                    MessageToast.show(iCount + " product(s) deleted successfully.");
                                })
                                .catch(function (err) {
                                    MessageBox.error("Could not delete products: " + err.message);
                                });
                        }
                    }
                }
            );
        }

    });
});
