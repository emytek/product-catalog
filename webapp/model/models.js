sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/ui/Device"
], function (JSONModel, Device) {
    "use strict";

    return {

        createDeviceModel: function () {
            var oModel = new JSONModel(Device);
            oModel.setDefaultBindingMode("OneWay");
            return oModel;
        },

        /**
         * Default empty Trade Card data structure.
         * Used by Component.js to initialise the tradeCard model before
         * the TradeCard controller loads and populates it on route match.
         * @returns {object} Trade Card model data
         */
        createTradeCardModel: function () {
            return {
                id: "LPG/2022/061",

                // General — Left
                productCode:         "",
                tradeCode:           "",
                tradeDesc:           "",
                demandQtyMT:         "",
                tradePlannerRemark:  "",
                demandQtyLtrs:       "",

                // General — Right
                status:               "",
                volumeToPurchase:     null,
                conversionFactor:     null,
                volumeToPurchaseLtrs: null,
                nnpcBPAValidity:      "",
                dprLicenceValidity:   "",
                supplierRegValidity:  "",
                pppraValidity:        "",

                // Trade Demands — single line item
                tradeDemands: [{
                    tradeCategory:         "",
                    customerNo:            "",
                    customerName:          "",
                    quantityMT:            null,
                    quantityLtrs:          null,
                    poPrice:               null,
                    pointOfDelivery:       "",
                    qualitySpec:           "",
                    quantityDetermination: "",
                    acceptanceDate:        "",
                    scannedPO:             "",
                    scannedPOUrl:          "",
                    deliveryMode:          "",
                    transactionType:       "",
                    thirdPartyVendorNo:    "",
                    financeArrangement:    null,
                    commission:            null,
                    profitSharing:         null
                }],

                // Supplies Contract — Left: Sourcing
                sourcingType:           "",
                qualityCostPct:         null,
                fxRateInterbank:        null,
                fxRateParallel:         null,
                premiumInsurance:       null,
                bankCommonRate:         null,
                confirmationChargesPct: null,

                // Supplies Contract — Left: Product Cost Estimate
                prodPriceIcePlat:    null,
                prodPricePremium:    null,
                proposedCostFXRate:  null,
                totalProductCostUSD: null,
                coastalMarginPct:    null,
                coastalMarginCost:   null,

                // Supplies Contract — Left: Import
                tradePriceReference: "",
                tradePrice:          "",
                premiumDiscount:     null,
                addRollover:         false,
                priceMonth:          "",
                tradePricingPeriod:  "",
                paymentMode:         "",
                incoterm:            "",

                // Supplies Contract — Right: Contract SPA/SQ
                supplierCode:          "",
                supplierName:          "",
                creditTerm:            "",
                supplierContractRef:   "",
                contractQty:           null,
                tolerance:             null,
                tradePricingContract:  "",
                currencyOfTransaction: "USD",
                loadPort:              "",
                laycanStartDate:       null,
                laycanEndDate:         null,
                laytime:               "",
                demurrageRate:         "",
                stsCostPct:            null,
                inspectionFees:        null,
                sendForOperation:      false,

                // ── Operations Logistics Budget ──────────────────────────
                opsLogistics: {
                    // Freight Cost
                    freightVendor:             "",
                    freightVendorName:         "",
                    freightCostFXRate:         null,
                    estimatedFreightDays:      null,
                    estDailyFreightCostUSD:    null,
                    freightTotalCost:          null,
                    freightTotalCostNGN:       null,
                    // Laycan & Demurrage
                    estLaycanStartDate:        null,
                    estLaycanEndDate:          null,
                    estLaycanDurationHRS:      null,
                    estDemurrageDays:          null,
                    demurrageFXRate:           null,
                    estDemurrageDailyCostUSD:  null,
                    totalDemurrageCostNGN:     null,
                    // Bunker
                    bunkerCostUSD:             null,
                    bunkerCostNGN:             null,
                    // Premium
                    premiumCostUSD:            null,
                    premiumCostNGN:            null,
                    // Agencies — Load Port
                    agenciesVendorLoad:        "",
                    agenciesVendorNameLoad:    "",
                    agenciesCostLoadFXRate:    null,
                    agenciesCostLoadUSD:       null,
                    agenciesLoadNGNLeg:        null,
                    agenciesLoadTotal:         null,
                    // Agencies — Discharge
                    agencyVendorDischarge:         "",
                    agencyVendorNameDischarge:     "",
                    agenciesCostDiscUSD:            null,
                    agenciesCostDiscFXRate:         null,
                    agenciesDiscTotal:              null,
                    agenciesDiscNGNLeg:             null,
                    // Storage
                    storageVendor:             "",
                    storageVendorName:         "",
                    storageRatePerLtr:         null,
                    // Trade Financing
                    tradeFinancingExpanded:    true,
                    spaAllocation:             "",
                    proformaInvoice:           "",
                    formMExists:               false,
                    lcBCExists:                false,
                    // Insurance
                    insuranceVendor:           "",
                    insuranceVendorName:       "",
                    insuranceCost:             null,
                    // Jetty Cost
                    jettyDepotVendor:          "",
                    jettyVendorName:           "",
                    jettyDepotCostUSD:         null,
                    jettyDepotCostFXRate:      null,
                    jettyDepotCost:            null,
                    // Surveyor Cost
                    loadPortSurveyor:          "",
                    loadPortSurveyorName:      "",
                    loadPortSurveyorCostNGN:   null,
                    disPortSurveyor:           "",
                    disPortSurveyorName:       "",
                    totalSurveyingCost:        null,
                    // STS/Fendering
                    stsFenderingVendorName:    "",
                    stsFenderingCostUSD:       null,
                    stsFenderingCostFXRate:    null,
                    // Quality Cost
                    loadPortQualityVendor:     "",
                    loadPortQualityVendorName: "",
                    loadPortQualityCost:       null,
                    disPortQualityVendor:      "",
                    disPortQualityVendorName:  "",
                    disPortQualityCostNGN:     null,
                    totalQualityCost:          null,
                    dprCostNGN:                null,
                    dprLicencesPermitsValidity:"",
                    pefCost:                   null,
                    pefChargesPerLtrNGN:       null,
                    totalPEFChargesNGN:        null,
                    // Distribution Margin
                    pppraCharges:              null,
                    totalPPPRAChargesNGN:      null,
                    bridgingMTACostNGN:        null,
                    // Other Costs
                    dischargeLogisticsCostNGN: null,
                    badgeFenderingCost:        null,
                    unionDuePerLtr:            null,
                    unionDuesCostNGN:          null,
                    otherOpCostDesc:           "",
                    otherOpCostAmount:         null,
                    totalLogisticsCost:        null,
                    sendToFinance:             false
                }
            };
        }
    };
});
