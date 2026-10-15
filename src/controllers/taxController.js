const prisma = require("../config/prisma");
const TransactionHelper = require("../services/TransactionHelper");
const { determineSupplyType } = require("../services/tax/supplyTypeEngine");
const { GST_STATES, resolveGstState } = require("../services/tax/gstConfig");

exports.resolveTaxPreview = async (req, res) => {
  try {
    const { businessId, id: userId } = req.user;
    const { items, customerId, discount, currency, transactionDate } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items array is required" });
    }

    const financials = await TransactionHelper.processTransactionFinancials({
      businessId,
      transactionDate: transactionDate ? new Date(transactionDate) : new Date(),
      currencyCode: currency || "AED",
      items,
      customerId,
      globalDiscount: discount ? Number(discount) : 0,
      userId,
      txClient: prisma
    });

    res.status(200).json({
      success: true,
      data: financials
    });

  } catch (error) {
    console.error("Error in resolveTaxPreview:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to resolve taxes" });
  }
};

/**
 * GET /api/tax/supply-type
 * Single source of truth for determining supply type between business and customer.
 */
exports.getSupplyType = async (req, res) => {
  try {
    const businessId = req.businessId || req.user?.businessId;
    if (!businessId) {
      return res.status(400).json({ success: false, message: "Business context required" });
    }

    const business = await prisma.business.findUnique({
      where: { id: businessId }
    });
    if (!business) {
      return res.status(404).json({ success: false, message: "Business not found" });
    }

    const {
      customerId,
      buyerCountry,
      buyerState,
      shipToState,
      isGoods,
      isSez,
      sezType,
      exportType,
      docDate
    } = req.query;

    let customer = null;
    if (customerId) {
      customer = await prisma.customer.findFirst({
        where: { id: customerId, businessId }
      });
    }

    const effectiveBuyer = {
      country: buyerCountry || customer?.country || customer?.billingCountry || customer?.shippingCountry || customer?.region,
      billingCountry: buyerCountry || customer?.billingCountry || customer?.country,
      shippingCountry: customer?.shippingCountry || buyerCountry || customer?.country,
      state: buyerState || customer?.state || customer?.billingState,
      billingState: buyerState || customer?.billingState || customer?.state,
      shippingState: shipToState || customer?.shippingState || buyerState || customer?.state,
      gstNumber: customer?.vatNumber,
      isSez: isSez === 'true' || isSez === true || customer?.isSez,
      sezType: sezType || customer?.sezType
    };

    const resolution = determineSupplyType(business, effectiveBuyer, {
      shipTo: shipToState || customer?.shippingState,
      docDate: docDate ? new Date(docDate) : new Date(),
      isGoods: isGoods !== 'false',
      isSez: isSez === 'true' || isSez === true,
      sezType,
      exportType
    });

    return res.status(200).json({
      success: true,
      data: resolution
    });
  } catch (error) {
    console.error("Error in getSupplyType:", error);
    res.status(500).json({ success: false, message: error.message || "Failed to determine supply type" });
  }
};

/**
 * GET /api/tax/gst-states
 * Returns the statutory list of 36 Indian States and Union Territories with GST codes.
 */
exports.getGstStates = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      data: GST_STATES
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
