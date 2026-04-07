sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "com/ardova/tradecard/utils/ApiService"
], function (Controller, JSONModel, MessageBox, MessageToast, ApiService) {
    "use strict";

    return Controller.extend("com.ardova.tradecard.controller.TradeCard", {

        // ─────────────────────────────────────────────────────────────────
        // LIFECYCLE
        // ─────────────────────────────────────────────────────────────────

        onInit: function () {
            var oRouter = this.getOwnerComponent().getRouter();
            oRouter.getRoute("tradeCard").attachPatternMatched(this._onRouteMatched, this);

            // View state model: controls busy indicator, edit mode, dirty flag
            var oViewModel = new JSONModel({
                busy:     false,
                editMode: true,
                isDirty:  false
            });
            this.getView().setModel(oViewModel, "view");
        },

        _onRouteMatched: function () {
            // Initialise the tradeCard model with a clean structure
            // In a real scenario, this would load from the backend by ID
            var oModel = this.getOwnerComponent().getModel("tradeCard");
            if (!oModel.getProperty("/id")) {
                oModel.setData(this._getDefaultTradeCard());
            }
        },

        // ─────────────────────────────────────────────────────────────────
        // DEFAULT MODEL STRUCTURE
        // ─────────────────────────────────────────────────────────────────

        _getDefaultTradeCard: function () {
            return {
                // Document identification
                id: "LPG/2022/061",

                // ── General — Left ───────────────────────────────────────
                productCode:         "",
                tradeCode:           "",
                tradeDesc:           "",
                demandQtyMT:         "",
                tradePlannerRemark:  "",
                demandQtyLtrs:       "",

                // ── General — Right ──────────────────────────────────────
                status:               "",
                volumeToPurchase:     null,
                conversionFactor:     null,
                volumeToPurchaseLtrs: null,
                nnpcBPAValidity:      "",
                dprLicenceValidity:   "",
                supplierRegValidity:  "",
                pppraValidity:        "",

                // ── Trade Demands — single line item ─────────────────────
                tradeDemands: [{
                    tradeCategory:          "",
                    customerNo:             "",
                    customerName:           "",
                    quantityMT:             null,
                    quantityLtrs:           null,
                    poPrice:                null,
                    pointOfDelivery:        "",
                    qualitySpec:            "",
                    quantityDetermination:  "",
                    acceptanceDate:         "",
                    scannedPO:              "",
                    scannedPOUrl:           "",
                    deliveryMode:           "",
                    transactionType:        "",
                    thirdPartyVendorNo:     "",
                    financeArrangement:     null,
                    commission:             null,
                    profitSharing:          null
                }],

                // ── Supplies Contract — Left: Sourcing ───────────────────
                sourcingType:            "",
                qualityCostPct:          null,
                fxRateInterbank:         null,
                fxRateParallel:          null,
                premiumInsurance:        null,
                bankCommonRate:          null,
                confirmationChargesPct:  null,

                // ── Supplies Contract — Left: Product Cost Estimate ──────
                prodPriceIcePlat:        null,
                prodPricePremium:        null,
                proposedCostFXRate:      null,
                totalProductCostUSD:     null,
                coastalMarginPct:        null,
                coastalMarginCost:       null,

                // ── Supplies Contract — Left: Import ─────────────────────
                tradePriceReference:     "",
                tradePrice:              "",
                premiumDiscount:         null,
                addRollover:             false,
                priceMonth:              "",
                tradePricingPeriod:      "",
                paymentMode:             "",
                incoterm:                "",

                // ── Supplies Contract — Right: Contract SPA/SQ ───────────
                supplierCode:            "",
                supplierName:            "",
                creditTerm:              "",
                supplierContractRef:     "",
                contractQty:             null,
                tolerance:               null,
                tradePricingContract:    "",
                currencyOfTransaction:   "USD",
                loadPort:                "",
                laycanStartDate:         null,
                laycanEndDate:           null,
                laytime:                 "",
                demurrageRate:           "",
                stsCostPct:              null,
                inspectionFees:          null,
                sendForOperation:        false,

                // ── Operations Logistics Budget ──────────────────────────
                opsLogistics: {
                    freightVendor: "", freightVendorName: "", freightCostFXRate: null,
                    estimatedFreightDays: null, estDailyFreightCostUSD: null,
                    freightTotalCost: null, freightTotalCostNGN: null,
                    estLaycanStartDate: null, estLaycanEndDate: null,
                    estLaycanDurationHRS: null, estDemurrageDays: null,
                    demurrageFXRate: null, estDemurrageDailyCostUSD: null, totalDemurrageCostNGN: null,
                    bunkerCostUSD: null, bunkerCostNGN: null,
                    premiumCostUSD: null, premiumCostNGN: null,
                    agenciesVendorLoad: "", agenciesVendorNameLoad: "",
                    agenciesCostLoadFXRate: null, agenciesCostLoadUSD: null,
                    agenciesLoadNGNLeg: null, agenciesLoadTotal: null,
                    agencyVendorDischarge: "", agencyVendorNameDischarge: "",
                    agenciesCostDiscUSD: null, agenciesCostDiscFXRate: null,
                    agenciesDiscTotal: null, agenciesDiscNGNLeg: null,
                    storageVendor: "", storageVendorName: "", storageRatePerLtr: null,
                    tradeFinancingExpanded: true, spaAllocation: "", proformaInvoice: "",
                    formMExists: false, lcBCExists: false,
                    insuranceVendor: "", insuranceVendorName: "", insuranceCost: null,
                    jettyDepotVendor: "", jettyVendorName: "",
                    jettyDepotCostUSD: null, jettyDepotCostFXRate: null, jettyDepotCost: null,
                    loadPortSurveyor: "", loadPortSurveyorName: "", loadPortSurveyorCostNGN: null,
                    disPortSurveyor: "", disPortSurveyorName: "", totalSurveyingCost: null,
                    stsFenderingVendorName: "", stsFenderingCostUSD: null, stsFenderingCostFXRate: null,
                    loadPortQualityVendor: "", loadPortQualityVendorName: "", loadPortQualityCost: null,
                    disPortQualityVendor: "", disPortQualityVendorName: "",
                    disPortQualityCostNGN: null, totalQualityCost: null,
                    dprCostNGN: null, dprLicencesPermitsValidity: "",
                    pefCost: null, pefChargesPerLtrNGN: null, totalPEFChargesNGN: null,
                    pppraCharges: null, totalPPPRAChargesNGN: null, bridgingMTACostNGN: null,
                    dischargeLogisticsCostNGN: null, badgeFenderingCost: null,
                    unionDuePerLtr: null, unionDuesCostNGN: null,
                    otherOpCostDesc: "", otherOpCostAmount: null,
                    totalLogisticsCost: null, sendToFinance: false
                }
            };
        },

        // ─────────────────────────────────────────────────────────────────
        // TRADE DEMANDS — CONDITIONAL CUSTOMER NAME LOGIC
        // Expression binding handles the enabled state in XML.
        // This handler fires on Trade Category change to clear the
        // Customer Name value when Open Market is selected.
        // ─────────────────────────────────────────────────────────────────

        onTradeCategoryChange: function (oEvent) {
            var sKey = oEvent.getSource().getSelectedKey();
            var oModel = this.getView().getModel("tradeCard");

            if (sKey !== "CONFIRMED_ORDER") {
                // Clear Customer Name when category is not Confirmed Order
                oModel.setProperty("/tradeDemands/0/customerName", "");
            }

            this._setDirty(true);
        },

        // ─────────────────────────────────────────────────────────────────
        // CONVERSION FACTOR — Auto-calculate Volume to Purchase (Ltrs)
        // ─────────────────────────────────────────────────────────────────

        onConversionFactorChange: function () {
            var oModel   = this.getView().getModel("tradeCard");
            var fVolMT   = parseFloat(oModel.getProperty("/volumeToPurchase")) || 0;
            var fFactor  = parseFloat(oModel.getProperty("/conversionFactor"))  || 0;

            if (fVolMT > 0 && fFactor > 0) {
                oModel.setProperty("/volumeToPurchaseLtrs", (fVolMT * fFactor).toFixed(2));
            }
            this._setDirty(true);
        },

        // ─────────────────────────────────────────────────────────────────
        // GENERIC FIELD CHANGE
        // ─────────────────────────────────────────────────────────────────

        onFieldChange: function () {
            this._setDirty(true);
        },

        // ─────────────────────────────────────────────────────────────────
        // SEND TO FINANCE TOGGLE — confirmation guard
        // ─────────────────────────────────────────────────────────────────

        onSendToFinanceChange: function (oEvent) {
            var bState  = oEvent.getParameter("state");
            var oSource = oEvent.getSource();

            if (bState) {
                MessageBox.confirm(
                    "Sending to Finance will lock the Logistics Budget for editing.\n\nProceed?",
                    {
                        title: "Send to Finance",
                        onClose: function (sAction) {
                            if (sAction !== MessageBox.Action.OK) {
                                // Revert toggle if user cancels
                                oSource.setState(false);
                                this.getView().getModel("tradeCard")
                                    .setProperty("/opsLogistics/sendToFinance", false);
                            } else {
                                MessageToast.show("Logistics Budget sent to Finance.");
                            }
                        }.bind(this)
                    }
                );
            }
            this._setDirty(true);
        },

        onStatusChange: function (oEvent) {
            var sStatus = oEvent.getSource().getSelectedKey();
            this._validateStatus(sStatus);
            this._setDirty(true);
        },

        // ─────────────────────────────────────────────────────────────────
        // TAB SELECTION (inactive tabs show an informational toast)
        // ─────────────────────────────────────────────────────────────────

        onTabSelect: function (oEvent) {
            var sKey = oEvent.getParameter("key");
            if (sKey !== "process") {
                MessageToast.show("This section will be available in a future release.");
                this.byId("tcTabBar").setSelectedKey("process");
            }
        },

        // ─────────────────────────────────────────────────────────────────
        // HEADER ACTIONS
        // ─────────────────────────────────────────────────────────────────

        onEdit: function () {
            MessageToast.show("Edit mode active.");
        },

        onPrint: function () {
            MessageToast.show("Preparing print view…");
        },

        onShare: function () {
            MessageToast.show("Share functionality coming soon.");
        },

        // ─────────────────────────────────────────────────────────────────
        // FOOTER: SAVE
        // ─────────────────────────────────────────────────────────────────

        onSave: function () {
            var aErrors = this._validate();
            if (aErrors.length > 0) {
                MessageBox.error(
                    "Please correct the following before saving:\n\n" + aErrors.join("\n"),
                    { title: "Validation Error" }
                );
                return;
            }

            this._setBusy(true);
            var oPayload = this.getView().getModel("tradeCard").getData();

            ApiService.saveTradeCard(oPayload)
                .then(function () {
                    MessageToast.show("Trade Card saved successfully.");
                    this._setDirty(false);
                }.bind(this))
                .catch(function (oErr) {
                    MessageBox.error(
                        "Failed to save Trade Card: " + (oErr.message || "Unknown error"),
                        { title: "Save Error" }
                    );
                })
                .finally(function () {
                    this._setBusy(false);
                }.bind(this));
        },

        // ─────────────────────────────────────────────────────────────────
        // FOOTER: CANCEL
        // ─────────────────────────────────────────────────────────────────

        onCancel: function () {
            var bDirty = this.getView().getModel("view").getProperty("/isDirty");
            if (bDirty) {
                MessageBox.confirm(
                    "You have unsaved changes. Are you sure you want to cancel?",
                    {
                        title:   "Unsaved Changes",
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.OK) {
                                this._resetForm();
                            }
                        }.bind(this)
                    }
                );
            } else {
                MessageToast.show("No changes to discard.");
            }
        },

        // ─────────────────────────────────────────────────────────────────
        // VALIDATION
        // ─────────────────────────────────────────────────────────────────

        _validate: function () {
            var oModel = this.getView().getModel("tradeCard");
            var aErrors = [];

            if (!oModel.getProperty("/productCode")) {
                aErrors.push("• Product Code is required.");
            }
            if (!oModel.getProperty("/tradeCode")) {
                aErrors.push("• Trade Code is required.");
            }
            if (!oModel.getProperty("/status")) {
                aErrors.push("• Status is required.");
            }
            if (!oModel.getProperty("/sourcingType")) {
                aErrors.push("• Sourcing Type is required.");
            }

            // Trade Demands row validation
            var sTradeCat = oModel.getProperty("/tradeDemands/0/tradeCategory");
            if (!sTradeCat) {
                aErrors.push("• Trade Category is required in Trade Demands.");
            }
            if (sTradeCat === "CONFIRMED_ORDER" && !oModel.getProperty("/tradeDemands/0/customerName")) {
                aErrors.push("• Customer Name is required for Confirmed Order.");
            }

            // Laycan date range validation
            var sStart = oModel.getProperty("/laycanStartDate");
            var sEnd   = oModel.getProperty("/laycanEndDate");
            if (sStart && sEnd && new Date(sStart) > new Date(sEnd)) {
                aErrors.push("• Laycan End Date must be after Laycan Start Date.");
            }

            return aErrors;
        },

        _validateStatus: function (sStatus) {
            // Placeholder for business rule enforcement on status transitions.
            // e.g. APPROVED requires an approver action, not manual selection.
            if (sStatus === "APPROVED") {
                MessageToast.show("Note: Status 'Approved' is set via the approval workflow.");
            }
        },

        // ─────────────────────────────────────────────────────────────────
        // HELPERS
        // ─────────────────────────────────────────────────────────────────

        _setDirty: function (bDirty) {
            this.getView().getModel("view").setProperty("/isDirty", bDirty);
        },

        _setBusy: function (bBusy) {
            this.getView().getModel("view").setProperty("/busy", bBusy);
        },

        _resetForm: function () {
            var oModel = this.getOwnerComponent().getModel("tradeCard");
            oModel.setData(this._getDefaultTradeCard());
            this._setDirty(false);
            MessageToast.show("Form reset.");
        }

    });
});
