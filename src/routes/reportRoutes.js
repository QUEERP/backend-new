const router = require("express").Router();

const auth = require("../middlewares/authMiddleware");
const business = require("../middlewares/business.middleware");
const checkPermission = require("../middlewares/checkPermission");

const Controller = require("../controllers/reportController");
const ExportController = require("../controllers/generalReportExportController");

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