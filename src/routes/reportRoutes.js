const router = require("express").Router();

const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");

const Controller = require("../controllers/reportController");
const ExportController = require("../controllers/generalReportExportController");
const TaxExportController = require("../controllers/taxStatutoryExportController");
const CurrencyExportController = require("../controllers/currencyExportController");

//////////////////////////////////////////////////////
// TAX REPORTS
//////////////////////////////////////////////////////
router.get(
  "/tax/summary",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getTaxSummary
);

router.get(
  "/tax/transactions",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getTaxTransactions
);

router.get("/tax/summary/export/:format", auth, business, checkPermission("report", "read"), TaxExportController.exportTaxSummary);
router.get("/tax/transactions/export/:format", auth, business, checkPermission("report", "read"), TaxExportController.exportTaxTransactions);

//////////////////////////////////////////////////////
// CURRENCY REPORTS
//////////////////////////////////////////////////////
router.get(
  "/currency/usage",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getCurrencyUsage
);

router.get(
  "/currency/gain-loss",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getCurrencyGainLoss
);

router.get("/currency/transactions/export/:format", auth, business, checkPermission("report", "read"), CurrencyExportController.exportCurrencyTransactions);

//////////////////////////////////////////////////////
// PROFIT & LOSS
//////////////////////////////////////////////////////
router.get(
  "/",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getProfitLoss
);

router.get(
  "/stock-valuation",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getStockValuation
);

router.get(
  "/low-stock-alerts",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getLowStockAlerts
);

router.get(
  "/movement-summary",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getMovementSummary
);

router.get(
  "/balance-sheet",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getBalanceSheet
);

router.get(
  "/trial-balance",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getTrialBalance
);

router.get(
  "/general-ledger",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getGeneralLedger
);

router.get(
  "/cash-flow",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getCashFlow
);

router.get(
  "/accounts-receivable",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getAccountsReceivable
);

router.get(
  "/accounts-payable",
  auth,
  business,
  checkPermission("report", "read"),
  Controller.getAccountsPayable
);

// Exports
router.get("/balance-sheet/export/excel", auth, business, checkPermission("report", "read"), ExportController.exportBalanceSheetExcel);
router.get("/balance-sheet/export/pdf", auth, business, checkPermission("report", "read"), ExportController.exportBalanceSheetPDF);

router.get("/trial-balance/export/excel", auth, business, checkPermission("report", "read"), ExportController.exportTrialBalanceExcel);
router.get("/trial-balance/export/pdf", auth, business, checkPermission("report", "read"), ExportController.exportTrialBalancePDF);

router.get("/general-ledger/export/excel", auth, business, checkPermission("report", "read"), ExportController.exportGeneralLedgerExcel);
router.get("/general-ledger/export/pdf", auth, business, checkPermission("report", "read"), ExportController.exportGeneralLedgerPDF);

router.get("/profit-loss/export/excel", auth, business, checkPermission("report", "read"), ExportController.exportProfitLossExcel);
router.get("/profit-loss/export/pdf", auth, business, checkPermission("report", "read"), ExportController.exportProfitLossPDF);

module.exports = router;