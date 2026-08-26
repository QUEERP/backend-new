const express = require("express");
const router = express.Router();
const statutoryController = require("../controllers/statutoryController");
const auth = require("../middlewares/authMiddleware");
const businessMiddleware = require("../middlewares/business.middleware");

// Get statutory dashboard summary
router.get("/dashboard", auth, businessMiddleware, statutoryController.getDashboardSummary);

// List available statutory reports based on tax framework
router.get("/list", auth, businessMiddleware, statutoryController.listAvailableReports);

// Generate a specific statutory report
router.get("/generate/:reportCode", auth, businessMiddleware, statutoryController.generateStatutoryReport);

// Export a specific statutory report
const TaxExportController = require("../controllers/taxStatutoryExportController");
router.get("/generate/:reportCode/export/:format", auth, businessMiddleware, TaxExportController.exportStatutoryReport);

module.exports = router;
