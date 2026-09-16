const prisma = require("../config/prisma");
const TransactionHelper = require("../services/TransactionHelper");

exports.resolveTaxPreview = async (req, res) => {
  try {
    const { businessId, id: userId } = req.user;
    const { items, customerId, discount, currency, transactionDate } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ success: false, message: "items array is required" });
    }

    // We use a completely detached interactive transaction that we intentionally rollback
    // OR we can just pass the regular prisma client because TransactionHelper doesn't actually save unless saveTaxLedger is called.
    // Wait, processTransactionFinancials has NO database side-effects (it just reads). 
    // It returns the taxTransactions array without inserting them.
    
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
